import { useTheme } from "@/hooks/use-theme"

const BASE_URL = import.meta.env.BASE_URL

interface HeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
}

export function Header({ title, description, actions }: HeaderProps) {
  const { theme } = useTheme()

  return (
    <header className="mx-3 mt-3 space-y-3">
      {/* Logo banner */}
      <div className="flex items-center gap-4 rounded-xl border border-border bg-card px-5 py-2.5 shadow-sm">
        <img
          src={theme === "dark" ? `${BASE_URL}images/DarkModeLogo.png` : `${BASE_URL}images/LightModeLogo.png`}
          alt="Lamps Plus"
          className="h-10 w-auto"
          onError={(e) => { e.currentTarget.style.display = "none" }}
        />
        <div className="h-8 w-px bg-border" />
        <img
          src={theme === "dark" ? `${BASE_URL}images/Pharos-dark.png` : `${BASE_URL}images/Pharos.png`}
          alt="Pharos"
          className="h-20 w-auto"
          onError={(e) => { e.currentTarget.style.display = "none" }}
        />
      </div>

      {/* Page title bar */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-3 shadow-sm">
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
