import { verifyUnsubscribeToken, getEmailPreferences, updateEmailPreference } from "@/lib/emailTokens"
import { redirect } from "next/navigation"
import { SubmitButton } from "./SubmitButton"

export const dynamic = "force-dynamic"

interface PageProps {
  searchParams: {
    email?: string
    token?: string
    updated?: string
  }
}

// Server Action to update email preferences from the form
async function handleUpdatePreferences(formData: FormData) {
  "use server"
  const email = formData.get("email") as string
  const token = formData.get("token") as string
  
  if (!email || !token) {
    return
  }

  // Verify token is still valid before saving changes
  const verified = verifyUnsubscribeToken(token)
  if (!verified || verified.email.toLowerCase() !== email.toLowerCase()) {
    return redirect(`/email-preferences/unsubscribe?email=${encodeURIComponent(email)}&token=${token}&error=invalid`)
  }

  const optedInReaudit = formData.get("opted_in_reaudit") === "on"
  const optedInAudit = formData.get("opted_in_audit") === "on"
  const optedInMarketing = formData.get("opted_in_marketing") === "on"

  await updateEmailPreference(email, "reaudit", optedInReaudit)
  await updateEmailPreference(email, "audit_results", optedInAudit)
  await updateEmailPreference(email, "marketing", optedInMarketing)

  redirect(`/email-preferences/unsubscribe?email=${encodeURIComponent(email)}&token=${token}&updated=true`)
}

export default async function UnsubscribePage({ searchParams }: PageProps) {
  const { email, token, updated } = searchParams

  if (!email || !token) {
    return renderError("Invalid Request", "Missing required email or secure token parameters.")
  }

  // 1. Verify token
  const verified = verifyUnsubscribeToken(token)
  if (!verified || verified.email.toLowerCase() !== email.toLowerCase()) {
    return renderError(
      "Link Expired or Invalid",
      "This secure unsubscribe link has expired or is invalid. Unsubscribe tokens expire 24 hours after being sent."
    )
  }

  // 2. Perform one-click unsubscribe on load if it hasn't been updated yet
  let successMessage = ""
  if (!updated) {
    try {
      await updateEmailPreference(email, "reaudit", false)
      successMessage = "You've been successfully unsubscribed from re-audit pricing change emails."
    } catch (err) {
      console.error("[unsubscribe] Failed to automatically unsubscribe user:", err)
      return renderError("Database Error", "Failed to update your subscription preferences. Please try again.")
    }
  } else {
    successMessage = "Your email preferences have been successfully updated."
  }

  // 3. Fetch current preferences to display in the form
  const prefs = await getEmailPreferences(email)

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        {/* Success Header */}
        <div style={headerStyle}>
          <div style={iconContainerStyle}>✓</div>
          <h1 style={titleStyle}>Unsubscribed Successfully</h1>
          <p style={subtitleStyle}>{successMessage}</p>
        </div>

        <div style={dividerStyle} />

        {/* Informative Checklist */}
        <div style={infoBoxStyle}>
          <p style={infoTitleStyle}>What you&apos;ll continue to receive:</p>
          <ul style={listStyle}>
            <li style={listItemStyle}>
              <span style={checkIconStyle}>✓</span>
              <div>
                <strong>Immediate Audit Results</strong>
                <span style={listDescStyle}>Sent only right after you trigger a new audit report.</span>
              </div>
            </li>
          </ul>
        </div>

        <div style={dividerStyle} />

        {/* Preference Management Form */}
        <form action={handleUpdatePreferences} style={formStyle}>
          <input type="hidden" name="email" value={email} />
          <input type="hidden" name="token" value={token} />

          <h3 style={sectionTitleStyle}>Manage Subscription Preferences</h3>
          
          <label style={checkboxLabelStyle}>
            <input 
              type="checkbox" 
              name="opted_in_reaudit" 
              defaultChecked={prefs.opted_in_reaudit_emails} 
              style={checkboxStyle}
            />
            <div>
              <span style={checkboxTextTitleStyle}>Re-audit pricing alerts</span>
              <span style={checkboxTextDescStyle}>Get notified when tool prices change and recommend stack modifications.</span>
            </div>
          </label>

          <label style={checkboxLabelStyle}>
            <input 
              type="checkbox" 
              name="opted_in_audit" 
              defaultChecked={prefs.opted_in_audit_results} 
              style={checkboxStyle}
            />
            <div>
              <span style={checkboxTextTitleStyle}>Audit results</span>
              <span style={checkboxTextDescStyle}>Receive a PDF copy of audit results immediately upon submission.</span>
            </div>
          </label>

          <label style={checkboxLabelStyle}>
            <input 
              type="checkbox" 
              name="opted_in_marketing" 
              defaultChecked={prefs.opted_in_marketing} 
              style={checkboxStyle}
            />
            <div>
              <span style={checkboxTextTitleStyle}>Marketing and tips</span>
              <span style={checkboxTextDescStyle}>Stay updated with live AI spend optimization advice and product tips.</span>
            </div>
          </label>

          <SubmitButton style={submitButtonStyle} />
        </form>

        <p style={footerStyle}>
          Vantage Spend Optimization · Powered by <a href="https://credex.rocks" style={{color: "#00C853", textDecoration: "none"}}>Credex</a>
        </p>
      </div>
    </div>
  )
}

function renderError(title: string, desc: string) {
  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={headerStyle}>
          <div style={errorIconContainerStyle}>!</div>
          <h1 style={titleStyle}>{title}</h1>
          <p style={subtitleStyle}>{desc}</p>
        </div>
        <div style={dividerStyle} />
        <div style={{ textAlign: "center", marginTop: "24px" }}>
          <a href="/" style={homeButtonStyle}>Go to Homepage</a>
        </div>
        <p style={footerStyle}>
          Vantage Spend Optimization · Powered by <a href="https://credex.rocks" style={{color: "#00C853", textDecoration: "none"}}>Credex</a>
        </p>
      </div>
    </div>
  )
}

// Styling Constants (Vanilla CSS for Premium Vantage Glassmorphism Feel)
const containerStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#080808",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: "system-ui, -apple-system, sans-serif",
  padding: "24px 16px",
  color: "#FFFFFF",
}

const cardStyle: React.CSSProperties = {
  background: "#111111",
  border: "1px solid #222222",
  borderRadius: "24px",
  width: "100%",
  maxWidth: "500px",
  padding: "36px",
  boxShadow: "0 20px 40px rgba(0, 0, 0, 0.4)",
}

const headerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  textAlign: "center",
}

const iconContainerStyle: React.CSSProperties = {
  width: "56px",
  height: "56px",
  background: "rgba(0, 200, 83, 0.1)",
  color: "#00C853",
  border: "1px solid rgba(0, 200, 83, 0.3)",
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "24px",
  fontWeight: "bold",
  marginBottom: "16px",
}

const errorIconContainerStyle: React.CSSProperties = {
  width: "56px",
  height: "56px",
  background: "rgba(239, 68, 68, 0.1)",
  color: "#EF4444",
  border: "1px solid rgba(239, 68, 68, 0.3)",
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "24px",
  fontWeight: "bold",
  marginBottom: "16px",
}

const titleStyle: React.CSSProperties = {
  fontSize: "22px",
  fontWeight: "700",
  margin: "0 0 8px 0",
  color: "#FFFFFF",
}

const subtitleStyle: React.CSSProperties = {
  fontSize: "14px",
  color: "#888888",
  margin: 0,
  lineHeight: "1.5",
}

const dividerStyle: React.CSSProperties = {
  height: "1px",
  background: "#222222",
  margin: "24px 0",
}

const infoBoxStyle: React.CSSProperties = {
  background: "#161616",
  borderRadius: "16px",
  padding: "20px",
  border: "1px solid #222222",
}

const infoTitleStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "#888888",
  fontWeight: "600",
  margin: "0 0 12px 0",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
}

const listStyle: React.CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: 0,
}

const listItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  fontSize: "14px",
  color: "#FFFFFF",
  lineHeight: "1.4",
}

const checkIconStyle: React.CSSProperties = {
  color: "#00C853",
  marginRight: "10px",
  fontWeight: "bold",
}

const listDescStyle: React.CSSProperties = {
  display: "block",
  fontSize: "12px",
  color: "#888888",
  marginTop: "2px",
}

const formStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "16px",
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: "15px",
  fontWeight: "600",
  color: "#FFFFFF",
  margin: "0 0 8px 0",
}

const checkboxLabelStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "12px",
  cursor: "pointer",
  padding: "8px 0",
}

const checkboxStyle: React.CSSProperties = {
  marginTop: "4px",
  cursor: "pointer",
  accentColor: "#00C853",
}

const checkboxTextTitleStyle: React.CSSProperties = {
  display: "block",
  fontSize: "14px",
  fontWeight: "600",
  color: "#FFFFFF",
}

const checkboxTextDescStyle: React.CSSProperties = {
  display: "block",
  fontSize: "12px",
  color: "#888888",
  marginTop: "2px",
  lineHeight: "1.4",
}

const submitButtonStyle: React.CSSProperties = {
  background: "#FFFFFF",
  color: "#000000",
  border: "none",
  borderRadius: "12px",
  padding: "12px",
  fontSize: "14px",
  fontWeight: "600",
  cursor: "pointer",
  transition: "background 0.2s",
  marginTop: "8px",
}

const homeButtonStyle: React.CSSProperties = {
  display: "inline-block",
  border: "1px solid #333333",
  background: "#111111",
  color: "#FFFFFF",
  borderRadius: "12px",
  padding: "10px 24px",
  fontSize: "14px",
  fontWeight: "600",
  textDecoration: "none",
  cursor: "pointer",
}

const footerStyle: React.CSSProperties = {
  fontSize: "11px",
  color: "#555555",
  textAlign: "center",
  marginTop: "32px",
}
