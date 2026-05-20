/**
 * Returns the severity magnitude of a price change.
 */
export function calculateMagnitude(
  oldPrice: number,
  newPrice: number
): "major" | "moderate" | "minor" {
  const delta = Math.abs(newPrice - oldPrice)
  if (delta > 20) return "major"
  if (delta > 5) return "moderate"
  return "minor"
}

/**
 * Formats an ISO timestamp to a short human-readable date like "May 19".
 */
export function formatDate(isoDate: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(
      new Date(isoDate)
    )
  } catch {
    return ""
  }
}
