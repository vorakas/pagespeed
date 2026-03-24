import { Outlet } from "react-router-dom"
import { Sidebar } from "./Sidebar"
import { Toaster } from "@/components/ui/sonner"

export function AppLayout() {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="ml-[232px] min-h-screen pb-3">
        <Outlet />
      </main>
      <Toaster position="bottom-right" richColors />
    </div>
  )
}
