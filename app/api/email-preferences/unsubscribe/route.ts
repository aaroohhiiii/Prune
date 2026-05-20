import { NextResponse } from "next/server"
import { verifyUnsubscribeToken, updateEmailPreference } from "@/lib/emailTokens"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const email = searchParams.get("email")
  const token = searchParams.get("token")

  if (!email || !token) {
    return new NextResponse(
      renderSimpleHtml("Invalid Request", "Missing required email or token parameters.", false),
      {
        status: 400,
        headers: { "Content-Type": "text/html" },
      }
    )
  }

  // 1. Verify token
  const verified = verifyUnsubscribeToken(token)
  if (!verified || verified.email.toLowerCase() !== email.toLowerCase()) {
    return new NextResponse(
      renderSimpleHtml(
        "Link Expired or Invalid",
        "This secure unsubscribe link has expired or is invalid. Unsubscribe tokens are valid for 24 hours.",
        false
      ),
      {
        status: 400,
        headers: { "Content-Type": "text/html" },
      }
    )
  }

  // 2. Perform the update
  try {
    await updateEmailPreference(email, "reaudit", false)
  } catch (error) {
    console.error("[unsubscribe-api] Error unsubscribing user:", error)
    return new NextResponse(
      renderSimpleHtml("Database Error", "Failed to process your request. Please try again.", false),
      {
        status: 500,
        headers: { "Content-Type": "text/html" },
      }
    )
  }

  return new NextResponse(
    renderSimpleHtml(
      "Unsubscribed Successfully",
      "You've been successfully unsubscribed from re-audit pricing change emails. You will continue to receive immediate audit results directly after performing audits.",
      true
    ),
    {
      status: 200,
      headers: { "Content-Type": "text/html" },
    }
  )
}

function renderSimpleHtml(title: string, message: string, isSuccess: boolean) {
  const brandColor = isSuccess ? "#00C853" : "#EF4444"
  const icon = isSuccess ? "✓" : "!"

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #080808;
      color: #FFFFFF;
      font-family: system-ui, -apple-system, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .card {
      background-color: #111111;
      border: 1px solid #222222;
      border-radius: 24px;
      padding: 40px;
      max-width: 420px;
      width: 100%;
      text-align: center;
      box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    }
    .icon {
      width: 50px;
      height: 50px;
      line-height: 50px;
      border-radius: 50%;
      margin: 0 auto 20px;
      font-size: 20px;
      font-weight: bold;
      background-color: ${brandColor}1a;
      color: ${brandColor};
      border: 1px solid ${brandColor}4d;
    }
    h1 {
      font-size: 20px;
      margin: 0 0 12px 0;
      font-weight: 700;
    }
    p {
      font-size: 14px;
      color: #888888;
      line-height: 1.5;
      margin: 0 0 24px 0;
    }
    .btn {
      display: inline-block;
      padding: 10px 24px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 600;
      background-color: #FFFFFF;
      color: #000000;
      text-decoration: none;
      transition: opacity 0.2s;
    }
    .btn:hover {
      opacity: 0.9;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <a href="/" class="btn">Go to Vantage</a>
  </div>
</body>
</html>
  `
}
