"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AnimatePresence, motion } from "framer-motion"

import { SpendDetails } from "@/components/SpendForm/SpendDetails"
import { TeamInfo } from "@/components/SpendForm/TeamInfo"
import { ToolSelector } from "@/components/SpendForm/ToolSelector"
import type { AuditInput, FormState, StoredFormState, ToolInput, ToolName, UseCase } from "@/lib/types"
import { getOfficialPrice, getToolPricing, getPlanPricing } from "@/lib/pricingData"
import { trackEvent } from "@/lib/analytics"

const LOCAL_STORAGE_KEY = "vantage-audit-form-state"
const STALE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000

const ALL_TOOLS: ToolName[] = [
  "cursor",
  "github-copilot",
  "claude",
  "chatgpt",
  "anthropic-api",
  "openai-api",
  "gemini",
  "windsurf",
]

const STEPS = [
  { number: 1, label: "Select tools" },
  { number: 2, label: "Add spend" },
  { number: 3, label: "Team context" },
] as const

function createDefaultToolInput(tool: ToolName): ToolInput {
  const pricing = getToolPricing(tool)
  const firstPlan = pricing?.plans[0]?.planName ?? ""
  const monthlySpend = firstPlan ? getOfficialPrice(tool, firstPlan, 1) : 0

  return { tool, plan: firstPlan, monthlySpend, seats: 1 }
}

function createInitialFormState(): FormState {
  const toolInputs = ALL_TOOLS.reduce<Record<ToolName, ToolInput>>((acc, tool) => {
    acc[tool] = createDefaultToolInput(tool)
    return acc
  }, {} as Record<ToolName, ToolInput>)

  return { step: 1, selectedTools: [], toolInputs, teamSize: 1, useCase: "coding" }
}

const stepVariants = {
  enter: (dir: number) => ({
    opacity: 0,
    x: dir > 0 ? 20 : -20,
  }),
  center: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.4, ease: [0.23, 1, 0.32, 1] as const },
  },
  exit: (dir: number) => ({
    opacity: 0,
    x: dir > 0 ? -20 : 20,
    transition: { duration: 0.3, ease: [0.23, 1, 0.32, 1] as const },
  }),
}

export default function SpendForm() {
  const [state, setState] = useState<FormState>(createInitialFormState)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [direction, setDirection] = useState(1)
  const router = useRouter()
  const searchParams = useSearchParams()
  const refCode = searchParams.get("ref") || undefined

  useEffect(() => {
    trackEvent('audit_start')
  }, [])

  useEffect(() => {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY)
    if (!raw) return
    try {
      const parsed = JSON.parse(raw) as StoredFormState
      const lastUpdated = new Date(parsed.lastUpdated).getTime()
      if (!Number.isFinite(lastUpdated) || Date.now() - lastUpdated > STALE_THRESHOLD_MS) {
        window.localStorage.removeItem(LOCAL_STORAGE_KEY)
        return
      }
      setState({
        step: parsed.step,
        selectedTools: parsed.selectedTools,
        toolInputs: parsed.toolInputs,
        teamSize: parsed.teamSize,
        useCase: parsed.useCase,
      })
    } catch {
      window.localStorage.removeItem(LOCAL_STORAGE_KEY)
    }
  }, [])

  useEffect(() => {
    const payload: StoredFormState = { ...state, lastUpdated: new Date().toISOString() }
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(payload))
  }, [state])



  function goTo(step: FormState["step"], dir: number) {
    if (dir > 0) {
      if (state.step === 1) trackEvent('audit_step_1_complete', undefined, { tools: state.selectedTools })
      if (state.step === 2) trackEvent('audit_step_2_complete', undefined, { toolsCount: state.selectedTools.length })
    }
    setDirection(dir)
    setState((prev) => ({ ...prev, step }))
  }

  function toggleTool(tool: ToolName) {
    setState((prev) => ({
      ...prev,
      selectedTools: prev.selectedTools.includes(tool)
        ? prev.selectedTools.filter((s) => s !== tool)
        : [...prev.selectedTools, tool],
    }))
  }

  function updateToolInput(tool: ToolName, next: Partial<ToolInput>) {
    setState((prev) => {
      const current = prev.toolInputs[tool]
      const plan = next.plan ?? current.plan
      const seats = next.seats ?? current.seats
      const shouldRecalculate =
        next.monthlySpend === undefined && (next.plan !== undefined || next.seats !== undefined)

      const matchedPlan = plan ? getPlanPricing(tool, plan) : undefined
      const isZeroPrice = matchedPlan ? matchedPlan.pricePerUserPerMonth === 0 : false
      const isFreePlan = plan ? (plan.toLowerCase().includes("free") || plan.toLowerCase().includes("hobby")) : false

      let calculatedSpend: number | undefined = current.monthlySpend
      if (next.monthlySpend !== undefined) {
        calculatedSpend = next.monthlySpend
      } else if (shouldRecalculate) {
        if (isZeroPrice) {
          calculatedSpend = isFreePlan ? 0 : undefined
        } else {
          calculatedSpend = getOfficialPrice(tool, plan, seats)
        }
      }

      return {
        ...prev,
        toolInputs: {
          ...prev.toolInputs,
          [tool]: {
            ...current,
            ...next,
            monthlySpend: calculatedSpend,
            tool,
          },
        },
      }
    })
  }

  async function submitAudit() {
    setIsSubmitting(true)
    setError(null)
    trackEvent('audit_submitted', undefined, {
      tools: state.selectedTools,
      teamSize: state.teamSize,
      useCase: state.useCase
    })
    try {
      const payload: AuditInput = {
        tools: state.selectedTools.map((tool) => state.toolInputs[tool]),
        teamSize: state.teamSize,
        useCase: state.useCase,
        referredBy: refCode,
      }
      const response = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!response.ok) throw new Error("Failed to run audit")
      const data = (await response.json()) as { id: string }
      window.localStorage.removeItem(LOCAL_STORAGE_KEY)
      router.push(`/audit/${data.id}`)
    } catch {
      setError("Something went wrong — please try again")
    } finally {
      setIsSubmitting(false)
    }
  }

  function setUseCase(useCase: UseCase) {
    setState((prev) => ({ ...prev, useCase }))
  }

  return (
    <div
      id="spend-form"
      className="mx-auto w-full max-w-4xl glass-card rounded-[40px] shadow-2xl shadow-black/[0.02]"
    >
      {/* ── Step indicator ── */}
      <div className="px-10 pt-10 pb-8 sm:px-12 sm:pt-12">
        <div className="flex items-center justify-between relative">
          {STEPS.map((step, i) => {
            const isCompleted = state.step > step.number
            const isActive = state.step === step.number
            return (
              <div key={step.number} className="relative flex items-center justify-center">
                <div className="flex flex-col items-center gap-3 z-10">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-full text-xs font-medium transition-all duration-500"
                    style={
                      isCompleted
                        ? { background: "#F0FDF4", border: "1px solid #BBF7D0", color: "#00C853" }
                        : isActive
                          ? { background: "#111111", color: "#fff" }
                          : { background: "#FFFFFF", border: "1px solid #E5E7EB", color: "#9CA3AF" }
                    }
                  >
                    {isCompleted ? "✓" : step.number}
                  </div>
                  <span
                    className="text-[10px] font-medium uppercase tracking-widest transition-colors duration-500 whitespace-nowrap"
                    style={{ color: isActive ? "#111111" : isCompleted ? "#00C853" : "#9CA3AF" }}
                  >
                    {step.label}
                  </span>
                </div>

                {i < STEPS.length - 1 && (
                  <div
                    className="absolute top-5 h-px transition-all duration-700"
                    style={{
                      background: isCompleted ? "#00C853" : "#E5E7EB",
                      left: "100%",
                      width: "300%"
                    }}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Step content ── */}
      <div className="relative overflow-hidden px-10 pb-12 sm:px-12">
        <AnimatePresence mode="wait" custom={direction}>
          {state.step === 1 && (
            <motion.div
              key="step-1"
              custom={direction}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
            >
              <ToolSelector
                selectedTools={state.selectedTools}
                onToggle={toggleTool}
                onNext={() => goTo(2, 1)}
              />
            </motion.div>
          )}

          {state.step === 2 && (
            <motion.div
              key="step-2"
              custom={direction}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
            >
              <SpendDetails
                selectedTools={state.selectedTools}
                toolInputs={state.toolInputs}
                onToolInputChange={updateToolInput}
                onBack={() => goTo(1, -1)}
                onNext={() => goTo(3, 1)}
              />
            </motion.div>
          )}

          {state.step === 3 && (
            <motion.div
              key="step-3"
              custom={direction}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
            >
              <TeamInfo
                state={state}
                isSubmitting={isSubmitting}
                error={error}
                onBack={() => goTo(2, -1)}
                onTeamSizeChange={(teamSize) => setState((prev) => ({ ...prev, teamSize }))}
                onUseCaseChange={setUseCase}
                onSubmit={submitAudit}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
