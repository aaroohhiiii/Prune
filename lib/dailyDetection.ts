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
  const changed: string[] = []
  
  for (const lead of leads) {
    const email = (lead.email as string).trim().toLowerCase()
    const audit = lead.audits as unknown as Record<string, unknown> | null
    if (!audit) continue
    
    const auditInput = audit.input as AuditInput
    const auditCreatedAt = audit.created_at as string
    const auditId = audit.id as string
    const auditResults = audit.results as ToolAuditResult[]
    const auditSavings = audit.total_monthly_savings as number
    
    if (!auditInput?.tools) continue
    
    const changesSummary: string[] = []
    let pricingChanged = false
    
    for (const t of auditInput.tools) {
      const toolName = (t as Record<string, unknown>).tool as ToolName
      const plan = (t as Record<string, unknown>).plan as string
      const monthlySpend = (t as Record<string, unknown>).monthlySpend as number
      const seats = (t as Record<string, unknown>).seats as number
      
      const historicalPlan = await getPricingAsOf(toolName, plan, new Date(auditCreatedAt))
      const currentPlan = getPlanPricingSync(toolName, plan)
      
      const oldPrice = historicalPlan?.pricePerUserPerMonth ?? (monthlySpend / Math.max(1, seats))
      const currentPrice = currentPlan?.pricePerUserPerMonth ?? 0
      
      if (oldPrice !== currentPrice) {
        pricingChanged = true
        changesSummary.push(`${toolName.replace("-", " ")} (${plan}): $${oldPrice.toFixed(0)} → $${currentPrice.toFixed(0)}`)
      }
    }
    
    if (pricingChanged) {
      changed.push(auditId)
      const newAudit = runAudit(auditInput)
      
      const formatRecs = (resultsList: ToolAuditResult[]) => {
        const recs = resultsList
          .filter((r) => r.monthlySavings > 0)
          .map((r) => `${r.tool.replace("-", " ")}: ${r.recommendedAction}`)
        return recs.length > 0 ? recs.join(", ") : "Stack is fully optimized"
      }
      
      const auditInfo: AffectedAuditInfo = {
        auditId,
        auditUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/audit/${auditId}?rerun=true`,
        changesSummary,
        oldSavings: auditSavings,
        newSavings: newAudit.totalMonthlySavings,
        oldRecommendations: formatRecs(auditResults),
        newRecommendations: formatRecs(newAudit.results),
      }
      
      if (!userAuditsMap[email]) {
        userAuditsMap[email] = []
      }
      userAuditsMap[email].push(auditInfo)
    }
  }
  
  let emailsSent = 0
  const failed: Array<{ tool: string }> = []
  
  for (const [email, affectedAudits] of Object.entries(userAuditsMap)) {
    try {
      const success = await sendConsolidatedPricingChangeEmail({ to: email, audits: affectedAudits })
      if (success) emailsSent++
      else failed.push({ tool: email })
    } catch {
      failed.push({ tool: email })
    }
  }
  
  return { changed, failed, emailsSent }
}
