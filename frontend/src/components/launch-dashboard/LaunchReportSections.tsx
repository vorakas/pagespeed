import { Fragment, useMemo, useState } from "react"
import type { CSSProperties, ReactNode } from "react"
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight } from "lucide-react"
import type {
  LaunchReportDevelopmentRow,
  LaunchReportDiagnostics,
  LaunchReportE2eRow,
  LaunchReportResponse,
} from "@/types"

type RowKind = "development" | "e2e"

interface LaunchReportSectionsProps {
  data: LaunchReportResponse | null
  error?: string | null
}

interface DiagnosticSummary {
  total: number
  items: Array<[string, number]>
}

const diagnosticLabels: Array<[keyof LaunchReportDiagnostics, string]> = [
  ["countedIssueCount", "Counted issues"],
  ["excludedIssueCount", "Excluded issues"],
  ["missingEpicLinkCount", "Missing epic links"],
  ["unresolvedEpicNameCount", "Unresolved epic names"],
  ["missingPhaseLabelCount", "Missing phase labels"],
  ["missingEstimateCount", "Missing estimates"],
]

const warningDiagnosticKeys: Array<keyof LaunchReportDiagnostics> = [
  "excludedIssueCount",
  "missingEpicLinkCount",
  "unresolvedEpicNameCount",
  "missingPhaseLabelCount",
  "missingEstimateCount",
]

export function LaunchReportSections({ data, error }: LaunchReportSectionsProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())

  const phaseLabel = data?.phase ?? "loading"

  const toggle = (id: string) => {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <section className="panel lcc-section" aria-label="Phase 1 report" style={sectionStyle}>
      <div style={headerStyle}>
        <div>
          <h2 style={titleStyle}>Phase 1 Report</h2>
          <p style={subtitleStyle}>Spreadsheet row contract · {phaseLabel}</p>
        </div>
        {data && <span style={stampStyle}>Generated {formatGeneratedAt(data.generatedAt)}</span>}
      </div>

      {error ? (
        <div role="status" style={errorStyle}>
          <AlertTriangle size={15} aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : !data ? (
        <div style={loadingStyle}>Loading launch report sections...</div>
      ) : (
        <div style={tablesStyle}>
          <ReportTable title="LampsPlus Development">
            <thead>
              <tr>
                <Th>Grouping</Th>
                <Th>Status</Th>
                <Th align="right">Completed</Th>
                <Th align="right">Remaining</Th>
                <Th>Progress</Th>
                <Th align="center">Diag</Th>
              </tr>
            </thead>
            <tbody>
              {data.lampsPlusDevelopment.rows.map((row) => {
                const id = rowId("development", row)
                const isExpanded = expanded.has(id)
                return (
                  <Fragment key={id}>
                    <DevelopmentRow row={row} expanded={isExpanded} onToggle={() => toggle(id)} />
                    {isExpanded && <DiagnosticRow colSpan={6} row={row} />}
                  </Fragment>
                )
              })}
            </tbody>
          </ReportTable>

          <ReportTable title="E2E Testing">
            <thead>
              <tr>
                <Th>Grouping</Th>
                <Th align="right">CNX OK</Th>
                <Th align="right">Passed TC</Th>
                <Th align="right">Failed TC</Th>
                <Th align="right">Completed</Th>
                <Th align="right">Remaining</Th>
                <Th>Progress</Th>
                <Th align="center">Diag</Th>
              </tr>
            </thead>
            <tbody>
              {data.e2eTesting.rows.map((row) => {
                const id = rowId("e2e", row)
                const isExpanded = expanded.has(id)
                return (
                  <Fragment key={id}>
                    <E2eRow row={row} expanded={isExpanded} onToggle={() => toggle(id)} />
                    {isExpanded && <DiagnosticRow colSpan={8} row={row} />}
                  </Fragment>
                )
              })}
            </tbody>
          </ReportTable>
        </div>
      )}
    </section>
  )
}

function ReportTable({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={tableBlockStyle}>
      <div style={tableTitleStyle}>{title}</div>
      <div style={tableWrapStyle}>
        <table style={tableStyle}>{children}</table>
      </div>
    </div>
  )
}

function DevelopmentRow({
  row,
  expanded,
  onToggle,
}: {
  row: LaunchReportDevelopmentRow
  expanded: boolean
  onToggle: () => void
}) {
  const summary = useDiagnosticSummary(row.diagnostics, row.issueKeys.length)
  return (
    <tr style={rowStyle}>
      <Td>
        <ExpandButton expanded={expanded} onToggle={onToggle} label={row.reportGrouping} />
      </Td>
      <Td>
        <StatusPill status={row.status} />
      </Td>
      <Td align="right">{formatHours(row.completedHours)}</Td>
      <Td align="right">{formatHours(row.remainingHours)}</Td>
      <Td>
        <Progress value={row.progressPercent} />
      </Td>
      <Td align="center">
        <DiagnosticIcon summary={summary} />
      </Td>
    </tr>
  )
}

function E2eRow({
  row,
  expanded,
  onToggle,
}: {
  row: LaunchReportE2eRow
  expanded: boolean
  onToggle: () => void
}) {
  const summary = useDiagnosticSummary(row.diagnostics, row.issueKeys.length)
  return (
    <tr style={rowStyle}>
      <Td>
        <ExpandButton expanded={expanded} onToggle={onToggle} label={row.reportGrouping} />
      </Td>
      <Td align="right">{formatCount(row.cnxOk)}</Td>
      <Td align="right">{formatCount(row.passedTc)}</Td>
      <Td align="right">{formatCount(row.failedTc)}</Td>
      <Td align="right">{formatHours(row.completedHours)}</Td>
      <Td align="right">{formatHours(row.remainingHours)}</Td>
      <Td>
        <Progress value={row.progressPercent} />
      </Td>
      <Td align="center">
        <DiagnosticIcon summary={summary} />
      </Td>
    </tr>
  )
}

function DiagnosticRow({
  colSpan,
  row,
}: {
  colSpan: number
  row: LaunchReportDevelopmentRow | LaunchReportE2eRow
}) {
  const summary = useDiagnosticSummary(row.diagnostics, row.issueKeys.length)
  return (
    <tr>
      <td colSpan={colSpan} style={diagnosticCellStyle}>
        <div style={diagnosticGridStyle}>
          <div>
            <div style={diagHeadingStyle}>Diagnostics</div>
            <div style={diagListStyle}>
              {summary.items.map(([label, value]) => (
                <span key={label} style={diagChipStyle}>
                  {label}: {value}
                </span>
              ))}
            </div>
          </div>
          <div>
            <div style={diagHeadingStyle}>Counted Issue Keys</div>
            <div style={issueKeysStyle}>
              {row.issueKeys.length > 0
                ? row.issueKeys.map((key) => (
                    <span key={key} style={issueKeyStyle}>
                      {key}
                    </span>
                  ))
                : "None"}
            </div>
          </div>
        </div>
      </td>
    </tr>
  )
}

function ExpandButton({
  expanded,
  onToggle,
  label,
}: {
  expanded: boolean
  onToggle: () => void
  label: string
}) {
  const Icon = expanded ? ChevronDown : ChevronRight
  return (
    <button type="button" onClick={onToggle} style={iconButtonStyle} aria-expanded={expanded}>
      <Icon size={14} aria-hidden="true" />
      <span style={groupingStyle}>{label}</span>
    </button>
  )
}

function StatusPill({ status }: { status: LaunchReportDevelopmentRow["status"] }) {
  const complete = status === "Complete"
  const Icon = complete ? CheckCircle2 : AlertTriangle
  return (
    <span
      style={{
        ...statusPillStyle,
        color: complete ? "var(--lcc-green)" : "var(--lcc-amber)",
        borderColor: complete ? "rgba(34, 197, 94, 0.35)" : "rgba(245, 158, 11, 0.35)",
      }}
    >
      <Icon size={13} aria-hidden="true" />
      {status}
    </span>
  )
}

function DiagnosticIcon({ summary }: { summary: DiagnosticSummary }) {
  const hasWarnings = summary.warningCount > 0
  const Icon = hasWarnings ? AlertTriangle : CheckCircle2
  const label = hasWarnings
    ? `${summary.warningCount} report diagnostic warnings`
    : "No report diagnostic warnings"
  return (
    <span
      aria-label={label}
      role="img"
      title={label}
      style={{ color: hasWarnings ? "var(--lcc-amber)" : "var(--lcc-green)" }}
    >
      <Icon size={16} aria-hidden="true" />
    </span>
  )
}

function Progress({ value }: { value: number }) {
  const width = Math.max(0, Math.min(100, value))
  return (
    <div style={progressWrapStyle}>
      <div style={progressTrackStyle}>
        <div style={{ ...progressBarStyle, width: `${width}%` }} />
      </div>
      <span style={progressTextStyle}>{Math.round(width)}%</span>
    </div>
  )
}

function Th({
  children,
  align = "left",
}: {
  children: ReactNode
  align?: CSSProperties["textAlign"]
}) {
  return <th style={{ ...thStyle, textAlign: align }}>{children}</th>
}

function Td({
  children,
  align = "left",
}: {
  children: ReactNode
  align?: CSSProperties["textAlign"]
}) {
  return <td style={{ ...tdStyle, textAlign: align }}>{children}</td>
}

function useDiagnosticSummary(diagnostics: LaunchReportDiagnostics, issueKeyCount: number) {
  return useMemo(() => {
    const items = diagnosticLabels.map(([key, label]) => [label, diagnostics[key]] as [string, number])
    const warningCount = warningDiagnosticKeys.reduce((sum, key) => sum + diagnostics[key], 0)
    return { warningCount, items: [["Counted issue keys", issueKeyCount] as [string, number], ...items] }
  }, [diagnostics, issueKeyCount])
}

function rowId(kind: RowKind, row: LaunchReportDevelopmentRow | LaunchReportE2eRow) {
  return `${kind}:${row.reportGrouping}:${row.epicKey ?? "no-epic"}:${row.phaseLabel}`
}

function formatHours(value: number) {
  return `${Number(value.toFixed(1)).toLocaleString()}h`
}

function formatCount(value: number | null) {
  return value === null ? "—" : value.toLocaleString()
}

function formatGeneratedAt(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

const sectionStyle: CSSProperties = {
  display: "grid",
  gap: 14,
}

const headerStyle: CSSProperties = {
  alignItems: "flex-start",
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
}

const titleStyle: CSSProperties = {
  margin: 0,
  color: "var(--lcc-text)",
  fontSize: 16,
  fontWeight: 800,
}

const subtitleStyle: CSSProperties = {
  margin: "4px 0 0",
  color: "var(--lcc-text-faint)",
  fontSize: 11,
  fontFamily: "var(--font-mono)",
  textTransform: "uppercase",
}

const stampStyle: CSSProperties = {
  color: "var(--lcc-text-faint)",
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  whiteSpace: "nowrap",
}

const loadingStyle: CSSProperties = {
  border: "1px dashed var(--lcc-glass-border)",
  borderRadius: 6,
  color: "var(--lcc-text-faint)",
  fontSize: 12,
  padding: "16px 12px",
}

const errorStyle: CSSProperties = {
  alignItems: "center",
  border: "1px solid rgba(245, 158, 11, 0.35)",
  borderRadius: 6,
  color: "var(--lcc-amber)",
  display: "flex",
  fontSize: 12,
  gap: 8,
  padding: "12px",
}

const tablesStyle: CSSProperties = {
  display: "grid",
  gap: 16,
}

const tableBlockStyle: CSSProperties = {
  display: "grid",
  gap: 8,
}

const tableTitleStyle: CSSProperties = {
  color: "var(--lcc-text)",
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: 0,
}

const tableWrapStyle: CSSProperties = {
  overflowX: "auto",
  border: "1px solid var(--lcc-glass-border)",
  borderRadius: 6,
}

const tableStyle: CSSProperties = {
  borderCollapse: "collapse",
  minWidth: 780,
  width: "100%",
}

const thStyle: CSSProperties = {
  background: "var(--lcc-glass-bg-faint, rgba(22,28,58,0.3))",
  borderBottom: "1px solid var(--lcc-glass-border)",
  color: "var(--lcc-text-faint)",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  fontWeight: 800,
  padding: "7px 8px",
  textTransform: "uppercase",
  whiteSpace: "nowrap",
}

const tdStyle: CSSProperties = {
  borderBottom: "1px solid var(--lcc-glass-border)",
  color: "var(--lcc-text)",
  fontSize: 12,
  padding: "7px 8px",
  verticalAlign: "middle",
  whiteSpace: "nowrap",
}

const rowStyle: CSSProperties = {
  background: "rgba(255,255,255,0.015)",
}

const iconButtonStyle: CSSProperties = {
  alignItems: "center",
  appearance: "none",
  background: "transparent",
  border: 0,
  color: "var(--lcc-text)",
  cursor: "pointer",
  display: "inline-flex",
  gap: 6,
  margin: 0,
  padding: 0,
  textAlign: "left",
}

const groupingStyle: CSSProperties = {
  fontWeight: 700,
  maxWidth: 320,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
}

const statusPillStyle: CSSProperties = {
  alignItems: "center",
  border: "1px solid",
  borderRadius: 999,
  display: "inline-flex",
  fontSize: 11,
  fontWeight: 700,
  gap: 5,
  padding: "2px 7px",
}

const progressWrapStyle: CSSProperties = {
  alignItems: "center",
  display: "grid",
  gap: 8,
  gridTemplateColumns: "minmax(90px, 1fr) 36px",
}

const progressTrackStyle: CSSProperties = {
  background: "rgba(255,255,255,0.08)",
  borderRadius: 999,
  height: 7,
  overflow: "hidden",
}

const progressBarStyle: CSSProperties = {
  background: "var(--lcc-green)",
  borderRadius: 999,
  height: "100%",
}

const progressTextStyle: CSSProperties = {
  color: "var(--lcc-text-dim)",
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  textAlign: "right",
}

const diagnosticCellStyle: CSSProperties = {
  background: "rgba(2, 6, 23, 0.22)",
  borderBottom: "1px solid var(--lcc-glass-border)",
  padding: "10px 12px",
}

const diagnosticGridStyle: CSSProperties = {
  display: "grid",
  gap: 12,
  gridTemplateColumns: "minmax(260px, 0.8fr) 1fr",
}

const diagHeadingStyle: CSSProperties = {
  color: "var(--lcc-text-faint)",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  fontWeight: 800,
  marginBottom: 6,
  textTransform: "uppercase",
}

const diagListStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
}

const diagChipStyle: CSSProperties = {
  border: "1px solid var(--lcc-glass-border)",
  borderRadius: 999,
  color: "var(--lcc-text-dim)",
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  padding: "2px 7px",
}

const issueKeysStyle: CSSProperties = {
  color: "var(--lcc-text-dim)",
  display: "flex",
  flexWrap: "wrap",
  fontSize: 11,
  gap: 6,
}

const issueKeyStyle: CSSProperties = {
  background: "rgba(255,255,255,0.06)",
  borderRadius: 6,
  color: "var(--lcc-text)",
  fontFamily: "var(--font-mono)",
  padding: "2px 6px",
}
