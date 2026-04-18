/* ============================================
   API Response Types — PageSpeed Monitor
   ============================================ */

// ---------- Sites & URLs ----------

export interface Site {
  id: number
  name: string
  created_at: string
}

export interface Url {
  id: number
  site_id: number
  url: string
  created_at: string
}

export interface SiteWithUrls extends Site {
  urls: Url[]
}

// ---------- Test Results ----------

export type Strategy = "desktop" | "mobile"

export interface TestResult {
  id: number
  url_id: number
  performance_score: number | null
  accessibility_score: number | null
  best_practices_score: number | null
  seo_score: number | null
  fcp: number | null
  lcp: number | null
  cls: number | null
  inp: number | null
  ttfb: number | null
  tti: number | null
  tbt: number | null
  speed_index: number | null
  total_byte_weight: number | null
  strategy: Strategy
  tested_at: string
  raw_data?: string
}

export interface LatestResult extends TestResult {
  url: string
  site_name?: string
}

export interface WorstPerformer {
  id: number
  url_id: number
  url: string
  site_name: string
  performance_score: number | null
  accessibility_score: number | null
  best_practices_score: number | null
  seo_score: number | null
  fcp: number | null
  lcp: number | null
  cls: number | null
  inp: number | null
  ttfb: number | null
  tti: number | null
  tbt: number | null
  speed_index: number | null
  total_byte_weight: number | null
  tested_at: string
}

export interface TestDetail {
  id: number
  url: string
  performance_score: number | null
  accessibility_score: number | null
  best_practices_score: number | null
  seo_score: number | null
  fcp: number | null
  lcp: number | null
  cls: number | null
  inp: number | null
  ttfb: number | null
  tti: number | null
  tbt: number | null
  speed_index: number | null
  total_byte_weight: number | null
  strategy: Strategy
  tested_at: string
  raw_data?: Record<string, unknown>
}

export interface HistoryPoint {
  tested_at: string
  performance_score: number | null
  accessibility_score: number | null
  best_practices_score: number | null
  seo_score: number | null
  fcp: number | null
  lcp: number | null
  cls: number | null
  inp: number | null
  ttfb: number | null
  tti: number | null
  tbt: number | null
  speed_index: number | null
}

// ---------- Triggers ----------

export type ScheduleType = "preset" | "custom"
export type TriggerStrategy = "desktop" | "mobile" | "both"

export interface SchedulePreset {
  id: number | null
  value: string
  label: string
  is_builtin: boolean
}

export interface Trigger {
  id: number
  name: string
  schedule_type: ScheduleType
  schedule_value: string
  schedule_label?: string
  strategy: TriggerStrategy
  enabled: boolean
  created_at: string
  updated_at: string
  url_ids: number[]
  url_count: number
  urls?: Url[]
  last_run_at?: string | null
  last_run_status?: "success" | "partial" | "failed" | "running" | null
}

export interface TriggerFormData {
  name: string
  schedule_type: ScheduleType
  schedule_value: string
  strategy: TriggerStrategy
  url_ids: number[]
}

// ---------- New Relic ----------

export interface NewRelicConfig {
  apiKey: string
  accountId: string
  appName: string
}

export interface NewRelicCwvData {
  metric: string
  p50: number | null
  p75: number | null
  p90: number | null
}

export interface NewRelicPerformanceData {
  current: Record<string, number | null>
  previous: Record<string, number | null>
}

// ---------- Azure ----------

export interface AzureConfig {
  tenantId: string
  clientId: string
  clientSecret: string
  workspaceId: string
  secretExpirationDate: string
  site: string
}

export interface AzureLogEntry {
  TimeGenerated: string
  csMethod: string
  csUriStem: string
  csUriQuery: string
  scStatus: number
  timeTaken: number
  cIP: string
  sSiteName: string
}

export interface AzureDashboardSummary {
  total_requests: number
  avg_response_time: number
  error_rate: number
  top_pages: Array<{ page: string; count: number }>
  status_distribution: Record<string, number>
  response_time_percentiles: {
    p50: number
    p90: number
    p99: number
    max: number
  }
}

// ---------- AI Analysis ----------

export interface AiConfig {
  claudeApiKey: string
  claudeModel: string
  openaiApiKey: string
  openaiModel: string
}

export interface AiAnalysisResult {
  provider: string
  analysis: string
  input_tokens: number
  output_tokens: number
  error?: string
}

export interface AiFollowUpResult {
  provider: string
  response: string
  input_tokens: number
  output_tokens: number
}

// ---------- Azure DevOps ----------

export interface DevOpsConfig {
  pat: string
  organization: string
  project: string
  orchestratorPipelineId: number | null
  pipelineMap: Record<string, number>
}

export type BuildStatus =
  | "notStarted"
  | "inProgress"
  | "completed"
  | "cancelling"
  | "postponed"
  | "notSet"
  | "none"

export type BuildResult =
  | "succeeded"
  | "partiallySucceeded"
  | "failed"
  | "canceled"
  | "none"
  | null

export interface DevOpsPipeline {
  id: number
  name: string
  folder: string
}

export interface DevOpsBuild {
  id: number
  buildNumber: string
  status: BuildStatus
  result: BuildResult
  definitionId: number
  definitionName: string
  sourceBranch: string
  startTime: string | null
  finishTime: string | null
  requestedBy: string
  webUrl: string
}

export interface FailedTest {
  testId: string
  testName: string
  config: string
  errorMessage: string
  stackTrace: string
  zephyrUrl: string
  isRerun: boolean
  runId: number | null
  resultId: number | null
  screenshotId: number | null
}

export interface SkippedTest {
  testId: string
  testName: string
  config: string
  userRole: string
  errorMessage: string
  zephyrUrl: string
}

// ---------- BlazeMeter (Load Testing) ----------

export interface BlazemeterConfigStatus {
  configured: boolean
  apiKeyIdMasked: string | null
  workspaceId: string | null
  defaultProjectId: string | null
}

export interface BlazemeterProject {
  id: number
  name: string
  workspaceId: number | null
  description: string | null
  testsCount: number | null
  updated: number | null
}

export interface BlazemeterTest {
  id: number
  name: string
  testType: string | null
  projectId: number | null
  workspaceId: number | null
  updated: number | null
}



export type BlazemeterQueueStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"

export interface BlazemeterQueueItem {
  itemId: number
  testId: number
  testName: string
  projectId: number | null
  projectName: string | null
  status: BlazemeterQueueStatus
  masterId: number | null
  enqueuedAt: number
  startedAt: number | null
  endedAt: number | null
  lastStatus: string | null
  error: string | null
}

export interface BlazemeterQueueSnapshot {
  active: BlazemeterQueueItem | null
  pending: BlazemeterQueueItem[]
  history: BlazemeterQueueItem[]
  pollSeconds?: number
  configured: boolean
}

export interface BlazemeterPresetTest {
  test_id: number
  test_name: string
  position: number
}

export interface BlazemeterPreset {
  id: number
  name: string
  project_id: number | null
  project_name: string | null
  tests: BlazemeterPresetTest[]
  created_at: string
  updated_at: string
}

export interface BlazemeterPresetInput {
  name: string
  projectId?: number | null
  projectName?: string | null
  tests: Array<{ testId: number; testName: string }>
}

// ---------- API Responses ----------

export interface ApiError {
  error: string
  details?: string
}

export interface TestUrlResponse {
  result: TestResult
}

export interface ComparisonUrl {
  id: number
  url: string
  site_name: string
}
