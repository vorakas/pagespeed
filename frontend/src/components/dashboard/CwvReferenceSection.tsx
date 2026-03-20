import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface MetricThreshold {
  name: string
  fullName: string
  good: string
  needsImprovement: string
  poor: string
}

const metrics: MetricThreshold[] = [
  { name: "FCP", fullName: "First Contentful Paint", good: "[0, 1800ms]", needsImprovement: "(1800ms, 3000ms]", poor: "over 3000ms" },
  { name: "LCP", fullName: "Largest Contentful Paint", good: "[0, 2500ms]", needsImprovement: "(2500ms, 4000ms]", poor: "over 4000ms" },
  { name: "CLS", fullName: "Cumulative Layout Shift", good: "[0, 0.1]", needsImprovement: "(0.1, 0.25]", poor: "over 0.25" },
  { name: "INP", fullName: "Interaction to Next Paint", good: "[0, 200ms]", needsImprovement: "(200ms, 500ms]", poor: "over 500ms" },
  { name: "TTFB", fullName: "Time to First Byte", good: "[0, 800ms]", needsImprovement: "(800ms, 1800ms]", poor: "over 1800ms" },
]

export function CwvReferenceSection() {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Core Web Vitals Reference</h2>
        <p className="text-sm text-muted-foreground">
          Understanding metric thresholds based on Google's Web Vitals initiative
        </p>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-9 text-xs font-medium">Metric</TableHead>
                <TableHead className="h-9 text-xs font-medium">Good</TableHead>
                <TableHead className="h-9 text-xs font-medium">Needs Improvement</TableHead>
                <TableHead className="h-9 text-xs font-medium">Poor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {metrics.map((metric) => (
                <TableRow key={metric.name}>
                  <TableCell className="py-2.5 text-sm">
                    <span className="font-semibold text-foreground">{metric.name}</span>
                    <span className="text-muted-foreground"> ({metric.fullName})</span>
                  </TableCell>
                  <TableCell className="py-2.5 text-sm font-medium text-score-good">
                    {metric.good}
                  </TableCell>
                  <TableCell className="py-2.5 text-sm font-medium text-score-average">
                    {metric.needsImprovement}
                  </TableCell>
                  <TableCell className="py-2.5 text-sm font-medium text-score-poor">
                    {metric.poor}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
