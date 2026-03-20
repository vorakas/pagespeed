import { useTheme } from "@/hooks/use-theme"
import { Button } from "@/components/ui/button"
import { Sun, Moon } from "lucide-react"

const BASE_URL = import.meta.env.BASE_URL

interface HeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
}

export function Header({ title, description, actions }: HeaderProps) {
  const { theme, toggleTheme } = useTheme()

  return (
    <header className="border-b border-border bg-card">
      {/* Top banner with logo */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <img
            src={theme === "dark" ? `${BASE_URL}images/DarkModeLogo.png` : `${BASE_URL}images/LightModeLogo.png`}
            alt="LampsPlus"
            className="h-7 w-auto"
            onError={(e) => {
              e.currentTarget.style.display = "none"
            }}
          />
          <span className="text-base font-semibold text-foreground">PageSpeed Insights Monitor</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </Button>
      </div>
      {/* Page title bar */}
      <div className="flex items-center justify-between px-6 py-3">
        <div>
          <h1 className="text-lg font-semibold text-foreground">{title}</h1>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-3">
            {actions}
          </div>
        )}
      </div>
    </header>
  )
}
