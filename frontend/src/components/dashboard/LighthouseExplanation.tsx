import { Card, CardContent } from "@/components/ui/card"
import { Zap, Accessibility, ShieldCheck, Search } from "lucide-react"
import { cn } from "@/lib/utils"

interface CategoryInfo {
  icon: React.ReactNode
  title: string
  accentClass: string
  measures: string
  details: string[]
  impact: string
}

const categories: CategoryInfo[] = [
  {
    icon: <Zap size={20} />,
    title: "Performance",
    accentClass: "text-chart-1 bg-chart-1/10",
    measures: "How quickly content loads and becomes interactive",
    details: [
      "Speed Metrics: First Contentful Paint, Largest Contentful Paint, Speed Index",
      "Interactivity: Time to Interactive, Total Blocking Time",
      "Visual Stability: Cumulative Layout Shift",
    ],
    impact: "Faster sites improve user experience and engagement. Performance is a ranking factor for Google Search.",
  },
  {
    icon: <Accessibility size={20} />,
    title: "Accessibility",
    accentClass: "text-pink-400 bg-pink-400/10",
    measures: "How usable your site is for all users, including those with disabilities",
    details: [
      "Screen Readers: Proper ARIA labels, semantic HTML, image alt text",
      "Keyboard Navigation: Focus indicators, logical tab order",
      "Visual: Color contrast, text sizing, touch targets",
      "Forms: Proper labels, error identification",
    ],
    impact: "Makes your site usable by everyone and is often a legal requirement (ADA, WCAG compliance).",
  },
  {
    icon: <ShieldCheck size={20} />,
    title: "Best Practices",
    accentClass: "text-cyan-400 bg-cyan-400/10",
    measures: "Overall code quality and modern web development standards",
    details: [
      "Security: HTTPS usage, secure connections, no browser errors",
      "Modern APIs: Deprecated API usage, console errors",
      "Images: Proper aspect ratios, appropriate formats",
      "Trust & Safety: No vulnerable libraries, proper permissions",
    ],
    impact: "Ensures your site follows web standards, is secure, and provides a reliable experience.",
  },
  {
    icon: <Search size={20} />,
    title: "SEO",
    accentClass: "text-emerald-400 bg-emerald-400/10",
    measures: "How well search engines can crawl and index your site",
    details: [
      "Content: Page titles, meta descriptions, heading structure",
      "Crawlability: robots.txt, canonical URLs, mobile-friendliness",
      "Links: Descriptive link text, valid href attributes",
      "Structure: Valid HTML, proper status codes, structured data",
    ],
    impact: "Better SEO means higher visibility in search results and more organic traffic.",
  },
]

export function LighthouseExplanation() {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Understanding Lighthouse Scores</h2>
        <p className="text-sm text-muted-foreground">
          What each category measures (scores range from 0-100) — Powered by Google PageSpeed Insights API
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {categories.map((category) => (
          <Card key={category.title}>
            <CardContent className="p-5">
              <div className="mb-3 flex items-center gap-2.5">
                <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg", category.accentClass)}>
                  {category.icon}
                </div>
                <h3 className="text-sm font-semibold text-foreground">{category.title}</h3>
              </div>
              <p className="mb-2 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Measures: </span>
                {category.measures}
              </p>
              <ul className="mb-3 space-y-1">
                {category.details.map((detail) => {
                  const [label, ...rest] = detail.split(": ")
                  return (
                    <li key={detail} className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">{label}: </span>
                      {rest.join(": ")}
                    </li>
                  )
                })}
              </ul>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Impact: </span>
                {category.impact}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
