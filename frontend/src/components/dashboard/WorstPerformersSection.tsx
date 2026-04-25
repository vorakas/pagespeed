import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table"
import { useState } from "react"
import { ArrowUpDown, ArrowUp, ArrowDown, BarChart3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScoreBadge } from "@/components/shared/ScoreBadge"
import { EmptyState } from "@/components/shared/EmptyState"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { formatMilliseconds, formatCls, formatBytes, formatDateTime } from "@/lib/utils"
import type { WorstPerformer } from "@/types"

interface WorstPerformersSectionProps {
  data: Record<string, WorstPerformer[]>
  loading: boolean
  error: string | null
}

const columns: ColumnDef<WorstPerformer>[] = [
  {
    accessorKey: "url",
    header: "URL",
    cell: ({ row }) => (
      <span className="aurora-text block truncate" title={row.original.url}>
        {row.original.url}
      </span>
    ),
  },
  {
    accessorKey: "performance_score",
    header: "Perf",
    cell: ({ row }) => <ScoreBadge score={row.original.performance_score} />,
    size: 52,
  },
  {
    accessorKey: "accessibility_score",
    header: "Access",
    cell: ({ row }) => <ScoreBadge score={row.original.accessibility_score} />,
    size: 52,
  },
  {
    accessorKey: "best_practices_score",
    header: "BP",
    cell: ({ row }) => <ScoreBadge score={row.original.best_practices_score} />,
    size: 52,
  },
  {
    accessorKey: "seo_score",
    header: "SEO",
    cell: ({ row }) => <ScoreBadge score={row.original.seo_score} />,
    size: 52,
  },
  {
    accessorKey: "fcp",
    header: "FCP",
    cell: ({ row }) => <span className="aurora-num">{formatMilliseconds(row.original.fcp)}</span>,
    size: 62,
  },
  {
    accessorKey: "lcp",
    header: "LCP",
    cell: ({ row }) => <span className="aurora-num">{formatMilliseconds(row.original.lcp)}</span>,
    size: 62,
  },
  {
    accessorKey: "cls",
    header: "CLS",
    cell: ({ row }) => <span className="aurora-num">{formatCls(row.original.cls)}</span>,
    size: 52,
  },
  {
    accessorKey: "inp",
    header: "INP",
    cell: ({ row }) => <span className="aurora-num">{formatMilliseconds(row.original.inp)}</span>,
    size: 62,
  },
  {
    accessorKey: "ttfb",
    header: "TTFB",
    cell: ({ row }) => <span className="aurora-num">{formatMilliseconds(row.original.ttfb)}</span>,
    size: 62,
  },
  {
    accessorKey: "total_byte_weight",
    header: "Size",
    cell: ({ row }) => <span className="aurora-num">{formatBytes(row.original.total_byte_weight)}</span>,
    size: 68,
  },
  {
    accessorKey: "tested_at",
    header: "Last Tested",
    cell: ({ row }) => (
      <span className="aurora-text-faint">{formatDateTime(row.original.tested_at)}</span>
    ),
    size: 115,
  },
]

function SiteTable({ siteName, results }: { siteName: string; results: WorstPerformer[] }) {
  const [sorting, setSorting] = useState<SortingState>([])

  const table = useReactTable({
    data: results,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: { sorting },
  })

  return (
    <div className="aurora-panel overflow-hidden">
      <div className="aurora-panel-header">{siteName}</div>
      <div className="overflow-x-auto">
        <table className="aurora-table">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    style={header.column.columnDef.size ? { width: "1px" } : { width: "100%" }}
                  >
                    {header.isPlaceholder ? null : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="aurora-text-faint -ml-2 h-7 px-1 text-[10px] font-semibold uppercase tracking-[0.12em] hover:bg-transparent hover:text-[color:var(--lcc-text)]"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === "asc" ? (
                          <ArrowUp className="ml-1 h-3 w-3" />
                        ) : header.column.getIsSorted() === "desc" ? (
                          <ArrowDown className="ml-1 h-3 w-3" />
                        ) : (
                          <ArrowUpDown className="ml-1 h-3 w-3 opacity-40" />
                        )}
                      </Button>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function WorstPerformersSection({ data, loading, error }: WorstPerformersSectionProps) {
  if (loading) {
    return <LoadingSpinner message="Loading worst performers..." />
  }

  if (error) {
    return (
      <div className="aurora-panel p-6">
        <p className="text-center text-sm text-[color:var(--lcc-red)]">{error}</p>
      </div>
    )
  }

  const siteNames = Object.keys(data)

  if (siteNames.length === 0) {
    return (
      <div className="aurora-panel overflow-hidden">
        <EmptyState
          icon={<BarChart3 size={40} />}
          title="No Test Results Yet"
          description="Run PageSpeed tests on your configured URLs to see the worst performers here."
          actionText="Go to Test URLs"
          actionHref="/test"
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="aurora-section-title">Worst Performing URLs</h2>
        <p className="aurora-section-subtitle">
          Bottom 5 URLs by performance score for each configured site
        </p>
      </div>
      {siteNames.map((siteName) => (
        <SiteTable key={siteName} siteName={siteName} results={data[siteName]} />
      ))}
    </div>
  )
}
