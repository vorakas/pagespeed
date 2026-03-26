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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
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
      <span className="block truncate text-foreground" title={row.original.url}>
        {row.original.url}
      </span>
    ),
  },
  {
    accessorKey: "performance_score",
    header: "Perf",
    cell: ({ row }) => <ScoreBadge score={row.original.performance_score} />,
    size: 70,
  },
  {
    accessorKey: "accessibility_score",
    header: "Access",
    cell: ({ row }) => <ScoreBadge score={row.original.accessibility_score} />,
    size: 70,
  },
  {
    accessorKey: "best_practices_score",
    header: "BP",
    cell: ({ row }) => <ScoreBadge score={row.original.best_practices_score} />,
    size: 70,
  },
  {
    accessorKey: "seo_score",
    header: "SEO",
    cell: ({ row }) => <ScoreBadge score={row.original.seo_score} />,
    size: 70,
  },
  {
    accessorKey: "fcp",
    header: "FCP",
    cell: ({ row }) => <span className="tabular-nums">{formatMilliseconds(row.original.fcp)}</span>,
    size: 80,
  },
  {
    accessorKey: "lcp",
    header: "LCP",
    cell: ({ row }) => <span className="tabular-nums">{formatMilliseconds(row.original.lcp)}</span>,
    size: 80,
  },
  {
    accessorKey: "cls",
    header: "CLS",
    cell: ({ row }) => <span className="tabular-nums">{formatCls(row.original.cls)}</span>,
    size: 70,
  },
  {
    accessorKey: "inp",
    header: "INP",
    cell: ({ row }) => <span className="tabular-nums">{formatMilliseconds(row.original.inp)}</span>,
    size: 80,
  },
  {
    accessorKey: "ttfb",
    header: "TTFB",
    cell: ({ row }) => <span className="tabular-nums">{formatMilliseconds(row.original.ttfb)}</span>,
    size: 80,
  },
  {
    accessorKey: "total_byte_weight",
    header: "Size",
    cell: ({ row }) => <span className="tabular-nums">{formatBytes(row.original.total_byte_weight)}</span>,
    size: 90,
  },
  {
    accessorKey: "tested_at",
    header: "Last Tested",
    cell: ({ row }) => (
      <span className="text-muted-foreground">{formatDateTime(row.original.tested_at)}</span>
    ),
    size: 140,
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
    <Card>
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">{siteName}</h3>
      </div>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="hover:bg-transparent">
                  {headerGroup.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      className="h-9 whitespace-nowrap text-xs"
                      style={header.column.columnDef.size ? { width: header.getSize() } : undefined}
                    >
                      {header.isPlaceholder ? null : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="-ml-3 h-8 text-xs font-medium"
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
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-2 text-sm">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

export function WorstPerformersSection({ data, loading, error }: WorstPerformersSectionProps) {
  if (loading) {
    return <LoadingSpinner message="Loading worst performers..." />
  }

  if (error) {
    return (
      <Card className="p-6">
        <p className="text-center text-sm text-destructive">{error}</p>
      </Card>
    )
  }

  const siteNames = Object.keys(data)

  if (siteNames.length === 0) {
    return (
      <Card>
        <CardContent className="p-0">
          <EmptyState
            icon={<BarChart3 size={40} />}
            title="No Test Results Yet"
            description="Run PageSpeed tests on your configured URLs to see the worst performers here."
            actionText="Go to Test URLs"
            actionHref="/test"
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Worst Performing URLs</h2>
        <p className="text-sm text-muted-foreground">
          Bottom 5 URLs by performance score for each configured site
        </p>
      </div>
      {siteNames.map((siteName) => (
        <SiteTable key={siteName} siteName={siteName} results={data[siteName]} />
      ))}
    </div>
  )
}
