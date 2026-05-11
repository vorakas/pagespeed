import { Outlet, useLocation } from "react-router-dom"
import { AppSidebar } from "./AppSidebar"
import { Toaster } from "@/components/ui/sonner"

/**
 * Production application shell — paints the beacon-shell aurora
 * register around every routed page. AppSidebar lives left, page
 * bodies render in the main column. Pages render their own
 * `<PageHeader>` at the top of their body so they can pass page-
 * specific `actions` (status, controls, filter pills) into the
 * header's right slot.
 *
 * The two-row brand banner from the legacy Header (LampsPlus +
 * Pharos logos as a separate strip above each page title) was
 * intentionally retired in Phase 2 — Pharos identity is now carried
 * by the sidebar logo + 'OPERATIONS HUB' tagline.
 */
export function AppLayout() {
  const { pathname, hash } = useLocation()
  // AppSidebar's active-state matcher splits href on '#' so
  // `/dashboard#incidents` lights up only when both pathname and
  // hash match. Concatenate them here so the matcher has full input.
  const activePath = hash ? `${pathname}${hash}` : pathname
  return (
    <div className="beacon beacon-shell dark aurora min-h-screen">
      <AppSidebar activePath={activePath} />
      <main className="beacon-main ml-[208px] min-h-screen min-w-0 max-w-[calc(100vw-208px)] overflow-x-hidden">
        <Outlet />
      </main>
      <Toaster position="bottom-right" richColors />
    </div>
  )
}
