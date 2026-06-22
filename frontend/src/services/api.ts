import type {
  Site,
  SiteWithUrls,
  Url,
  Strategy,
  TestResult,
  LatestResult,
  WorstPerformer,
  TestDetail,
  HistoryPoint,
  Trigger,
  TriggerFormData,
  SchedulePreset,
  NewRelicConfig,
  NewRelicCwvData,
  NewRelicPerformanceData,
  AzureConfig,
  AzureLogEntry,
  AzureDashboardSummary,
  AiConfig,
  AiSavedConfig,
  AiAnalysisResult,
  AiFollowUpResult,
  DevOpsConfig,
  DevOpsPipeline,
  DevOpsBuild,
  FailedTest,
  SkippedTest,
  UnresolvedTest,
  BlazemeterConfigStatus,
  BlazemeterProject,
  BlazemeterTest,
  BlazemeterQueueSnapshot,
  BlazemeterQueueItem,
  BlazemeterPreset,
  BlazemeterPresetInput,
  BlazemeterMasterReport,
  BlazemeterRunsResponse,
  BlazemeterTestMastersResponse,
  ObsidianCapabilities,
  ObsidianPendingOrchestration,
  ObsidianSyncJob,
  ObsidianSyncJobSummary,
  ObsidianSyncRequest,
  ObsidianVaultNode,
  ObsidianVaultPage,
  MigrationHealthSnapshot,
  MigrationKpis,
  MigrationSource,
  MigrationWorkstream,
  MigrationBlocker,
  MigrationTaskStatusRow,
  MigrationTrendPoint,
  MigrationTeam,
  MigrationWorkstreamDetail,
  MigrationDashboardOverview,
  LaunchReportResponse,
  EpicProgressResponse,
  MigrationSnapshot,
  MigrationSnapshotDiff,
  MigrationSnapshotDiffResponse,
  MigrationHistoryEntry,
  MigrationDailyActivity,
  MigrationProjectTasks,
  MigrationTaskDetail,
  RawTaskRecord,
  RequirementAnswer,
  RequirementCandidate,
  RequirementCommonQuestion,
  RequirementKnowledgeBase,
  RequirementSource,
  QaTestingReport,
  AiUsageSummary,
  AutofixBuild,
  AutofixFix,
  AutofixRefreshSummary,
  AutofixFixPatch,
  CsvLighthouseFile,
  CsvLighthouseRun,
  CsvLighthouseRunDetail,
  CsvLighthouseSiteKey,
  TestDataListing,
  ValidationSiteKey,
} from "@/types"

export class RateLimitError extends Error {
  retryAfter: number
  constructor(message: string, retryAfter: number) {
    super(message)
    this.name = "RateLimitError"
    this.retryAfter = retryAfter
  }
}

class ApiClient {
  private baseUrl: string

  constructor(baseUrl: string = "") {
    this.baseUrl = baseUrl
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }))
      if (response.status === 429) {
        throw new RateLimitError(
          errorData.error || "Rate limit exceeded",
          errorData.retryAfter ?? 30,
        )
      }
      throw new Error(errorData.error || `Request failed: ${response.status}`)
    }

    return response.json()
  }

  // ---------- Sites ----------

  async getSites(): Promise<Site[]> {
    return this.request<Site[]>("/api/sites")
  }

  async getSitesWithUrls(): Promise<SiteWithUrls[]> {
    return this.request<SiteWithUrls[]>("/api/sites-with-urls")
  }

  async createSite(name: string): Promise<Site> {
    return this.request<Site>("/api/sites", {
      method: "POST",
      body: JSON.stringify({ name }),
    })
  }

  async updateSite(siteId: number, name: string): Promise<Site> {
    return this.request<Site>(`/api/sites/${siteId}`, {
      method: "PUT",
      body: JSON.stringify({ name }),
    })
  }

  async deleteSite(siteId: number): Promise<void> {
    await this.request<{ message: string }>(`/api/sites/${siteId}`, {
      method: "DELETE",
    })
  }

  // ---------- URLs ----------

  async getUrls(siteId: number): Promise<Url[]> {
    return this.request<Url[]>(`/api/sites/${siteId}/urls`)
  }

  async addUrl(siteId: number, url: string): Promise<Url> {
    return this.request<Url>(`/api/sites/${siteId}/urls`, {
      method: "POST",
      body: JSON.stringify({ url }),
    })
  }

  async deleteUrl(urlId: number): Promise<void> {
    await this.request<{ message: string }>(`/api/urls/${urlId}`, {
      method: "DELETE",
    })
  }

  // ---------- Testing ----------

  async testUrl(urlId: number, url: string, strategy: Strategy = "desktop"): Promise<{ success: boolean; result: TestResult; error?: string }> {
    return this.request("/api/test-url", {
      method: "POST",
      body: JSON.stringify({ url_id: urlId, url, strategy }),
    })
  }

  async testSite(siteId: number, strategy: Strategy = "desktop"): Promise<{ results: TestResult[] }> {
    return this.request(`/api/test-site/${siteId}`, {
      method: "POST",
      body: JSON.stringify({ strategy }),
    })
  }

  async testAll(strategy: Strategy = "desktop"): Promise<{ results: TestResult[] }> {
    return this.request("/api/test-all", {
      method: "POST",
      body: JSON.stringify({ strategy }),
    })
  }

  // ---------- Results ----------

  async getLatestResults(siteId: number, strategy: Strategy = "desktop"): Promise<LatestResult[]> {
    return this.request<LatestResult[]>(`/api/sites/${siteId}/latest-results?strategy=${strategy}`)
  }

  async getUrlHistory(urlId: number, strategy: Strategy = "desktop", days: number = 30): Promise<HistoryPoint[]> {
    return this.request<HistoryPoint[]>(`/api/urls/${urlId}/history?strategy=${strategy}&days=${days}`)
  }

  async getTestDetails(testId: number): Promise<TestDetail> {
    return this.request<TestDetail>(`/api/test-details/${testId}`)
  }

  async getWorstPerforming(strategy: Strategy = "desktop", limit: number = 5): Promise<Record<string, WorstPerformer[]>> {
    return this.request<Record<string, WorstPerformer[]>>(`/api/worst-performing?strategy=${strategy}&limit=${limit}`)
  }

  async compareSites(site1Id: number, site2Id: number, strategy: Strategy = "desktop"): Promise<{ site1: LatestResult[]; site2: LatestResult[] }> {
    return this.request(`/api/comparison?site1=${site1Id}&site2=${site2Id}&strategy=${strategy}`)
  }

  async compareUrls(url1Id: number, url2Id: number): Promise<{ url1: LatestResult; url2: LatestResult }> {
    return this.request(`/api/comparison/urls?url1=${url1Id}&url2=${url2Id}`)
  }

  // ---------- Triggers ----------

  async getTriggers(): Promise<Trigger[]> {
    return this.request<Trigger[]>("/api/triggers")
  }

  async createTrigger(data: TriggerFormData): Promise<Trigger> {
    return this.request<Trigger>("/api/triggers", {
      method: "POST",
      body: JSON.stringify(data),
    })
  }

  async updateTrigger(triggerId: number, data: TriggerFormData): Promise<Trigger> {
    return this.request<Trigger>(`/api/triggers/${triggerId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  }

  async deleteTrigger(triggerId: number): Promise<void> {
    await this.request<{ message: string }>(`/api/triggers/${triggerId}`, {
      method: "DELETE",
    })
  }

  async toggleTrigger(triggerId: number, enabled: boolean): Promise<Trigger> {
    return this.request<Trigger>(`/api/triggers/${triggerId}/toggle`, {
      method: "PATCH",
      body: JSON.stringify({ enabled }),
    })
  }

  async getTriggerPresets(): Promise<SchedulePreset[]> {
    return this.request<SchedulePreset[]>("/api/triggers/presets")
  }

  async runTrigger(triggerId: number): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/api/triggers/${triggerId}/run-now`, {
      method: "POST",
    })
  }

  async createPreset(name: string, cronExpression: string): Promise<{ success: boolean; id: number }> {
    return this.request("/api/triggers/presets", {
      method: "POST",
      body: JSON.stringify({ name, cron_expression: cronExpression }),
    })
  }

  async deletePreset(presetId: number): Promise<void> {
    await this.request<{ success: boolean }>(`/api/triggers/presets/${presetId}`, {
      method: "DELETE",
    })
  }

  // ---------- New Relic ----------

  private nrBody(config: NewRelicConfig, extra: Record<string, unknown> = {}): string {
    return JSON.stringify({
      api_key: config.apiKey,
      account_id: config.accountId,
      app_name: config.appName,
      ...extra,
    })
  }

  async testNewRelicConnection(config: NewRelicConfig): Promise<{ success: boolean; message: string }> {
    return this.request("/api/newrelic/test-connection", {
      method: "POST",
      body: this.nrBody(config),
    })
  }

  async getNewRelicCwv(
    config: NewRelicConfig,
    pageUrl: string,
    timeRange: string = "30 minutes ago"
  ): Promise<Record<string, unknown>> {
    return this.request("/api/newrelic/core-web-vitals", {
      method: "POST",
      body: this.nrBody(config, { page_url: pageUrl, time_range: timeRange }),
    })
  }

  async getNewRelicPerformance(
    config: NewRelicConfig,
    timeRange: string = "30 minutes ago"
  ): Promise<Record<string, unknown>> {
    return this.request("/api/newrelic/performance-overview", {
      method: "POST",
      body: this.nrBody(config, { time_range: timeRange }),
    })
  }

  async getNewRelicApm(
    config: NewRelicConfig,
    timeRange: string = "30 minutes ago"
  ): Promise<Record<string, unknown>> {
    return this.request("/api/newrelic/apm-metrics", {
      method: "POST",
      body: this.nrBody(config, { time_range: timeRange }),
    })
  }

  async executeNewRelicQuery(config: NewRelicConfig, query: string): Promise<Record<string, unknown>> {
    return this.request("/api/newrelic/custom-query", {
      method: "POST",
      body: this.nrBody(config, { query }),
    })
  }

  // ---------- Azure ----------

  private azBody(config: AzureConfig, extra: Record<string, unknown> = {}): string {
    return JSON.stringify({
      tenant_id: config.tenantId,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      workspace_id: config.workspaceId,
      ...extra,
    })
  }

  async testAzureConnection(config: AzureConfig): Promise<{ success: boolean; message: string; warning?: boolean }> {
    return this.request("/api/azure/test-connection", {
      method: "POST",
      body: this.azBody(config),
    })
  }

  async searchAzureLogs(
    config: AzureConfig,
    filters: { startDate: string; endDate: string; urlFilter?: string; statusCode?: string; siteName?: string; limit?: number }
  ): Promise<Record<string, unknown>> {
    return this.request("/api/azure/search-logs", {
      method: "POST",
      body: this.azBody(config, {
        start_date: filters.startDate,
        end_date: filters.endDate,
        url_filter: filters.urlFilter || null,
        status_code: filters.statusCode || null,
        site_name: filters.siteName || null,
        limit: filters.limit || 100,
      }),
    })
  }

  async getAzureDashboard(
    config: AzureConfig,
    startDate: string,
    endDate: string,
    siteName?: string
  ): Promise<Record<string, unknown>> {
    return this.request("/api/azure/dashboard-summary", {
      method: "POST",
      body: this.azBody(config, {
        start_date: startDate,
        end_date: endDate,
        site_name: siteName || null,
      }),
    })
  }

  async executeAzureQuery(config: AzureConfig, query: string): Promise<Record<string, unknown>> {
    return this.request("/api/azure/execute-query", {
      method: "POST",
      body: this.azBody(config, { query }),
    })
  }

  async listAzureSites(config: AzureConfig): Promise<{ success: boolean; sites: string[] }> {
    return this.request("/api/azure/list-sites", {
      method: "POST",
      body: this.azBody(config),
    })
  }

  // ---------- AI Analysis ----------

  async getAiConfig(): Promise<AiSavedConfig> {
    return this.request("/api/ai/config")
  }

  async saveAiConfig(config: AiConfig): Promise<AiSavedConfig> {
    return this.request("/api/ai/config", {
      method: "PUT",
      body: JSON.stringify({
        claude_api_key: config.claudeApiKey,
        claude_model: config.claudeModel,
        openai_api_key: config.openaiApiKey,
        openai_model: config.openaiModel,
      }),
    })
  }

  async analyzeWithAi(
    config: AiConfig,
    data: { url: string; newRelicData?: unknown; azureData?: unknown; customPrompt?: string }
  ): Promise<{ results: AiAnalysisResult[] }> {
    return this.request("/api/ai/analyze", {
      method: "POST",
      body: JSON.stringify({ ...config, ...data }),
    })
  }

  async aiFollowUp(
    config: AiConfig,
    data: { provider: string; message: string; conversationHistory: unknown[] }
  ): Promise<AiFollowUpResult> {
    return this.request("/api/ai/follow-up", {
      method: "POST",
      body: JSON.stringify({ ...config, ...data }),
    })
  }

  // ---------- Autofix (AI Fixes) ----------

  async refreshAutofix(
    body: { definition_ids?: number[]; per_definition?: number; pat?: string } = {}
  ): Promise<AutofixRefreshSummary> {
    return this.request<AutofixRefreshSummary>("/api/autofix/refresh", {
      method: "POST",
      body: JSON.stringify(body),
    })
  }

  async getAutofixBuilds(): Promise<{ success: boolean; builds: AutofixBuild[] }> {
    return this.request<{ success: boolean; builds: AutofixBuild[] }>("/api/autofix/builds")
  }

  async getAutofixFixes(
    buildId: string
  ): Promise<{ success: boolean; fixes: AutofixFix[] }> {
    return this.request<{ success: boolean; fixes: AutofixFix[] }>(
      `/api/autofix/builds/${encodeURIComponent(buildId)}/fixes`
    )
  }

  async patchAutofixFix(
    buildId: string,
    fixId: string,
    patch: AutofixFixPatch
  ): Promise<{ success: boolean }> {
    return this.request<{ success: boolean }>(
      `/api/autofix/fixes/${encodeURIComponent(buildId)}/${encodeURIComponent(fixId)}`,
      { method: "PATCH", body: JSON.stringify(patch) }
    )
  }

  // ---------- Azure DevOps ----------

  async getDevOpsServerConfig(): Promise<{
    managed: boolean
    organization: string
    project: string
    orchestratorPipelineId: number | null
    pipelineMap: Record<string, number>
  }> {
    return this.request("/api/devops/server-config")
  }

  private devOpsBody(config: DevOpsConfig, extra: Record<string, unknown> = {}): string {
    return JSON.stringify({
      pat: config.pat,
      organization: config.organization,
      project: config.project,
      ...extra,
    })
  }

  async testDevOpsConnection(config: DevOpsConfig): Promise<{ success: boolean; message: string }> {
    return this.request("/api/devops/test-connection", {
      method: "POST",
      body: this.devOpsBody(config),
    })
  }

  async getDevOpsFailedTests(
    config: DevOpsConfig,
    buildId: number
  ): Promise<{ success: boolean; failedTests: FailedTest[] }> {
    return this.request(`/api/devops/failed-tests/${buildId}`, {
      method: "POST",
      body: this.devOpsBody(config),
    })
  }

  async getDevOpsSkippedTests(
    config: DevOpsConfig,
    buildId: number
  ): Promise<{ success: boolean; skippedTests: SkippedTest[] }> {
    return this.request(`/api/devops/skipped-tests/${buildId}`, {
      method: "POST",
      body: this.devOpsBody(config),
    })
  }

  async getDevOpsTestScreenshot(
    config: DevOpsConfig,
    runId: number,
    resultId: number,
    attachmentId: number
  ): Promise<string> {
    const response = await fetch(
      `${this.baseUrl}/api/devops/test-screenshot/${runId}/${resultId}/${attachmentId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: this.devOpsBody(config),
      }
    )
    if (!response.ok) throw new Error("Failed to fetch screenshot")
    const blob = await response.blob()
    return URL.createObjectURL(blob)
  }

  async getDevOpsTestScreenshotMetadata(
    config: DevOpsConfig,
    runId: number,
    resultId: number
  ): Promise<{ success: boolean; screenshotId: number | null }> {
    return this.request(`/api/devops/test-screenshot-metadata/${runId}/${resultId}`, {
      method: "POST",
      body: this.devOpsBody(config),
    })
  }

  async getDevOpsEffectiveStatus(
    config: DevOpsConfig,
    buildId: number
  ): Promise<{ success: boolean; effectiveResult: string; hasRerun: boolean }> {
    return this.request(`/api/devops/effective-status/${buildId}`, {
      method: "POST",
      body: this.devOpsBody(config),
    })
  }

  async getDevOpsPipelines(config: DevOpsConfig): Promise<{ success: boolean; pipelines: DevOpsPipeline[] }> {
    return this.request("/api/devops/pipelines", {
      method: "POST",
      body: this.devOpsBody(config),
    })
  }

  async getDevOpsBuilds(
    config: DevOpsConfig,
    definitionIds?: number[],
    top: number = 20
  ): Promise<{ success: boolean; builds: DevOpsBuild[] }> {
    return this.request("/api/devops/builds", {
      method: "POST",
      body: this.devOpsBody(config, {
        definition_ids: definitionIds || null,
        top,
      }),
    })
  }

  async getDevOpsRecentBuildsByDefinition(
    config: DevOpsConfig,
    definitionIds: number[],
    perDefinition: number = 5,
  ): Promise<{ success: boolean; buildsByDefinition: Record<string, DevOpsBuild[]> }> {
    return this.request("/api/devops/builds/recent-by-definition", {
      method: "POST",
      body: this.devOpsBody(config, {
        definition_ids: definitionIds,
        per_definition: perDefinition,
      }),
    })
  }

  async getDevOpsBuild(config: DevOpsConfig, buildId: number): Promise<{ success: boolean; build: DevOpsBuild }> {
    return this.request(`/api/devops/builds/${buildId}`, {
      method: "POST",
      body: this.devOpsBody(config),
    })
  }

  async cancelDevOpsBuild(
    config: DevOpsConfig,
    buildId: number
  ): Promise<{ success: boolean; build: DevOpsBuild }> {
    return this.request(`/api/devops/builds/${buildId}/cancel`, {
      method: "POST",
      body: this.devOpsBody(config),
    })
  }

  async getDevOpsBranches(config: DevOpsConfig): Promise<{ success: boolean; branches: string[] }> {
    return this.request("/api/devops/branches", {
      method: "POST",
      body: this.devOpsBody(config),
    })
  }

  async triggerDevOpsPipeline(
    config: DevOpsConfig,
    pipelineId: number,
    branch?: string,
    options?: {
      templateParameters?: Record<string, string>
      variables?: Record<string, string>
    }
  ): Promise<{ success: boolean; build: DevOpsBuild }> {
    return this.request(`/api/devops/trigger/${pipelineId}`, {
      method: "POST",
      body: this.devOpsBody(config, {
        branch: branch ? `refs/heads/${branch}` : "refs/heads/master",
        template_parameters: options?.templateParameters || {},
        variables: options?.variables || {},
      }),
    })
  }

  async triggerDevOpsOrchestrator(
    config: DevOpsConfig,
    params: {
      pipelineId: number
      branch: string
      targetInstance: string
      stagingInstance: string
      runWarmUp: boolean
      runFunctional: boolean
      runVisual: boolean
      runWindows: boolean
      runMac: boolean
      runIPhone: boolean
      runAndroid: boolean
    }
  ): Promise<{ success: boolean; build: DevOpsBuild }> {
    return this.request("/api/devops/trigger-orchestrator", {
      method: "POST",
      body: this.devOpsBody(config, {
        pipeline_id: params.pipelineId,
        branch: `refs/heads/${params.branch}`,
        template_parameters: {
          runWarmUp: String(params.runWarmUp),
          runFunctional: String(params.runFunctional),
          runVisual: String(params.runVisual),
          runWindows: String(params.runWindows),
          runMac: String(params.runMac),
          runIPhone: String(params.runIPhone),
          runAndroid: String(params.runAndroid),
          TargetInstance: params.targetInstance,
          StagingInstance: params.stagingInstance,
        },
      }),
    })
  }

  // ---------- Applitools (helper-uploaded results) ----------

  /**
   * List recent helper uploads — one entry per cached batch, sorted
   * newest first. Used by the Visual-card dropdown so QA can pick an
   * uploaded batch by id without retyping it. Test rows are not
   * included; fetch them per-batch via ``getApplitoolsBatch``.
   */
  async getRecentApplitoolsBatches(): Promise<Array<{
    batchId: string
    fetchedAt: string
    uploadedAt: number
    platform: string | null
    testCount: number
  }>> {
    const response = await fetch("/api/applitools/recent-uploads", {
      headers: { Accept: "application/json" },
    })
    if (!response.ok) return []
    const data = await response.json()
    return data.uploads ?? []
  }

  /**
   * Look up Applitools batch results that the desktop helper uploaded
   * for this batch id. Returns ``null`` when nothing has been uploaded
   * yet (the helper hasn't been run, or the cache TTL expired) so
   * callers can fall back to an empty Unresolved section in the
   * spreadsheet rather than aborting the whole export.
   */
  async getApplitoolsBatch(
    batchId: string,
  ): Promise<{
    batchId: string
    fetchedAt: string
    tests: UnresolvedTest[]
  } | null> {
    const response = await fetch(
      `/api/applitools/batch/${encodeURIComponent(batchId)}`,
      { headers: { Accept: "application/json" } },
    )
    if (response.status === 404) return null
    if (!response.ok) {
      throw new Error(`Applitools lookup failed: HTTP ${response.status}`)
    }
    const data = await response.json()
    return {
      batchId: data.batchId,
      fetchedAt: data.fetchedAt,
      tests: data.tests ?? [],
    }
  }

  // ---------- BlazeMeter (Load Testing) ----------

  async getBlazemeterConfig(): Promise<BlazemeterConfigStatus> {
    return this.request<BlazemeterConfigStatus>("/api/blazemeter/config-status")
  }

  async testBlazemeterConnection(): Promise<{ success: boolean; user?: { email?: string; displayName?: string } }> {
    return this.request("/api/blazemeter/test-connection", { method: "POST" })
  }

  async listBlazemeterProjects(): Promise<{ success: boolean; projects: BlazemeterProject[] }> {
    return this.request("/api/blazemeter/projects")
  }

  async listBlazemeterTests(
    projectId?: number | string | null,
    limit: number = 200,
  ): Promise<{ success: boolean; tests: BlazemeterTest[] }> {
    const qs = new URLSearchParams({ limit: String(limit) })
    if (projectId) qs.set("projectId", String(projectId))
    return this.request(`/api/blazemeter/tests?${qs.toString()}`)
  }

  async listBlazemeterTestMasters(
    testId: number,
    limit: number = 10,
  ): Promise<BlazemeterTestMastersResponse> {
    return this.request(`/api/blazemeter/tests/${testId}/masters?limit=${limit}`)
  }

  async getBlazemeterQueue(): Promise<BlazemeterQueueSnapshot> {
    return this.request<BlazemeterQueueSnapshot>("/api/blazemeter/queue")
  }

  async enqueueBlazemeterTest(
    testId: number,
    testName: string,
    projectContext?: { projectId: number; projectName: string },
  ): Promise<{ success: boolean; item: BlazemeterQueueItem }> {
    return this.request("/api/blazemeter/queue", {
      method: "POST",
      body: JSON.stringify({
        testId,
        testName,
        projectId: projectContext?.projectId,
        projectName: projectContext?.projectName,
      }),
    })
  }

  async removeBlazemeterQueueItem(itemId: number): Promise<{ success: boolean }> {
    return this.request(`/api/blazemeter/queue/${itemId}`, { method: "DELETE" })
  }

  async clearBlazemeterQueue(): Promise<{ success: boolean; removed: number }> {
    return this.request("/api/blazemeter/queue/clear", { method: "POST" })
  }

  async cancelBlazemeterActive(): Promise<{ success: boolean }> {
    return this.request("/api/blazemeter/queue/cancel-active", { method: "POST" })
  }

  // ---------- BlazeMeter presets ----------

  async listBlazemeterPresets(): Promise<{ success: boolean; presets: BlazemeterPreset[] }> {
    return this.request("/api/blazemeter/presets")
  }

  async createBlazemeterPreset(input: BlazemeterPresetInput): Promise<{ success: boolean; preset: BlazemeterPreset }> {
    return this.request("/api/blazemeter/presets", {
      method: "POST",
      body: JSON.stringify(input),
    })
  }

  async updateBlazemeterPreset(presetId: number, input: BlazemeterPresetInput): Promise<{ success: boolean; preset: BlazemeterPreset }> {
    return this.request(`/api/blazemeter/presets/${presetId}`, {
      method: "PUT",
      body: JSON.stringify(input),
    })
  }

  async deleteBlazemeterPreset(presetId: number): Promise<{ success: boolean }> {
    return this.request(`/api/blazemeter/presets/${presetId}`, { method: "DELETE" })
  }

  async queueBlazemeterPreset(presetId: number): Promise<{ success: boolean; queued: number }> {
    return this.request(`/api/blazemeter/presets/${presetId}/queue`, { method: "POST" })
  }

  async getBlazemeterMasterReport(
    masterId: number,
    range?: { fromTs?: number | null; toTs?: number | null },
  ): Promise<BlazemeterMasterReport> {
    const params = new URLSearchParams()
    if (range?.fromTs != null) params.set("fromTs", String(Math.floor(range.fromTs)))
    if (range?.toTs != null) params.set("toTs", String(Math.floor(range.toTs)))
    const query = params.toString()
    return this.request(
      `/api/blazemeter/masters/${masterId}/report${query ? `?${query}` : ""}`,
    )
  }

  async restoreBlazemeterMasterReports(
    masterId: number,
  ): Promise<{ success: boolean; masterId: number; restore: Record<string, unknown> }> {
    return this.request(`/api/blazemeter/masters/${masterId}/restore-reports`, {
      method: "POST",
    })
  }

  async listBlazemeterRuns(limit = 50, offset = 0): Promise<BlazemeterRunsResponse> {
    return this.request(`/api/blazemeter/runs?limit=${limit}&offset=${offset}`)
  }

  // ---------- Obsidian Bridge ----------

  async getObsidianCapabilities(): Promise<ObsidianCapabilities> {
    return this.request("/api/obsidian/capabilities")
  }

  async getObsidianPendingOrchestration(): Promise<ObsidianPendingOrchestration> {
    return this.request("/api/obsidian/pending-orchestration")
  }

  async startObsidianSync(
    body: ObsidianSyncRequest = {},
  ): Promise<{ success: boolean; job: ObsidianSyncJob }> {
    return this.request("/api/obsidian/sync", {
      method: "POST",
      body: JSON.stringify(body),
    })
  }

  async getObsidianActiveSync(): Promise<{ active: ObsidianSyncJob | null }> {
    return this.request("/api/obsidian/sync/active")
  }

  async getObsidianSyncHistory(limit = 20): Promise<{ jobs: ObsidianSyncJobSummary[] }> {
    return this.request(`/api/obsidian/sync/history?limit=${limit}`)
  }

  async getObsidianSyncJob(jobId: string): Promise<{ job: ObsidianSyncJob }> {
    return this.request(`/api/obsidian/sync/${jobId}`)
  }

  async cancelObsidianSync(
    jobId: string,
  ): Promise<{ success: boolean; job: ObsidianSyncJob }> {
    return this.request(`/api/obsidian/sync/${jobId}/cancel`, {
      method: "POST",
    })
  }

  async getObsidianVaultTree(subdir = "", depth = 6): Promise<{ tree: ObsidianVaultNode }> {
    const params = new URLSearchParams()
    if (subdir) params.set("subdir", subdir)
    params.set("depth", String(depth))
    return this.request(`/api/obsidian/vault/tree?${params.toString()}`)
  }

  async getObsidianVaultPage(path: string): Promise<{ page: ObsidianVaultPage }> {
    return this.request(`/api/obsidian/vault/page?path=${encodeURIComponent(path)}`)
  }

  // ---------- Migration dashboard ----------

  async getMigrationHealth(): Promise<MigrationHealthSnapshot> {
    return this.request("/api/dashboard/health")
  }

  async getMigrationOverview(): Promise<MigrationDashboardOverview> {
    return this.request("/api/dashboard/overview")
  }

  async getMigrationKpis(): Promise<MigrationKpis> {
    return this.request("/api/dashboard/kpis")
  }

  async getEpicProgress(): Promise<EpicProgressResponse> {
    return this.request("/api/dashboard/epic-progress")
  }

  async getLaunchReport(): Promise<LaunchReportResponse> {
    return this.request("/api/dashboard/launch-report")
  }

  async getMigrationSources(): Promise<MigrationSource[]> {
    return this.request("/api/dashboard/sources")
  }

  async getMigrationWorkstreams(): Promise<MigrationWorkstream[]> {
    return this.request("/api/dashboard/workstreams")
  }

  async getVaultAutoRefreshStatus(): Promise<{
    enabled: boolean
    lastRefreshedAt?: number | null
    lastRefreshedOk?: boolean | null
    lastRefreshedHead?: string | null
    lastOrchestrationPushAt?: number | null
  }> {
    return this.request("/api/obsidian/vault/auto-refresh-status")
  }

  async getMigrationBlockers(): Promise<MigrationBlocker[]> {
    return this.request("/api/dashboard/blockers")
  }

  async getMigrationProductionFailures(): Promise<RawTaskRecord[]> {
    return this.request("/api/dashboard/production-failures")
  }

  async getMigrationNewBugs(windowDays = 7): Promise<RawTaskRecord[]> {
    return this.request(`/api/dashboard/new-bugs?windowDays=${windowDays}`)
  }

  async getMigrationDailyActivity(date?: string): Promise<MigrationDailyActivity> {
    const qs = date ? `?date=${encodeURIComponent(date)}` : ""
    return this.request(`/api/dashboard/daily-activity${qs}`)
  }

  async getMigrationProjectTasks(projectKey: string): Promise<MigrationProjectTasks> {
    return this.request(`/api/dashboard/projects/${encodeURIComponent(projectKey)}/tasks`)
  }

  async getMigrationTaskDetail(relPath: string): Promise<MigrationTaskDetail> {
    return this.request(`/api/dashboard/task-detail?relPath=${encodeURIComponent(relPath)}`)
  }

  async getMigrationTaskStatus(): Promise<MigrationTaskStatusRow[]> {
    return this.request("/api/dashboard/task-status")
  }

  async getMigrationTrend(): Promise<MigrationTrendPoint[]> {
    return this.request("/api/dashboard/trend")
  }

  async getMigrationTeams(): Promise<MigrationTeam[]> {
    return this.request("/api/dashboard/teams")
  }

  async getMigrationWorkstreamDetail(id: string): Promise<MigrationWorkstreamDetail> {
    return this.request(`/api/dashboard/workstream/${encodeURIComponent(id)}`)
  }

  async getMigrationSnapshots(): Promise<MigrationSnapshot[]> {
    return this.request("/api/dashboard/snapshots")
  }

  async getMigrationSnapshotLatest(): Promise<MigrationSnapshot> {
    return this.request("/api/dashboard/snapshots/latest")
  }

  async getMigrationSnapshotDiff(): Promise<MigrationSnapshotDiffResponse> {
    return this.request("/api/dashboard/snapshots/diff")
  }

  async getMigrationSnapshotHistory(): Promise<MigrationHistoryEntry[]> {
    return this.request("/api/dashboard/snapshots/history")
  }

  async reingestMigrationSnapshots(): Promise<{ ingested: string[] }> {
    return this.request("/api/dashboard/snapshots/reingest", { method: "POST" })
  }

  // ---------- Requirement Questions ----------

  async getRequirementKnowledgeBases(): Promise<RequirementKnowledgeBase[]> {
    return this.request("/api/requirements/knowledge-bases")
  }

  async seedCalculatorKnowledgeBase(): Promise<RequirementKnowledgeBase> {
    return this.request("/api/requirements/seed/calculator", { method: "POST" })
  }

  async discoverRequirementCandidates(terms: string[], limit = 50): Promise<RequirementCandidate[]> {
    return this.request("/api/requirements/discover", {
      method: "POST",
      body: JSON.stringify({ terms, limit }),
    })
  }

  async createRequirementKnowledgeBase(input: {
    name: string
    description?: string
    searchTerms: string[]
    candidates: RequirementCandidate[]
  }): Promise<RequirementKnowledgeBase> {
    return this.request("/api/requirements/knowledge-bases", {
      method: "POST",
      body: JSON.stringify(input),
    })
  }

  async getRequirementSources(kbId: number): Promise<RequirementSource[]> {
    return this.request(`/api/requirements/knowledge-bases/${kbId}/sources`)
  }

  async getRequirementCommonQuestions(kbId: number): Promise<RequirementCommonQuestion[]> {
    return this.request(`/api/requirements/knowledge-bases/${kbId}/common-questions`)
  }

  async getQaTestingReport(
    start: string,
    end: string,
    forceRefresh = false,
    taskWindow: "range" | "sinceYesterday" = "sinceYesterday",
    burndownStart?: string,
    burndownEnd?: string,
    clearCache = false,
  ): Promise<QaTestingReport> {
    const params = new URLSearchParams({ start, end, taskWindow })
    if (forceRefresh) params.set("forceRefresh", "true")
    if (clearCache) params.set("clearCache", "true")
    if (burndownStart) params.set("burndownStart", burndownStart)
    if (burndownEnd) params.set("burndownEnd", burndownEnd)
    return this.request(`/api/requirements/qa-testing/report?${params.toString()}`)
  }

  async addRequirementTaskSource(kbId: number, sourcePath: string): Promise<RequirementSource> {
    return this.request(`/api/requirements/knowledge-bases/${kbId}/sources/tasks`, {
      method: "POST",
      body: JSON.stringify({ sourcePath }),
    })
  }

  async removeRequirementSource(kbId: number, sourceId: number): Promise<{ removed: boolean; sourceId: number; title?: string }> {
    return this.request(`/api/requirements/knowledge-bases/${kbId}/sources/${sourceId}`, {
      method: "DELETE",
    })
  }

  async getRequirementSourceFile(kbId: number, sourceId: number): Promise<Blob> {
    const response = await fetch(`${this.baseUrl}/api/requirements/knowledge-bases/${kbId}/sources/${sourceId}/file`)
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }))
      throw new Error(errorData.error || `Request failed: ${response.status}`)
    }
    return response.blob()
  }

  async addRequirementNote(
    kbId: number,
    input: { title: string; body: string; category: string; tags: string[]; sourceLink?: string },
  ): Promise<RequirementSource> {
    return this.request(`/api/requirements/knowledge-bases/${kbId}/notes`, {
      method: "POST",
      body: JSON.stringify(input),
    })
  }

  async uploadRequirementFiles(kbId: number, files: File[]): Promise<RequirementSource[]> {
    const formData = new FormData()
    files.forEach((file) => formData.append("files", file))
    const response = await fetch(`${this.baseUrl}/api/requirements/knowledge-bases/${kbId}/uploads`, {
      method: "POST",
      body: formData,
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }))
      throw new Error(errorData.error || `Request failed: ${response.status}`)
    }
    return response.json()
  }

  async askRequirementQuestion(
    kbId: number,
    question: string,
    ai?: { provider: "claude" | "openai"; apiKey: string; model: string },
    answerMode: "exact" | "summary" = "exact",
  ): Promise<RequirementAnswer> {
    return this.request(`/api/requirements/knowledge-bases/${kbId}/questions`, {
      method: "POST",
      body: JSON.stringify({ question, ai, answerMode }),
    })
  }

  async rechunkKnowledgeBase(kbId: number): Promise<{ rechunked: boolean; sources: number; chunks: number }> {
    return this.request(`/api/requirements/knowledge-bases/${kbId}/rechunk`, { method: "POST" })
  }

  async getAiUsageSummary(): Promise<AiUsageSummary> {
    return this.request("/api/requirements/ai-usage")
  }

  // ---------- CSV Lighthouse runs ----------

  async createCsvLighthouseRun(input: {
    files: File[]
    siteKeys: CsvLighthouseSiteKey[]
    strategy: Strategy
    label?: string
  }): Promise<{ success: boolean; run_id: number; worker_count: number; total_items: number }> {
    const formData = new FormData()
    input.files.forEach((file) => formData.append("files", file))
    input.siteKeys.forEach((siteKey) => formData.append("site_keys", siteKey))
    formData.append("strategy", input.strategy)
    const label = input.label?.trim()
    if (label) {
      formData.append("label", label)
    }

    const response = await fetch(`${this.baseUrl}/api/csv-lighthouse/runs`, {
      method: "POST",
      body: formData,
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }))
      throw new Error(errorData.error || `Request failed: ${response.status}`)
    }
    return response.json()
  }

  async listCsvLighthouseRuns(): Promise<{ success: boolean; runs: CsvLighthouseRun[] }> {
    return this.request("/api/csv-lighthouse/runs")
  }

  async getCsvLighthouseRun(runId: number): Promise<{ success: boolean } & CsvLighthouseRunDetail> {
    return this.request(`/api/csv-lighthouse/runs/${runId}`)
  }

  async deleteCsvLighthouseRun(runId: number): Promise<{ success: boolean }> {
    return this.request(`/api/csv-lighthouse/runs/${runId}`, { method: "DELETE" })
  }

  async listCsvLighthouseFiles(runId: number): Promise<{ success: boolean; files: CsvLighthouseFile[] }> {
    return this.request(`/api/csv-lighthouse/runs/${runId}/files`)
  }

  async getCsvLighthouseFile(fileId: number): Promise<{ success: boolean; file: CsvLighthouseFile }> {
    return this.request(`/api/csv-lighthouse/files/${fileId}`)
  }

  async updateCsvLighthouseFile(fileId: number, csvText: string): Promise<{ success: boolean; file: CsvLighthouseFile }> {
    return this.request(`/api/csv-lighthouse/files/${fileId}`, {
      method: "PUT",
      body: JSON.stringify({ csv_text: csvText }),
    })
  }

  async deleteCsvLighthouseFile(fileId: number): Promise<{ success: boolean }> {
    return this.request(`/api/csv-lighthouse/files/${fileId}`, { method: "DELETE" })
  }

  async startCsvLighthouseRun(runId: number): Promise<{ success: boolean } & CsvLighthouseRunDetail> {
    return this.request(`/api/csv-lighthouse/runs/${runId}/start`, { method: "POST" })
  }

  async cancelCsvLighthouseRun(runId: number): Promise<{ success: boolean }> {
    return this.request(`/api/csv-lighthouse/runs/${runId}/cancel`, { method: "POST" })
  }

  getCsvLighthouseExportUrl(runId: number): string {
    return `${this.baseUrl}/api/csv-lighthouse/runs/${runId}/export`
  }

  async listCsvLighthouseLibrary(): Promise<{ success: boolean; files: CsvLighthouseFile[] }> {
    return this.request("/api/csv-lighthouse/library")
  }

  async uploadCsvLighthouseLibrary(files: File[]): Promise<{ success: boolean; files: CsvLighthouseFile[] }> {
    const formData = new FormData()
    files.forEach((file) => formData.append("files", file))

    const response = await fetch(`${this.baseUrl}/api/csv-lighthouse/library`, {
      method: "POST",
      body: formData,
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }))
      throw new Error(errorData.error || `Request failed: ${response.status}`)
    }
    return response.json()
  }

  async deleteCsvLighthouseLibraryFile(filename: string): Promise<{ success: boolean }> {
    return this.request(`/api/csv-lighthouse/library/${encodeURIComponent(filename)}`, { method: "DELETE" })
  }

  // ---------- TestData URL listing ----------

  async buildTestDataUrls(
    files: File[],
    sites: ValidationSiteKey[],
  ): Promise<TestDataListing> {
    const formData = new FormData()
    files.forEach((file) => formData.append("files", file))
    sites.forEach((site) => formData.append("sites", site))
    const response = await fetch(`${this.baseUrl}/api/testdata/urls`, {
      method: "POST",
      body: formData,
    })
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }))
      throw new Error(errorData.error || `Request failed: ${response.status}`)
    }
    return response.json()
  }
}

export const api = new ApiClient()
