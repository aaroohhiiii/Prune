import crypto from "crypto"
import { supabaseService } from "./supabase"

// Ensure we have a valid JWT_SECRET (fallback for development)
const JWT_SECRET = process.env.JWT_SECRET || "development-fallback-secret-key-at-least-32-chars-long"

export interface EmailPreferences {
  user_email: string
  opted_in_reaudit_emails: boolean
  opted_in_audit_results: boolean
  opted_in_marketing: boolean
  unsubscribed_at?: string | null
}

/**
 * Generates a signed, URL-safe unsubscribe token containing the email and expiration time.
 * Token expires in 24 hours.
 */
export function generateUnsubscribeToken(email: string): string {
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000 // 24 hours from now
  const payload = JSON.stringify({ email: email.toLowerCase().trim(), expiresAt })
  
  const signature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(payload)
    .digest("hex")

  return Buffer.from(JSON.stringify({ payload, signature })).toString("base64url")
}

/**
 * Verifies the signature and expiration of an unsubscribe token.
 * Returns the decoded email if valid, or null if invalid/expired.
 */
export function verifyUnsubscribeToken(token: string): { email: string } | null {
  try {
    const raw = Buffer.from(token, "base64url").toString("utf8")
    const { payload, signature } = JSON.parse(raw)

    const expectedSignature = crypto
      .createHmac("sha256", JWT_SECRET)
      .update(payload)
      .digest("hex")

    if (signature !== expectedSignature) {
      console.warn("[emailTokens] Token signature verification failed")
      return null
    }

    const { email, expiresAt } = JSON.parse(payload)
    if (Date.now() > expiresAt) {
      console.warn("[emailTokens] Token has expired")
      return null
    }

    return { email }
  } catch (error) {
    console.error("[emailTokens] Failed to verify unsubscribe token:", error)
    return null
  }
}

/**
 * Fetches email preferences for a user.
 * Defaults to opted-in for re-audits and audit results if no record exists.
 */
export async function getEmailPreferences(email: string): Promise<EmailPreferences> {
  const normalizedEmail = email.toLowerCase().trim()

  if (!supabaseService) {
    return {
      user_email: normalizedEmail,
      opted_in_reaudit_emails: true,
      opted_in_audit_results: true,
      opted_in_marketing: false,
    }
  }

  try {
    const { data, error } = await supabaseService
      .from("email_preferences")
      .select("*")
      .eq("user_email", normalizedEmail)
      .single()

    if (error || !data) {
      return {
        user_email: normalizedEmail,
        opted_in_reaudit_emails: true,
        opted_in_audit_results: true,
        opted_in_marketing: false,
      }
    }

    return {
      user_email: data.user_email,
      opted_in_reaudit_emails: !!data.opted_in_reaudit_emails,
      opted_in_audit_results: !!data.opted_in_audit_results,
      opted_in_marketing: !!data.opted_in_marketing,
      unsubscribed_at: data.unsubscribed_at,
    }
  } catch (err) {
    console.error("[emailTokens] Error checking email preferences in database:", err)
    return {
      user_email: normalizedEmail,
      opted_in_reaudit_emails: true,
      opted_in_audit_results: true,
      opted_in_marketing: false,
    }
  }
}

/**
 * Updates a specific preference column for a user (upserting if the record does not exist).
 */
export async function updateEmailPreference(
  email: string,
  preference: "reaudit" | "audit_results" | "marketing" | string,
  value: boolean
): Promise<EmailPreferences> {
  if (!supabaseService) {
    throw new Error("Supabase service client not initialized")
  }

  const normalizedEmail = email.toLowerCase().trim()
  let columnName = ""

  if (preference === "reaudit") {
    columnName = "opted_in_reaudit_emails"
  } else if (preference === "audit_results") {
    columnName = "opted_in_audit_results"
  } else if (preference === "marketing") {
    columnName = "opted_in_marketing"
  } else {
    columnName = preference
  }

  const updateData: Record<string, unknown> = {
    [columnName]: value,
    updated_at: new Date().toISOString(),
  }

  if (value === false) {
    updateData.unsubscribed_at = new Date().toISOString()
  }

  const { data, error } = await supabaseService
    .from("email_preferences")
    .upsert(
      {
        user_email: normalizedEmail,
        ...updateData,
      },
      { onConflict: "user_email" }
    )
    .select()
    .single()

  if (error) {
    console.error("[emailTokens] Failed to update email preferences:", error)
    throw error
  }

  return {
    user_email: data.user_email,
    opted_in_reaudit_emails: !!data.opted_in_reaudit_emails,
    opted_in_audit_results: !!data.opted_in_audit_results,
    opted_in_marketing: !!data.opted_in_marketing,
    unsubscribed_at: data.unsubscribed_at,
  }
}
