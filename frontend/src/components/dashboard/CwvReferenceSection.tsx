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
        <h2 className="aurora-section-title">Core Web Vitals Reference</h2>
        <p className="aurora-section-subtitle">
          Understanding metric thresholds based on Google's Web Vitals initiative
        </p>
      </div>
      <div className="aurora-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="aurora-table">
            <thead>
              <tr>
                <th>Metric</th>
                <th>Good</th>
                <th>Needs Improvement</th>
                <th>Poor</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((metric) => (
                <tr key={metric.name}>
                  <td>
                    <span className="aurora-text font-semibold">{metric.name}</span>
                    <span className="aurora-text-faint"> ({metric.fullName})</span>
                  </td>
                  <td className="font-medium" style={{ color: "var(--lcc-green)" }}>
                    {metric.good}
                  </td>
                  <td className="font-medium" style={{ color: "var(--lcc-amber)" }}>
                    {metric.needsImprovement}
                  </td>
                  <td className="font-medium" style={{ color: "var(--lcc-red)" }}>
                    {metric.poor}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
