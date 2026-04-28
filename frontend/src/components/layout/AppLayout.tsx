import { Outlet } from "react-router-dom"
import { Sidebar } from "./Sidebar"
import { Toaster } from "@/components/ui/sonner"
import "@/styles/aurora-glass.css"

export function AppLayout() {
  return (
    <div className="aurora-app-shell min-h-screen">
      <Sidebar />
      <main className="ml-[232px] min-h-screen pb-3">
        <Outlet />
      </main>
      <Toaster position="bottom-right" richColors />
    </div>
  )
}
