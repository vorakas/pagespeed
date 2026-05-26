import { Suspense } from "react"
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { ThemeProvider } from "@/context/ThemeContext"

import { SitesProvider } from "@/context/SitesContext"
import { BatchTestProvider } from "@/context/BatchTestContext"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AppLayout } from "@/components/layout/AppLayout"
import { RouteErrorBoundary } from "@/components/layout/RouteErrorBoundary"
import { lazyWithReload } from "@/lib/lazy-with-reload"

const Dashboard = lazyWithReload(() => import("@/pages/Dashboard").then((module) => ({ default: module.Dashboard })))
const TestUrls = lazyWithReload(() => import("@/pages/TestUrls").then((module) => ({ default: module.TestUrls })))
const Metrics = lazyWithReload(() => import("@/pages/Metrics").then((module) => ({ default: module.Metrics })))
const Setup = lazyWithReload(() => import("@/pages/Setup").then((module) => ({ default: module.Setup })))
const NewRelic = lazyWithReload(() => import("@/pages/NewRelic").then((module) => ({ default: module.NewRelic })))
const IisLogs = lazyWithReload(() => import("@/pages/IisLogs").then((module) => ({ default: module.IisLogs })))
const AiAnalysis = lazyWithReload(() => import("@/pages/AiAnalysis").then((module) => ({ default: module.AiAnalysis })))
const Builds = lazyWithReload(() => import("@/pages/Builds").then((module) => ({ default: module.Builds })))
const LoadTesting = lazyWithReload(() => import("@/pages/LoadTesting").then((module) => ({ default: module.LoadTesting })))
const Obsidian = lazyWithReload(() => import("@/pages/Obsidian").then((module) => ({ default: module.Obsidian })))
const LaunchDashboard = lazyWithReload(() =>
  import("@/pages/LaunchDashboard").then((module) => ({ default: module.LaunchDashboard })),
)
const StatusHistory = lazyWithReload(() => import("@/pages/StatusHistory").then((module) => ({ default: module.StatusHistory })))
const WorkstreamDetail = lazyWithReload(() =>
  import("@/pages/WorkstreamDetail").then((module) => ({ default: module.WorkstreamDetail })),
)
const ProjectDashboard = lazyWithReload(() =>
  import("@/pages/ProjectDashboard").then((module) => ({ default: module.ProjectDashboard })),
)
const RequirementQuestions = lazyWithReload(() =>
  import("@/pages/RequirementQuestions").then((module) => ({ default: module.RequirementQuestions })),
)
const QaTesting = lazyWithReload(() => import("@/pages/QaTesting").then((module) => ({ default: module.QaTesting })))

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
            <BatchTestProvider>
              <RouteErrorBoundary>
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
                      <Route path="dashboard/qa-testing" element={<QaTesting />} />
                      <Route path="dashboard/projects/:key" element={<ProjectDashboard />} />
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Route>
                  </Routes>
                </Suspense>
              </RouteErrorBoundary>
            </BatchTestProvider>
          </SitesProvider>
        </TooltipProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
