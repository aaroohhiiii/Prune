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

export async function sendAdminAlert(message: string) {
  console.log("[ADMIN ALERT]", message)
}

export async function runDailyPriceDetection() {
  if (!supabase) throw new Error("Supabase client not initialized")
  
  await getCachedPricing()
  
  const { data: leads, error: leadsError } = await supabase
    .from("leads")
    .select(`email, audit_id, audits (id, input, results, total_monthly_savings, total_annual_savings, created_at)`)
    
  if (leadsError) throw leadsError
  if (!leads) return { changed: [], failed: [], emailsSent: 0 }
  
  const userAuditsMap: Record<string, AffectedAuditInfo[]> = {}
  const changed = []
  
  for (const lead of leads) {
    const email = lead.email.trim().toLowerCase()
    const audit = lead.audits as any
    if (!audit || !audit.input || !audit.input.tools) continue
    
    const auditInput = audit.input as AuditInput
    const changesSummary: string[] = []
    let pricingChanged = false
    
    for (const t of auditInput.tools) {
      const historicalPlan = await getPricingAsOf(t.tool as ToolName, t.plan, new Date(audit.created_at))
      const currentPlan = getPlanPricingSync(t.tool as ToolName, t.plan)
      const oldPrice = historicalPlan ? historicalPlan.pricePerUserPerMonth : t.monthlySpend / Math.max(1, t.seats)
      const currentPrice = currentPlan ? currentPlan.pricePerUserPerMonth : 0
      
      if (oldPrice !== currentPrice) {
        pricingChanged = true
        changesSummary.push(`${t.tool.replace("-", " ")} (${t.plan}): changed from $${oldPrice.toFixed(0)} to $${currentPrice.toFixed(0)}`)
      }
    }
    
    if (pricingChanged) {
      changed.push(audit.id)
      const newAudit = runAudit(auditInput)
      const formatRecs = (resultsList: ToolAuditResult[]) => {
        const recs = resultsList.filter(r => r.monthlySavings > 0).map(r => `${r.tool.replace("-", " ")}: ${r.recommendedAction}`)
        return recs.length > 0 ? recs.join(", ") : "Stack is fully optimized"
      }
      
      const auditInfo: AffectedAuditInfo = {
        auditId: audit.id,
        auditUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/audit/${audit.id}?rerun=true`,
        changesSummary,
        oldSavings: audit.total_monthly_savings,
        newSavings: newAudit.totalMonthlySavings,
        oldRecommendations: formatRecs(audit.results),
        newRecommendations: formatRecs(newAudit.results),
      }
      if (!userAuditsMap[email]) userAuditsMap[email] = []
      userAuditsMap[email].push(auditInfo)
    }
  }
  
  let emailsSent = 0
  const failed = []
  for (const [email, affectedAudits] of Object.entries(userAuditsMap)) {
    try {
      const success = await sendConsolidatedPricingChangeEmail({ to: email, audits: affectedAudits })
      if (success) emailsSent++
      else failed.push({ tool: email }) // logging email as tool for error formatting compatibility
    } catch (e) {
      failed.push({ tool: email })
    }
  }
  
  return { changed, failed, emailsSent }
}
