"use client"

import type { AuditResult } from "@/lib/types"
import type { RecommendationChange } from "@/lib/auditDiff"
import { calculateAuditDelta, getToolDisplayName } from "@/lib/auditDiff"
import { ArrowUpRight, ArrowDownRight, Minus, Check, AlertTriangle, Plus, X, ArrowRight, Sparkles, Info } from "lucide-react"
import Link from "next/link"

type Props = {
  currentAudit: AuditResult
  previousAudit: AuditResult
}

function StatusBadge({ status }: { status: RecommendationChange["status"] }) {
  const config = {
    implemented: { label: "Implemented", bg: "bg-[#ECFDF5]", text: "text-[#059669]", border: "border-[#A7F3D0]", icon: <Check className="h-3 w-3" /> },
    changed: { label: "Changed", bg: "bg-[#FFF7ED]", text: "text-[#D97706]", border: "border-[#FDE68A]", icon: <AlertTriangle className="h-3 w-3" /> },
    unchanged: { label: "No Change", bg: "bg-[#F9FAFB]", text: "text-[#6B7280]", border: "border-[#E5E7EB]", icon: <Minus className="h-3 w-3" /> },
    new: { label: "New", bg: "bg-[#EFF6FF]", text: "text-[#2563EB]", border: "border-[#BFDBFE]", icon: <Plus className="h-3 w-3" /> },
    removed: { label: "Removed", bg: "bg-[#FEF2F2]", text: "text-[#DC2626]", border: "border-[#FECACA]", icon: <X className="h-3 w-3" /> },
  }
  const c = config[status]
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border ${c.bg} ${c.text} ${c.border}`}>
      {c.icon} {c.label}
    </span>
  )
}

function DeltaIndicator({ value, suffix = "/mo" }: { value: number; suffix?: string }) {
  if (value === 0) return <span className="text-[#9CA3AF] font-medium text-sm">No change</span>
  const isPositive = value > 0
  return (
    <span className={`inline-flex items-center gap-0.5 font-semibold text-sm ${isPositive ? "text-[#00C853]" : "text-[#EF4444]"}`}>
      {isPositive ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
      {isPositive ? "+" : ""}${Math.abs(value).toFixed(0)}{suffix}
    </span>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[24px] lg:text-[30px] font-bold tracking-widest text-[#111] mb-6">
      {children}
    </h3>
  )
}

export function AuditDiffView({ currentAudit, previousAudit }: Props) {
  const delta = calculateAuditDelta(currentAudit, previousAudit)
  const efficiencyDelta = delta.currentEfficiency - delta.previousEfficiency
  const savingsPercent = delta.previousTotalSavings > 0
    ? ((delta.totalSavingsDelta / delta.previousTotalSavings) * 100).toFixed(0)
    : delta.currentTotalSavings > 0 ? "+100" : "0"

  const prevDate = new Date(previousAudit.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  const currDate = new Date(currentAudit.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })

  const implementedCount = delta.recommendationChanges.filter(r => r.status === "implemented").length

  const currentDuplicates = currentAudit.summary?.duplicateCapabilities || []
  const previousDuplicates = previousAudit.summary?.duplicateCapabilities || []
  const resolvedDuplicates = previousDuplicates.filter(cap => !currentDuplicates.includes(cap))

  const takeaways: { title: string; desc: string; type: "success" | "warning" | "info" }[] = []

  const spendDiff = delta.currentTotalSpend - delta.previousTotalSpend
  if (spendDiff < 0) {
    takeaways.push({
      title: "Monthly Spend Reduced",
      desc: `Your stack spend decreased from $${delta.previousTotalSpend}/mo to $${delta.currentTotalSpend}/mo, successfully cutting monthly costs by $${Math.abs(spendDiff)}/mo ($${(Math.abs(spendDiff) * 12).toFixed(0)}/yr).`,
      type: "success"
    })
  } else if (spendDiff > 0) {
    takeaways.push({
      title: "Monthly Spend Increased",
      desc: `Your monthly stack spend rose by $${spendDiff}/mo due to additions or pricing changes, bringing total monthly spend to $${delta.currentTotalSpend}/mo.`,
      type: "warning"
    })
  } else {
    takeaways.push({
      title: "Monthly Spend Static",
      desc: `Total monthly spend remains unchanged at $${delta.currentTotalSpend}/mo. Apply outstanding recommendations to lower your recurring software costs.`,
      type: "info"
    })
  }

  if (implementedCount > 0) {
    takeaways.push({
      title: "Optimization Steps Taken",
      desc: `You implemented ${implementedCount} recommendation${implementedCount > 1 ? "s" : ""} since the last audit. Current potential savings now stand at $${delta.currentTotalSavings}/mo.`,
      type: "success"
    })
  } else if (delta.currentTotalSavings > 0) {
    takeaways.push({
      title: "Potential Savings Awaiting Action",
      desc: `You have $${delta.currentTotalSavings}/mo in monthly savings ($${(delta.currentTotalSavings * 12).toFixed(0)}/yr) waiting to be unlocked by optimizing plans and consolidating tools.`,
      type: "info"
    })
  }

  if (resolvedDuplicates.length > 0) {
    takeaways.push({
      title: "Capability Redundancy Resolved",
      desc: `Successfully eliminated duplicate tool subscriptions for capabilities: ${resolvedDuplicates.map(d => d.replace(/_/g, ' ')).join(', ')}.`,
      type: "success"
    })
  } else if (currentDuplicates.length > 0) {
    takeaways.push({
      title: "Active Capability Overlap",
      desc: `Your team currently pays for overlapping tools offering duplicate support for: ${currentDuplicates.map(d => d.replace(/_/g, ' ')).join(', ')}.`,
      type: "warning"
    })
  } else {
    takeaways.push({
      title: "Optimized Stack Footprint",
      desc: "Your software stack is highly streamlined with zero duplicate capability redundancies across your tools.",
      type: "success"
    })
  }

  const getCohort = (score: number) => {
    if (score >= 80) return { label: "Optimal Stack", desc: "Top 10% of engineering teams", color: "text-[#00C853]", bg: "bg-[#ECFDF5]", border: "border-[#A7F3D0]" }
    if (score >= 50) return { label: "Moderate Overlap", desc: "Average efficiency (Middle 60%)", color: "text-[#D97706]", bg: "bg-[#FFF7ED]", border: "border-[#FDE68A]" }
    return { label: "High Redundancy", desc: "Bottom 20% (Consolidation needed)", color: "text-[#EF4444]", bg: "bg-[#FEF2F2]", border: "border-[#FECACA]" }
  }

  const prevCohort = getCohort(delta.previousEfficiency)
  const currCohort = getCohort(delta.currentEfficiency)

  return (
    <div className="space-y-8">
      {/* Header Card */}
      <div className="rounded-[32px] border border-[#111] bg-white p-8 shadow-sm hover:shadow-md transition-shadow duration-300">
        <div className="pb-6 border-b border-black/5 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-[32px] font-bold tracking-widest text-[#111] mb-1">Audit Comparison</h2>
              <p className="text-[15px] text-[#666] font-medium">
                {prevDate} <ArrowRight className="inline h-3.5 w-3.5 mx-1.5 text-[#9CA3AF]" /> {currDate}
                <span className="text-[#9CA3AF] ml-2">({delta.daysBetween} days)</span>
              </p>
            </div>
            {implementedCount > 0 && (
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#ECFDF5] border border-[#A7F3D0]">
                <Check className="h-4 w-4 text-[#059669]" />
                <span className="text-sm font-bold text-[#059669]">
                  {implementedCount} recommendation{implementedCount > 1 ? "s" : ""} implemented
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Savings Delta Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-black/5">
          <div className="p-6 text-center">
            <p className="text-[12px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-2">Previous Savings</p>
            <p className="text-3xl font-bold text-[#111] tracking-tight">${delta.previousTotalSavings.toFixed(0)}<span className="text-sm text-[#9CA3AF] font-medium">/mo</span></p>
          </div>
          <div className="p-6 text-center">
            <p className="text-[12px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-2">Current Savings</p>
            <p className="text-3xl font-bold text-[#111] tracking-tight">${delta.currentTotalSavings.toFixed(0)}<span className="text-sm text-[#9CA3AF] font-medium">/mo</span></p>
          </div>
          <div className="p-6 text-center">
            <p className="text-[12px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-2">Savings Delta</p>
            <div className="flex flex-col items-center justify-center">
              <DeltaIndicator value={delta.totalSavingsDelta} />
              <p className="text-[11px] text-[#9CA3AF] mt-1 font-semibold">{savingsPercent}%</p>
            </div>
          </div>
          <div className="p-6 text-center">
            <p className="text-[12px] font-bold uppercase tracking-widest text-[#9CA3AF] mb-2">Efficiency</p>
            <p className="text-3xl font-bold tracking-tight">
              <span className="text-[#9CA3AF]">{delta.previousEfficiency}</span>
              <ArrowRight className="inline h-4 w-4 mx-2 text-[#D1D5DB]" />
              <span className={efficiencyDelta >= 0 ? "text-[#00C853]" : "text-[#EF4444]"}>{delta.currentEfficiency}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Audit Detail Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link
          href={`/audit/${previousAudit.id}`}
          className="group relative flex flex-col justify-between p-8 rounded-[32px] border border-[#111] bg-white shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300"
        >
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF] block mb-2">Previous Audit Detail</span>
            <h4 className="text-[20px] font-bold tracking-wide text-[#111] transition-colors">
              View Detailed Breakdown
            </h4>
            <p className="text-sm text-[#666] font-medium mt-2 leading-relaxed">
              Analyze the historical stack optimization recommendations and spent details as of {prevDate}.
            </p>
          </div>
          <div className="mt-6 flex items-center gap-1.5 text-xs font-semibold text-[#111] group-hover:translate-x-1 transition-transform">
            Go to Previous Audit <ArrowRight className="h-4 w-4" />
          </div>
        </Link>

        <Link
          href={`/audit/${currentAudit.id}`}
          className="group relative flex flex-col justify-between p-8 rounded-[32px] border border-[#111] bg-white shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300"
        >
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF] block mb-2">Current Audit Detail</span>
            <h4 className="text-[20px] font-bold tracking-wide text-[#111] transition-colors">
              View Detailed Breakdown
            </h4>
            <p className="text-sm text-[#666] font-medium mt-2 leading-relaxed">
              Analyze the new live stack recommendations computed with updated tool pricing as of {currDate}.
            </p>
          </div>
          <div className="mt-6 flex items-center gap-1.5 text-xs font-semibold text-[#111] group-hover:translate-x-1 transition-transform">
            Go to Current Audit <ArrowRight className="h-4 w-4" />
          </div>
        </Link>
      </div>

      {/* Comparative Insights & Benchmarks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Key Takeaways */}
        <div className="lg:col-span-2 rounded-[32px] border border-[#111] bg-white p-8 shadow-sm hover:shadow-md transition-shadow duration-300">
          <SectionTitle>Key Comparative Insights</SectionTitle>
          <div className="space-y-6">
            {takeaways.map((item, index) => {
              const IconComponent = item.type === "success" ? Sparkles : item.type === "warning" ? AlertTriangle : Info
              const iconColor = item.type === "success" ? "text-[#00C853]" : item.type === "warning" ? "text-[#EF4444]" : "text-[#3B82F6]"
              const iconBg = item.type === "success" ? "bg-[#ECFDF5]" : item.type === "warning" ? "bg-[#FEF2F2]" : "bg-[#EFF6FF]"
              const iconBorder = item.type === "success" ? "border-[#A7F3D0]" : item.type === "warning" ? "border-[#FECACA]" : "border-[#BFDBFE]"
              return (
                <div key={index} className="flex gap-4 items-start">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${iconBg} border ${iconBorder} shrink-0 shadow-sm ${iconColor}`}>
                    <IconComponent className="h-5 w-5" />
                  </div>
                  <div>
                    <h5 className="text-[16px] font-bold text-[#111]">{item.title}</h5>
                    <p className="text-sm text-[#666] font-medium leading-relaxed mt-1">{item.desc}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Market Benchmark */}
        <div className="rounded-[32px] border border-[#111] bg-white p-8 shadow-sm hover:shadow-md transition-shadow duration-300 flex flex-col justify-between">
          <div>
            <SectionTitle>Market Benchmarking</SectionTitle>
            <p className="text-sm text-[#666] font-medium mb-6 leading-relaxed">
              Where your stack ranks compared to benchmarks of over 10,000 engineering teams.
            </p>
            
            <div className="space-y-4">
              <div className="p-4 rounded-2xl border border-black/5 bg-[#F9FAFB]/50">
                <span className="text-[9px] font-bold uppercase tracking-wider text-[#9CA3AF] block mb-1">Previous Cohort</span>
                <span className={`text-xs font-bold ${prevCohort.color}`}>{prevCohort.label}</span>
                <span className="text-[11px] text-[#666] font-medium block mt-0.5">{prevCohort.desc}</span>
              </div>

              <div className="flex justify-center my-1 text-[#9CA3AF]">
                <ArrowRight className="h-5 w-5 rotate-90 lg:rotate-0" />
              </div>

              <div className={`p-4 rounded-2xl border ${currCohort.border} ${currCohort.bg}`}>
                <span className="text-[9px] font-bold uppercase tracking-wider text-[#9CA3AF] block mb-1">Current Cohort</span>
                <span className={`text-xs font-bold ${currCohort.color}`}>{currCohort.label}</span>
                <span className="text-[11px] text-[#666] font-medium block mt-0.5">{currCohort.desc}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tools Removed */}
      {delta.toolsRemoved.length > 0 && (
        <div>
          <SectionTitle>Tools Removed</SectionTitle>
          <div className="space-y-4">
            {delta.toolsRemoved.map((t) => (
              <div key={t.tool} className="rounded-[24px] border border-[#111] bg-white p-6 shadow-sm hover:shadow-md transition-all duration-300">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-[#111]">{getToolDisplayName(t.tool)}</span>
                      <span className="text-xs text-[#9CA3AF] font-medium">{t.previousPlan}</span>
                      <StatusBadge status={t.previousAction === "remove" || t.previousAction === "cancel-redundant" ? "implemented" : "removed"} />
                    </div>
                    <p className="text-sm text-[#666] leading-relaxed">{t.reason}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-[#EF4444] line-through">${t.previousSpend.toFixed(0)}/mo</p>
                    <p className="text-xs text-[#9CA3AF]">${(t.previousSpend * 12).toFixed(0)}/yr saved</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tools Added */}
      {delta.toolsAdded.length > 0 && (
        <div>
          <SectionTitle>Tools Added</SectionTitle>
          <div className="space-y-4">
            {delta.toolsAdded.map((t) => (
              <div key={t.tool} className="rounded-[24px] border border-[#111] bg-white p-6 shadow-sm hover:shadow-md transition-all duration-300 bg-[#EFF6FF]/10">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-[#111]">{getToolDisplayName(t.tool)}</span>
                      <span className="text-xs text-[#9CA3AF] font-medium">{t.plan}</span>
                      <StatusBadge status="new" />
                    </div>
                    <p className="text-sm text-[#666] leading-relaxed">{t.reason}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-[#2563EB]">+${t.spend.toFixed(0)}/mo</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Plan Changes */}
      {delta.planChanges.length > 0 && (
        <div>
          <SectionTitle>Plan Changes</SectionTitle>
          <div className="space-y-4">
            {delta.planChanges.map((p) => (
              <div key={p.tool} className="rounded-[24px] border border-[#111] bg-white p-6 shadow-sm hover:shadow-md transition-all duration-300">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="font-semibold text-[#111]">{getToolDisplayName(p.tool)}</span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm text-[#9CA3AF] line-through">{p.oldPlan}</span>
                      <ArrowRight className="h-3 w-3 text-[#D1D5DB]" />
                      <span className="text-sm font-medium text-[#111]">{p.newPlan}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-[#9CA3AF]">${p.oldSpend.toFixed(0)}</span>
                      <ArrowRight className="h-3 w-3 text-[#D1D5DB]" />
                      <span className="text-sm font-semibold text-[#111]">${p.newSpend.toFixed(0)}</span>
                    </div>
                    <DeltaIndicator value={-p.monthlyDelta} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tool-by-Tool Breakdown */}
      <div>
        <SectionTitle>Tool-by-Tool Breakdown</SectionTitle>
        <div className="rounded-[32px] border border-[#111] bg-white shadow-sm overflow-hidden divide-y divide-black/5">
          {delta.recommendationChanges.map((r) => {
            const bgClass = r.status === "implemented"
              ? "bg-[#ECFDF5]/40"
              : r.status === "changed"
                ? "bg-[#FFF7ED]/40"
                : r.status === "new"
                  ? "bg-[#EFF6FF]/30"
                  : r.status === "removed"
                    ? "bg-[#FEF2F2]/30"
                    : ""
            return (
              <div key={r.tool} className={`p-5 ${bgClass}`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-[#111] text-sm">{getToolDisplayName(r.tool)}</span>
                    <StatusBadge status={r.status} />
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="text-right">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF] block mb-0.5">Previous</span>
                      <span className="text-[#9CA3AF] font-medium">{r.oldAction}</span>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-[#D1D5DB] shrink-0" />
                    <div className="text-right">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF] block mb-0.5">Current</span>
                      <span className="text-[#111] font-semibold">{r.newAction}</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
