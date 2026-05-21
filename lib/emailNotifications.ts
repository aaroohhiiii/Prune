import { Resend } from "resend"
import { buildPricingChangeEmailHtml, UserAuditChange, AuditChangeDetail } from "./emailTemplates"
import { getEmailPreferences } from "./emailTokens"

const apiKey = process.env.RESEND_API_KEY
const resend = apiKey ? new Resend(apiKey) : null
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev"
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"

export interface AuditChange {
  originalId: string
  newId: string
  userEmail: string
  tool: string
  oldRecommendation: string
  newRecommendation: string
  savingsDelta: number
  why?: string
}

export async function sendPricingChangeEmails(changedAudits: AuditChange[]) {
  const result = {
    emailsSent: 0,
    failures: 0,
    userEmails: [] as string[]
  }

  if (changedAudits.length === 0) {
    return result
  }

  // Group by userEmail
  const userGroups: Record<string, AuditChange[]> = {}
  for (const change of changedAudits) {
    const email = change.userEmail.trim().toLowerCase()
    if (!userGroups[email]) {
      userGroups[email] = []
    }
    userGroups[email].push(change)
  }

  // Send consolidated email to each user
  for (const [email, changesForUser] of Object.entries(userGroups)) {
    // Check unsubscribe status
    const preferences = await getEmailPreferences(email)
    if (!preferences.opted_in_reaudit_emails) {
      console.log(`Skipped email for ${email} (unsubscribed)`)
      continue
    }

    // Group changes for user by original audit ID
    const auditsMap: Record<string, { newId: string; changes: AuditChangeDetail[] }> = {}
    
    // We enforce max 10 emails per user constraint
    // Actually, grouping by user means we send exactly 1 email to that user.
    // The requirement says: "Max 10 emails per user (consolidate if multiple tools changed)"
    // By consolidating all changes into exactly 1 email, we stay well below the max 10 emails limit.
    for (const c of changesForUser) {
      if (!auditsMap[c.originalId]) {
        auditsMap[c.originalId] = {
          newId: c.newId,
          changes: []
        }
      }
      auditsMap[c.originalId].changes.push({
        tool: c.tool,
        oldRecommendation: c.oldRecommendation,
        newRecommendation: c.newRecommendation,
        savingsDelta: c.savingsDelta,
        why: c.why
      })
    }

    const userAuditChanges: UserAuditChange[] = Object.entries(auditsMap).map(([origId, details]) => ({
      originalId: origId,
      newId: details.newId,
      userEmail: email,
      changes: details.changes
    }))

    const { subject, html } = buildPricingChangeEmailHtml(email, userAuditChanges, APP_URL)

    if (!resend) {
      console.warn("[emailNotifications] Resend client not initialized. Email was not sent via API.")
      result.failures++
      continue
    }

    try {
      const token = (await import("./emailTokens")).generateUnsubscribeToken(email)
      await resend.emails.send({
        from: FROM_EMAIL,
        to: email,
        subject,
        html,
        text: `Pricing updates for your AI Stack.\n\nView details online.\n\nManage email preferences or unsubscribe: ${APP_URL}/email-preferences/unsubscribe?email=${encodeURIComponent(email)}&token=${token}`
      })
      result.emailsSent++
      result.userEmails.push(email)
    } catch (err) {
      console.error(`Failed to send pricing change email to ${email}:`, err)
      result.failures++
    }
  }

  return result
}
