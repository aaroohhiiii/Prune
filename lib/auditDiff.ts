import type { AuditResult, ToolAuditResult, ToolName } from "@/lib/types"

// ═══════════════════════════════════════════════════════════════
// AUDIT DIFF ENGINE
// Pure utility: same input → same output, no side effects
// ═══════════════════════════════════════════════════════════════

export interface ToolRemoved {
  tool: ToolName
  previousPlan: string
  previousSpend: number
  previousAction: string
  reason: string
}

export interface ToolAdded {
  tool: ToolName
  plan: string
  spend: number
  action: string
  reason: string
}

export interface PlanChange {
  tool: ToolName
  oldPlan: string
  newPlan: string
  oldSpend: number
  newSpend: number
  monthlyDelta: number
  annualDelta: number
}

export interface RecommendationChange {
  tool: ToolName
  oldAction: string
  newAction: string
  oldSavings: number
  newSavings: number
  status: "implemented" | "changed" | "unchanged" | "new" | "removed"
}

export interface AuditDelta {
  toolsRemoved: ToolRemoved[]
  toolsAdded: ToolAdded[]
  planChanges: PlanChange[]
  recommendationChanges: RecommendationChange[]
  totalSavingsDelta: number
  previousTotalSavings: number
  currentTotalSavings: number
  previousTotalSpend: number
  currentTotalSpend: number
  previousEfficiency: number
  currentEfficiency: number
  daysBetween: number
}

function getToolMap(results: ToolAuditResult[]): Map<ToolName, ToolAuditResult> {
  const map = new Map<ToolName, ToolAuditResult>()
  for (const r of results) {
    map.set(r.tool, r)
  }
  return map
}

function daysBetweenDates(a: string, b: string): number {
  const dateA = new Date(a)
  const dateB = new Date(b)
  const diff = Math.abs(dateB.getTime() - dateA.getTime())
  return Math.round(diff / (1000 * 60 * 60 * 24))
}

function getToolDisplayName(tool: ToolName): string {
  const names: Record<string, string> = {
    cursor: "Cursor",
    "github-copilot": "GitHub Copilot",
    claude: "Claude",
    chatgpt: "ChatGPT",
    "anthropic-api": "Anthropic API",
    "openai-api": "OpenAI API",
    gemini: "Gemini",
    windsurf: "Windsurf",
  }
  return names[tool] || tool
}

/**
 * Determines whether a user "implemented" a previous recommendation.
 * If prev said "remove" and the tool is now gone from the current audit → implemented.
 * If prev said "downgrade" and the current plan is cheaper → implemented.
 */
function determineStatus(
  prevResult: ToolAuditResult | undefined,
  currResult: ToolAuditResult | undefined
): RecommendationChange["status"] {
  if (!prevResult && currResult) return "new"
  if (prevResult && !currResult) {
    // Tool was removed from the stack
    if (prevResult.recommendedAction === "remove" || prevResult.recommendedAction === "cancel-redundant") {
      return "implemented"
    }
    return "removed"
  }
  if (prevResult && currResult) {
    if (prevResult.recommendedAction === currResult.recommendedAction) {
      return "unchanged"
    }
    return "changed"
  }
  return "unchanged"
}

export function calculateAuditDelta(
  current: AuditResult,
  previous: AuditResult
): AuditDelta {
  const prevMap = getToolMap(previous.results)
  const currMap = getToolMap(current.results)

  const allTools = new Set<ToolName>([...prevMap.keys(), ...currMap.keys()])

  const toolsRemoved: ToolRemoved[] = []
  const toolsAdded: ToolAdded[] = []
  const planChanges: PlanChange[] = []
  const recommendationChanges: RecommendationChange[] = []

  for (const tool of allTools) {
    const prev = prevMap.get(tool)
    const curr = currMap.get(tool)
    const status = determineStatus(prev, curr)

    // Tool was in previous but not in current
    if (prev && !curr) {
      toolsRemoved.push({
        tool,
        previousPlan: prev.currentPlan,
        previousSpend: prev.currentSpend,
        previousAction: prev.recommendedAction,
        reason:
          status === "implemented"
            ? `You followed the previous recommendation to ${prev.recommendedAction} ${getToolDisplayName(tool)}.`
            : `${getToolDisplayName(tool)} was removed from your stack.`,
      })

      recommendationChanges.push({
        tool,
        oldAction: prev.recommendedAction,
        newAction: "(removed)",
        oldSavings: prev.monthlySavings,
        newSavings: 0,
        status,
      })
      continue
    }

    // Tool is new in current audit
    if (!prev && curr) {
      toolsAdded.push({
        tool,
        plan: curr.currentPlan,
        spend: curr.currentSpend,
        action: curr.recommendedAction,
        reason: `${getToolDisplayName(tool)} was added to your stack.`,
      })

      recommendationChanges.push({
        tool,
        oldAction: "(not present)",
        newAction: curr.recommendedAction,
        oldSavings: 0,
        newSavings: curr.monthlySavings,
        status: "new",
      })
      continue
    }

    // Tool exists in both
    if (prev && curr) {
      // Plan change detection
      if (prev.currentPlan.toLowerCase() !== curr.currentPlan.toLowerCase()) {
        planChanges.push({
          tool,
          oldPlan: prev.currentPlan,
          newPlan: curr.currentPlan,
          oldSpend: prev.currentSpend,
          newSpend: curr.currentSpend,
          monthlyDelta: curr.currentSpend - prev.currentSpend,
          annualDelta: (curr.currentSpend - prev.currentSpend) * 12,
        })
      }

      recommendationChanges.push({
        tool,
        oldAction: prev.recommendedAction,
        newAction: curr.recommendedAction,
        oldSavings: prev.monthlySavings,
        newSavings: curr.monthlySavings,
        status,
      })
    }
  }

  const previousTotalSpend = previous.input.tools.reduce((s, t) => s + Math.max(0, t.monthlySpend), 0)
  const currentTotalSpend = current.input.tools.reduce((s, t) => s + Math.max(0, t.monthlySpend), 0)

  return {
    toolsRemoved,
    toolsAdded,
    planChanges,
    recommendationChanges,
    totalSavingsDelta: current.totalMonthlySavings - previous.totalMonthlySavings,
    previousTotalSavings: previous.totalMonthlySavings,
    currentTotalSavings: current.totalMonthlySavings,
    previousTotalSpend,
    currentTotalSpend,
    previousEfficiency: previous.efficiencyScore ?? 50,
    currentEfficiency: current.efficiencyScore ?? 50,
    daysBetween: daysBetweenDates(previous.createdAt, current.createdAt),
  }
}

export { getToolDisplayName }
