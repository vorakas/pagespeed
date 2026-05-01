import { Link } from "react-router-dom"
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
  Sun,
  Moon,
  type LucideIcon,
} from "lucide-react"
import { useTheme } from "@/hooks/use-theme"

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

interface AppSidebarProps {
  /** Path of the active nav item — typically `useLocation().pathname`,
   *  optionally with a `#hash` appended for hash-link items like
   *  /dashboard#incidents. */
  activePath: string
}

const BASE_URL = import.meta.env.BASE_URL

/**
 * Pharos sidebar — left-rail navigation rendered by the production
 * `AppLayout`. The class name `.beacon-sidebar` (and its descendants)
 * comes from the underlying CSS register and stays unchanged across
 * the component rename — the register is the cross-cutting visual
 * spec, the component is its mount point.
 *
 * Was named `BeaconSidebar` during the prototype phase. Phase 3C of
 * the Aurora rollout renamed it to `AppSidebar` since the prototype
 * is gone and the component is now the singular sidebar for production.
 */
export function AppSidebar({ activePath }: AppSidebarProps) {
  const { theme, toggleTheme } = useTheme()
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
                // Active when pathname+hash match the link target. The
                // hash split lets `/dashboard#incidents` light up only
                // when the user is actually scrolled to that anchor,
                // and a bare `/dashboard` doesn't trigger the Blockers
                // item.
                const [linkPath, linkHash = ""] = item.href.split("#")
                const isActive = linkPath === activePath.split("#")[0] &&
                  linkHash === (activePath.split("#")[1] ?? "")
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className="beacon-sidebar-item"
                    data-active={isActive}
                  >
                    <Icon size={14} className="shrink-0" aria-hidden />
                    <span className="truncate">{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer — theme toggle */}
      <div className="border-t border-border p-2">
        <button
          type="button"
          onClick={toggleTheme}
          className="beacon-sidebar-item w-full"
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
          <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
        </button>
      </div>
    </aside>
  )
}
