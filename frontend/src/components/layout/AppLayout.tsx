import { Outlet } from "react-router-dom"
import { Sidebar } from "./Sidebar"
import { Toaster } from "@/components/ui/sonner"

export function AppLayout() {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="ml-[260px] min-h-screen">
        <Outlet />
      </main>
      <Toaster position="bottom-right" richColors />
    </div>
  )
}
