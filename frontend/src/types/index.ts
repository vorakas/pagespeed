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
  project_id: number | null
  project_name: string | null
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
  tests: Array<{
    testId: number
    testName: string
    projectId?: number | null
    projectName?: string | null
  }>
}

export interface BlazemeterMasterInfo {
  id: number | null
  testId: number | null
  name: string | null
  status: number | string | null
  reportStatus: string | null
  created: number | null
  ended: number | null
  note: string | null
  publicTokenUrl: string | null
  maxUsers: number | null
}

export interface BlazemeterRunSummary {
  hits: number | null
  failed: number | null
  errorRate: number | null
  avgResponseTime: number | null
  minResponseTime: number | null
  maxResponseTime: number | null
  p50: number | null
  p90: number | null
  p95: number | null
  p99: number | null
  avgLatency: number | null
  avgBandwidth: number | null
  avgThroughput: number | null
  duration: number | null
  startTime: number | null
  endTime: number | null
  maxUsers: number | null
  totalBytes: number | null
  avgBytesPerHit: number | null
}

export interface BlazemeterLabelRow {
  labelId: number | string | null
  labelName: string | null
  samples: number | null
  errors: number | null
  errorRate: number | null
  avgResponseTime: number | null
  minResponseTime: number | null
  maxResponseTime: number | null
  p50: number | null
  p90: number | null
  p95: number | null
  p99: number | null
  avgLatency: number | null
  avgThroughput: number | null
  avgBytes: number | null
}

export interface BlazemeterTimelinePoint {
  t: number | string | null
  avgResponseTime: number | null
  errorRate: number | null
  users: number | null
  hits: number | null
}

export interface BlazemeterTimeline {
  points: BlazemeterTimelinePoint[]
  interval: number | null
}

export interface BlazemeterErrorRow {
  labelId: number | string | null
  labelName: string | null
  errorCode: number | string | null
  count: number | null
  message: string | null
}

export interface BlazemeterCiStatus {
  failures?: Array<Record<string, unknown>>
  failuresCount?: number | null
  passed?: boolean | null
  reason?: string | null
  thresholds?: Array<Record<string, unknown>>
}

export interface BlazemeterPersistedRun {
  masterId: number
  testId: number
  testName: string
  projectId: number | null
  projectName: string | null
  status: BlazemeterQueueStatus
  lastStatus: string | null
  error: string | null
  startedAt: number | null
  endedAt: number | null
  createdAt: number | null
}

export interface BlazemeterRunsResponse {
  success: boolean
  runs: BlazemeterPersistedRun[]
  total: number
  limit: number
  offset: number
}

export interface BlazemeterMasterReport {
  masterId: number
  master: BlazemeterMasterInfo | null
  summary: BlazemeterRunSummary | null
  aggregate: BlazemeterLabelRow[] | null
  timeline: BlazemeterTimeline | null
  errors: BlazemeterErrorRow[] | null
  ciStatus: BlazemeterCiStatus | null
  thresholds: Array<Record<string, unknown>> | null
  fetchErrors: Record<string, string>
}

// ---------- Obsidian Bridge ----------

export interface ObsidianCapabilities {
  vaultRoot: string
  vaultExists: boolean
  jiraConfigured: boolean
  asanaConfigured: boolean
  jiraProjects: string[]
  asanaProjects: string[]
}

export type ObsidianSyncStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "partial"

export interface ObsidianSyncJob {
  jobId: string
  source: "jira" | "asana" | "both"
  projectsJira: string[]
  projectsAsana: string[]
  fullRefresh: boolean
  status: ObsidianSyncStatus
  startedAt: number | null
  endedAt: number | null
  lineCount: number
  lines: string[]
  error: string | null
}

export type ObsidianSyncJobSummary = Omit<ObsidianSyncJob, "lines">

export interface ObsidianSyncRequest {
  source?: "jira" | "asana" | "both"
  projectsJira?: string[]
  projectsAsana?: string[]
  fullRefresh?: boolean
}

export interface ObsidianVaultNode {
  path: string
  name: string
  isDir: boolean
  children?: ObsidianVaultNode[]
}

export interface ObsidianVaultPage {
  path: string
  name: string
  raw: string
  body: string
  frontmatter: Record<string, string>
  wikilinks: string[]
  size: number
  modified: number
}

// ---------- Launch Command Center (migration dashboard) ----------

export type MigrationHealth =
  | "at-risk"
  | "blocked"
  | "in-progress"
  | "near-complete"
  | "improving"
  | "groomed"

export interface MigrationLaunchWindow {
  start: string
  end: string | null
}

export interface MigrationHealthSnapshot {
  overall: MigrationHealth | null
  launchWindow: MigrationLaunchWindow | null
  lastSynced: string | null
  headline: string | null
  reasons: string[]
}

export interface MigrationKpis {
  combinedUnique: number
  combinedResolved: number
  combinedActive: number
  resolvedPct: number
  productionFailures: number
  openBlockers: number
  criticalBlockers: number
  newBugs24h: number
  unassignedRate: number
  failedQa: number
}

export interface MigrationSource {
  key: string
  kind: "jira" | "asana" | string
  name: string
  total: number
  resolved: number
  active: number
  pct: number
}

export interface MigrationWorkstream {
  id: string
  name: string
  area: string | null
  status: MigrationHealth | string | null
  tasks: number
  closed: number
  failedQa: number
  inProgress: number
  blockedCount: number
  epics: string[]
  blockers: string[]
  note: string | null
}

export type BlockerSeverity = "critical" | "high" | "medium" | "low"

export interface MigrationBlocker {
  id: string
  name: string
  status: string
  severity: BlockerSeverity | string | null
  affects: string[]
  note: string | null
  relPath: string | null
}

export interface RawTaskRecord {
  key: string
  source: "jira" | "asana" | string
  project: string
  relPath: string
  summary: string | null
  type: string | null
  status: string | null
  priority: string | null
  assignee: string | null
  created: string | null
  updated: string | null
  resolved: string | null
  taskStatus: string | null
  uatStatus: string | null
  completion: string | null
  url: string | null
}

export interface MigrationTaskStatusRow {
  status: string
  count: number
  color: "green" | "red" | "amber" | "blue" | "neutral" | string
  group: "done" | "inProgress" | "blocked" | "backlog" | string
}

export interface MigrationTrendPoint {
  date: string
  overallHealth: MigrationHealth | string | null
  resolved: number | null
  active: number | null
  total: number | null
}

export interface MigrationTeam {
  id: string
  name: string
  project: string | null
  lead: string | null
  qaLead: string | null
  devCount: number | null
  qaCount: number | null
  note: string | null
  totalTasks?: number
  assignedTasks?: number
  unassignedRate?: number
}

export interface WorkstreamMdMeta {
  type: string
  status: string | null
  taskCount: number | null
  blockedCount: number
  title: string
  lastUpdate: string | null
}

export interface WorkstreamMdSource {
  key: string
  kind: string
  name: string
  issues?: number
  note?: string
}

export interface WorkstreamMdScopeItem {
  label: string
  note: string
}

export interface WorkstreamMdEpic {
  id: string
  title: string
}

export interface WorkstreamMdProgressBucket {
  label: string
  count: number
  tone: string
  kind: string
}

export interface WorkstreamMdProgress {
  total: number | null
  completion: string | null
  buckets: WorkstreamMdProgressBucket[]
}

export interface WorkstreamMdActiveItem {
  id: string
  title: string
  assignee: string | null
  note?: string
  overdue?: boolean
  isNew?: boolean
}

export interface WorkstreamMdActive {
  blocked: WorkstreamMdActiveItem[]
  inProgress: WorkstreamMdActiveItem[]
  onHold: WorkstreamMdActiveItem[]
  approvedReview: WorkstreamMdActiveItem[]
  codeReview: WorkstreamMdActiveItem[]
  openUnassigned: WorkstreamMdActiveItem[]
  evaluating: WorkstreamMdActiveItem[]
  evaluated: WorkstreamMdActiveItem[]
}

export interface WorkstreamMdRisk {
  tone: "red" | "amber" | string
  text: string
}

export interface WorkstreamMdBurndown {
  month: string
  closed: number
  cum: number
  partial: boolean
}

export interface WorkstreamMdVelocity {
  q1avg: number | null
  marRate: number | null
  remaining: number | null
  projection: string | null
  projectionNote: string | null
}

export interface WorkstreamMdDev {
  name: string
  inProgress: number
  codeReview: number
  pipeline: number
  backlog: number
  total: number
  unassigned: boolean
}

export interface WorkstreamMdRecent {
  id: string
  title: string
  status: string
  tone: string
  assignee: string
  updated: string
  highlight: boolean
}

export interface WorkstreamMdDecision {
  date: string
  id: string
  decision: string
  status: string
  impact: string
}

export interface WorkstreamMdCrossRef {
  area: string
  ws: string
}

export interface WorkstreamMdPayload {
  meta: WorkstreamMdMeta
  sources: WorkstreamMdSource[]
  overviewParagraph: string
  scope: WorkstreamMdScopeItem[]
  epics: WorkstreamMdEpic[]
  progress: WorkstreamMdProgress
  active: WorkstreamMdActive
  keyRisks: WorkstreamMdRisk[]
  burndown: WorkstreamMdBurndown[]
  velocity: WorkstreamMdVelocity
  devs: WorkstreamMdDev[]
  devObservations: string[]
  recentActivity: WorkstreamMdRecent[]
  activitySummary: string | null
  decisions: WorkstreamMdDecision[]
  decisionContext: string | null
  crossRefs: WorkstreamMdCrossRef[]
  team: { leads: string[] }
}

export interface MigrationWorkstreamDetail {
  workstream: MigrationWorkstream
  blockers: MigrationBlocker[]
  criticalTasks: RawTaskRecord[]
  referencedKeyCount: number
  markdown: WorkstreamMdPayload | null
}

// ---------- Snapshots (status-YYYY-MM-DD.md rollups) ----------

export interface SnapshotKpis {
  combinedUnique?: number | null
  combinedResolved?: number | null
  combinedActive?: number | null
  resolvedPct?: number | null
  productionFailures?: number | null
  openBlockers?: number | null
  criticalBlockers?: number | null
  newBugs24h?: number | null
  criticalBugCount?: number | null
  wpm?: number | null
  [k: string]: number | null | undefined
}

export interface SnapshotSource {
  key: string
  total: number
  resolved: number
  active: number
  approx?: boolean
}

export interface SnapshotTaskItem {
  id: string
  title?: string
  sev?: string
  due?: string
  who?: string
  status?: string
  tag?: string
  regression?: boolean
  isNew?: boolean
  type?: string
  workstream?: string
  note?: string
}

export interface SnapshotStatusChange {
  id: string
  change: string
  detail: string
}

export interface SnapshotPositive {
  id: string
  title: string
  detail: string
}

export interface SnapshotChangeSummary {
  new: number
  resolved: number
  reassigned: number
  regressed: number
  onHold: number
}

export interface MigrationSnapshot {
  date: string
  overall: string | null
  headline: string | null
  kpis: SnapshotKpis
  sourceCoverage: SnapshotSource[]
  areaStatuses: Record<string, string>
  criticalBugs: SnapshotTaskItem[]
  prodFailures: SnapshotTaskItem[]
  openBlockers: SnapshotTaskItem[]
  newItems: SnapshotTaskItem[]
  statusChanges: SnapshotStatusChange[]
  positives: SnapshotPositive[]
  changeSummary: SnapshotChangeSummary
  sourcePath?: string | null
  ingestedAt?: string | null
}

export interface SnapshotKpiDelta {
  prev: number | null
  curr: number | null
  delta: number | null
}

export interface SnapshotAreaChange {
  ws: string
  from: string
  to: string
}

export interface SnapshotSourceDelta {
  key: string
  total: SnapshotKpiDelta
  resolved: SnapshotKpiDelta
  active: SnapshotKpiDelta
}

export interface MigrationSnapshotDiff {
  from: string
  to: string
  kpis: Record<string, SnapshotKpiDelta>
  sources: SnapshotSourceDelta[]
  areaStatuses: SnapshotAreaChange[]
  criticalBugs: { added: SnapshotTaskItem[]; removed: SnapshotTaskItem[] }
  prodFailures: {
    added: SnapshotTaskItem[]
    removed: SnapshotTaskItem[]
    reassigned: (SnapshotTaskItem & { from?: string })[]
    regressed: SnapshotTaskItem[]
  }
  openBlockers: { added: SnapshotTaskItem[]; removed: SnapshotTaskItem[] }
  newItems: { added: SnapshotTaskItem[]; removed: SnapshotTaskItem[] }
}

export interface MigrationSnapshotDiffResponse {
  latest: MigrationSnapshot | null
  previous: MigrationSnapshot | null
  diff: MigrationSnapshotDiff | null
}

export interface MigrationHistoryEntry {
  from: string
  to: string
  currentPayload: MigrationSnapshot
  previousPayload: MigrationSnapshot
  diff: MigrationSnapshotDiff
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
