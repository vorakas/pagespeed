import { Link, useLocation } from "react-router-dom"
import { useTheme } from "@/hooks/use-theme"

import {
  LayoutDashboard,
  Gauge,
  BarChart3,
  Settings,
  Activity,
  FileText,
  Brain,
  Hammer,
  Waves,
  Network,
  ListTree,
  AlertTriangle,
  Rocket,
  History,
  Sun,
  Moon,
} from "lucide-react"

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
}

interface NavSection {
  title: string
  items: NavItem[]
}

const navSections: NavSection[] = [
  {
    title: "Migration",
    items: [
      { label: "Launch Dashboard", href: "/dashboard", icon: <Rocket size={16} /> },
      { label: "Status History", href: "/dashboard/history", icon: <History size={16} /> },
      { label: "Workstreams", href: "/dashboard/workstreams/ws-data-platform", icon: <ListTree size={16} /> },
      { label: "Blockers & Incidents", href: "/dashboard#incidents", icon: <AlertTriangle size={16} /> },
    ],
  },
  {
    title: "Monitoring",
    items: [
      { label: "PageSpeed", href: "/", icon: <LayoutDashboard size={16} /> },
      { label: "Test URLs", href: "/test", icon: <Gauge size={16} /> },
      { label: "Performance Metrics", href: "/metrics", icon: <BarChart3 size={16} /> },
    ],
  },
  {
    title: "Integrations",
    items: [
      { label: "New Relic", href: "/newrelic", icon: <Activity size={16} /> },
      { label: "IIS Logs", href: "/iislogs", icon: <FileText size={16} /> },
      { label: "AI Analysis", href: "/ai-analysis", icon: <Brain size={16} /> },
      { label: "Automation Builds", href: "/builds", icon: <Hammer size={16} /> },
      { label: "Load Testing", href: "/load-testing", icon: <Waves size={16} /> },
      { label: "Obsidian Vault", href: "/obsidian", icon: <Network size={16} /> },
    ],
  },
  {
    title: "Configuration",
    items: [
      { label: "Setup", href: "/setup", icon: <Settings size={16} /> },
    ],
  },
]

function isItemActive(
  href: string,
  pathname: string,
  hash: string,
): boolean {
  const [linkPath, linkHash = ""] = href.split("#")
  const currentHash = hash.startsWith("#") ? hash.slice(1) : hash
  if (linkPath === "/") {
    return pathname === "/" && !currentHash
  }
  return pathname === linkPath && currentHash === linkHash
}

export function Sidebar() {
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()

  return (
    <aside className="aurora-sidebar fixed left-3 top-3 bottom-3 z-50 flex w-[220px] flex-col">
      <div className="aurora-sidebar-head">
        <div className="aurora-sidebar-brand-dot" aria-hidden />
        <div className="min-w-0">
          <p className="aurora-sidebar-brand-name truncate">Pharos</p>
          <p className="aurora-sidebar-brand-sub">Operations Hub</p>
        </div>
      </div>

      <nav className="aurora-sidebar-nav">
        {navSections.map((section, sectionIndex) => (
          <div key={section.title}>
            {sectionIndex > 0 && <div className="aurora-sidebar-separator mb-3" />}
            <p className="aurora-sidebar-section-label">{section.title}</p>
            <div className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const active = isItemActive(item.href, location.pathname, location.hash)
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className="aurora-sidebar-item"
                    data-active={active}
                  >
                    {item.icon}
                    <span className="truncate">{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="aurora-sidebar-footer">
        <button
          type="button"
          onClick={toggleTheme}
          className="aurora-sidebar-item w-full"
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
        </button>
      </div>
    </aside>
  )
}
