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
    return this.request<{ message: string }>(`/api/triggers/${triggerId}/run`, {
      method: "POST",
    })
  }

  // ---------- New Relic ----------

  async testNewRelicConnection(config: NewRelicConfig): Promise<{ success: boolean; message: string }> {
    return this.request("/api/newrelic/test-connection", {
      method: "POST",
      body: JSON.stringify(config),
    })
  }

  async getNewRelicCwv(config: NewRelicConfig): Promise<NewRelicCwvData[]> {
    return this.request<NewRelicCwvData[]>("/api/newrelic/core-web-vitals", {
      method: "POST",
      body: JSON.stringify(config),
    })
  }

  async getNewRelicPerformance(config: NewRelicConfig, period: string = "1 DAY"): Promise<NewRelicPerformanceData> {
    return this.request<NewRelicPerformanceData>("/api/newrelic/performance-overview", {
      method: "POST",
      body: JSON.stringify({ ...config, period }),
    })
  }

  async getNewRelicApm(config: NewRelicConfig): Promise<Record<string, unknown>> {
    return this.request("/api/newrelic/apm-metrics", {
      method: "POST",
      body: JSON.stringify(config),
    })
  }

  async executeNewRelicQuery(config: NewRelicConfig, query: string): Promise<Record<string, unknown>> {
    return this.request("/api/newrelic/custom-query", {
      method: "POST",
      body: JSON.stringify({ ...config, query }),
    })
  }

  // ---------- Azure ----------

  async testAzureConnection(config: AzureConfig): Promise<{ success: boolean; message: string }> {
    return this.request("/api/azure/test-connection", {
      method: "POST",
      body: JSON.stringify(config),
    })
  }

  async searchAzureLogs(
    config: AzureConfig,
    filters: { startDate?: string; endDate?: string; urlPath?: string; statusCode?: string; limit?: number }
  ): Promise<AzureLogEntry[]> {
    return this.request<AzureLogEntry[]>("/api/azure/search-logs", {
      method: "POST",
      body: JSON.stringify({ ...config, ...filters }),
    })
  }

  async getAzureDashboard(config: AzureConfig): Promise<AzureDashboardSummary> {
    return this.request<AzureDashboardSummary>("/api/azure/dashboard-summary", {
      method: "POST",
      body: JSON.stringify(config),
    })
  }

  async executeAzureQuery(config: AzureConfig, query: string): Promise<Record<string, unknown>> {
    return this.request("/api/azure/execute-query", {
      method: "POST",
      body: JSON.stringify({ ...config, query }),
    })
  }

  async listAzureSites(config: AzureConfig): Promise<string[]> {
    return this.request<string[]>("/api/azure/list-sites", {
      method: "POST",
      body: JSON.stringify(config),
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
}

export const api = new ApiClient()
