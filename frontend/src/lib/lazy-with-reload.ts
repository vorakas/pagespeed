import { lazy, type ComponentType } from "react"

const reloadAttemptKey = "pharos:route-chunk-reload"

function errorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}

function isChunkLoadError(error: unknown) {
  const message = errorMessage(error)
  return [
    "Failed to fetch dynamically imported module",
    "Importing a module script failed",
    "Loading chunk",
    "ChunkLoadError",
    "dynamically imported module",
  ].some((needle) => message.includes(needle))
}

function reloadOnceForChunkError(error: unknown) {
  if (typeof window === "undefined" || !isChunkLoadError(error)) {
    return false
  }

  const attemptValue = `${window.location.pathname}${window.location.search}|${errorMessage(error).slice(0, 180)}`
  if (window.sessionStorage.getItem(reloadAttemptKey) === attemptValue) {
    return false
  }

  window.sessionStorage.setItem(reloadAttemptKey, attemptValue)
  window.location.reload()
  return true
}

export function lazyWithReload(loader: () => Promise<{ default: ComponentType }>) {
  return lazy(async () => {
    try {
      const module = await loader()
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(reloadAttemptKey)
      }
      return module
    } catch (error) {
      if (reloadOnceForChunkError(error)) {
        return new Promise<{ default: ComponentType }>(() => undefined)
      }
      throw error
    }
  })
}
