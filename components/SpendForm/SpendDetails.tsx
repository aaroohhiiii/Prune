"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import { Info, ChevronRight, ArrowLeft } from "lucide-react"
import { ToolIcon, TOOL_DISPLAY_NAMES } from "@/components/ui/ToolIcon"
import { getToolPricing, getOfficialPrice } from "@/lib/pricingData"
import type { ToolInput, ToolName } from "@/lib/types"

type SpendDetailsProps = {
  selectedTools: ToolName[]
  toolInputs: Record<ToolName, ToolInput>
  onToolInputChange: (tool: ToolName, next: Partial<ToolInput>) => void
  onBack: () => void
  onNext: () => void
}

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
}

const cardVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.23, 1, 0.32, 1] as const } },
}

const inputClass =
  "w-full rounded-2xl px-4 py-3 text-sm font-medium text-[#111] placeholder-[#9CA3AF] bg-white border border-black/5 outline-none transition-all duration-300 focus:border-[#00C853] focus:ring-4 focus:ring-[#00C853]/5"

export function SpendDetails({
  selectedTools,
  toolInputs,
  onToolInputChange,
  onBack,
  onNext,
}: SpendDetailsProps) {
  const [, setEditSpend] = useState<Record<string, string>>({})

  useEffect(() => {
    const next: Record<string, string> = {}
    selectedTools.forEach((tool) => {
      const val = toolInputs[tool]?.monthlySpend
      next[tool] = typeof val === "number" ? String(val) : ""
    })
    setEditSpend((prev) => ({ ...next, ...prev }))
  }, [selectedTools, toolInputs])

  const totalSpend = selectedTools.reduce(
    (sum, tool) => sum + (toolInputs[tool]?.monthlySpend ?? 0),
    0,
  )

  return (
    <section className="space-y-8" aria-labelledby="spend-details-title">
      {/* Header */}
      <div>
        <h2
          id="spend-details-title"
          className="text-2xl font-medium text-[#111]"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          How much do you spend on each?
        </h2>
        <p className="mt-2 text-[#666] font-medium text-sm">
          Enter your current plan and monthly cost. We&apos;ll compare against official pricing.
        </p>
      </div>

      {/* Tool cards */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-4"
      >
        {selectedTools.map((tool) => {
          const pricing = getToolPricing(tool)
          const input = toolInputs[tool] || { tool, plan: "", monthlySpend: 0, seats: 1 }
          const officialMonthlySpend = getOfficialPrice(tool, input.plan, input.seats)
          const selectedPlan = pricing?.plans.find(
            (p) => p.planName.toLowerCase() === (input.plan || "").toLowerCase(),
          )

          const isOverpaying = officialMonthlySpend > 0 && input.monthlySpend > officialMonthlySpend * 1.15
          const isUnderList =
            officialMonthlySpend > 0 && input.monthlySpend > 0 && input.monthlySpend <= officialMonthlySpend * 1.05

          return (
            <motion.div
              key={tool}
              variants={cardVariants}
              className="rounded-[32px] p-6 bg-white border border-black/5 transition-all duration-300"
            >
              {/* Tool header */}
              <div className="mb-6 flex items-center gap-4">
                <ToolIcon tool={tool} size={40} />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[#111]">{TOOL_DISPLAY_NAMES[tool]}</p>
                  {selectedPlan && officialMonthlySpend > 0 && (
                    <p className="text-xs font-medium text-[#666] mt-0.5">
                      List Price: ${officialMonthlySpend}{selectedPlan.isPerUser ? "/user" : ""}/mo
                    </p>
                  )}
                </div>

                {isOverpaying && (
                  <div className="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest bg-amber-50 text-amber-600 border border-amber-200">
                    Overpaying
                  </div>
                )}
                {isUnderList && !isOverpaying && (
                  <div className="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest bg-green-50 text-green-600 border border-green-200">
                    Optimal
                  </div>
                )}
              </div>

              {/* Inputs row */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#666] ml-1" htmlFor={`${tool}-plan`}>
                    Plan
                  </label>
                  <select
                    id={`${tool}-plan`}
                    value={input.plan ?? ""}
                    onChange={(e) => {
                      const selectedPlan = e.target.value
                      const pricing = getToolPricing(tool)
                      const planData = pricing?.plans.find((p) => p.planName === selectedPlan)
                      const minSeats = planData?.minSeats ?? 1
                      onToolInputChange(tool, { 
                        plan: selectedPlan,
                        seats: Math.max(input.seats, minSeats)
                      })
                    }}
                    className={inputClass}
                  >
                    <option value="">Select plan</option>
                    {pricing?.plans?.map((plan) => (
                      <option key={plan.planName} value={plan.planName}>{plan.planName}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#666] ml-1" htmlFor={`${tool}-spend`}>
                    Monthly spend
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium text-[#666]">$</span>
                    <input
                      id={`${tool}-spend`}
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={input.monthlySpend === 0 ? "0" : (input.monthlySpend || "")}
                      onChange={(e) => {
                        const val = e.target.value
                        if (val === "" || /^\d*\.?\d*$/.test(val)) {
                          onToolInputChange(tool, { 
                            monthlySpend: val === "" ? undefined : Number(val) 
                          })
                        }
                      }}
                      className={`${inputClass} pl-8`}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-[#666] ml-1" htmlFor={`${tool}-seats`}>
                    Seats
                  </label>
                  <input
                    id={`${tool}-seats`}
                    type="number"
                    min={selectedPlan?.minSeats ?? 1}
                    value={input.seats || ""}
                    onChange={(e) => {
                      const val = Number(e.target.value) || 0
                      const min = selectedPlan?.minSeats ?? 1
                      onToolInputChange(tool, { seats: Math.max(min, val) })
                    }}
                    className={inputClass}
                  />
                  {selectedPlan?.minSeats && selectedPlan.minSeats > 1 && (
                    <p className="text-[10px] font-medium text-amber-600 ml-1">
                      Minimum {selectedPlan.minSeats} seats required for this plan
                    </p>
                  )}
                </div>
              </div>

              {selectedPlan && (
                <div className="mt-4 pt-4 border-t border-black/5 flex items-center justify-between">
                  <p className="text-[10px] font-medium text-[#666]">
                    Verified via <a href={selectedPlan.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-[#111] underline underline-offset-2 hover:text-[#00C853]">{new URL(selectedPlan.sourceUrl).hostname}</a>
                  </p>
                  <Info className="h-3.5 w-3.5 text-[#9CA3AF]" />
                </div>
              )}
            </motion.div>
          )
        })}
      </motion.div>

      {/* Total spend bar */}
      <div className="rounded-[32px] px-8 py-6 bg-[#f9fafb] border border-black/5 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#666] mb-1">Monthly Burn</p>
          <p className="text-3xl font-medium text-[#111]" style={{ fontFamily: "var(--font-heading)" }}>
            ${totalSpend.toFixed(0)}<span className="text-sm font-medium text-[#666] ml-1">/mo</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#666] mb-1">Annual Run Rate</p>
          <p className="text-xl font-semibold text-[#00C853]">
            ${(totalSpend * 12).toLocaleString()}/yr
          </p>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-4 border-t border-black/5">
        <button
          type="button"
          onClick={onBack}
          className="text-sm font-bold uppercase tracking-widest text-[#666] hover:text-[#111] transition-all flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <button
          type="button"
          onClick={onNext}
          className="btn-primary flex items-center gap-2"
        >
          Next: Team context <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  )
}