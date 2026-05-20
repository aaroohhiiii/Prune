import { notFound } from "next/navigation"
import Link from "next/link"
import { supabasePublic } from "@/lib/supabase"
import type { AuditResult } from "@/lib/types"
import { ResultsNavbar } from "@/components/AuditResults/ResultsNavbar"
import { AuditDiffView } from "@/components/AuditDiffView"
import { ArrowLeft, BarChart3, AlertTriangle } from "lucide-react"

function mapAuditRow(data: Record<string, unknown>): AuditResult {
  return {
    id: data.id as string,
    input: data.input as AuditResult["input"],
    results: (data.results as Record<string, unknown>[]).map((r) => ({
      ...r,
      strengths: (r.strengths as string[]) || [],
      weaknesses: (r.weaknesses as string[]) || [],
      alternativeTool: (r.alternativeTool as string) || "",
      uniqueCapabilityAnalysis: (r.uniqueCapabilityAnalysis as string) || "",
    })) as AuditResult["results"],
    totalMonthlySavings: data.total_monthly_savings as number,
    totalAnnualSavings: data.total_annual_savings as number,
    aiSummary: data.ai_summary as string,
    isOptimal: data.is_optimal as boolean,
    showCredex: data.show_credex as boolean,
    createdAt: data.created_at as string,
    summary: (data.summary ?? undefined) as AuditResult["summary"],
    efficiencyScore: (data.efficiency_score ?? undefined) as number | undefined,
    referralCode: (data.referral_code ?? undefined) as string | undefined,
  }
}

async function getAudit(id: string): Promise<AuditResult | null> {
  const { data, error } = await supabasePublic
    .from("audits")
    .select("*")
    .eq("id", id)
    .single()

  if (error || !data) return null
  return mapAuditRow(data)
}

async function getPreviousAuditId(auditId: string): Promise<string | null> {
  const { data } = await supabasePublic
    .from("audits")
    .select("previous_audit_id")
    .eq("id", auditId)
    .single()

  return data?.previous_audit_id || null
}

export async function generateMetadata() {
  return {
    title: "Audit Comparison — Vantage",
    description: "Compare your current and previous AI spend audits side by side.",
  }
}

export default async function AuditComparePage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { prev?: string }
}) {
  const currentAudit = await getAudit(params.id)
  if (!currentAudit) notFound()

  // Determine previous audit: from query param, or from DB column
  let prevAuditId = searchParams.prev || null
  if (!prevAuditId) {
    prevAuditId = await getPreviousAuditId(params.id)
  }

  // If no previous audit exists at all
  if (!prevAuditId) {
    return (
      <div className="min-h-screen bg-white">
        <ResultsNavbar />
        <main className="mx-auto w-[95%] max-w-screen-2xl px-2 sm:px-6 pt-32 pb-24">
          <div className="rounded-[32px] border border-[#111] bg-white p-8 lg:p-12 text-center shadow-sm">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#F9FAFB] border border-[#111] mb-6 text-[#111]">
              <BarChart3 className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#111] mb-3">No Previous Audit Found</h1>
            <p className="text-[#666] text-sm font-medium max-w-md mx-auto mb-8 leading-relaxed">
              This is your first audit — there&apos;s nothing to compare yet. Run another audit after implementing
              recommendations, and you&apos;ll see a detailed diff of what changed.
            </p>
            <Link
              href={`/audit/${params.id}`}
              className="inline-flex items-center gap-2 bg-[#111] text-white text-sm font-semibold px-6 py-3 rounded-full hover:bg-black transition-all"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Audit Results
            </Link>
          </div>
        </main>
      </div>
    )
  }

  const previousAudit = await getAudit(prevAuditId)

  // If prev ID was provided but audit doesn't exist
  if (!previousAudit) {
    return (
      <div className="min-h-screen bg-white">
        <ResultsNavbar />
        <main className="mx-auto w-[95%] max-w-screen-2xl px-2 sm:px-6 pt-32 pb-24">
          <div className="rounded-[32px] border border-[#111] bg-white p-8 lg:p-12 text-center shadow-sm">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#FEF2F2] border border-[#EF4444] mb-6 text-[#EF4444]">
              <AlertTriangle className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#111] mb-3">Previous Audit Not Found</h1>
            <p className="text-[#666] text-sm font-medium max-w-md mx-auto mb-8 leading-relaxed">
              The referenced previous audit could not be loaded. It may have been deleted or the ID is incorrect.
            </p>
            <Link
              href={`/audit/${params.id}`}
              className="inline-flex items-center gap-2 bg-[#111] text-white text-sm font-semibold px-6 py-3 rounded-full hover:bg-black transition-all"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Audit Results
            </Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <ResultsNavbar />
      <main className="mx-auto w-[95%] max-w-screen-2xl px-2 sm:px-6 pt-32 pb-24">
        <div className="mb-6">
          <Link
            href={`/audit/${params.id}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#666] hover:text-[#111] transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to audit results
          </Link>
        </div>

        <AuditDiffView currentAudit={currentAudit} previousAudit={previousAudit} />
      </main>
    </div>
  )
}
