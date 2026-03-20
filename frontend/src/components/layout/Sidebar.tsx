import { NavLink } from "react-router-dom"

const BASE_URL = import.meta.env.BASE_URL
import { cn } from "@/lib/utils"
import { useTheme } from "@/hooks/use-theme"
import {
  LayoutDashboard,
  Gauge,
  BarChart3,
  Settings,
  Activity,
  FileText,
  Brain,
} from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"

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
    title: "Monitoring",
    items: [
      { label: "Dashboard", href: "/", icon: <LayoutDashboard size={20} /> },
      { label: "Test URLs", href: "/test", icon: <Gauge size={20} /> },
      { label: "Metrics", href: "/metrics", icon: <BarChart3 size={20} /> },
    ],
  },
  {
    title: "Integrations",
    items: [
      { label: "New Relic", href: "/newrelic", icon: <Activity size={20} /> },
      { label: "IIS Logs", href: "/iislogs", icon: <FileText size={20} /> },
      { label: "AI Analysis", href: "/ai-analysis", icon: <Brain size={20} /> },
    ],
  },
  {
    title: "Configuration",
    items: [
      { label: "Setup", href: "/setup", icon: <Settings size={20} /> },
    ],
  },
]

export function Sidebar() {
  const { theme } = useTheme()

  return (
    <aside className="fixed left-0 top-0 z-50 flex h-screen w-[260px] flex-col border-r border-sidebar-border bg-sidebar">
      {/* Logo Header */}
      <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-5">
        <img
          src={theme === "dark" ? `${BASE_URL}images/DarkModeLogo.png` : `${BASE_URL}images/LightModeLogo.png`}
          alt="LampsPlus"
          className="h-7 w-auto"
          onError={(e) => {
            e.currentTarget.style.display = "none"
          }}
        />
        <span className="text-sm font-semibold text-sidebar-foreground">PageSpeed Monitor</span>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-3">
        {navSections.map((section) => (
          <div key={section.title}>
            <div className="px-3 pb-1 pt-4 first:pt-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {section.title}
              </span>
            </div>
            {section.items.map((item) => (
              <NavLink
                key={item.href}
                to={item.href}
                end={item.href === "/"}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                    "my-0.5",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )
                }
              >
                {item.icon}
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </ScrollArea>
    </aside>
  )
}
