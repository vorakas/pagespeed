import type {
  Site,
  // SiteWithUrls used by consumers, not directly by this client
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
  AiAnalysisResult,
  AiFollowUpResult,
  DevOpsConfig,
  DevOpsPipeline,
  DevOpsBuild,
  FailedTest,
  SkippedTest,
} from "@/types"

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
      throw new Error(errorData.error || `Request failed: ${response.status}`)
    }

    return response.json()
  }

  // ---------- Sites ----------

  async getSites(): Promise<Site[]> {
    return this.request<Site[]>("/api/sites")
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
  // ---------- Azure DevOps ----------

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

  async getDevOpsBuild(config: DevOpsConfig, buildId: number): Promise<{ success: boolean; build: DevOpsBuild }> {
    return this.request(`/api/devops/builds/${buildId}`, {
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
    templateParameters?: Record<string, string>
  ): Promise<{ success: boolean; build: DevOpsBuild }> {
    return this.request(`/api/devops/trigger/${pipelineId}`, {
      method: "POST",
      body: this.devOpsBody(config, {
        branch: branch ? `refs/heads/${branch}` : "refs/heads/master",
        template_parameters: templateParameters || {},
      }),
    })
  }

  async triggerDevOpsOrchestrator(
    config: DevOpsConfig,
    params: {
      pipelineId: number
      branch: string
      targetInstance: string
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
        },
      }),
    })
  }
}

export const api = new ApiClient()
