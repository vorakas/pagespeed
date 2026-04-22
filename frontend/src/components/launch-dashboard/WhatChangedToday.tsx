import type {
  MigrationSnapshot,
  MigrationSnapshotDiff,
  SnapshotKpiDelta,
  SnapshotTaskItem,
} from "@/types"

// Maps diff output onto the handoff's "What Changed Today" panel:
//   [ 5-cell summary strip ]
//   [ 3 columns: added / removed/reassigned / regressed ]
//   [ KPI delta bar ]
//
// Reads the latest snapshot and diff. Hidden entirely if there is no
// previous snapshot (i.e. first ingest). The single-responsibility
// contract here is layout — all diff logic lives server-side.

interface Props {
  latest: MigrationSnapshot
  diff: MigrationSnapshotDiff
}

const KPI_ORDER: Array<{ key: string; label: string; goodWhen: "up" | "down" }> = [
  { key: "combinedResolved", label: "Resolved", goodWhen: "up" },
  { key: "combinedActive", label: "Active", goodWhen: "down" },
  { key: "resolvedPct", label: "% Resolved", goodWhen: "up" },
  { key: "productionFailures", label: "Prod Failures", goodWhen: "down" },
  { key: "openBlockers", label: "Open Blockers", goodWhen: "down" },
  { key: "newBugs24h", label: "New Bugs", goodWhen: "down" },
]

export function WhatChangedToday({ latest, diff }: Props) {
  const summary = latest.changeSummary
  const cells = [
    { label: "New", value: summary?.new ?? diff.newItems.added.length, tone: "violet" },
    { label: "Resolved", value: summary?.resolved ?? latest.positives.length, tone: "green" },
    { label: "Regressed", value: summary?.regressed ?? diff.prodFailures.regressed.length, tone: "red" },
    { label: "Reassigned", value: summary?.reassigned ?? diff.prodFailures.reassigned.length, tone: "amber" },
    { label: "On Hold", value: summary?.onHold ?? 0, tone: "blue" },
  ]

  return (
    <section className="panel" aria-label="What changed today">
      <h3 style={headingStyle}>
        <span>What Changed · {latest.date} vs {diff.from}</span>
        <span style={{ marginLeft: "auto", color: "var(--lcc-text-dim)", fontFamily: "var(--font-mono, monospace)", fontWeight: 500, fontSize: 11 }}>
          {diff.areaStatuses.length} workstream status change{diff.areaStatuses.length === 1 ? "" : "s"}
        </span>
      </h3>

      <div style={stripStyle}>
        {cells.map((c) => (
          <div key={c.label} style={{ ...cellStyle, borderLeft: `3px solid var(--lcc-${c.tone})` }}>
            <div style={cellValueStyle}>{c.value}</div>
            <div style={cellLabelStyle}>{c.label}</div>
          </div>
        ))}
      </div>

      <div style={columnsStyle}>
        <Column
          tone="violet"
          label="Added / New"
          count={diff.newItems.added.length + diff.criticalBugs.added.length}
          items={[...diff.criticalBugs.added, ...diff.newItems.added]}
        />
        <Column
          tone="amber"
          label="Reassigned"
          count={diff.prodFailures.reassigned.length}
          items={diff.prodFailures.reassigned.map((p) => ({
            ...p,
            title: `${p.title ?? ""} ${p.from ? `· was ${p.from}` : ""}`.trim(),
          }))}
        />
        <Column
          tone="red"
          label="Regressed"
          count={diff.prodFailures.regressed.length}
          items={diff.prodFailures.regressed}
        />
      </div>

      <div style={kpiRowStyle}>
        {KPI_ORDER.map((k) => {
          const delta = (diff.kpis ?? {})[k.key] as SnapshotKpiDelta | undefined
          return <KpiDelta key={k.key} label={k.label} delta={delta} goodWhen={k.goodWhen} />
        })}
      </div>
    </section>
  )
}

// ── Sub components ────────────────────────────────────────────────────

function Column({
  tone,
  label,
  count,
  items,
}: {
  tone: "violet" | "amber" | "red" | "green"
  label: string
  count: number
  items: Array<SnapshotTaskItem & { from?: string }>
}) {
  return (
    <div>
      <div style={sectionHeadStyle}>
        <span style={{ color: `var(--lcc-${tone})`, fontWeight: 700 }}>{label}</span>
        <span style={sectionSepStyle} />
        <span style={sectionCountStyle}>{count}</span>
      </div>
      {items.length === 0 ? (
        <div style={emptyStyle}>No changes</div>
      ) : (
        <ul style={listStyle}>
          {items.slice(0, 6).map((item, i) => (
            <li key={`${item.id}-${i}`} style={{ ...itemStyle, borderLeft: `2px solid var(--lcc-${tone})` }}>
              <div style={itemIdStyle}>{item.id}</div>
              <div style={itemTitleStyle}>{item.title || "(no title)"}</div>
              {(item.who || item.sev || item.tag) && (
                <div style={itemMetaStyle}>
                  {item.sev && <span className="lcc-chip" data-sev={item.sev}>{item.sev}</span>}
                  {item.who && <span style={{ marginLeft: 6 }}>{item.who}</span>}
                  {item.tag && <span style={{ marginLeft: 6, color: "var(--lcc-text-faint)" }}>{item.tag}</span>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function KpiDelta({
  label,
  delta,
  goodWhen,
}: {
  label: string
  delta: SnapshotKpiDelta | undefined
  goodWhen: "up" | "down"
}) {
  if (!delta) return null
  const curr = delta.curr ?? 0
  const value = delta.delta ?? 0
  const tone =
    value === 0
      ? "neutral"
      : (goodWhen === "up" && value > 0) || (goodWhen === "down" && value < 0)
      ? "green"
      : "red"
  const arrow = value > 0 ? "▲" : value < 0 ? "▼" : "·"
  return (
    <div style={kpiCellStyle}>
      <div style={kpiLabelStyle}>{label}</div>
      <div style={kpiValueStyle}>
        <span>{curr}</span>
        {value !== 0 && (
          <span style={{ color: `var(--lcc-${tone})`, marginLeft: 6, fontSize: 12, fontWeight: 600 }}>
            {arrow} {Math.abs(value)}
          </span>
        )}
      </div>
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

const stripStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(5, 1fr)",
  gap: 10,
  marginBottom: 16,
}

const cellStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 8,
  background: "var(--lcc-glass-bg-faint, rgba(22,28,58,0.3))",
  border: "1px solid var(--lcc-glass-border, rgba(255,255,255,0.1))",
  display: "flex",
  flexDirection: "column",
  gap: 2,
}

const cellValueStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
  lineHeight: 1,
  color: "var(--lcc-text)",
  fontVariantNumeric: "tabular-nums",
}

const cellLabelStyle: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--lcc-text-faint)",
  fontFamily: "var(--font-mono, monospace)",
  marginTop: 3,
}

const columnsStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 18,
  marginBottom: 14,
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
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
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

const kpiRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
  gap: 8,
  marginTop: 12,
  paddingTop: 14,
  borderTop: "1px solid var(--lcc-glass-border, rgba(255,255,255,0.1))",
}

const kpiCellStyle: React.CSSProperties = {
  padding: "6px 8px",
  display: "flex",
  flexDirection: "column",
  gap: 2,
}

const kpiLabelStyle: React.CSSProperties = {
  fontSize: 9.5,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--lcc-text-faint)",
  fontFamily: "var(--font-mono, monospace)",
}

const kpiValueStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  fontSize: 16,
  fontWeight: 700,
  color: "var(--lcc-text)",
  fontVariantNumeric: "tabular-nums",
}
