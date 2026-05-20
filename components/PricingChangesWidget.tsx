"use client"

export default PricingChangesWidget

import { useEffect, useState } from "react"
import { formatDate } from "@/lib/pricingHelpers"
import { ToolIcon, TOOL_DISPLAY_NAMES } from "@/components/ui/ToolIcon"
import type { ToolName } from "@/lib/types"

interface PricingChange {
  id: string
  tool_name: string
  plan_name: string
  old_price: number
  new_price: number
  detected_at: string
}

// Client-side cache — 0ms TTL in dev so every mount fetches fresh data
let cachedData: PricingChange[] | null = null
let cacheTime = 0
const CACHE_TTL = process.env.NODE_ENV === "development" ? 0 : 5 * 60 * 1000

function SkeletonCard() {
  return (
    <div
      style={{
        background: "white",
        border: "1px solid #E5E7EB",
        borderRadius: 20,
        padding: "20px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        animation: "pulse 1.5s ease-in-out infinite",
      }}
    >
      <div style={{ height: 14, width: "60%", background: "#F3F4F6", borderRadius: 6 }} />
      <div style={{ height: 22, width: "80%", background: "#F3F4F6", borderRadius: 6 }} />
      <div style={{ height: 12, width: "40%", background: "#F3F4F6", borderRadius: 6 }} />
    </div>
  )
}

export function PricingChangesWidget() {
  const [changes, setChanges] = useState<PricingChange[]>([])
  const [loading, setLoading] = useState(true)
  const [timedOut, setTimedOut] = useState(false)
  const [fetchKey, setFetchKey] = useState(0) // bump to force a re-fetch

  function fetchChanges() {
    // Return cached data immediately if fresh
    if (cachedData && Date.now() - cacheTime < CACHE_TTL) {
      setChanges(cachedData)
      setLoading(false)
      return () => {}
    }

    setLoading(true)
    setTimedOut(false)

    const controller = new AbortController()
    const timeout = setTimeout(() => {
      controller.abort()
      setTimedOut(true)
      setLoading(false)
    }, 5000)

    fetch("/api/pricing-changes?days=7&limit=4", { signal: controller.signal })
      .then((r) => r.json())
      .then((data: PricingChange[]) => {
        clearTimeout(timeout)
        cachedData = data
        cacheTime = Date.now()
        setChanges(data)
        setLoading(false)
      })
      .catch(() => {
        clearTimeout(timeout)
        setLoading(false)
      })

    return () => {
      clearTimeout(timeout)
      controller.abort()
    }
  }

  useEffect(() => {
    const cleanup = fetchChanges()
    return cleanup
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchKey])

  const handleRefresh = () => {
    // Bust the cache and re-fetch
    cachedData = null
    cacheTime = 0
    setFetchKey((k) => k + 1)
  }

  const isUp = (change: PricingChange) => change.new_price > change.old_price
  const priceDelta = (change: PricingChange) => {
    const delta = change.new_price - change.old_price
    return (delta > 0 ? "+" : "") + "$" + Math.abs(delta).toFixed(0)
  }

  // Only hard-hide on network timeout — never hide just because data is empty
  if (!loading && timedOut) return null

  return (
    <section className="py-20 px-6 relative z-10">
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span
                style={{
                  display: "inline-block",
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: "#00C853",
                  boxShadow: "0 0 0 3px rgba(0,200,83,0.2)",
                }}
              />
              <span className="text-xs font-bold text-[#00C853] uppercase tracking-widest">
                Live Tracking
              </span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-[#111]">
              This Week in AI Pricing
            </h2>
            <p className="text-[#666] font-medium mt-2 text-base">
              Real pricing changes we&apos;re tracking . Your audit could already be out of date.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs font-bold text-[#999] whitespace-nowrap">Last 7 days</span>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="text-xs font-bold text-[#111] border border-black/10 rounded-full px-4 py-1.5 hover:bg-black/5 transition-all disabled:opacity-40"
            >
              {loading ? "Loading…" : "↻ Refresh"}
            </button>
          </div>
        </div>

        {/* Cards grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: 16,
          }}
        >
          {loading
            ? [0, 1, 2, 3].map((i) => <SkeletonCard key={i} />)
            : changes.length === 0
            ? (
              <div
                style={{
                  gridColumn: "1 / -1",
                  textAlign: "center",
                  padding: "48px 24px",
                  color: "#111",
                  fontWeight: 600,
                  fontSize: 14,
                  border: "1px solid #111",
                  borderRadius: 20,
                }}
              >
                No pricing changes in the last 7 days.
                <br />
               
              </div>
            )
            : changes.map((change) => {
                const up = isUp(change)
                const toolKey = change.tool_name.toLowerCase() as ToolName
                const displayName = TOOL_DISPLAY_NAMES[toolKey] || change.tool_name

                return (
                  <div
                    key={change.id}
                    className="glass-card rounded-[20px] border border-black/5 p-6 flex flex-col gap-4 hover:shadow-lg hover:-translate-y-0.5 transition-all"
                  >
                    {/* Tool Logo + Name/Plan */}
                    <div className="flex items-center gap-3">
                      <ToolIcon tool={toolKey} size={32} />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[#111] text-sm leading-tight truncate">
                          {displayName}
                        </p>
                        <p className="text-xs text-[#666] font-medium mt-0.5 truncate">
                          {change.plan_name} Plan
                        </p>
                      </div>
                    </div>

                    {/* Price change */}
                    <div className="flex items-center gap-2">
                      <span className="text-base font-medium text-[#666] line-through">
                        ${change.old_price.toFixed(0)}
                      </span>
                      <span className="text-[#999] text-sm">→</span>
                      <span
                        className="text-xl font-bold"
                        style={{ color: up ? "#DC2626" : "#00C853" }}
                      >
                        ${change.new_price.toFixed(0)}
                      </span>
                      <span
                        className="text-xs font-bold ml-auto"
                        style={{ color: up ? "#DC2626" : "#00C853" }}
                      >
                        {priceDelta(change)}/mo
                      </span>
                    </div>

                    {/* Date */}
                    <p className="text-xs text-[#999] font-medium">
                      Detected {formatDate(change.detected_at)}
                    </p>
                  </div>
                )
              })}
        </div>

        {/* CTA beneath */}
        {!loading && changes.length > 0 && (
          <p className="text-center text-sm text-[#666] font-medium mt-8">
            Prices shifted above?{" "}
            <a
              href="/audit/new"
              className="text-[#111] font-bold underline underline-offset-2 hover:opacity-60 transition-opacity"
            >
              Re-run your audit now →
            </a>
          </p>
        )}
      </div>
    </section>
  )
}
