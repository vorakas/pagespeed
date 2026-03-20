import { useContext } from "react"
import { SitesContext } from "@/context/SitesContext"

export function useSites() {
  const context = useContext(SitesContext)
  if (!context) {
    throw new Error("useSites must be used within a SitesProvider")
  }
  return context
}
