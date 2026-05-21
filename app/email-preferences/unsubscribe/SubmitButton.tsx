"use client"
import { useFormStatus } from "react-dom"
import React from "react"

export function SubmitButton({ style }: { style: React.CSSProperties }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" style={{ ...style, opacity: pending ? 0.7 : 1, cursor: pending ? "not-allowed" : "pointer" }} disabled={pending}>
      {pending ? "Saving..." : "Save Preferences"}
    </button>
  )
}
