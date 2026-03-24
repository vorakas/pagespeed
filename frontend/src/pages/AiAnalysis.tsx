import { useState, useRef, useCallback } from "react"
import { Header } from "@/components/layout/Header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { AiConfigPanel } from "@/components/ai-analysis/AiConfigPanel"
import { AnalysisPanel, type ChatMessage } from "@/components/ai-analysis/AnalysisPanel"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { useLocalConfig } from "@/hooks/use-local-config"
import { api } from "@/services/api"
import type { AiConfig, NewRelicConfig, AzureConfig } from "@/types"
import { Loader2, Send, Sparkles } from "lucide-react"

const TIME_RANGES = [
  { value: "30 minutes ago", label: "Last 30 minutes" },
  { value: "1 hour ago", label: "Last 1 hour" },
  { value: "3 hours ago", label: "Last 3 hours" },
  { value: "6 hours ago", label: "Last 6 hours" },
  { value: "12 hours ago", label: "Last 12 hours" },
  { value: "24 hours ago", label: "Last 24 hours" },
]

const DEFAULT_AI_CONFIG: AiConfig = {
  claudeApiKey: "",
  claudeModel: "claude-sonnet-4-20250514",
  openaiApiKey: "",
  openaiModel: "gpt-4o",
}

interface ConversationState {
  active: boolean
  systemPrompt: string | null
  providers: string[]
  claudeMessages: ChatMessage[]
  openaiMessages: ChatMessage[]
  claudeHistory: Array<{ role: string; content: string }>
  openaiHistory: Array<{ role: string; content: string }>
  claudeUsage: { input: number; output: number }
  openaiUsage: { input: number; output: number }
  turnCount: number
  claudeModel: string
  openaiModel: string
  claudeError: string | null
  openaiError: string | null
}

const INITIAL_CONVERSATION: ConversationState = {
  active: false,
  systemPrompt: null,
  providers: [],
  claudeMessages: [],
  openaiMessages: [],
  claudeHistory: [],
  openaiHistory: [],
  claudeUsage: { input: 0, output: 0 },
  openaiUsage: { input: 0, output: 0 },
  turnCount: 0,
  claudeModel: "",
  openaiModel: "",
  claudeError: null,
  openaiError: null,
}

export function AiAnalysis() {
  const [aiConfig, setAiConfig] = useLocalConfig<AiConfig>("aiConfig", DEFAULT_AI_CONFIG)
  const [nrConfig] = useLocalConfig<NewRelicConfig>("nrConfig", { apiKey: "", accountId: "", appName: "" })
  const [azConfig] = useLocalConfig<AzureConfig>("azureConfig", {
    tenantId: "", clientId: "", clientSecret: "", workspaceId: "", secretExpirationDate: "", site: "",
  })

  const [urlPath, setUrlPath] = useState("")
  const [pageUrl, setPageUrl] = useState("")
  const [timeRange, setTimeRange] = useState("1 hour ago")
  const [useClaude, setUseClaude] = useState(true)
  const [useOpenai, setUseOpenai] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [followupText, setFollowupText] = useState("")
  const [sendingFollowup, setSendingFollowup] = useState(false)
  const [dataSources, setDataSources] = useState<{ newrelic: boolean; iis_logs: boolean } | null>(null)

  const [conversation, setConversation] = useState<ConversationState>(INITIAL_CONVERSATION)
  const followupRef = useRef<HTMLTextAreaElement>(null)

  const handleAnalyze = useCallback(async () => {
    if (!urlPath.trim()) return
    if (!useClaude && !useOpenai) return

    setAnalyzing(true)
    setConversation(INITIAL_CONVERSATION)
    setDataSources(null)

    const providers: string[] = []
    if (useClaude) providers.push("claude")
    if (useOpenai) providers.push("openai")

    const payload = {
      url: urlPath.trim(),
      page_url: pageUrl.trim() || null,
      time_range: timeRange,
      providers,
      nr_api_key: nrConfig.apiKey || null,
      nr_account_id: nrConfig.accountId || null,
      nr_app_name: nrConfig.appName || null,
      azure_tenant_id: azConfig.tenantId || null,
      azure_client_id: azConfig.clientId || null,
      azure_client_secret: azConfig.clientSecret || null,
      azure_workspace_id: azConfig.workspaceId || null,
      azure_site_name: azConfig.site || null,
      claude_api_key: useClaude ? aiConfig.claudeApiKey : null,
      claude_model: aiConfig.claudeModel,
      openai_api_key: useOpenai ? aiConfig.openaiApiKey : null,
      openai_model: aiConfig.openaiModel,
    }

    try {
      const response = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await response.json()

      if (!response.ok || !data.success) {
        setConversation((prev) => ({
          ...prev,
          claudeError: data.error || "Analysis failed",
        }))
        return
      }

      setDataSources(data.data_sources)

      const newConv: ConversationState = {
        active: true,
        systemPrompt: data.system_prompt,
        providers,
        claudeMessages: [],
        openaiMessages: [],
        claudeHistory: [],
        openaiHistory: [],
        claudeUsage: { input: 0, output: 0 },
        openaiUsage: { input: 0, output: 0 },
        turnCount: 1,
        claudeModel: data.claude?.model || aiConfig.claudeModel,
        openaiModel: data.openai?.model || aiConfig.openaiModel,
        claudeError: null,
        openaiError: null,
      }

      if (data.claude) {
        if (data.claude.analysis) {
          newConv.claudeMessages = [
            { role: "assistant", content: data.claude.analysis, label: "Initial Analysis" },
          ]
          newConv.claudeHistory = [
            { role: "user", content: data.user_message },
            { role: "assistant", content: data.claude.analysis },
          ]
          newConv.claudeUsage = {
            input: data.claude.usage?.input_tokens || 0,
            output: data.claude.usage?.output_tokens || 0,
          }
        } else {
          newConv.claudeError = data.claude.error
        }
      }

      if (data.openai) {
        if (data.openai.analysis) {
          newConv.openaiMessages = [
            { role: "assistant", content: data.openai.analysis, label: "Initial Analysis" },
          ]
          newConv.openaiHistory = [
            { role: "user", content: data.user_message },
            { role: "assistant", content: data.openai.analysis },
          ]
          newConv.openaiUsage = {
            input: data.openai.usage?.prompt_tokens || data.openai.usage?.input_tokens || 0,
            output: data.openai.usage?.completion_tokens || data.openai.usage?.output_tokens || 0,
          }
        } else {
          newConv.openaiError = data.openai.error
        }
      }

      setConversation(newConv)
    } catch (err) {
      setConversation((prev) => ({
        ...prev,
        claudeError: err instanceof Error ? err.message : "Analysis failed",
      }))
    } finally {
      setAnalyzing(false)
    }
  }, [urlPath, pageUrl, timeRange, useClaude, useOpenai, aiConfig, nrConfig, azConfig])

  const handleFollowup = useCallback(async () => {
    const question = followupText.trim()
    if (!question || !conversation.active) return

    setSendingFollowup(true)
    setFollowupText("")

    // Append user message to both panels immediately
    const userMsg: ChatMessage = { role: "user", content: question }

    setConversation((prev) => {
      const next = { ...prev }
      if (prev.claudeHistory.length > 0) {
        next.claudeMessages = [...prev.claudeMessages, userMsg]
        next.claudeHistory = [...prev.claudeHistory, { role: "user", content: question }]
      }
      if (prev.openaiHistory.length > 0) {
        next.openaiMessages = [...prev.openaiMessages, userMsg]
        next.openaiHistory = [...prev.openaiHistory, { role: "user", content: question }]
      }
      return next
    })

    const payload = {
      providers: conversation.providers,
      system_prompt: conversation.systemPrompt,
      claude_api_key: aiConfig.claudeApiKey,
      claude_model: aiConfig.claudeModel,
      openai_api_key: aiConfig.openaiApiKey,
      openai_model: aiConfig.openaiModel,
      claude_history: conversation.claudeHistory.length > 0
        ? [...conversation.claudeHistory, { role: "user", content: question }]
        : null,
      openai_history: conversation.openaiHistory.length > 0
        ? [...conversation.openaiHistory, { role: "user", content: question }]
        : null,
    }

    try {
      const response = await fetch("/api/ai/follow-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await response.json()

      if (!response.ok || !data.success) {
        // Rollback user messages
        setConversation((prev) => ({
          ...prev,
          claudeMessages: prev.claudeMessages.filter((_, i) => i < prev.claudeMessages.length - 1),
          openaiMessages: prev.openaiMessages.filter((_, i) => i < prev.openaiMessages.length - 1),
          claudeHistory: prev.claudeHistory.filter((_, i) => i < prev.claudeHistory.length - 1),
          openaiHistory: prev.openaiHistory.filter((_, i) => i < prev.openaiHistory.length - 1),
        }))
        return
      }

      const followupNum = conversation.turnCount

      setConversation((prev) => {
        const next = { ...prev, turnCount: prev.turnCount + 1 }

        if (data.claude?.analysis) {
          next.claudeMessages = [
            ...prev.claudeMessages,
            { role: "assistant", content: data.claude.analysis, label: `Claude (Follow-up #${followupNum})` },
          ]
          next.claudeHistory = [
            ...prev.claudeHistory,
            { role: "user", content: question },
            { role: "assistant", content: data.claude.analysis },
          ]
          next.claudeUsage = {
            input: prev.claudeUsage.input + (data.claude.usage?.input_tokens || 0),
            output: prev.claudeUsage.output + (data.claude.usage?.output_tokens || 0),
          }
        }

        if (data.openai?.analysis) {
          next.openaiMessages = [
            ...prev.openaiMessages,
            { role: "assistant", content: data.openai.analysis, label: `OpenAI (Follow-up #${followupNum})` },
          ]
          next.openaiHistory = [
            ...prev.openaiHistory,
            { role: "user", content: question },
            { role: "assistant", content: data.openai.analysis },
          ]
          next.openaiUsage = {
            input: prev.openaiUsage.input + (data.openai.usage?.prompt_tokens || data.openai.usage?.input_tokens || 0),
            output: prev.openaiUsage.output + (data.openai.usage?.completion_tokens || data.openai.usage?.output_tokens || 0),
          }
        }

        return next
      })
    } catch {
      // Rollback
      setConversation((prev) => ({
        ...prev,
        claudeMessages: prev.claudeMessages.slice(0, -1),
        openaiMessages: prev.openaiMessages.slice(0, -1),
        claudeHistory: prev.claudeHistory.slice(0, -1),
        openaiHistory: prev.openaiHistory.slice(0, -1),
      }))
    } finally {
      setSendingFollowup(false)
    }
  }, [followupText, conversation, aiConfig])

  const handleFollowupKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleFollowup()
    }
  }

  const hasResults = conversation.claudeMessages.length > 0 || conversation.openaiMessages.length > 0
  const showClaude = conversation.providers.includes("claude") || useClaude
  const showOpenai = conversation.providers.includes("openai") || useOpenai

  return (
    <>
      <Header
        title="AI Analysis"
        description="AI-powered performance analysis"
      />
      <div className="space-y-6 p-6">
        {/* Disclaimer */}
        <Card className="border-score-average/30 bg-score-average/5">
          <CardContent className="p-4 text-sm text-foreground">
            <strong>Experimental Feature:</strong> AI-generated analysis is provided for informational
            purposes only. Results may contain inaccuracies and should always be verified.
            <br />
            <strong>Note:</strong> Currently only available for the Lamps Plus site.
          </CardContent>
        </Card>

        {/* AI Config */}
        <AiConfigPanel config={aiConfig} onConfigChange={setAiConfig} />

        {/* Data Source Status */}
        {dataSources && (
          <div className="flex gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${dataSources.newrelic ? "bg-score-good/20 text-score-good" : "bg-score-average/20 text-score-average"}`}>
              New Relic: {dataSources.newrelic ? "Connected" : "No data"}
            </span>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${dataSources.iis_logs ? "bg-score-good/20 text-score-good" : "bg-score-average/20 text-score-average"}`}>
              IIS Logs: {dataSources.iis_logs ? "Connected" : "No data"}
            </span>
          </div>
        )}

        {/* Analysis Inputs */}
        <Card>
          <CardContent className="p-4 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Performance Analysis</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="aiUrlPath">URL Path (for IIS Logs)</Label>
                <Input
                  id="aiUrlPath"
                  value={urlPath}
                  onChange={(e) => setUrlPath(e.target.value)}
                  placeholder="/products/ceiling-fans"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="aiPageUrl">Full Page URL (for CWV)</Label>
                <Input
                  id="aiPageUrl"
                  value={pageUrl}
                  onChange={(e) => setPageUrl(e.target.value)}
                  placeholder="https://www.lampsplus.com/products/ceiling-fans/"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-1.5 w-48">
                <Label>Time Range</Label>
                <Select value={timeRange} onValueChange={setTimeRange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_RANGES.map((tr) => (
                      <SelectItem key={tr.value} value={tr.value}>
                        {tr.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <Checkbox checked={useClaude} onCheckedChange={(v) => setUseClaude(!!v)} />
                  Claude
                </label>
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <Checkbox checked={useOpenai} onCheckedChange={(v) => setUseOpenai(!!v)} />
                  OpenAI
                </label>
              </div>
              <Button onClick={handleAnalyze} disabled={analyzing || !urlPath.trim() || (!useClaude && !useOpenai)}>
                {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {analyzing ? "Analyzing..." : "Analyze"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Loading */}
        {analyzing && <LoadingSpinner message="Gathering data and running AI analysis..." />}

        {/* Results — side by side */}
        {hasResults && !analyzing && (
          <div className={`grid gap-4 ${showClaude && showOpenai ? "sm:grid-cols-2" : ""}`}>
            {showClaude && conversation.claudeMessages.length > 0 && (
              <AnalysisPanel
                provider="Claude"
                model={conversation.claudeModel}
                messages={conversation.claudeMessages}
                tokenUsage={conversation.claudeUsage}
                turnCount={conversation.turnCount}
                loading={sendingFollowup}
                error={conversation.claudeError}
              />
            )}
            {showOpenai && conversation.openaiMessages.length > 0 && (
              <AnalysisPanel
                provider="OpenAI"
                model={conversation.openaiModel}
                messages={conversation.openaiMessages}
                tokenUsage={conversation.openaiUsage}
                turnCount={conversation.turnCount}
                loading={sendingFollowup}
                error={conversation.openaiError}
              />
            )}
          </div>
        )}

        {/* Follow-up */}
        {conversation.active && !analyzing && (
          <Card>
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold text-foreground mb-2">Follow-up Question</h3>
              <div className="flex gap-2">
                <Textarea
                  ref={followupRef}
                  value={followupText}
                  onChange={(e) => setFollowupText(e.target.value)}
                  onKeyDown={handleFollowupKeyDown}
                  placeholder="Ask a follow-up question... (Enter to send, Shift+Enter for newline)"
                  rows={2}
                  disabled={sendingFollowup}
                  className="flex-1"
                />
                <Button
                  onClick={handleFollowup}
                  disabled={sendingFollowup || !followupText.trim()}
                  className="self-end"
                >
                  {sendingFollowup ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}
