import type { ReactNode } from "react"
import { BeaconSidebar } from "@/components/layout/BeaconSidebar"
import { BeaconHeader } from "@/components/layout/BeaconHeader"

interface BeaconLayoutProps {
  title: string
  description?: string
  activePath: string
  /** Optional right-aligned slot in the header for page-specific
   *  status / controls. */
  actions?: ReactNode
  /** Visual register variant. Default 'beacon'. 'aurora' applies the
   *  lifted-card register on top of the same structural rules. */
  register?: "beacon" | "aurora"
  children: ReactNode
}

/**
 * Full prototype shell — paints the body, mounts the Pharos sidebar +
 * header, and renders children inside the main column. The `register`
 * prop selects the visual language ('beacon' = austere amber, 'aurora'
 * = lifted-card pastel).
 */
export function BeaconLayout({
  title,
  description,
  activePath,
  actions,
  register = "beacon",
  children,
}: BeaconLayoutProps) {
  const wrapperClass = `beacon beacon-shell dark${register === "aurora" ? " aurora" : ""}`
  return (
    <div className={wrapperClass}>
      <BeaconSidebar activePath={activePath} polling={false} />
      <main className="beacon-main ml-[208px] min-h-screen">
        <BeaconHeader title={title} description={description} actions={actions} />
        <div>{children}</div>
      </main>
    </div>
  )
}
