import { useState } from "react"
import { Upload, ExternalLink, Download, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { api } from "@/services/api"
import type { TestDataGroupListing, TestDataListing, ValidationSiteKey } from "@/types"

const SITES: ValidationSiteKey[] = ["mcprod", "www"]

export function TestDataValidationPanel() {
  const [listing, setListing] = useState<TestDataListing | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileCount, setFileCount] = useState(0)

  const handleFiles = async (files: File[]) => {
    setFileCount(files.length)
    if (files.length === 0) return
    setError(null)
    setLoading(true)
    try {
      setListing(await api.buildTestDataUrls(files, SITES))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to build URLs")
    } finally {
      setLoading(false)
    }
  }

  const groups = listing ? Object.values(listing.groups) : []

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div>
        <h2 className="text-base font-semibold text-foreground">TestData SKU links</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload the BlazeMeter <code>TestData/*.csv</code> files. Pharos builds each entry's mcprod
          and www URL so you can open and check every SKU before a load test. MoreLikeThis is capped
          to 5.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {fileCount > 0 ? `${fileCount} file(s) selected` : "Choose CSV files"}
          <input
            type="file"
            multiple
            accept=".csv"
            className="hidden"
            onChange={(e) => void handleFiles(Array.from(e.target.files ?? []))}
          />
        </label>
      </div>

      {error ? <p className="mt-3 text-sm text-red-500">{error}</p> : null}

      {listing && listing.unrecognized.length > 0 ? (
        <p className="mt-3 text-sm text-amber-500">
          Unrecognized files (skipped): {listing.unrecognized.join(", ")}
        </p>
      ) : null}

      {groups.length > 0 ? (
        <div className="mt-4 space-y-3">
          {groups.map((g) => (
            <GroupCard key={g.key} group={g} />
          ))}
        </div>
      ) : null}
    </section>
  )
}

function downloadCsv(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function GroupCard({ group }: { group: TestDataGroupListing }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{group.label}</span>
          <span className="text-xs text-muted-foreground">
            {group.capped
              ? `showing ${group.shownRows} of ${group.totalRows} rows (capped at ${group.maxRows})`
              : `${group.totalRows} rows`}
          </span>
        </div>
        {group.trimmedCsv ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadCsv(group.filename, group.trimmedCsv!)}
          >
            <Download className="mr-2 h-3.5 w-3.5" /> Trimmed CSV ({group.shownRows})
          </Button>
        ) : null}
      </div>

      <table className="mt-2 w-full text-left text-xs">
        <thead className="text-muted-foreground">
          <tr>
            <th className="py-1 pr-3">Value</th>
            <th className="py-1 pr-3">mcprod</th>
            <th className="py-1">www</th>
          </tr>
        </thead>
        <tbody>
          {group.entries.map((e) => (
            <tr key={e.value} className="border-t border-border align-top">
              <td className="py-1 pr-3 font-mono break-all">{e.value}</td>
              <td className="py-1 pr-3">
                {e.urls.mcprod ? (
                  <OpenLink href={e.urls.mcprod} />
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
              <td className="py-1">
                {e.urls.www ? (
                  <OpenLink href={e.urls.www} />
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function OpenLink({ href }: { href: string }) {
  return (
    <a
      className="inline-flex items-center gap-1 text-blue-400 underline"
      href={href}
      target="_blank"
      rel="noreferrer"
    >
      Open <ExternalLink className="h-3 w-3" />
    </a>
  )
}
