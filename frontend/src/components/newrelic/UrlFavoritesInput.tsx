import { Star } from "lucide-react"

interface UrlFavoritesInputProps {
  id: string
  label: string
  url: string
  onUrlChange: (url: string) => void
  favorites: string[]
  onFavoritesChange: (favorites: string[]) => void
  placeholder: string
}

export function UrlFavoritesInput({
  id,
  label,
  url,
  onUrlChange,
  favorites,
  onFavoritesChange,
  placeholder,
}: UrlFavoritesInputProps) {
  const isFavorited = url.trim() !== "" && favorites.includes(url.trim())

  const toggleFavorite = () => {
    const trimmed = url.trim()
    if (!trimmed) return
    if (isFavorited) {
      onFavoritesChange(favorites.filter((f) => f !== trimmed))
    } else {
      onFavoritesChange([...favorites, trimmed])
    }
  }

  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <label htmlFor={id} className="aurora-label block">{label}</label>
      <div className="flex gap-1.5">
        <input
          id={id}
          className="aurora-input flex-1 min-w-0"
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={toggleFavorite}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded transition-colors"
          style={{
            border: "1px solid var(--lcc-border)",
            backgroundColor: "var(--glass-bg)",
            color: isFavorited ? "var(--lcc-amber)" : "var(--lcc-text-faint)",
          }}
          title={isFavorited ? "Remove from favorites" : "Save to favorites"}
        >
          <Star className="h-3.5 w-3.5" fill={isFavorited ? "currentColor" : "none"} />
        </button>
      </div>
      {favorites.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {favorites.map((fav) => {
            const isActive = fav === url.trim()
            return (
              <button
                key={fav}
                type="button"
                className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] transition-colors"
                style={{
                  backgroundColor: isActive ? "var(--lcc-amber)" : "var(--glass-bg)",
                  color: isActive ? "#000" : "var(--lcc-text-dim)",
                  border: `1px solid ${isActive ? "var(--lcc-amber)" : "var(--lcc-border)"}`,
                }}
                onClick={() => onUrlChange(fav)}
                title={fav}
              >
                <span className="truncate max-w-[200px]">
                  {fav.replace(/^https?:\/\//, "")}
                </span>
                <span
                  className="ml-0.5 cursor-pointer opacity-50 hover:opacity-100"
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation()
                    onFavoritesChange(favorites.filter((f) => f !== fav))
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.stopPropagation()
                      onFavoritesChange(favorites.filter((f) => f !== fav))
                    }
                  }}
                >
                  ×
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
