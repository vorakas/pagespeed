import {
  Rocket,
  History,
  ListTree,
  AlertTriangle,
  LayoutDashboard,
  Gauge,
  BarChart3,
  Activity,
  FileText,
  Brain,
  Hammer,
  Waves,
  Network,
  Settings,
  type LucideIcon,
} from "lucide-react"

interface NavItem {
  label: string
  href: string
  icon: LucideIcon
}

interface NavSection {
  label: string
  items: NavItem[]
}

const NAV: NavSection[] = [
  {
    label: "MIGRATION",
    items: [
      { label: "Launch Dashboard", href: "/dashboard", icon: Rocket },
      { label: "Status History", href: "/dashboard/history", icon: History },
      { label: "Workstreams", href: "/dashboard/workstreams/ws-data-platform", icon: ListTree },
      { label: "Blockers", href: "/dashboard#incidents", icon: AlertTriangle },
    ],
  },
  {
    label: "MONITORING",
    items: [
      { label: "PageSpeed", href: "/", icon: LayoutDashboard },
      { label: "Test URLs", href: "/test", icon: Gauge },
      { label: "Performance Metrics", href: "/metrics", icon: BarChart3 },
    ],
  },
  {
    label: "INTEGRATIONS",
    items: [
      { label: "New Relic", href: "/newrelic", icon: Activity },
      { label: "IIS Logs", href: "/iislogs", icon: FileText },
      { label: "AI Analysis", href: "/ai-analysis", icon: Brain },
      { label: "Automation Builds", href: "/builds", icon: Hammer },
      { label: "Load Testing", href: "/load-testing", icon: Waves },
      { label: "Obsidian Vault", href: "/obsidian", icon: Network },
    ],
  },
  {
    label: "CONFIG",
    items: [{ label: "Setup", href: "/setup", icon: Settings }],
  },
]

interface BeaconSidebarProps {
  /** Path of the active nav item. */
  activePath: string
  /** Polling state (kept for API compatibility — no longer drives the
   *  brand mark animation since the static Pharos logo is used). */
  polling: boolean
}

const BASE_URL = import.meta.env.BASE_URL

export function BeaconSidebar({ activePath }: BeaconSidebarProps) {
  return (
    <aside className="beacon-sidebar fixed left-0 top-0 bottom-0 z-40 flex w-[208px] flex-col">
      {/* Brand — static Pharos logo. The image carries the "Pharos"
          wordmark, so we don't repeat it as text — only the small
          OPERATIONS HUB tagline rides alongside. */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border">
        <img
          src={`${BASE_URL}images/Pharos-dark.png`}
          alt="Pharos"
          className="h-12 w-auto"
          onError={(e) => {
            e.currentTarget.style.display = "none"
          }}
        />
        <p className="beacon-label" style={{ fontSize: "9px" }}>
          OPERATIONS<br />HUB
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3">
        {NAV.map((section, sectionIdx) => (
          <div key={section.label} className="beacon-sidebar-section">
            {sectionIdx > 0 && <div className="beacon-sidebar-divider" />}
            <p className="beacon-sidebar-section-label">{section.label}</p>
            <div className="flex flex-col gap-px">
              {section.items.map((item) => {
                const Icon = item.icon
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    className="beacon-sidebar-item"
                    data-active={item.href === activePath}
                    onClick={(e) => {
                      // Prototype: keep navigation contained.
                      if (item.href !== activePath) e.preventDefault()
                    }}
                  >
                    <Icon size={14} className="shrink-0" aria-hidden />
                    <span className="truncate">{item.label}</span>
                  </a>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-border px-3 py-2.5">
        <p className="beacon-label" style={{ fontSize: "9px" }}>
          v1.0 · prototype
        </p>
      </div>
    </aside>
  )
}
