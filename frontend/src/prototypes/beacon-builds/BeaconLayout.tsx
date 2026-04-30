import type { ReactNode } from "react"
import { BeaconSidebar } from "./BeaconSidebar"
import { BeaconHeader } from "./BeaconHeader"

interface BeaconLayoutProps {
  title: string
  description?: string
  activePath: string
  activeBuildCount: number
  polling: boolean
  lastSync: Date | null
  /** Visual register variant. Default 'beacon'. 'aurora' applies the
   *  lifted-purple pastel re-skin on top of the same structural rules. */
  register?: "beacon" | "aurora"
  children: ReactNode
}

/**
 * Full prototype shell — paints the body, mounts the Pharos sidebar +
 * header, and renders children inside the main column. The `register`
 * prop selects the visual language ('beacon' = austere amber, 'aurora'
 * = lifted-purple pastel).
 */
export function BeaconLayout({
  title,
  description,
  activePath,
  activeBuildCount,
  polling,
  lastSync,
  register = "beacon",
  children,
}: BeaconLayoutProps) {
  const wrapperClass = `beacon beacon-shell dark${register === "aurora" ? " aurora" : ""}`
  return (
    <div className={wrapperClass}>
      <BeaconSidebar activePath={activePath} polling={polling} />
      <main className="beacon-main ml-[208px] min-h-screen">
        <BeaconHeader
          title={title}
          description={description}
          activeBuildCount={activeBuildCount}
          polling={polling}
          lastSync={lastSync}
        />
        <div>{children}</div>
      </main>
    </div>
  )
}
