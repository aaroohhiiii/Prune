import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const key = supabaseServiceRoleKey || supabaseAnonKey
const supabase = supabaseUrl && key ? createClient(supabaseUrl, key) : null

export async function GET(request: Request) {
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

    if (!supabase) {
      return NextResponse.json(
        { error: "Database client is not initialized" },
        { status: 500 }
      )
    }

    // 2. Fetch all leads and their linked audits
    const { data: leads, error: leadsError } = await supabase
      .from("leads")
      .select(`
        id,
        email,
        company_name,
        created_at,
        audits (
          id,
          input,
          total_monthly_savings,
          is_optimal,
          created_at
        )
      `)

    if (leadsError) throw leadsError

    return NextResponse.json({
      success: true,
      total_leads: leads?.length || 0,
      leads: leads || [],
    })
  } catch (err: unknown) {
    const error = err as Error
    console.error("[leads-api] Error fetching leads:", error)
    return NextResponse.json(
      { error: "Failed to fetch leads", message: error.message || String(err) },
      { status: 500 }
    )
  }
}
