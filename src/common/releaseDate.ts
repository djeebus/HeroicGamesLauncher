/**
 * Normalizes a store-provided release date into an ISO 8601 string.
 * Returns undefined for missing, unparsable or placeholder (epoch or earlier)
 * dates, so callers can treat "no usable date" uniformly.
 */
export function toIsoReleaseDate(raw?: string | null): string | undefined {
  const timestamp = releaseTimestamp(raw)
  return timestamp === undefined ? undefined : new Date(timestamp).toISOString()
}

/**
 * Parses a release date into a millisecond timestamp, or undefined when the
 * date is missing, unparsable or a placeholder (epoch or earlier).
 */
export function releaseTimestamp(raw?: string | null): number | undefined {
  if (!raw) return undefined
  const timestamp = Date.parse(raw)
  if (Number.isNaN(timestamp) || timestamp <= 0) return undefined
  return timestamp
}
