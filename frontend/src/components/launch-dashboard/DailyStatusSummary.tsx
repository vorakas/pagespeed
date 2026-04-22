import type { MigrationSnapshot } from "@/types"

// Maps the handoff Daily Status Summary panel:
//   [ eyebrow: date · source file ]
//   [ headline prose ]
//   [ positives · status changes · new items ]

interface Props {
  snapshot: MigrationSnapshot
}

export function DailyStatusSummary({ snapshot }: Props) {
  return (
    <section className="panel" aria-label="Daily status summary">
      <div style={eyebrowStyle}>
        <span>Daily Status · {snapshot.date}</span>
        {snapshot.sourcePath && (
          <>
            <span style={eyebrowSep}>·</span>
            <span style={eyebrowFile}>{snapshot.sourcePath}</span>
          </>
        )}
        {snapshot.overall && (
          <>
            <span style={eyebrowSep}>·</span>
            <HealthBadge health={snapshot.overall} />
          </>
        )}
      </div>
      {snapshot.headline && <p style={headlineStyle}>{snapshot.headline}</p>}

      <div style={bitsGridStyle}>
        <BitColumn
          label="Positives"
          tone="green"
          emptyHint="No wins today"
          items={snapshot.positives.map((p) => ({
            id: p.id,
            title: p.title,
            detail: p.detail,
          }))}
        />
        <BitColumn
          label="Status Changes"
          tone="blue"
          emptyHint="No state changes"
          items={snapshot.statusChanges.map((c) => ({
            id: c.id,
            title: c.change,
            detail: c.detail,
          }))}
        />
        <BitColumn
          label="New Items"
          tone="violet"
          emptyHint="No new items filed"
          items={snapshot.newItems.map((n) => ({
            id: n.id,
            title: n.title ?? "",
            detail: [n.type, n.who].filter(Boolean).join(" · "),
          }))}
        />
      </div>
    </section>
  )
}

function HealthBadge({ health }: { health: string }) {
  const tone =
    health === "on-track"
      ? "green"
      : health === "off-track"
      ? "red"
      : "amber"
  const label = health.replace("-", " ").toUpperCase()
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 9.5,
        fontWeight: 700,
        letterSpacing: "0.08em",
        color: `var(--lcc-${tone})`,
        background: `var(--lcc-${tone}-bg)`,
        border: `1px solid var(--lcc-${tone})`,
      }}
    >
      {label}
    </span>
  )
}

function BitColumn({
  label,
  tone,
  items,
  emptyHint,
}: {
  label: string
  tone: "green" | "blue" | "violet" | "amber" | "red"
  items: Array<{ id: string; title: string; detail?: string }>
  emptyHint: string
}) {
  return (
    <div>
      <div style={sectionHeadStyle}>
        <span style={{ color: `var(--lcc-${tone})` }}>{label}</span>
        <span style={sectionSepStyle} />
        <span style={sectionCountStyle}>{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div style={emptyStyle}>{emptyHint}</div>
      ) : (
        <ul style={listStyle}>
          {items.map((item, i) => (
            <li
              key={`${item.id}-${i}`}
              style={{ ...itemStyle, borderLeft: `2px solid var(--lcc-${tone})` }}
            >
              <div style={itemIdStyle}>{item.id}</div>
              <div style={itemTitleStyle}>{item.title}</div>
              {item.detail && <div style={itemDetailStyle}>{item.detail}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const eyebrowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
  fontSize: 10.5,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--lcc-text-faint)",
  fontWeight: 600,
  fontFamily: "var(--font-mono, monospace)",
  marginBottom: 10,
}
const eyebrowSep: React.CSSProperties = { color: "var(--lcc-text-faint)" }
const eyebrowFile: React.CSSProperties = {
  color: "var(--lcc-text-faint)",
  textTransform: "none",
  letterSpacing: "0.02em",
}

const headlineStyle: React.CSSProperties = {
  fontSize: 15,
  lineHeight: 1.4,
  color: "var(--lcc-text)",
  margin: "0 0 16px",
  fontWeight: 500,
  letterSpacing: "-0.005em",
}

const bitsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
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
  fontWeight: 700,
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
  fontWeight: 600,
  lineHeight: 1.35,
}
const itemDetailStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--lcc-text-dim)",
  marginTop: 3,
  lineHeight: 1.4,
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
