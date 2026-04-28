import { useState } from "react"
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table"
import { ArrowUpDown, ArrowUp, ArrowDown, BarChart3, RefreshCw, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScoreBadge } from "@/components/shared/ScoreBadge"
import { EmptyState } from "@/components/shared/EmptyState"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { formatMilliseconds, formatCls, formatBytes, formatDateTime } from "@/lib/utils"
import type { LatestResult } from "@/types"

interface TestResultsTableProps {
  results: LatestResult[]
  loading: boolean
  error: string | null
  onViewDetails: (urlId: number) => void
  onRetestUrl: (urlId: number, url: string) => void
  onDeleteUrl: (urlId: number, url: string) => void
  retestingUrlId: number | null
}

function createColumns(
  onViewDetails: (urlId: number) => void,
  onRetestUrl: (urlId: number, url: string) => void,
  onDeleteUrl: (urlId: number, url: string) => void,
  retestingUrlId: number | null
): ColumnDef<LatestResult>[] {
  return [
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
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const result = row.original
        const isRetesting = retestingUrlId === result.url_id
        return (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-xs"
              title="View detailed breakdown"
              onClick={() => onViewDetails(result.url_id)}
            >
              <BarChart3 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              title="Retest this URL"
              onClick={() => onRetestUrl(result.url_id, result.url)}
              disabled={isRetesting}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRetesting ? "animate-spin" : ""}`} />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              title="Delete this URL"
              style={{ color: "var(--lcc-red)" }}
              onClick={() => onDeleteUrl(result.url_id, result.url)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )
      },
      size: 80,
      enableSorting: false,
    },
  ]
}

export function TestResultsTable({
  results,
  loading,
  error,
  onViewDetails,
  onRetestUrl,
  onDeleteUrl,
  retestingUrlId,
}: TestResultsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])

  const columns = createColumns(onViewDetails, onRetestUrl, onDeleteUrl, retestingUrlId)

  const table = useReactTable({
    data: results,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: { sorting },
  })

  if (loading) {
    return <LoadingSpinner message="Loading results..." />
  }

  if (error) {
    return (
      <div className="aurora-panel p-6">
        <p className="text-center text-sm" style={{ color: "var(--lcc-red)" }}>{error}</p>
      </div>
    )
  }

  if (results.length === 0) {
    return (
      <div className="aurora-panel overflow-hidden">
        <EmptyState
          icon={<BarChart3 size={40} />}
          title="No Test Results Yet"
          description="Run a PageSpeed test to see performance scores for this site."
        />
      </div>
    )
  }

  return (
    <div className="aurora-panel overflow-hidden">
      <div className="overflow-x-auto">
        <table className="aurora-table">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    style={header.column.columnDef.size ? { width: "1px" } : undefined}
                  >
                    {header.isPlaceholder ? null : header.column.getCanSort() ? (
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
                    ) : (
                      <span>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </span>
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
