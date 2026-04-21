import { NavLink } from "react-router-dom"
import { useTheme } from "@/hooks/use-theme"

import { cn } from "@/lib/utils"
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
  Share2,
  ListTree,
  AlertTriangle,
  Rocket,
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
      { label: "Knowledge Graph", href: "/dashboard#graph", icon: <Share2 size={16} /> },
      { label: "Workstreams", href: "/dashboard#workstreams", icon: <ListTree size={16} /> },
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

export function Sidebar() {
  const { theme, toggleTheme } = useTheme()

  return (
    <aside className="fixed left-3 top-3 bottom-3 z-50 flex w-[220px] flex-col rounded-xl border border-sidebar-border bg-sidebar shadow-lg">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-sidebar-border">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
          <Gauge size={16} className="text-sidebar-primary-foreground" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-sidebar-foreground truncate">Pharos</p>
          <p className="text-[10px] text-muted-foreground">Operations Hub</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 pb-3 pt-2">
        {navSections.map((section, sectionIndex) => (
          <div key={section.title}>
            {sectionIndex > 0 && (
              <div className="mx-1 my-2 h-px bg-sidebar-border" />
            )}
            <p className="px-2 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {section.title}
            </p>
            {section.items.map((item) => (
              <NavLink
                key={item.href}
                to={item.href}
                end={item.href === "/"}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                  )
                }
              >
                {item.icon}
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Theme toggle at bottom */}
      <div className="border-t border-sidebar-border px-3 py-2.5">
        <button
          onClick={toggleTheme}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          {theme === "dark" ? "Light Mode" : "Dark Mode"}
        </button>
      </div>
    </aside>
  )
}
