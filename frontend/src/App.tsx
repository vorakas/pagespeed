import { BrowserRouter, Routes, Route } from "react-router-dom"
import { ThemeProvider } from "@/context/ThemeContext"

import { SitesProvider } from "@/context/SitesContext"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AppLayout } from "@/components/layout/AppLayout"
import { Dashboard } from "@/pages/Dashboard"
import { TestUrls } from "@/pages/TestUrls"
import { Metrics } from "@/pages/Metrics"
import { Setup } from "@/pages/Setup"
import { NewRelic } from "@/pages/NewRelic"
import { IisLogs } from "@/pages/IisLogs"
import { AiAnalysis } from "@/pages/AiAnalysis"
import { Builds } from "@/pages/Builds"
import { LoadTesting } from "@/pages/LoadTesting"
import { Obsidian } from "@/pages/Obsidian"
import { LaunchDashboard } from "@/pages/LaunchDashboard"

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <TooltipProvider>
          <SitesProvider>
            <Routes>
              <Route element={<AppLayout />}>
                <Route index element={<Dashboard />} />
                <Route path="test" element={<TestUrls />} />
                <Route path="metrics" element={<Metrics />} />
                <Route path="setup" element={<Setup />} />
                <Route path="newrelic" element={<NewRelic />} />
                <Route path="iislogs" element={<IisLogs />} />
                <Route path="ai-analysis" element={<AiAnalysis />} />
              <Route path="builds" element={<Builds />} />
              <Route path="load-testing" element={<LoadTesting />} />
              <Route path="obsidian" element={<Obsidian />} />
              <Route path="dashboard" element={<LaunchDashboard />} />
              </Route>
            </Routes>
          </SitesProvider>
        </TooltipProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
