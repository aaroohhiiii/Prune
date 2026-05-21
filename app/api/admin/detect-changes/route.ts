import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getPricingAsOf, getCachedPricing, getPlanPricingSync } from "@/lib/pricingService"
import { runAudit } from "@/lib/auditEngineV2"
import { sendConsolidatedPricingChangeEmail, AffectedAuditInfo } from "@/lib/resend"
import type { AuditInput, ToolName, ToolAuditResult } from "@/lib/types"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const key = supabaseServiceRoleKey || supabaseAnonKey
const supabase = supabaseUrl && key ? createClient(supabaseUrl, key) : null

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

    if (!supabase) {
      return NextResponse.json(
        { error: "Database client is not initialized" },
        { status: 500 }
      )
    }

    // 2. Warm the dynamic pricing cache
    await getCachedPricing()

    // 3. Fetch all leads and their linked audits using SQL join
    const { data: leads, error: leadsError } = await supabase
      .from("leads")
      .select(`
        email,
        audit_id,
        audits (
          id,
          input,
          results,
          total_monthly_savings,
          total_annual_savings,
          created_at
        )
      `)

    if (leadsError) throw leadsError

    if (!leads || leads.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No audits found to analyze.",
        emails_sent: 0,
        notified_users: [],
      })
    }

    // Type definition for nested Supabase join
    interface SupabaseAuditRow {
      id: string
      input: AuditInput
      results: ToolAuditResult[]
      total_monthly_savings: number
      total_annual_savings: number
      created_at: string
    }

    // 4. Map and check pricing changes for each audit, grouped by user email
    const userAuditsMap: Record<string, AffectedAuditInfo[]> = {}
    let checkedCount = 0
    let affectedCount = 0

    // Retrieve full host details for generating re-run links
    const host = request.headers.get("host") || "vantage.vercel.app"
    const protocol = host.includes("localhost") ? "http" : "https"

    for (const lead of leads) {
      const email = lead.email.trim().toLowerCase()
      const audit = lead.audits as unknown as SupabaseAuditRow

      if (!audit || !audit.input || !audit.input.tools) continue
      checkedCount++

      const auditInput = audit.input as AuditInput
      const changesSummary: string[] = []
      let pricingChanged = false

      // Check if price of any tool has changed since the audit was created
      for (const t of auditInput.tools) {
        const historicalPlan = await getPricingAsOf(t.tool as ToolName, t.plan, new Date(audit.created_at))
        const currentPlan = getPlanPricingSync(t.tool as ToolName, t.plan)

        const oldPrice = historicalPlan ? historicalPlan.pricePerUserPerMonth : t.monthlySpend / Math.max(1, t.seats)
        const currentPrice = currentPlan ? currentPlan.pricePerUserPerMonth : 0

        // If the price of the plan changed, document the shift
        if (oldPrice !== currentPrice) {
          pricingChanged = true
          changesSummary.push(
            `${t.tool.replace("-", " ")} (${t.plan}): changed from $${oldPrice.toFixed(0)} to $${currentPrice.toFixed(0)}`
          )
        }
      }

      if (pricingChanged) {
        affectedCount++

        // Re-run the audit engine live with updated cache pricing
        const newAudit = runAudit(auditInput)

        // Generate descriptive summaries of recommendations
        const formatRecommendations = (resultsList: ToolAuditResult[]) => {
          const recs = resultsList
            .filter((r) => r.monthlySavings > 0)
            .map((r) => `${r.tool.replace("-", " ")}: ${r.recommendedAction} (Save $${r.monthlySavings.toFixed(0)}/mo)`)
          return recs.length > 0 ? recs.join(", ") : "Stack is fully optimized"
        }

        const oldRecommendations = formatRecommendations(audit.results)
        const newRecommendations = formatRecommendations(newAudit.results)

        const auditInfo: AffectedAuditInfo = {
          auditId: audit.id,
          auditUrl: `${protocol}://${host}/audit/${audit.id}?rerun=true`,
          changesSummary,
          oldSavings: audit.total_monthly_savings,
          newSavings: newAudit.totalMonthlySavings,
          oldRecommendations,
          newRecommendations,
        }

        if (!userAuditsMap[email]) {
          userAuditsMap[email] = []
        }
        userAuditsMap[email].push(auditInfo)
      }
    }

    // 5. Send one consolidated email per affected user
    const notifiedUsers: string[] = []
    for (const [email, affectedAudits] of Object.entries(userAuditsMap)) {
      const emailSuccess = await sendConsolidatedPricingChangeEmail({
        to: email,
        audits: affectedAudits,
      })
      if (emailSuccess) {
        notifiedUsers.push(email)
      }
    }

    return NextResponse.json({
      success: true,
      audits_checked: checkedCount,
      audits_affected: affectedCount,
      emails_sent: notifiedUsers.length,
      notified_users: notifiedUsers,
    })
  } catch (err: unknown) {
    const error = err as Error
    console.error("[pricing-change-job] Error detecting pricing updates:", error)
    return NextResponse.json(
      { error: "Change detection job failed", message: error.message || String(err) },
      { status: 500 }
    )
  }
}
