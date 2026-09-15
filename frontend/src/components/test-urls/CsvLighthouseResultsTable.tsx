import { Fragment } from "react"
import { ExternalLink } from "lucide-react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { CsvLighthouseItem } from "@/types"
import { formatCls, formatMilliseconds } from "@/lib/utils"
import { ScoreBadge } from "@/components/shared/ScoreBadge"
import { buildCsvLighthouseAttemptErrorDisplay } from "@/components/test-urls/csv-lighthouse-attempt-errors"
import { buildCsvLighthouseClsDiagnosticDisplay } from "@/components/test-urls/csv-lighthouse-cls-diagnostics"
import { buildCsvLighthouseResultSections } from "@/components/test-urls/csv-lighthouse-results"

interface CsvLighthouseResultsTableProps {
  items: CsvLighthouseItem[]
  samplesPerUrl: number
}

const targetLabels: Record<CsvLighthouseItem["site_key"], string> = {
  mcprod: "Adobe Commerce",
  www: "LampsPlus",
}

function TruncatedText({ value, className = "max-w-[14rem]" }: { value: string | null; className?: string }) {
  if (!value) {
    return <span className="aurora-text-faint">-</span>
  }

  return (
    <span className={`aurora-text block truncate ${className}`} title={value}>
      {value}
    </span>
  )
}

function StatusPill({ status }: { status: CsvLighthouseItem["status"] }) {
  const className =
    status === "passed"
      ? "border-[color:var(--lcc-green)]/40 bg-[color:var(--lcc-green)]/10 text-[color:var(--lcc-green)]"
      : status === "failed"
        ? "border-[color:var(--lcc-red)]/40 bg-[color:var(--lcc-red)]/10 text-[color:var(--lcc-red)]"
        : status === "cancelled"
          ? "border-border bg-muted text-muted-foreground"
          : "border-[color:var(--lcc-blue)]/40 bg-[color:var(--lcc-blue)]/10 text-[color:var(--lcc-blue)]"

  return (
    <span className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${className}`}>
      {status}
    </span>
  )
}

function ModeEvidence({ item }: { item: CsvLighthouseItem }) {
  if (!item.detected_mode) {
    return <span className="aurora-text-faint">-</span>
  }

  const matchesExpected = !item.expected_mode || item.expected_mode === item.detected_mode
  const className = matchesExpected
    ? "border-[color:var(--lcc-green)]/40 bg-[color:var(--lcc-green)]/10 text-[color:var(--lcc-green)]"
    : "border-[color:var(--lcc-red)]/40 bg-[color:var(--lcc-red)]/10 text-[color:var(--lcc-red)]"

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${className}`}
      title={item.mode_evidence || undefined}
    >
      {item.detected_mode}
    </span>
  )
}

function ErrorEvidence({ item }: { item: CsvLighthouseItem }) {
  const attemptErrors = buildCsvLighthouseAttemptErrorDisplay(item.attempt_error_summary)
  if (attemptErrors) {
    return (
      <span className="aurora-text block max-w-[18rem] truncate" title={attemptErrors.title}>
        {attemptErrors.summary}
      </span>
    )
  }

  return <TruncatedText value={item.error_message} className="max-w-[16rem]" />
}

function ClsEvidence({ item }: { item: CsvLighthouseItem }) {
  const diagnostics = buildCsvLighthouseClsDiagnosticDisplay(item.cls_diagnostics)

  return (
    <div className="text-right">
      <div className="aurora-num">{formatCls(item.cls)}</div>
      {diagnostics && (
        <div className="aurora-text-faint max-w-[5rem] truncate text-[10px]" title={diagnostics.title}>
          {diagnostics.summary}
        </div>
      )}
    </div>
  )
}

export function CsvLighthouseResultsTable({ items, samplesPerUrl }: CsvLighthouseResultsTableProps) {
  const sections = buildCsvLighthouseResultSections(items)

  if (items.length === 0) {
    return (
      <div className="aurora-panel p-4">
        <p className="aurora-text-dim text-sm">No CSV Lighthouse rows loaded.</p>
      </div>
    )
  }

  return (
    <div className="aurora-panel overflow-hidden">
      <div className="overflow-x-auto">
        <Table className="aurora-table min-w-max text-xs">
        <TableHeader>
          <TableRow>
            <TableHead>Target</TableHead>
            <TableHead>Group</TableHead>
            <TableHead>Value</TableHead>
            <TableHead>URL</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Perf</TableHead>
            <TableHead className="text-right">FCP</TableHead>
            <TableHead className="text-right">Speed Index</TableHead>
            <TableHead className="text-right">LCP</TableHead>
            <TableHead className="text-right">TBT</TableHead>
            <TableHead className="text-right">CLS</TableHead>
            <TableHead className="text-right">Samples</TableHead>
            <TableHead>Evidence</TableHead>
            <TableHead>Error</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sections.map((section) => (
            <Fragment key={section.key}>
              {section.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{targetLabels[item.site_key]}</TableCell>
                  <TableCell>
                    <TruncatedText value={item.group_key} className="max-w-[8rem]" />
                  </TableCell>
                  <TableCell>
                    <TruncatedText value={item.original_value} />
                  </TableCell>
                  <TableCell>
                    <a
                      href={item.generated_url}
                      target="_blank"
                      rel="noreferrer"
                      className="aurora-text inline-flex max-w-[18rem] items-center gap-1 truncate hover:text-primary"
                      title={item.generated_url}
                    >
                      <span className="truncate">{item.generated_url}</span>
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  </TableCell>
                  <TableCell>
                    <StatusPill status={item.status} />
                  </TableCell>
                  <TableCell className="text-right"><ScoreBadge score={item.performance} /></TableCell>
                  <TableCell className="aurora-num text-right">{formatMilliseconds(item.fcp)}</TableCell>
                  <TableCell className="aurora-num text-right">{formatMilliseconds(item.speed_index)}</TableCell>
                  <TableCell className="aurora-num text-right">{formatMilliseconds(item.lcp)}</TableCell>
                  <TableCell className="aurora-num text-right">{formatMilliseconds(item.tbt)}</TableCell>
                  <TableCell>
                    <ClsEvidence item={item} />
                  </TableCell>
                  <TableCell className="aurora-num text-right">
                    {item.valid_samples == null ? item.attempts : `${item.valid_samples} / ${samplesPerUrl}`}
                  </TableCell>
                  <TableCell>
                    <ModeEvidence item={item} />
                  </TableCell>
                  <TableCell>
                    <ErrorEvidence item={item} />
                  </TableCell>
                </TableRow>
              ))}
              <TableRow
                key={`${section.key}::average`}
                className="border-y border-[color:var(--lcc-blue)]/30 bg-[color:var(--lcc-blue)]/10 font-semibold hover:bg-[color:var(--lcc-blue)]/15"
              >
                <TableCell className="border-l-4 border-l-[color:var(--lcc-blue)] text-[color:var(--lcc-blue)]">
                  {targetLabels[section.target]}
                </TableCell>
                <TableCell>{section.group}</TableCell>
                <TableCell>
                  <span className="rounded border border-[color:var(--lcc-blue)]/35 bg-background/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[color:var(--lcc-blue)]">
                    Averages
                  </span>
                </TableCell>
                <TableCell className="aurora-text-dim">{section.average.passedCount} passed</TableCell>
                <TableCell>-</TableCell>
                <TableCell className="text-right">
                  <ScoreBadge score={section.average.performance == null ? null : Math.round(section.average.performance)} />
                </TableCell>
                <TableCell className="aurora-num text-right text-[color:var(--lcc-blue)]">{formatMilliseconds(section.average.fcp)}</TableCell>
                <TableCell className="aurora-num text-right text-[color:var(--lcc-blue)]">{formatMilliseconds(section.average.speed_index)}</TableCell>
                <TableCell className="aurora-num text-right text-[color:var(--lcc-blue)]">{formatMilliseconds(section.average.lcp)}</TableCell>
                <TableCell className="aurora-num text-right text-[color:var(--lcc-blue)]">{formatMilliseconds(section.average.tbt)}</TableCell>
                <TableCell className="aurora-num text-right text-[color:var(--lcc-blue)]">{formatCls(section.average.cls)}</TableCell>
                <TableCell>-</TableCell>
                <TableCell>-</TableCell>
                <TableCell>-</TableCell>
              </TableRow>
            </Fragment>
          ))}
        </TableBody>
        </Table>
      </div>
    </div>
  )
}
