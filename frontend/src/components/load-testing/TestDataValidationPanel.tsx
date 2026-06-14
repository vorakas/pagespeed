import { useMemo, useState } from "react"
import { CheckCircle2, XCircle, Upload, Download, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { api } from "@/services/api"
import { useTestDataValidation } from "@/hooks/use-testdata-validation"
import type { TestDataGroupResult, ValidationSiteKey } from "@/types"

const ALL_SITES: ValidationSiteKey[] = ["mcprod", "www"]

export function TestDataValidationPanel() {
  const { run, busy, error, start } = useTestDataValidation()
  const [files, setFiles] = useState<File[]>([])
  const [sites, setSites] = useState<ValidationSiteKey[]>([...ALL_SITES])

  const toggleSite = (s: ValidationSiteKey) =>
    setSites((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))

  const groups = useMemo(() => (run ? Object.values(run.groups) : []), [run])
  const pct = run && run.total > 0 ? Math.round((run.completed / run.total) * 100) : 0

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div>
        <h2 className="text-base font-semibold text-foreground">TestData SKU validation</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload the BlazeMeter <code>TestData/*.csv</code> files to confirm every SKU resolves to a
          live, in-stock page on mcprod and www before you run a load test.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted">
          <Upload className="h-4 w-4" />
          {files.length > 0 ? `${files.length} file(s) selected` : "Choose CSV files"}
          <input
            type="file"
            multiple
            accept=".csv"
            className="hidden"
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
        </label>

        {ALL_SITES.map((s) => (
          <label key={s} className="inline-flex items-center gap-1.5 text-sm">
            <input type="checkbox" checked={sites.includes(s)} onChange={() => toggleSite(s)} />
            {s}
          </label>
        ))}

        <Button
          size="sm"
          disabled={busy || files.length === 0 || sites.length === 0}
          onClick={() => void start(files, sites)}
          style={{ color: "#000" }}
        >
          {busy ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
          Validate
        </Button>
      </div>

      {error ? <p className="mt-3 text-sm text-red-500">{error}</p> : null}

      {run ? (
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded bg-muted">
              <div className="h-full bg-green-500 transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-muted-foreground">
              {run.completed}/{run.total} ({run.status})
            </span>
          </div>

          {run.unrecognized.length > 0 ? (
            <p className="text-sm text-amber-500">
              Unrecognized files (skipped): {run.unrecognized.join(", ")}
            </p>
          ) : null}

          {groups.map((g) => (
            <GroupCard key={g.key} group={g} runId={run.runId} />
          ))}
        </div>
      ) : null}
    </section>
  )
}

function GroupCard({ group, runId }: { group: TestDataGroupResult; runId: string }) {
  const failing = group.entries.filter((e) => !e.ok)
  const badge =
    group.allPassed === null ? (
      <Badge variant="outline">pending</Badge>
    ) : group.allPassed ? (
      <Badge variant="outline" className="gap-1.5">
        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> all good
      </Badge>
    ) : (
      <Badge variant="outline" className="gap-1.5">
        <XCircle className="h-3.5 w-3.5 text-red-500" /> {failing.length} failing
      </Badge>
    )

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{group.label}</span>
          {badge}
          <span className="text-xs text-muted-foreground">{group.totalRows} rows</span>
        </div>
        {group.hasTrimmed ? (
          <a href={api.testDataTrimmedUrl(runId, group.key)} download>
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-3.5 w-3.5" /> Trimmed CSV
            </Button>
          </a>
        ) : null}
      </div>

      {group.note ? <p className="mt-1 text-xs text-muted-foreground">{group.note}</p> : null}

      {failing.length > 0 ? (
        <table className="mt-2 w-full text-left text-xs">
          <thead className="text-muted-foreground">
            <tr>
              <th className="py-1 pr-3">Value</th>
              <th className="py-1 pr-3">Site</th>
              <th className="py-1 pr-3">Reason</th>
              <th className="py-1">URL</th>
            </tr>
          </thead>
          <tbody>
            {failing.flatMap((e) =>
              Object.entries(e.sites)
                .filter(([, r]) => r && !r.ok)
                .map(([site, r]) => (
                  <tr key={`${e.value}-${site}`} className="border-t border-border">
                    <td className="py-1 pr-3 font-mono">{e.value}</td>
                    <td className="py-1 pr-3">{site}</td>
                    <td className="py-1 pr-3">{r!.reason}</td>
                    <td className="py-1">
                      <a
                        className="text-blue-400 underline"
                        href={r!.final_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        open
                      </a>
                    </td>
                  </tr>
                )),
            )}
          </tbody>
        </table>
      ) : null}
    </div>
  )
}
