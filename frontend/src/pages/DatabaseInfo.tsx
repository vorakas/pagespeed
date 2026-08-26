import { useMemo, useState } from "react"
import { Database, Search, X } from "lucide-react"

import { EmptyState } from "@/components/shared/EmptyState"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { databaseMappings } from "@/data/databaseMappings"
import { filterDatabaseMappings } from "@/lib/databaseInfo"

const sheetOrder = ["All", ...Array.from(new Set(databaseMappings.map((row) => row.sheet)))]

const headerCellClass = "px-2 py-1.5 text-left font-semibold tracking-normal"
const subHeaderCellClass = "px-2 py-1.5 text-left font-medium tracking-normal"
const textCellClass = "px-2 py-1.5 font-medium text-foreground"
const codeCellClass = "px-2 py-1.5 font-mono text-[11px] text-foreground"

const wupHeaderClass =
  "bg-[oklch(87%_0.05_245)] text-[oklch(29%_0.08_245)] dark:bg-[oklch(34%_0.055_245)] dark:text-[oklch(89%_0.035_245)]"
const wupCellClass = "bg-[oklch(97%_0.018_245)] dark:bg-[oklch(24%_0.026_245)]"
const acDataHeaderClass =
  "bg-[oklch(88%_0.05_155)] text-[oklch(29%_0.075_155)] dark:bg-[oklch(33%_0.055_155)] dark:text-[oklch(89%_0.035_155)]"
const acDataCellClass = "bg-[oklch(97%_0.018_155)] dark:bg-[oklch(23%_0.026_155)]"
const acHeaderClass =
  "bg-[oklch(89%_0.06_82)] text-[oklch(33%_0.075_82)] dark:bg-[oklch(34%_0.052_82)] dark:text-[oklch(90%_0.04_82)]"
const acCellClass = "bg-[oklch(97%_0.02_82)] dark:bg-[oklch(24%_0.028_82)]"

export function DatabaseInfo() {
  const [query, setQuery] = useState("")
  const [selectedSheet, setSelectedSheet] = useState("All")

  const filteredRows = useMemo(
    () => filterDatabaseMappings(databaseMappings, query, selectedSheet),
    [query, selectedSheet],
  )

  const visibleSheets = useMemo(
    () => new Set(filteredRows.map((row) => row.sheet)).size,
    [filteredRows],
  )

  return (
    <>
      <PageHeader
        title="Database Info"
        description="ACLP database mappings for the Adobe Commerce migration."
        actions={
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{filteredRows.length} visible</span>
            <span>{databaseMappings.length} total</span>
            <span>{visibleSheets} sheets</span>
          </div>
        }
      />

      <main className="space-y-4 p-6">
        <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search database, table, column, or sheet"
                className="h-10 pl-9 pr-10"
                aria-label="Search database mappings"
              />
              {query && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            <div className="flex flex-wrap gap-1 rounded-md border border-border bg-muted/40 p-1">
              {sheetOrder.map((sheet) => (
                <Button
                  key={sheet}
                  type="button"
                  variant={selectedSheet === sheet ? "default" : "ghost"}
                  size="sm"
                  className="h-8 px-3"
                  onClick={() => setSelectedSheet(sheet)}
                >
                  {sheet}
                </Button>
              ))}
            </div>
          </div>
        </section>

        {filteredRows.length === 0 ? (
          <section className="rounded-lg border border-border bg-card p-6 shadow-sm">
            <EmptyState
              icon={<Database className="h-10 w-10" />}
              title="No mappings found"
              description="Try a different database, table, column, or sheet name."
              actionText={query ? "Clear search" : undefined}
              onAction={query ? () => setQuery("") : undefined}
            />
          </section>
        ) : (
          <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-xs">
                <thead>
                  <tr className="border-b border-border text-[10px] uppercase text-muted-foreground">
                    <th className={`${headerCellClass} bg-muted/60`} rowSpan={2}>
                      Sheet
                    </th>
                    <th className={`${headerCellClass} border-l border-border ${wupHeaderClass}`} colSpan={3}>
                      WUP
                    </th>
                    <th className={`${headerCellClass} border-l border-border ${acDataHeaderClass}`} colSpan={3}>
                      ACData
                    </th>
                    <th className={`${headerCellClass} border-l border-border ${acHeaderClass}`} colSpan={2}>
                      AC
                    </th>
                  </tr>
                  <tr className="border-b border-border text-[10px] uppercase text-muted-foreground">
                    <th className={`${subHeaderCellClass} border-l border-border ${wupHeaderClass}`}>Database</th>
                    <th className={`${subHeaderCellClass} ${wupHeaderClass}`}>Table</th>
                    <th className={`${subHeaderCellClass} ${wupHeaderClass}`}>Column</th>
                    <th className={`${subHeaderCellClass} border-l border-border ${acDataHeaderClass}`}>Database</th>
                    <th className={`${subHeaderCellClass} ${acDataHeaderClass}`}>Table</th>
                    <th className={`${subHeaderCellClass} ${acDataHeaderClass}`}>Column</th>
                    <th className={`${subHeaderCellClass} border-l border-border ${acHeaderClass}`}>Table</th>
                    <th className={`${subHeaderCellClass} ${acHeaderClass}`}>Column</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredRows.map((row, index) => (
                    <tr key={`${row.sheet}-${index}`} className="hover:bg-muted/35">
                      <td className="whitespace-nowrap px-2 py-1.5 text-muted-foreground">{row.sheet}</td>
                      <td className={`${textCellClass} border-l border-border ${wupCellClass}`}>{row.legacyDatabase}</td>
                      <td className={`${codeCellClass} ${wupCellClass}`}>{row.legacyTable}</td>
                      <td className={`${codeCellClass} ${wupCellClass}`}>{row.legacyColumn}</td>
                      <td className={`${textCellClass} border-l border-border ${acDataCellClass}`}>{row.acDataDatabase}</td>
                      <td className={`${codeCellClass} ${acDataCellClass}`}>{row.acDataTable}</td>
                      <td className={`${codeCellClass} ${acDataCellClass}`}>{row.acDataColumn}</td>
                      <td className={`${codeCellClass} border-l border-border ${acCellClass}`}>{row.commerceTable}</td>
                      <td className={`${codeCellClass} ${acCellClass}`}>{row.commerceColumn}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </>
  )
}
