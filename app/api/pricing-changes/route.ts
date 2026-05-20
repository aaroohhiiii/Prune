import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const days = Math.min(parseInt(searchParams.get("days") || "7", 10), 30)
    const limit = Math.min(parseInt(searchParams.get("limit") || "4", 10), 10)

    if (!supabase) {
      return NextResponse.json([], { status: 200 })
    }

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    const { data, error } = await supabase
      .from("pricing_changes")
      .select("id, tool_name, plan_name, old_price, new_price, detected_at")
      .gte("detected_at", since)
      // Remove rows with null price values – Supabase cannot filter numeric null directly
      .order("detected_at", { ascending: false })
      .limit(limit)


    if (error) {
      console.error("[pricing-changes] DB error:", error)
      return NextResponse.json([], { status: 200 })
    }

    // Filter out rows where price didn't actually change
    const filtered = (data || []).filter(
      (row) => parseFloat(row.old_price) !== parseFloat(row.new_price)
    )

    return NextResponse.json(filtered, {
      headers: {
        // 5-minute CDN cache, 1-minute stale-while-revalidate
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
      },
    })
  } catch (err) {
    console.error("[pricing-changes] Unexpected error:", err)
    return NextResponse.json([], { status: 200 })
  }
}
