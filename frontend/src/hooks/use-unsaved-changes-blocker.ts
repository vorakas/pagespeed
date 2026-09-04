import { useEffect } from "react"
import { useBlocker } from "react-router-dom"

/**
 * Blocks route navigation away from the current page while there are
 * unsaved edits, and warns via the browser's native dialog on page
 * refresh / tab close. Returns the router blocker so the caller can
 * render its own confirmation UI: `blocker.state === "blocked"` means
 * a navigation is waiting on `blocker.proceed()` / `blocker.reset()`.
 */
export function useUnsavedChangesBlocker(hasUnsavedChanges: boolean) {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      hasUnsavedChanges && currentLocation.pathname !== nextLocation.pathname
  )

  useEffect(() => {
    if (!hasUnsavedChanges) return

    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }

    window.addEventListener("beforeunload", warnBeforeUnload)
    return () => window.removeEventListener("beforeunload", warnBeforeUnload)
  }, [hasUnsavedChanges])

  return blocker
}
