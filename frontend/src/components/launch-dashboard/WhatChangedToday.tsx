import { useEffect, useState } from "react"
import { api } from "@/services/api"
import { formatPacificDate } from "@/lib/datetime"
import type { MigrationDailyActivity, RawTaskRecord } from "@/types"

/**
 * "What Changed Today" — tickets created and resolved during the
 * current Pacific calendar day. Sourced from raw Jira/Asana frontmatter
 * timestamps via ``GET /api/dashboard/daily-activity``, so the counts
 * stay accurate regardless of whether the orchestrator's daily status
 * file populated its summary sections.
 *
 * The previous implementation diff'd the latest two daily snapshots,
 * which gave 0s across the board when the orchestrator's "what changed"
 * fields weren't populated. This version goes to the source of truth
 * (per-ticket created/resolved dates) and reports actual day-of activity.
 */
export function WhatChangedToday() {
  const [data, setData] = useState<MigrationDailyActivity | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api
      .getMigrationDailyActivity()
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : "failed to load")
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (error) {
    return (
      <section className="panel" aria-label="What changed today">
        <h3 style={headingStyle}>
          <span>What Changed</span>
        </h3>
        <p style={{ color: "var(--lcc-red)", fontSize: 12, margin: 0 }}>{error}</p>
      </section>
    )
  }

  if (!data) {
    return (
      <section className="panel" aria-label="What changed today">
        <h3 style={headingStyle}>
          <span>What Changed</span>
        </h3>
        <p style={{ color: "var(--lcc-text-faint)", fontSize: 12, margin: 0 }}>
          loading…
        </p>
      </section>
    )
  }

  const dateLabel = formatPacificDate(data.date)

  return (
    <section className="panel" aria-label="What changed today">
      <h3 style={headingStyle}>
        <span>What Changed · {dateLabel}</span>
        <span style={summaryStyle}>
          <span style={numNewStyle}>{data.createdCount}</span> new
          <span style={sepStyle}>·</span>
          <span style={numResolvedStyle}>{data.resolvedCount}</span> resolved
          <span style={cycleLabelStyle}>today</span>
        </span>
      </h3>

      <div style={columnsStyle}>
        <Column
          tone="violet"
          label="Created today"
          tickets={data.created}
        />
        <Column
          tone="green"
          label="Resolved today"
          tickets={data.resolved}
        />
      </div>
    </section>
  )
}

// ── Sub components ────────────────────────────────────────────────────

interface ColumnProps {
  tone: "violet" | "green"
  label: string
  tickets: RawTaskRecord[]
}

function Column({ tone, label, tickets }: ColumnProps) {
  return (
    <div>
      <div style={sectionHeadStyle}>
        <span style={{ color: `var(--lcc-${tone})`, fontWeight: 600 }}>{label}</span>
        <span style={sectionSepStyle} />
        <span style={sectionCountStyle}>{tickets.length}</span>
      </div>
      {tickets.length === 0 ? (
        <div style={emptyStyle}>None</div>
      ) : (
        <ul style={listStyle}>
          {tickets.slice(0, 8).map((t) => (
            <li key={t.key} style={itemStyle}>
              <div style={itemIdStyle}>{t.key}</div>
              <div style={itemTitleStyle}>{t.summary || "(no summary)"}</div>
              <div style={itemMetaStyle}>
                <span>{t.project}</span>
                {t.priority && (
                  <>
                    <span style={{ marginLeft: 6 }}>·</span>
                    <span style={{ marginLeft: 6 }}>{t.priority}</span>
                  </>
                )}
                {t.assignee && (
                  <>
                    <span style={{ marginLeft: 6 }}>·</span>
                    <span style={{ marginLeft: 6 }}>{t.assignee}</span>
                  </>
                )}
              </div>
            </li>
          ))}
          {tickets.length > 8 && (
            <li style={moreStyle}>+{tickets.length - 8} more</li>
          )}
        </ul>
      )}
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────

const headingStyle: React.CSSProperties = {
  margin: "0 0 14px",
  fontSize: 10.5,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--lcc-text-faint)",
  fontWeight: 600,
  display: "flex",
  alignItems: "center",
  gap: 8,
}

const summaryStyle: React.CSSProperties = {
  marginLeft: "auto",
  display: "inline-flex",
  alignItems: "baseline",
  gap: 6,
  color: "var(--lcc-text-dim)",
  fontFamily: "var(--font-mono, monospace)",
  fontWeight: 500,
  fontSize: 11,
  textTransform: "none",
  letterSpacing: 0,
}

const numNewStyle: React.CSSProperties = {
  color: "var(--lcc-violet)",
  fontWeight: 700,
  fontSize: 14,
  fontVariantNumeric: "tabular-nums",
}

const numResolvedStyle: React.CSSProperties = {
  color: "var(--lcc-green)",
  fontWeight: 700,
  fontSize: 14,
  fontVariantNumeric: "tabular-nums",
}

const sepStyle: React.CSSProperties = {
  color: "var(--lcc-text-faint)",
  margin: "0 4px",
}

const cycleLabelStyle: React.CSSProperties = {
  marginLeft: 8,
  color: "var(--lcc-text-faint)",
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: "0.1em",
}

const columnsStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 18,
}

const sectionHeadStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  marginBottom: 8,
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: "0.14em",
  fontFamily: "var(--font-mono, monospace)",
}

const sectionSepStyle: React.CSSProperties = {
  flex: 1,
  height: 1,
  background:
    "linear-gradient(90deg, var(--lcc-glass-border, rgba(255,255,255,0.1)), transparent)",
}

const sectionCountStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono, monospace)",
  fontSize: 10,
  padding: "1px 7px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.06)",
  color: "var(--lcc-text-dim)",
}

const listStyle: React.CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: 0,
  display: "flex",
  flexDirection: "column",
  gap: 6,
}

const itemStyle: React.CSSProperties = {
  padding: "8px 10px",
  background: "var(--lcc-glass-bg-faint, rgba(22,28,58,0.3))",
  borderRadius: 6,
}

const itemIdStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono, monospace)",
  fontSize: 10,
  color: "var(--lcc-text-faint)",
  marginBottom: 2,
}

const itemTitleStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--lcc-text)",
  lineHeight: 1.35,
}

const itemMetaStyle: React.CSSProperties = {
  fontSize: 10.5,
  color: "var(--lcc-text-dim)",
  marginTop: 4,
}

const emptyStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--lcc-text-faint)",
  fontStyle: "italic",
  padding: "14px 10px",
  textAlign: "center",
  background: "var(--lcc-glass-bg-faint, rgba(22,28,58,0.3))",
  borderRadius: 6,
}

const moreStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--lcc-text-faint)",
  fontStyle: "italic",
  padding: "4px 10px",
}
