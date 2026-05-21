import { getOfficialPriceSync as getOfficialPrice, getToolPricingSync as getToolPricing } from "@/lib/pricingService"
import { getPlanCapabilities, getRequiredCapabilitiesForUseCase } from "@/lib/capabilityData"
import { calculateMarginalUtility, findDuplicateCapabilities, findUncoveredCapabilities, getStackCapabilities, recommendAction } from "@/lib/capabilityAnalysis"
import type { AuditInput, AuditOutput, ToolAuditResult, ToolInput, ToolName, AuditFinding, AuditStackSummary, Capability } from "@/lib/types"

function round2(value: number): number { return Number(Math.max(0, value).toFixed(2)) }

function buildKeep(tool: ToolInput, credex: boolean): ToolAuditResult {
  return {
    tool: tool.tool, currentPlan: tool.plan, currentSpend: tool.monthlySpend,
    recommendedAction: "keep", monthlySavings: 0, annualSavings: 0,
    reason: "Plan and pricing are appropriate for your team size and use case.",
    credexOpportunity: credex, confidence: "medium", overlapScore: 0,
    uniqueValueScore: 0.5, needAlignmentScore: 0.5, findings: [],
    rationale: ["Provides appropriate capabilities for your use case"],
    marginalUtility: { capabilities: [], description: "Provides baseline capabilities for your workflow" }
  }
}

function normalizeAuditInput(input: AuditInput): AuditInput {
  const normalizedTools = input.tools.map(tool => {
    const officialPrice = getOfficialPrice(tool.tool, tool.plan, tool.seats)
    return { ...tool, monthlySpend: Math.max(tool.monthlySpend, 0), seats: Math.max(tool.seats, 1), _priceDiscrepancy: officialPrice > 0 ? Math.abs(tool.monthlySpend - officialPrice) / officialPrice : 0, _officialPrice: officialPrice }
  })
  return { tools: normalizedTools, teamSize: Math.max(input.teamSize, 1), useCase: input.useCase || "mixed" }
}

function buildAuditContext(normalized: AuditInput): AuditContext {
  const totalSpend = normalized.tools.reduce((sum, t) => sum + t.monthlySpend, 0)
  const toolCapabilities = new Map<ToolName, Capability[]>()
  normalized.tools.forEach(tool => toolCapabilities.set(tool.tool, getPlanCapabilities(tool.tool, tool.plan)))
  return { normalized, totalSpend, allCapabilities: getStackCapabilities(normalized.tools), duplicateCapabilities: findDuplicateCapabilities(normalized.tools), requiredCapabilities: getRequiredCapabilitiesForUseCase(normalized.useCase), uncoveredCapabilities: findUncoveredCapabilities(normalized.tools, normalized.useCase), toolCapabilities }
}

interface AuditContext { normalized: AuditInput; totalSpend: number; allCapabilities: Capability[]; duplicateCapabilities: Capability[]; uncoveredCapabilities: Capability[]; requiredCapabilities: Capability[]; toolCapabilities: Map<ToolName, Capability[]> }

function runAllRules(context: AuditContext): AuditFinding[] {
  const { normalized } = context
  const findings: AuditFinding[] = []
  normalized.tools.forEach(tool => {
    const pricing = getToolPricing(tool.tool)
    if (pricing && !pricing.plans.some(p => p.planName.toLowerCase() === tool.plan.toLowerCase())) {
      findings.push({ ruleId: "unknown-plan", severity: "medium", type: "data-quality", message: `${tool.tool} plan not found`, evidence: {} })
    }
    if (tool._priceDiscrepancy && tool._priceDiscrepancy > 0.1) {
      findings.push({ ruleId: "price-discrepancy", severity: "high", type: "pricing", message: `Price mismatch for ${tool.tool}`, evidence: { score: tool._priceDiscrepancy } })
    }
  })
  return findings
}

function resolveFindingsToRecommendations(findings: AuditFinding[], context: AuditContext): ToolAuditResult[] {
  const { normalized, totalSpend } = context
  const resultMap = new Map<ToolName, ToolAuditResult>()
  normalized.tools.forEach((tool) => resultMap.set(tool.tool, buildKeep(tool, tool.monthlySpend > 50 || totalSpend > 200)))

  const categoryWinners = new Map<string, ToolName>()
  const sortedTools = [...normalized.tools].sort((a, b) => b.monthlySpend - a.monthlySpend)

  sortedTools.forEach((tool) => {
    const toolPricing = getToolPricing(tool.tool)
    const category = toolPricing?.category
    if (!category) return

    const isWinner = !categoryWinners.has(category)
    if (isWinner) categoryWinners.set(category, tool.tool)

    const otherTools = normalized.tools.filter((t) => t.tool !== tool.tool)
    const utility = calculateMarginalUtility(tool.tool, tool.plan, otherTools, normalized.useCase)
    const currentResult = resultMap.get(tool.tool)!

    const isRedundant = !isWinner && normalized.teamSize <= 15
    const recommendation = recommendAction(
      utility.overlapScore, utility.uniqueValueScore, utility.needAlignmentScore,
      tool.monthlySpend, findings.some(f => f.message.includes(tool.tool) && f.ruleId === "unknown-plan"),
      { teamSize: normalized.teamSize, useCase: normalized.useCase },
      isRedundant // FORCE REMOVE if redundant
    )

    if (recommendation !== "keep") {
      currentResult.recommendedAction = recommendation
      currentResult.monthlySavings = tool.monthlySpend
      currentResult.annualSavings = tool.monthlySpend * 12
      currentResult.reason = isRedundant
        ? `Redundant ${category} tool. You already have ${categoryWinners.get(category)}.`
        : `High overlap. Removing saves $${tool.monthlySpend}/mo.`
      currentResult.rationale = [`Category Conflict: Multiple ${category} tools detected.`]
    } else {
      currentResult.recommendedAction = "keep"
    }

    currentResult.overlapScore = isRedundant ? 0.95 : utility.overlapScore
    currentResult.uniqueValueScore = utility.uniqueValueScore
    currentResult.needAlignmentScore = utility.needAlignmentScore
    currentResult.marginalUtility = { capabilities: utility.marginalCapabilities, description: utility.description }
  })

  return Array.from(resultMap.values())
}

function buildAuditStackSummary(recommendations: ToolAuditResult[], context: AuditContext): AuditStackSummary {
  const { normalized, duplicateCapabilities, uncoveredCapabilities } = context
  const currentMonthlySpend = normalized.tools.reduce((sum, t) => sum + t.monthlySpend, 0)
  const optimizedMonthlySpend = recommendations.reduce((sum, r) => sum + (r.recommendedAction === "remove" ? 0 : r.currentSpend), 0)
  const estimatedMonthlySavings = currentMonthlySpend - optimizedMonthlySpend
  const highOverlapTools = recommendations.filter(r => r.overlapScore > 0.6).length
  let stackStatus: "optimized" | "overlapping" | "underprovided" | "mixed" = "optimized"
  if (uncoveredCapabilities.length > 0) stackStatus = "underprovided"
  else if (highOverlapTools >= recommendations.length / 2) stackStatus = "overlapping"
  else if (highOverlapTools > 0) stackStatus = "mixed"

  return { currentMonthlySpend, optimizedMonthlySpend, estimatedMonthlySavings, duplicateCapabilities, uncoveredCapabilities, stackStatus, primaryConsolidationOpportunity: recommendations.find(r => r.recommendedAction === "remove")?.tool, biggestValueAdder: recommendations.sort((a, b) => b.uniqueValueScore - a.uniqueValueScore)[0]?.tool }
}

function computeEfficiencyScore(recommendations: ToolAuditResult[]): number {
  if (recommendations.length === 0) return 50
  const avgOverlap = recommendations.reduce((s, r) => s + r.overlapScore, 0) / recommendations.length
  const avgUnique = recommendations.reduce((s, r) => s + r.uniqueValueScore, 0) / recommendations.length
  const avgAlignment = recommendations.reduce((s, r) => s + r.needAlignmentScore, 0) / recommendations.length
  return Math.min(100, Math.max(0, Math.round((1 - avgOverlap) * 50 + avgUnique * 30 + avgAlignment * 20)))
}

export function runAudit(input: AuditInput): AuditOutput {
  const normalized = normalizeAuditInput(input)
  const context = buildAuditContext(normalized)
  const findings = runAllRules(context)
  const recommendations = resolveFindingsToRecommendations(findings, context)
  const summary = buildAuditStackSummary(recommendations, context)
  const totalMonthlySavings = round2(recommendations.reduce((sum, r) => sum + r.monthlySavings, 0))
  return {
    input: normalized, results: recommendations, summary,
    efficiencyScore: computeEfficiencyScore(recommendations),
    totalMonthlySavings, totalAnnualSavings: round2(totalMonthlySavings * 12),
    isOptimal: summary.stackStatus === "optimized" && totalMonthlySavings < 10,
    showCredex: totalMonthlySavings * 12 > 500
  }
}
