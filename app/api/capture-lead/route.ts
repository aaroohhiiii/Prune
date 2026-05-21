import { NextResponse } from "next/server"
import { headers } from "next/headers"

import { Ratelimit } from "@upstash/ratelimit"
import { redis } from "@/lib/redis"
import { getAuditById, saveLead } from "@/lib/supabase"
import { sendAuditResultsEmail } from "@/lib/resend"
import { updateEmailPreference } from "@/lib/emailTokens"

// Rate limiter is only active when Upstash Redis is configured
const ratelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(3, "1 h"),
      analytics: true,
      prefix: "vantage:lead",
    })
  : null

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type LeadRequestBody = {
  auditId: string
  email: string
  companyName?: string
  role?: string
  honeypot?: string
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LeadRequestBody

    // Honeypot: silently succeed if filled (bot trap)
    if (body.honeypot && body.honeypot.length > 0) {
      return NextResponse.json({ success: true })
    }

    // Validate required fields
    if (!body.auditId || typeof body.auditId !== "string") {
      return NextResponse.json(
        { message: "auditId is required" },
        { status: 400 },
      )
    }

    if (!body.email || typeof body.email !== "string" || !EMAIL_REGEX.test(body.email)) {
      return NextResponse.json(
        { message: "A valid email address is required" },
        { status: 400 },
      )
    }

    // Rate limit by IP (skipped if Upstash not configured)
    const headersList = await headers()
    if (ratelimit) {
      const ip = headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
      const { success: rateLimitOk } = await ratelimit.limit(ip)

      if (!rateLimitOk) {
        return NextResponse.json(
          { message: "Too many requests. Please try again later." },
          { status: 429 },
        )
      }
    }

    // Fetch the audit to validate it exists and for the email
    const audit = await getAuditById(body.auditId)
    if (!audit) {
      return NextResponse.json(
        { message: "Audit not found" },
        { status: 404 },
      )
    }

    // Save the lead
    const saved = await saveLead({
      auditId: body.auditId,
      email: body.email.trim().toLowerCase(),
      companyName: body.companyName?.trim(),
      role: body.role?.trim(),
      teamSize: audit.input.teamSize,
    })

    if (!saved) {
      return NextResponse.json(
        { message: "Failed to save lead" },
        { status: 500 },
      )
    }

    // Auto-link this audit to the user's most recent previous audit
    // This powers the "Compare with Previous Audit" feature
    try {
      const { getSupabaseServerClient } = await import("@/lib/supabase")
      const supabaseServer = getSupabaseServerClient()
      
      // Find the user's most recent OTHER audit (via leads table)
      const { data: previousLeads } = await supabaseServer
        .from("leads")
        .select("audit_id")
        .eq("email", body.email.trim().toLowerCase())
        .neq("audit_id", body.auditId)
        .order("created_at", { ascending: false })
        .limit(1)

      if (previousLeads && previousLeads.length > 0) {
        await supabaseServer
          .from("audits")
          .update({ previous_audit_id: previousLeads[0].audit_id })
          .eq("id", body.auditId)
      }
    } catch (linkErr) {
      // Non-critical — don't fail the request if linking fails
      console.warn("[capture-lead] Failed to link previous audit:", linkErr)
    }

    // Since the user is requesting a new audit report, restore their essential email preferences
    try {
      const formattedEmail = body.email.trim().toLowerCase()
      await updateEmailPreference(formattedEmail, "audit_results", true)
      await updateEmailPreference(formattedEmail, "reaudit", true)
    } catch (prefErr) {
      console.warn("[capture-lead] Failed to restore email preferences:", prefErr)
    }

    // Send the results email (fire-and-forget — don't block response)
    const baseUrl = headersList.get("host") ?? "vantage.vercel.app"
    const protocol = baseUrl.includes("localhost") ? "http" : "https"
    const auditUrl = `${protocol}://${baseUrl}/audit/${body.auditId}`

    sendAuditResultsEmail({
      to: body.email.trim().toLowerCase(),
      audit,
      auditUrl,
    }).catch((err) => console.error("Email send failed:", err))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Lead capture error:", error)
    return NextResponse.json(
      { message: "Unexpected server error" },
      { status: 500 },
    )
  }
}
