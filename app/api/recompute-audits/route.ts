import { NextResponse } from "next/server"
import { recomputeAuditsForPricingChange } from "@/lib/auditRecompute"
import { sendPricingChangeEmails } from "@/lib/emailNotifications"

export async function POST(request: Request) {
  try {
    // 1. Authenticate using ADMIN_API_KEY
    const authHeader = request.headers.get("Authorization")
    const queryKey = new URL(request.url).searchParams.get("apiKey")
    const providedKey = authHeader ? authHeader.replace("Bearer ", "") : queryKey

    const adminApiKey = process.env.ADMIN_API_KEY
    if (!adminApiKey) {
      return NextResponse.json(
        { error: "Admin authentication is not configured on the server" },
        { status: 500 }
      )
    }

    if (!providedKey || providedKey !== adminApiKey) {
      return NextResponse.json(
        { error: "Unauthorized: Invalid or missing ADMIN_API_KEY" },
        { status: 401 }
      )
    }

    // 2. Parse request body if available
    let tool: string | undefined
    let lookbackDays = 30
    let dryRun = false
    let maxAudits = 100

    try {
      const body = await request.json()
      if (body) {
        tool = body.tool || body.toolName
        lookbackDays = body.lookback_days ?? body.lookbackDays ?? 30
        dryRun = body.dry_run ?? body.dryRun ?? false
        maxAudits = body.max_audits ?? body.maxAudits ?? 100
      }
    } catch {
      // Body empty or not valid JSON, use defaults
    }

    // 3. Trigger recomputation
    const recomputeResult = await recomputeAuditsForPricingChange(tool, {
      lookbackDays,
      dryRun,
      maxAudits
    })

    // 4. Send emails to affected users
    let emailsSent = 0
    if (recomputeResult.changedAudits.length > 0) {
      const emailResult = await sendPricingChangeEmails(recomputeResult.changedAudits)
      emailsSent = emailResult.emailsSent
    }

    return NextResponse.json({
      success: true,
      auditsProcessed: recomputeResult.auditsProcessed,
      auditsChanged: recomputeResult.auditsChanged,
      emailsSent,
      changedAudits: recomputeResult.changedAudits
    })
  } catch (error: unknown) {
    const err = error as Error
    console.error("[recompute-audits] Endpoint execution failed:", err)
    return NextResponse.json(
      { success: false, error: err.message || String(error) },
      { status: 500 }
    )
  }
}
