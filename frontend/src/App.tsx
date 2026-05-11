import { Suspense, lazy } from "react"
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { ThemeProvider } from "@/context/ThemeContext"

import { SitesProvider } from "@/context/SitesContext"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AppLayout } from "@/components/layout/AppLayout"

const Dashboard = lazy(() => import("@/pages/Dashboard").then((module) => ({ default: module.Dashboard })))
const TestUrls = lazy(() => import("@/pages/TestUrls").then((module) => ({ default: module.TestUrls })))
const Metrics = lazy(() => import("@/pages/Metrics").then((module) => ({ default: module.Metrics })))
const Setup = lazy(() => import("@/pages/Setup").then((module) => ({ default: module.Setup })))
const NewRelic = lazy(() => import("@/pages/NewRelic").then((module) => ({ default: module.NewRelic })))
const IisLogs = lazy(() => import("@/pages/IisLogs").then((module) => ({ default: module.IisLogs })))
const AiAnalysis = lazy(() => import("@/pages/AiAnalysis").then((module) => ({ default: module.AiAnalysis })))
const Builds = lazy(() => import("@/pages/Builds").then((module) => ({ default: module.Builds })))
const LoadTesting = lazy(() => import("@/pages/LoadTesting").then((module) => ({ default: module.LoadTesting })))
const Obsidian = lazy(() => import("@/pages/Obsidian").then((module) => ({ default: module.Obsidian })))
const LaunchDashboard = lazy(() =>
  import("@/pages/LaunchDashboard").then((module) => ({ default: module.LaunchDashboard })),
)
const StatusHistory = lazy(() => import("@/pages/StatusHistory").then((module) => ({ default: module.StatusHistory })))
const WorkstreamDetail = lazy(() =>
  import("@/pages/WorkstreamDetail").then((module) => ({ default: module.WorkstreamDetail })),
)
const ProjectDashboard = lazy(() =>
  import("@/pages/ProjectDashboard").then((module) => ({ default: module.ProjectDashboard })),
)
const RequirementQuestions = lazy(() =>
  import("@/pages/RequirementQuestions").then((module) => ({ default: module.RequirementQuestions })),
)

function RouteFallback() {
  return (
    <div className="flex min-h-[240px] items-center justify-center p-6 text-sm text-muted-foreground">
      Loading...
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <TooltipProvider>
          <SitesProvider>
            <Suspense fallback={<RouteFallback />}>
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
                  <Route path="dashboard/history" element={<StatusHistory />} />
                  <Route path="dashboard/workstreams/:id" element={<WorkstreamDetail />} />
                  <Route path="dashboard/requirements" element={<RequirementQuestions />} />
                  <Route path="dashboard/projects/:key" element={<ProjectDashboard />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Route>
              </Routes>
            </Suspense>
          </SitesProvider>
        </TooltipProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
