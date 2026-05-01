import { Outlet, useLocation } from "react-router-dom"
import { BeaconSidebar } from "./BeaconSidebar"
import { Toaster } from "@/components/ui/sonner"
import "@/styles/aurora-glass.css"

/**
 * Production application shell — paints the beacon-shell aurora register
 * around every routed page. The sidebar lives left, page bodies render
 * inside the main column. Pages render their own `<BeaconHeader>` at the
 * top of their body so they can pass page-specific `actions` (status,
 * controls, filter pills) into the header's right slot.
 *
 * Composition was previously a thin `<Sidebar />` + `<main>` shell plus a
 * separate per-page `<Header>` panel. Phase 2 of the Aurora rollout
 * collapses both into the BeaconSidebar / BeaconHeader pair that the
 * prototype shipped under `BeaconLayout`. The two-row brand banner from
 * the legacy Header is gone — Pharos identity is carried by the sidebar
 * logo + tagline.
 */
export function AppLayout() {
  const { pathname } = useLocation()
  return (
    <div className="beacon beacon-shell dark aurora min-h-screen">
      <BeaconSidebar activePath={pathname} polling={false} />
      <main className="beacon-main ml-[208px] min-h-screen">
        <Outlet />
      </main>
      <Toaster position="bottom-right" richColors />
    </div>
  )
}
