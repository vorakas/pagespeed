/**
 * Pacific-time datetime formatters for the Launch Dashboard.
 *
 * Backend timestamps arrive in UTC (Jira ISO strings, Railway-side
 * epoch seconds, vault sync timestamps). Pacific is the operations
 * team's timezone, so the dashboard normalizes to it everywhere a
 * timestamp is shown to a user.
 *
 * Each formatter accepts an ISO string, an epoch-ms number, or a
 * `Date`, and returns a placeholder ("—") on invalid input rather
 * than throwing — every caller is rendering inside JSX where a
 * crash would replace the whole panel with an error boundary.
 *
 * Tip: don't build new `Intl.DateTimeFormat` instances inline in a
 * render path. The constructor is non-trivial; the helpers below
 * lazily memoize a single formatter per shape.
 */

const PACIFIC_TZ = "America/Los_Angeles"

type DateInput = string | number | Date | null | undefined

const PLACEHOLDER = "—"

let _dateFmt: Intl.DateTimeFormat | null = null
let _dateLongFmt: Intl.DateTimeFormat | null = null
let _timeFmt: Intl.DateTimeFormat | null = null
let _dateTimeFmt: Intl.DateTimeFormat | null = null

function dateFmt(): Intl.DateTimeFormat {
  if (_dateFmt) return _dateFmt
  _dateFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: PACIFIC_TZ,
    month: "short",
    day: "numeric",
    year: "numeric",
  })
  return _dateFmt
}

function dateLongFmt(): Intl.DateTimeFormat {
  if (_dateLongFmt) return _dateLongFmt
  _dateLongFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: PACIFIC_TZ,
    month: "long",
    day: "numeric",
    year: "numeric",
  })
  return _dateLongFmt
}

function timeFmt(): Intl.DateTimeFormat {
  if (_timeFmt) return _timeFmt
  _timeFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: PACIFIC_TZ,
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  })
  return _timeFmt
}

function dateTimeFmt(): Intl.DateTimeFormat {
  if (_dateTimeFmt) return _dateTimeFmt
  _dateTimeFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: PACIFIC_TZ,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  })
  return _dateTimeFmt
}

/** Coerce any accepted shape into a valid `Date`, or `null` on failure. */
function toDate(input: DateInput): Date | null {
  if (input == null || input === "") return null
  const d = input instanceof Date ? input : new Date(input)
  return Number.isNaN(d.getTime()) ? null : d
}

/** "Apr 29, 2026" in Pacific. */
export function formatPacificDate(input: DateInput): string {
  const d = toDate(input)
  return d ? dateFmt().format(d) : PLACEHOLDER
}

/** "April 29, 2026" in Pacific. */
export function formatPacificDateLong(input: DateInput): string {
  const d = toDate(input)
  return d ? dateLongFmt().format(d) : PLACEHOLDER
}

/** "4:32 PM PT" in Pacific. */
export function formatPacificTime(input: DateInput): string {
  const d = toDate(input)
  return d ? timeFmt().format(d) : PLACEHOLDER
}

/** "Apr 29, 4:32 PM PT" in Pacific. */
export function formatPacificDateTime(input: DateInput): string {
  const d = toDate(input)
  return d ? dateTimeFmt().format(d) : PLACEHOLDER
}
