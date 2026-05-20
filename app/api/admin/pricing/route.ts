import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { pricingData } from "@/lib/pricingData"
import { invalidatePricingCache } from "@/lib/pricingService"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const key = supabaseServiceRoleKey || supabaseAnonKey
const supabase = supabaseUrl && key ? createClient(supabaseUrl, key) : null

export async function PATCH(request: Request) {
  try {
    // 1. Authenticate using ADMIN_API_KEY
    const authHeader = request.headers.get("Authorization")
    const queryKey = new URL(request.url).searchParams.get("apiKey")
    const providedKey = authHeader ? authHeader.replace("Bearer ", "") : queryKey

    const adminApiKey = process.env.ADMIN_API_KEY
    if (!adminApiKey) {
      return NextResponse.json(
        { error: "Admin authentication is not configured on the server" },
        { status: 500 }
      )
    }

    if (!providedKey || providedKey !== adminApiKey) {
      return NextResponse.json(
        { error: "Unauthorized: Invalid or missing ADMIN_API_KEY" },
        { status: 401 }
      )
    }

    // 2. Parse & Validate Request Body
    const body = await request.json()
    const { tool, plan, new_price, verified_date, source_url } = body

    if (!tool || !plan || new_price === undefined || !verified_date || !source_url) {
      return NextResponse.json(
        { error: "Missing required fields: tool, plan, new_price, verified_date, source_url" },
        { status: 400 }
      )
    }

    const priceNum = parseFloat(new_price)
    if (isNaN(priceNum) || priceNum <= 0) {
      return NextResponse.json(
        { error: "Invalid price: new_price must be a positive number greater than 0" },
        { status: 400 }
      )
    }

    // Map tool name to standard internal representation
    const matchedTool = pricingData.find(
      (t) =>
        t.toolName.toLowerCase() === tool.toLowerCase() ||
        t.displayName.toLowerCase() === tool.toLowerCase()
    )

    if (!matchedTool) {
      return NextResponse.json(
        { error: `Invalid tool name: ${tool} is not supported` },
        { status: 400 }
      )
    }

    const toolName = matchedTool.toolName
    const matchedPlan = matchedTool.plans.find(
      (p) => p.planName.toLowerCase() === plan.toLowerCase()
    )

    if (!matchedPlan) {
      return NextResponse.json(
        { error: `Invalid plan name: ${plan} is not supported for tool ${toolName}` },
        { status: 400 }
      )
    }

    const planName = matchedPlan.planName

    if (!supabase) {
      return NextResponse.json(
        { error: "Database client is not initialized" },
        { status: 500 }
      )
    }

    // 3. Update active status on database (Ledger pattern)
    // Find the current active row price to return as "old_price"
    const { data: activeRows, error: fetchError } = await supabase
      .from("pricing_snapshot")
      .select("price_per_month, min_seats, features")
      .eq("tool_name", toolName)
      .eq("plan_name", planName)
      .eq("is_active", true)
      .limit(1)

    if (fetchError) throw fetchError

    const oldPrice = activeRows && activeRows.length > 0
      ? parseFloat(activeRows[0].price_per_month)
      : matchedPlan.pricePerUserPerMonth

    const minSeats = activeRows && activeRows.length > 0
      ? activeRows[0].min_seats
      : (matchedPlan.minSeats || null)

    const features = activeRows && activeRows.length > 0
      ? activeRows[0].features
      : []

    // Mark previous active price row as inactive
    const { error: deactivateError } = await supabase
      .from("pricing_snapshot")
      .update({ is_active: false })
      .eq("tool_name", toolName)
      .eq("plan_name", planName)
      .eq("is_active", true)

    if (deactivateError) throw deactivateError

    // Insert new active price row
    const { error: insertError } = await supabase
      .from("pricing_snapshot")
      .insert({
        tool_name: toolName,
        plan_name: planName,
        price_per_month: priceNum,
        min_seats: minSeats,
        features: features,
        source_url: source_url,
        verified_date: verified_date,
        is_active: true,
      })

    if (insertError) throw insertError
    // 4. Invalidate the in-memory pricing cache
    invalidatePricingCache()

    // 5. Count affected audits in database using JSONB containment
    const { count, error: countError } = await supabase
      .from("audits")
      .select("id", { count: "exact", head: true })
      .contains("input", { tools: [{ tool: toolName, plan: planName }] })

    if (countError) {
      console.warn("[pricing-api] Failed to fetch affected audits count:", countError)
    }

    // 6. Trigger recompute asynchronously in background
    Promise.resolve().then(async () => {
      try {
        const { recomputeAuditsForPricingChange } = await import("@/lib/auditRecompute")
        const { sendPricingChangeEmails } = await import("@/lib/emailNotifications")
        
        console.log(`[pricing-api] Started recomputing ${count || 0} audits for ${toolName} pricing change`)
        const recomputeResult = await recomputeAuditsForPricingChange(toolName)
        if (recomputeResult.changedAudits.length > 0) {
          const emailResult = await sendPricingChangeEmails(recomputeResult.changedAudits)
          console.log(`[pricing-api] Recomputation complete: ${recomputeResult.auditsChanged} changed, ${emailResult.emailsSent} emails sent`)
        } else {
          console.log(`[pricing-api] Recomputation complete: no audits changed`)
        }
      } catch (e) {
        console.error("[pricing-api] Background audit recomputation failed:", e)
      }
    })

    return NextResponse.json({
      success: true,
      old_price: oldPrice,
      new_price: priceNum,
      affected_audits: count || 0,
    })
  } catch (err: unknown) {
    const error = err as Error
    console.error("[pricing-api] Error processing request:", error)
    return NextResponse.json(
      { error: "Database operation failed", message: error.message || String(err) },
      { status: 500 }
    )
  }
}
