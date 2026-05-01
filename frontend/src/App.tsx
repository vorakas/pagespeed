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
import { StatusHistory } from "@/pages/StatusHistory"
import { WorkstreamDetail } from "@/pages/WorkstreamDetail"
import { ProjectDashboard } from "@/pages/ProjectDashboard"
import { PrototypeBeaconBuilds } from "@/prototypes/beacon-builds/PrototypeBeaconBuilds"
import { PrototypeAuroraSetup } from "@/prototypes/aurora-setup/PrototypeAuroraSetup"
import { PrototypeAuroraTestUrls } from "@/prototypes/aurora-test-urls/PrototypeAuroraTestUrls"
import { PrototypeAuroraLoadTesting } from "@/prototypes/aurora-load-testing/PrototypeAuroraLoadTesting"
import { PrototypeAuroraObsidian } from "@/prototypes/aurora-obsidian/PrototypeAuroraObsidian"
import { PrototypeAuroraAiAnalysis } from "@/prototypes/aurora-ai-analysis/PrototypeAuroraAiAnalysis"
import { PrototypeAuroraIisLogs } from "@/prototypes/aurora-iis-logs/PrototypeAuroraIisLogs"
import { PrototypeAuroraNewRelic } from "@/prototypes/aurora-newrelic/PrototypeAuroraNewRelic"
import { PrototypeAuroraMetrics } from "@/prototypes/aurora-metrics/PrototypeAuroraMetrics"

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <TooltipProvider>
          <SitesProvider>
            <Routes>
              {/* Prototype routes — bypass AppLayout entirely. */}
              <Route path="prototype/builds" element={<PrototypeBeaconBuilds register="beacon" />} />
              <Route path="prototype/builds/aurora" element={<PrototypeBeaconBuilds register="aurora" />} />
              <Route path="prototype/setup/aurora" element={<PrototypeAuroraSetup />} />
              <Route path="prototype/test/aurora" element={<PrototypeAuroraTestUrls />} />
              <Route path="prototype/load-testing/aurora" element={<PrototypeAuroraLoadTesting />} />
              <Route path="prototype/obsidian/aurora" element={<PrototypeAuroraObsidian />} />
              <Route path="prototype/ai-analysis/aurora" element={<PrototypeAuroraAiAnalysis />} />
              <Route path="prototype/iislogs/aurora" element={<PrototypeAuroraIisLogs />} />
              <Route path="prototype/newrelic/aurora" element={<PrototypeAuroraNewRelic />} />
              <Route path="prototype/metrics/aurora" element={<PrototypeAuroraMetrics />} />

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
              <Route path="dashboard/history" element={<StatusHistory />} />
              <Route path="dashboard/workstreams/:id" element={<WorkstreamDetail />} />
              <Route path="dashboard/projects/:key" element={<ProjectDashboard />} />
              </Route>
            </Routes>
          </SitesProvider>
        </TooltipProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
