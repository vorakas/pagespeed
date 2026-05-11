import { type KeyboardEvent, type MouseEvent, useEffect, useMemo, useRef, useState } from "react"
import { marked } from "marked"
import { renderAsync } from "docx-preview"
import * as XLSX from "xlsx"
import {
  BookOpenCheck,
  CheckCircle2,
  FileUp,
  FileText,
  Loader2,
  MessageSquareText,
  Plus,
  Search,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react"

import { api } from "@/services/api"
import type {
  AiConfig,
  RequirementAnswer,
  RequirementCandidate,
  RequirementCommonQuestion,
  RequirementKnowledgeBase,
  RequirementSource,
} from "@/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useLocalConfig } from "@/hooks/use-local-config"
import { repairJiraMarkdownSource } from "@/lib/markdown-source"
import { cn } from "@/lib/utils"

const DISCOVERY_TERMS_EXAMPLE = "Example: minimum pricing, UMRP, MPR, vendor approval, discount rules"
const ACTION_BUTTON_CLASS = "!bg-white !text-black hover:!bg-white/90 hover:!text-black focus-visible:!text-black [&_svg]:!text-black"
const OUTLINE_ACTION_BUTTON_CLASS = "!bg-white !text-black hover:!bg-white/90 hover:!text-black focus-visible:!text-black [&_svg]:!text-black"
const DEFAULT_AI_CONFIG: AiConfig = {
  claudeApiKey: "",
  claudeModel: "claude-sonnet-4-20250514",
  openaiApiKey: "",
  openaiModel: "gpt-4o",
}

type SourcePreview =
  | { kind: "empty" }
  | { kind: "loading" }
  | { kind: "docx" }
  | { kind: "error"; message: string }
  | { kind: "object"; url: string; mode: "pdf" | "image" | "download" }
  | { kind: "excel"; sheets: Array<{ name: string; rows: string[][] }> }

const IMAGE_ATTACHMENT_RE = /\.(png|jpe?g|gif|webp|svg|bmp)$/i
const VIDEO_ATTACHMENT_RE = /\.(webm|mp4|mov|m4v)$/i

export function RequirementQuestions() {
  const [aiConfig] = useLocalConfig<AiConfig>("aiConfig", DEFAULT_AI_CONFIG)
  const [aiProvider, setAiProvider] = useLocalConfig<"claude" | "openai">("requirementAiProvider", "claude")
  const [knowledgeBases, setKnowledgeBases] = useState<RequirementKnowledgeBase[]>([])
  const [activeKbId, setActiveKbId] = useState<number | null>(null)
  const [uploadKbId, setUploadKbId] = useState<string>("")
  const [sources, setSources] = useState<RequirementSource[]>([])
  const [commonQuestions, setCommonQuestions] = useState<RequirementCommonQuestion[]>([])
  const [question, setQuestion] = useState("")
  const [answer, setAnswer] = useState<RequirementAnswer | null>(null)
  const [kbName, setKbName] = useState("")
  const [kbDescription, setKbDescription] = useState("")
  const [discoveryTerms, setDiscoveryTerms] = useState("")
  const [candidates, setCandidates] = useState<RequirementCandidate[]>([])
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set())
  const [taskPath, setTaskPath] = useState("")
  const [noteTitle, setNoteTitle] = useState("")
  const [noteBody, setNoteBody] = useState("")
  const [noteCategory, setNoteCategory] = useState("requirement")
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploadMessage, setUploadMessage] = useState<string | null>(null)
  const [sourceMessage, setSourceMessage] = useState<string | null>(null)
  const [selectedSource, setSelectedSource] = useState<RequirementSource | null>(null)
  const [sourceToRemove, setSourceToRemove] = useState<RequirementSource | null>(null)
  const [sourcePreview, setSourcePreview] = useState<SourcePreview>({ kind: "empty" })
  const [imagePreview, setImagePreview] = useState<{ src: string; alt: string } | null>(null)
  const [videoPreview, setVideoPreview] = useState<{ src: string; label: string } | null>(null)
  const docxPreviewRef = useRef<HTMLDivElement | null>(null)

  const activeKb = useMemo(
    () => knowledgeBases.find((kb) => kb.id === activeKbId) ?? null,
    [activeKbId, knowledgeBases],
  )
  const uploadKnowledgeBase = useMemo(
    () => knowledgeBases.find((kb) => String(kb.id) === uploadKbId) ?? null,
    [knowledgeBases, uploadKbId],
  )
  const taskSources = useMemo(
    () =>
      sources
        .filter((source) => source.sourceType === "vault_task")
        .sort((a, b) => (b.chunkCount ?? 0) - (a.chunkCount ?? 0)),
    [sources],
  )
  const documentSources = useMemo(
    () =>
      sources
        .filter((source) => source.sourceType !== "vault_task")
        .sort((a, b) => (b.chunkCount ?? 0) - (a.chunkCount ?? 0)),
    [sources],
  )
  const selectedSourceHtml = useMemo(() => {
    if (!selectedSource) return ""
    const repaired = repairJiraMarkdownSource(sourceContent(selectedSource))
    const transformed = transformRequirementAttachments(
      formatRequirementMarkdownSource(repaired),
      selectedSource.sourcePath || "",
    )
    return formatRequirementHtml(marked.parse(transformed, { async: false }) as string)
  }, [selectedSource])
  const selectedSourceShowsOriginalPreview =
    selectedSource != null && selectedSource.sourceType !== "vault_task" && selectedSource.sourceType !== "manual_note"

  useEffect(() => {
    void loadKnowledgeBases(true)
  }, [])

  useEffect(() => {
    if (activeKbId == null) {
      setSources([])
      setCommonQuestions([])
      return
    }
    setUploadKbId(String(activeKbId))
    void loadSources(activeKbId)
    void loadCommonQuestions(activeKbId)
  }, [activeKbId])

  useEffect(() => {
    if (!selectedSource || !activeKbId || !selectedSource.hasOriginalFile) {
      setSourcePreview({ kind: "empty" })
      if (docxPreviewRef.current) docxPreviewRef.current.innerHTML = ""
      return
    }

    const previewSource = selectedSource
    const previewKbId = activeKbId
    let cancelled = false
    let objectUrl: string | null = null
    setSourcePreview({ kind: "loading" })
    if (docxPreviewRef.current) docxPreviewRef.current.innerHTML = ""

    async function loadOriginalPreview() {
      try {
        const blob = await api.getRequirementSourceFile(previewKbId, previewSource.id)
        if (cancelled) return
        const filename = previewSource.originalFilename || previewSource.sourcePath || previewSource.title
        const lower = filename.toLowerCase()
        const mimeType = previewSource.mimeType || blob.type

        if (lower.endsWith(".docx")) {
          if (!cancelled) setSourcePreview({ kind: "docx" })
          requestAnimationFrame(() => {
            if (cancelled || !docxPreviewRef.current) return
            docxPreviewRef.current.innerHTML = ""
            void renderAsync(blob, docxPreviewRef.current, undefined, {
              className: "requirement-docx-preview",
              inWrapper: false,
              ignoreWidth: true,
              ignoreHeight: true,
            }).catch((err: unknown) => {
              if (!cancelled) setSourcePreview({ kind: "error", message: err instanceof Error ? err.message : "Word preview failed" })
            })
          })
          return
        }

        if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
          const workbook = XLSX.read(await blob.arrayBuffer(), { type: "array" })
          const sheets = workbook.SheetNames.slice(0, 4).map((name) => ({
            name,
            rows: (XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, blankrows: false }) as unknown[][])
              .slice(0, 80)
              .map((row) => row.slice(0, 12).map((cell) => String(cell ?? ""))),
          }))
          if (!cancelled) setSourcePreview({ kind: "excel", sheets })
          return
        }

        objectUrl = URL.createObjectURL(blob)
        if (mimeType === "application/pdf" || lower.endsWith(".pdf")) {
          setSourcePreview({ kind: "object", url: objectUrl, mode: "pdf" })
        } else if (mimeType.startsWith("image/") || lower.endsWith(".svg")) {
          setSourcePreview({ kind: "object", url: objectUrl, mode: "image" })
        } else {
          setSourcePreview({ kind: "object", url: objectUrl, mode: "download" })
        }
      } catch (err) {
        if (!cancelled) setSourcePreview({ kind: "error", message: err instanceof Error ? err.message : "Preview failed" })
      }
    }

    void loadOriginalPreview()

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [activeKbId, selectedSource])

  async function loadKnowledgeBases(seedCalculator = false) {
    setLoading(true)
    setError(null)
    try {
      let items = await api.getRequirementKnowledgeBases()
      if (seedCalculator && !items.some((kb) => kb.slug === "calculator")) {
        await api.seedCalculatorKnowledgeBase()
        items = await api.getRequirementKnowledgeBases()
      }
      setKnowledgeBases(items)
      const nextActive = activeKbId ?? items.find((kb) => kb.slug === "calculator")?.id ?? items[0]?.id ?? null
      setActiveKbId(nextActive)
      if (nextActive != null) {
        setUploadKbId(String(nextActive))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load requirement knowledge bases")
    } finally {
      setLoading(false)
    }
  }

  async function loadSources(kbId: number) {
    try {
      setSources(await api.getRequirementSources(kbId))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sources")
    }
  }

  async function loadCommonQuestions(kbId: number) {
    try {
      setCommonQuestions(await api.getRequirementCommonQuestions(kbId))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load common questions")
    }
  }

  async function askQuestion() {
    if (!activeKbId || !question.trim()) return
    const selectedAi =
      aiProvider === "claude"
        ? { provider: "claude" as const, apiKey: aiConfig.claudeApiKey, model: aiConfig.claudeModel }
        : { provider: "openai" as const, apiKey: aiConfig.openaiApiKey, model: aiConfig.openaiModel }
    setBusy("question")
    setError(null)
    try {
      const nextAnswer = await api.askRequirementQuestion(
        activeKbId,
        question.trim(),
        selectedAi.apiKey && selectedAi.model ? selectedAi : undefined,
      )
      setAnswer(nextAnswer)
      await loadCommonQuestions(activeKbId)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Question failed")
    } finally {
      setBusy(null)
    }
  }

  function showCommonQuestion(commonQuestion: RequirementCommonQuestion) {
    setQuestion(commonQuestion.question)
    setAnswer({
      answer: commonQuestion.answer,
      citations: commonQuestion.citations,
      commonQuestionId: commonQuestion.id,
    })
  }

  async function discoverCandidates() {
    const terms = discoveryTerms.split(",").map((term) => term.trim()).filter(Boolean)
    if (!terms.length) return
    setBusy("discover")
    setError(null)
    try {
      const discovered = await api.discoverRequirementCandidates(terms, 60)
      setCandidates(discovered)
      setSelectedCandidates(new Set(discovered.slice(0, 12).map((candidate) => candidate.sourcePath)))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Discovery failed")
    } finally {
      setBusy(null)
    }
  }

  async function createKnowledgeBase() {
    if (!kbName.trim()) return
    const included = candidates.filter((candidate) => selectedCandidates.has(candidate.sourcePath))
    setBusy("create")
    setError(null)
    try {
      const kb = await api.createRequirementKnowledgeBase({
        name: kbName.trim(),
        description: kbDescription.trim(),
        searchTerms: discoveryTerms.split(",").map((term) => term.trim()).filter(Boolean),
        candidates: included,
      })
      const items = await api.getRequirementKnowledgeBases()
      setKnowledgeBases(items)
      setActiveKbId(kb.id)
      setUploadKbId(String(kb.id))
      setKbName("")
      setKbDescription("")
      setCandidates([])
      setSelectedCandidates(new Set())
      await loadSources(kb.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create knowledge base failed")
    } finally {
      setBusy(null)
    }
  }

  async function addTaskSource() {
    if (!activeKbId || !taskPath.trim()) return
    setBusy("task")
    setError(null)
    setSourceMessage(null)
    try {
      await api.addRequirementTaskSource(activeKbId, taskPath.trim())
      setTaskPath("")
      setSourceMessage("Task added to the active knowledge base.")
      await loadSources(activeKbId)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Task import failed")
    } finally {
      setBusy(null)
    }
  }

  async function removeSource() {
    if (!activeKbId || !sourceToRemove) return
    setBusy("remove-source")
    setError(null)
    setSourceMessage(null)
    try {
      await api.removeRequirementSource(activeKbId, sourceToRemove.id)
      setSourceMessage(`${sourceToRemove.title} removed from the active knowledge base.`)
      if (selectedSource?.id === sourceToRemove.id) {
        setSelectedSource(null)
      }
      setSourceToRemove(null)
      await loadSources(activeKbId)
      await loadKnowledgeBases(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Source removal failed")
    } finally {
      setBusy(null)
    }
  }

  async function addNote() {
    if (!activeKbId || !noteTitle.trim() || !noteBody.trim()) return
    setBusy("note")
    setError(null)
    try {
      await api.addRequirementNote(activeKbId, {
        title: noteTitle.trim(),
        body: noteBody.trim(),
        category: noteCategory,
        tags: [],
      })
      setNoteTitle("")
      setNoteBody("")
      await loadSources(activeKbId)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Note save failed")
    } finally {
      setBusy(null)
    }
  }

  async function uploadFiles() {
    const kbId = Number(uploadKbId)
    if (!kbId || files.length === 0) return
    setBusy("upload")
    setError(null)
    setUploadMessage(null)
    try {
      const uploaded = await api.uploadRequirementFiles(kbId, files)
      setFiles([])
      setUploadMessage(`Upload Complete: ${uploaded.length} file${uploaded.length === 1 ? "" : "s"} indexed.`)
      if (kbId === activeKbId) {
        await loadSources(kbId)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setBusy(null)
    }
  }

  function toggleCandidate(sourcePath: string) {
    setSelectedCandidates((current) => {
      const next = new Set(current)
      if (next.has(sourcePath)) {
        next.delete(sourcePath)
      } else {
        next.add(sourcePath)
      }
      return next
    })
  }

  function sourceContent(source: RequirementSource): string {
    const text = source.extractedText?.trim()
    if (text) return text.replace(/^---[\s\S]*?\n---\s*/, "").trim()
    if (source.parseStatus === "visual_only") {
      return "No readable text was extracted from this file. It remains attached to the knowledge base as a visual/reference source."
    }
    return "No source text is available for this item."
  }

  function sourceKindLabel(source: RequirementSource): string {
    if (source.sourceType === "vault_task") return source.sourceSystem || "Task"
    if (source.sourcePath?.toLowerCase().endsWith(".docx")) return "Word Doc"
    if (source.sourcePath?.toLowerCase().endsWith(".pdf")) return "PDF"
    if (source.sourcePath?.toLowerCase().endsWith(".svg")) return "Diagram"
    if (source.sourcePath?.toLowerCase().endsWith(".vsdx")) return "Diagram"
    return source.sourceSystem || "Document"
  }

  function compactTaskTitle(source: RequirementSource): string {
    const id = source.sourceId?.trim()
    if (!id) return source.title
    return source.title
      .replace(new RegExp(`^\\[?${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\]?\\s*[-:]*\\s*`, "i"), "")
      .trim() || source.title
  }

  function formatRequirementMarkdownSource(content: string): string {
    return content
      .replace(
        /^###\s+(.+?\s+(?:--|[-\u2013\u2014])\s+\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})\s*$/gm,
        '<h3 class="rq-comment-header">$1</h3>',
      )
      .replace(
        /\[(@[^\]]+)\]\(([^)]+)\)/g,
        '<a class="rq-mention" href="$2" target="_blank" rel="noreferrer">$1</a>',
      )
      .replace(/(^|[\s(])@([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,3})/g, '$1<span class="rq-mention">@$2</span>')
  }

  function formatRequirementHtml(html: string): string {
    if (!html) return html
    const template = document.createElement("template")
    template.innerHTML = html
    const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT)
    const textNodes: Text[] = []

    while (walker.nextNode()) {
      const node = walker.currentNode as Text
      const parent = node.parentElement
      if (parent?.closest("a, code, pre, script, style, .requirement-attachment-video-button")) continue
      textNodes.push(node)
    }

    for (const node of textNodes) {
      const text = node.nodeValue || ""
      if (!/\bAC\s*\d+\b/.test(text)) continue
      const fragment = document.createDocumentFragment()
      let lastIndex = 0
      const re = /\bAC\s*(\d+)\b(?!\.\w)/g
      let match: RegExpExecArray | null

      while ((match = re.exec(text)) !== null) {
        if (match.index > lastIndex) fragment.append(document.createTextNode(text.slice(lastIndex, match.index)))
        const span = document.createElement("span")
        span.className = "rq-ac-label"
        span.textContent = `AC${match[1]}`
        fragment.append(span)
        lastIndex = match.index + match[0].length
      }
      if (lastIndex < text.length) fragment.append(document.createTextNode(text.slice(lastIndex)))
      node.replaceWith(fragment)
    }

    return template.innerHTML
  }

  function attachmentDisplayNames(target: string, label?: string): string[] {
    const cleanTarget = target.trim()
    const filename = cleanTarget.split("/").pop() || cleanTarget
    const underscoreFilename = filename.includes("_") ? filename.slice(filename.lastIndexOf("_") + 1) : ""
    return [label, filename, underscoreFilename]
      .filter((value): value is string => Boolean(value?.trim()))
      .map((value) => value.trim())
  }

  function normalizeAttachmentCaption(value: string): string {
    return value
      .trim()
      .replace(/^[*_`]+|[*_`]+$/g, "")
      .replace(/^["']+|["']+$/g, "")
      .trim()
      .toLowerCase()
  }

  function isDuplicateAttachmentCaption(value: string, names: string[]): boolean {
    const normalized = normalizeAttachmentCaption(value)
    if (!normalized) return false
    return names.some((name) => normalizeAttachmentCaption(name) === normalized)
  }

  function removeDuplicateAttachmentCaptions(content: string): string {
    const attachmentRe = /!?\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g
    const lines = content.split(/\r?\n/)
    const cleaned: string[] = []
    let previousAttachmentNames: string[] = []

    for (const line of lines) {
      attachmentRe.lastIndex = 0
      const matches = [...line.matchAll(attachmentRe)]

      if (matches.length > 0) {
        const lastMatch = matches[matches.length - 1]
        const target = String(lastMatch[1] || "")
        const label = lastMatch[2] ? String(lastMatch[2]) : undefined
        const names = attachmentDisplayNames(target, label)
        const afterAttachment = line.slice((lastMatch.index ?? 0) + lastMatch[0].length)

        if (isDuplicateAttachmentCaption(afterAttachment, names)) {
          cleaned.push(line.slice(0, (lastMatch.index ?? 0) + lastMatch[0].length).trimEnd())
        } else {
          cleaned.push(line)
        }
        previousAttachmentNames = names
        continue
      }

      if (previousAttachmentNames.length > 0 && isDuplicateAttachmentCaption(line, previousAttachmentNames)) {
        previousAttachmentNames = []
        continue
      }

      cleaned.push(line)
      previousAttachmentNames = []
    }

    return cleaned.join("\n")
  }

  function escapeAttachmentAttribute(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
  }

  function transformRequirementAttachments(content: string, basePath: string): string {
    if (!basePath) return content
    const renderAttachment = (target: string, label?: string) => {
      const cleanTarget = target.trim()
      const cleanLabel = (label || cleanTarget.split("/").pop() || cleanTarget).trim()
      const src = `/api/obsidian/vault/asset?base=${encodeURIComponent(basePath)}&asset=${encodeURIComponent(cleanTarget)}`
      const safeLabel = escapeAttachmentAttribute(cleanLabel)
      const safeSrc = escapeAttachmentAttribute(src)
      if (IMAGE_ATTACHMENT_RE.test(cleanTarget)) {
        return `<img src="${safeSrc}" alt="${safeLabel}" class="requirement-attachment-image" loading="lazy" role="button" tabindex="0" title="Open image preview" data-requirement-preview-src="${safeSrc}" />`
      }
      if (VIDEO_ATTACHMENT_RE.test(cleanTarget)) {
        return `<button type="button" class="requirement-attachment-video-button" data-requirement-video-src="${safeSrc}" data-requirement-video-label="${safeLabel}" title="Open video playback"><span class="requirement-attachment-video-label">${safeLabel}</span><video src="${safeSrc}" class="requirement-attachment-video" muted preload="metadata"></video></button>`
      }
      return `<a href="${safeSrc}" target="_blank" rel="noreferrer" class="requirement-attachment-link">${safeLabel}</a>`
    }

    return removeDuplicateAttachmentCaptions(content)
      .replace(/!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_match, target, label) => renderAttachment(String(target), label ? String(label) : undefined))
      .replace(/(?<!!)\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_match, target, label) => renderAttachment(String(target), label ? String(label) : undefined))
  }

  function openRequirementImagePreview(img: HTMLImageElement) {
    setImagePreview({
      src: img.dataset.requirementPreviewSrc || img.currentSrc || img.src,
      alt: img.alt || "Attachment image",
    })
  }

  function openRequirementVideoPreview(button: HTMLElement) {
    setVideoPreview({
      src: button.dataset.requirementVideoSrc || "",
      label: button.dataset.requirementVideoLabel || "Attachment video",
    })
  }

  function handleSourceContentClick(event: MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement | null
    const img = target?.closest<HTMLImageElement>("img.requirement-attachment-image")
    if (img) {
      openRequirementImagePreview(img)
      return
    }
    const videoButton = target?.closest<HTMLElement>(".requirement-attachment-video-button")
    if (!videoButton) return
    openRequirementVideoPreview(videoButton)
  }

  function handleSourceContentKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter" && event.key !== " ") return
    const target = event.target as HTMLElement | null
    const img = target?.closest<HTMLImageElement>("img.requirement-attachment-image")
    if (img) {
      event.preventDefault()
      openRequirementImagePreview(img)
      return
    }
    const videoButton = target?.closest<HTMLElement>(".requirement-attachment-video-button")
    if (!videoButton) return
    event.preventDefault()
    openRequirementVideoPreview(videoButton)
  }

  function renderOriginalPreview() {
    if (!selectedSource?.hasOriginalFile) {
      return (
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          Original file preview is not available for this source. Re-upload documents to enable original previews.
        </div>
      )
    }
    if (sourcePreview.kind === "loading") {
      return (
        <div className="flex min-h-40 items-center justify-center rounded-lg border bg-muted/25 text-sm text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" />
          Loading original preview...
        </div>
      )
    }
    if (sourcePreview.kind === "error") {
      return <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{sourcePreview.message}</div>
    }
    if (sourcePreview.kind === "docx") {
      return <div ref={docxPreviewRef} className="requirement-docx-preview rounded-lg border bg-white p-4 text-black" />
    }
    if (sourcePreview.kind === "object" && sourcePreview.mode === "pdf") {
      return <iframe title="Source PDF preview" src={sourcePreview.url} className="h-[68vh] w-full rounded-lg border bg-white" />
    }
    if (sourcePreview.kind === "object" && sourcePreview.mode === "image") {
      return (
        <div className="rounded-lg border bg-white p-3">
          <img src={sourcePreview.url} alt={selectedSource.title} className="max-h-[68vh] w-full object-contain" />
        </div>
      )
    }
    if (sourcePreview.kind === "object") {
      return (
        <a href={sourcePreview.url} target="_blank" rel="noreferrer" className="text-sm text-primary underline underline-offset-4">
          Open original file
        </a>
      )
    }
    if (sourcePreview.kind === "excel") {
      return (
        <div className="space-y-4">
          {sourcePreview.sheets.map((sheet) => (
            <div key={sheet.name} className="overflow-hidden rounded-lg border">
              <div className="border-b bg-muted/40 px-3 py-2 text-sm font-medium">{sheet.name}</div>
              <div className="max-h-96 overflow-auto">
                <table className="w-full border-collapse text-xs">
                  <tbody>
                    {sheet.rows.map((row, rowIndex) => (
                      <tr key={`${sheet.name}-${rowIndex}`}>
                        {row.map((cell, cellIndex) => (
                          <td key={`${sheet.name}-${rowIndex}-${cellIndex}`} className="border-b border-r px-2 py-1 align-top">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  if (loading) {
    return (
      <div className="flex min-h-[360px] items-center justify-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Loading requirement knowledge bases...
      </div>
    )
  }

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <section className="space-y-3">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Migration</p>
            <h1 className="font-heading text-2xl font-semibold tracking-normal">Requirement Questions</h1>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Ask source-backed QA questions across curated requirements, synced Jira/Asana tasks, uploaded docs, and manual notes.
            </p>
          </div>
          <Button
            variant="outline"
            className={OUTLINE_ACTION_BUTTON_CLASS}
            onClick={() => void loadKnowledgeBases(true)}
            disabled={busy != null}
          >
            <Sparkles className="size-4" />
            Seed Calculator
          </Button>
        </div>

        <div className="flex flex-wrap gap-2" aria-label="Requirement knowledge bases">
          {knowledgeBases.map((kb) => (
            <button
              key={kb.id}
              type="button"
              onClick={() => setActiveKbId(kb.id)}
              className={cn(
                "inline-flex min-h-9 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors",
                activeKbId === kb.id
                  ? "border-primary !bg-white !text-black hover:!bg-white/90 hover:!text-black"
                  : "border-border !bg-white !text-black hover:!bg-white/90 hover:!text-black",
              )}
            >
              <BookOpenCheck className="size-4" />
              {kb.name}
              <span className="text-xs opacity-75">{kb.sourceCount ?? 0}</span>
            </button>
          ))}
          {knowledgeBases.length === 0 && (
            <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
              No knowledge bases yet. Create one from vault discovery below.
            </div>
          )}
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Ask {activeKb ? activeKb.name : "a Knowledge Base"}</CardTitle>
            <CardDescription>
              Active knowledge base controls retrieval. Answers cite stored source chunks.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Example: When is vendor approval required for minimum pricing?"
              className="min-h-28"
            />
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-52 space-y-1">
                <Label className="text-xs">AI Provider if Needed</Label>
                <Select value={aiProvider} onValueChange={(value) => setAiProvider(value as "claude" | "openai")}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="claude">Claude</SelectItem>
                    <SelectItem value="openai">OpenAI</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {aiProvider === "claude"
                    ? aiConfig.claudeApiKey
                      ? `Configured: ${aiConfig.claudeModel}`
                      : "Claude key not configured; answers will stay knowledge-base only."
                    : aiConfig.openaiApiKey
                      ? `Configured: ${aiConfig.openaiModel}`
                      : "OpenAI key not configured; answers will stay knowledge-base only."}
                </p>
              </div>
              <Button
                className={ACTION_BUTTON_CLASS}
                onClick={() => void askQuestion()}
                disabled={!activeKbId || !question.trim() || busy === "question"}
              >
                {busy === "question" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                Ask
              </Button>
            </div>
            {answer && (
              <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant={answer.apiUsed ? "secondary" : "outline"}>
                    {answer.answerSource === "common_question"
                      ? "Answered from saved FAQ"
                      : answer.apiUsed
                        ? `AI-generated with ${answer.aiProvider === "openai" ? "OpenAI" : "Claude"}`
                        : "Answered from knowledge base search, no API"}
                  </Badge>
                  {answer.usage && (
                    <span>
                      Estimated API cost: ${answer.usage.estimatedCost.toFixed(6)}
                      {answer.aiModel ? ` (${answer.aiModel})` : ""}
                    </span>
                  )}
                </div>
                <div className="whitespace-pre-wrap text-sm leading-relaxed">{answer.answer}</div>
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Citations</p>
                  {answer.citations.map((citation, index) => (
                    <div key={`${citation.sourceId}-${citation.chunkIndex}-${index}`} className="rounded-md border bg-background p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{citation.sourceSystem}</Badge>
                        <span className="text-sm font-medium">{citation.title}</span>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">{citation.sourcePath}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle>Commonly Asked Questions</CardTitle>
              <CardDescription>
                {activeKb ? `${activeKb.name} answers already generated` : "Select a knowledge base to reuse answers"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {commonQuestions.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  No saved answers for this knowledge base yet. Asked questions with citations will appear here.
                </div>
              ) : (
                commonQuestions.slice(0, 8).map((commonQuestion) => (
                  <button
                    key={commonQuestion.id}
                    type="button"
                    onClick={() => showCommonQuestion(commonQuestion)}
                    className="w-full rounded-lg border bg-white p-3 text-left text-black transition-colors hover:bg-white/90 hover:text-black"
                  >
                    <div className="flex items-start gap-2">
                      <MessageSquareText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-medium">{commonQuestion.question}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline">{commonQuestion.usageCount} asks</Badge>
                          <span>{commonQuestion.citations.length} citations</span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle>Sources</CardTitle>
              <CardDescription>
                {activeKb ? `${activeKb.name} indexed evidence` : "Select a knowledge base to inspect sources"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {sourceMessage && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                  {sourceMessage}
                </div>
              )}
              {sources.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  No sources indexed for the active knowledge base yet.
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tasks</p>
                        <p className="text-[11px] text-muted-foreground" title="The number at right is how many indexed chunks this source contributes to search and answers.">
                          Right number = indexed chunks, sorted high to low.
                        </p>
                      </div>
                      <Badge variant="outline">{taskSources.length}</Badge>
                    </div>
                    <div className="max-h-80 space-y-1 overflow-y-auto pr-1">
                      {taskSources.length === 0 ? (
                        <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                          No Jira or Asana task sources.
                        </div>
                      ) : (
                        taskSources.map((source) => (
                          <div key={source.id} className="group/source flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedSource(source)}
                              className="min-w-0 flex-1 rounded-md border border-border/70 bg-background px-2 py-1.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <div className="flex min-w-0 items-center gap-2">
                                <span className="shrink-0 rounded-[4px] border border-violet-300/70 bg-violet-700 px-1.5 py-0.5 font-mono text-[10px] font-semibold leading-none text-white shadow-sm">
                                  {source.sourceId || source.sourceSystem}
                                </span>
                                <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                                  {compactTaskTitle(source)}
                                </span>
                                <span
                                  className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                                  title="Indexed chunks used for retrieval"
                                >
                                  {source.chunkCount ?? 0}
                                </span>
                              </div>
                            </button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                              aria-label={`Remove ${source.title}`}
                              onClick={() => setSourceToRemove(source)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Documents</p>
                        <p className="text-[11px] text-muted-foreground">Click a document to preview indexed content.</p>
                      </div>
                      <Badge variant="outline">{documentSources.length}</Badge>
                    </div>
                    <div className="max-h-80 space-y-1 overflow-y-auto pr-1">
                      {documentSources.length === 0 ? (
                        <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                          No uploaded document sources.
                        </div>
                      ) : (
                        documentSources.map((source) => (
                          <div key={source.id} className="group/source flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedSource(source)}
                              className="min-w-0 flex-1 rounded-md border border-border/70 bg-background px-2 py-1.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <div className="flex min-w-0 items-center gap-2">
                                <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                                <span className="shrink-0 rounded-[4px] border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium leading-none text-muted-foreground">
                                  {sourceKindLabel(source)}
                                </span>
                                <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{source.title}</span>
                                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground" title="Indexed chunks used for retrieval">
                                  {source.chunkCount ?? 0}
                                </span>
                                <Badge variant={source.parseStatus === "indexed" ? "secondary" : "outline"} className="shrink-0 text-[10px]">
                                  {source.parseStatus}
                                </Badge>
                              </div>
                            </button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                              aria-label={`Remove ${source.title}`}
                              onClick={() => setSourceToRemove(source)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Create Knowledge Base</CardTitle>
            <CardDescription>Discover Jira/Asana candidates using terms that identify the requirement area.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input value={kbName} onChange={(event) => setKbName(event.target.value)} placeholder="Knowledge base name, e.g. ATP" />
            <Input value={kbDescription} onChange={(event) => setKbDescription(event.target.value)} placeholder="Optional description" />
            <div className="space-y-2">
              <Label>Search Terms</Label>
              <Textarea
                value={discoveryTerms}
                onChange={(event) => setDiscoveryTerms(event.target.value)}
                className="min-h-20"
                placeholder={DISCOVERY_TERMS_EXAMPLE}
              />
              <p className="text-xs leading-relaxed text-muted-foreground">
                Enter words, phrases, feature names, task labels, or field names that should identify related Jira/Asana tasks.
                Separate terms with commas.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className={OUTLINE_ACTION_BUTTON_CLASS}
                onClick={() => void discoverCandidates()}
                disabled={busy === "discover"}
              >
                {busy === "discover" ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                Discover
              </Button>
              <Button
                className={ACTION_BUTTON_CLASS}
                onClick={() => void createKnowledgeBase()}
                disabled={!kbName.trim() || busy === "create"}
              >
                {busy === "create" ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Create
              </Button>
            </div>
            {candidates.length > 0 && (
              <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
                {candidates.map((candidate) => (
                  <label key={candidate.sourcePath} className="block rounded-lg border p-3 text-sm">
                    <div className="flex gap-2">
                      <input
                        type="checkbox"
                        checked={selectedCandidates.has(candidate.sourcePath)}
                        onChange={() => toggleCandidate(candidate.sourcePath)}
                        className="mt-1 size-4"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{candidate.sourceSystem}</Badge>
                          <span className="font-medium">{candidate.taskKey || candidate.sourceId}</span>
                          <span className="text-xs text-muted-foreground">score {candidate.relevanceScore}</span>
                        </div>
                        <p className="mt-1 line-clamp-2">{candidate.title}</p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">{candidate.sourcePath}</p>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Upload Docs</CardTitle>
            <CardDescription>Choose a knowledge base target before uploading.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label>Target Knowledge Base</Label>
            <Select value={uploadKbId} onValueChange={(value) => setUploadKbId(value ?? "")}>
              <SelectTrigger aria-label="Upload target knowledge base">
                <span className={cn("flex flex-1 text-left", uploadKnowledgeBase ? "text-foreground" : "text-muted-foreground")}>
                  {uploadKnowledgeBase?.name ?? "Select knowledge base"}
                </span>
              </SelectTrigger>
              <SelectContent align="start">
                {knowledgeBases.map((kb) => (
                  <SelectItem key={kb.id} value={String(kb.id)}>
                    {kb.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                id="requirement-doc-upload"
                type="file"
                multiple
                className="sr-only"
                onChange={(event) => {
                  setFiles(Array.from(event.target.files ?? []))
                  setUploadMessage(null)
                }}
                accept=".docx,.pdf,.xlsx,.xls,.csv,.json,.vsdx,.svg,.png,.jpg,.jpeg,.webm,.mp4,.mov,.m4v"
              />
              <Label
                htmlFor="requirement-doc-upload"
                className={cn(
                  OUTLINE_ACTION_BUTTON_CLASS,
                  "inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-input px-4 py-2 text-sm font-medium transition-colors",
                )}
              >
                <FileUp className="size-4" />
                Choose Files
              </Label>
              {files.length > 0 && <span className="text-sm text-muted-foreground">{files.length} selected</span>}
            </div>
            <Button
              className={ACTION_BUTTON_CLASS}
              onClick={() => void uploadFiles()}
              disabled={!uploadKbId || files.length === 0 || busy === "upload"}
            >
              {busy === "upload" ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}
              Upload {files.length ? files.length : ""}
            </Button>
            {uploadMessage && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                {uploadMessage}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Add Knowledge</CardTitle>
            <CardDescription>Add a Jira/Asana task or manual QA note to the active knowledge base.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Task ID</Label>
              <Input
                value={taskPath}
                onChange={(event) => setTaskPath(event.target.value)}
                placeholder="DBADMIN-256 or LAMPSPLUS-123"
              />
              <Button
                variant="outline"
                className={OUTLINE_ACTION_BUTTON_CLASS}
                onClick={() => void addTaskSource()}
                disabled={!activeKbId || !taskPath.trim() || busy === "task"}
              >
                <Plus className="size-4" />
                Add Task
              </Button>
            </div>
            <div className="space-y-2">
              <Label>Manual note</Label>
              <Input value={noteTitle} onChange={(event) => setNoteTitle(event.target.value)} placeholder="Note title" />
              <Select value={noteCategory} onValueChange={(value) => setNoteCategory(value ?? "requirement")}>
                <SelectTrigger aria-label="Note category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="start">
                  <SelectItem value="requirement">Requirement</SelectItem>
                  <SelectItem value="test scenario">Test scenario</SelectItem>
                  <SelectItem value="exception">Exception</SelectItem>
                  <SelectItem value="decision">Decision</SelectItem>
                  <SelectItem value="open question">Open question</SelectItem>
                </SelectContent>
              </Select>
              <Textarea value={noteBody} onChange={(event) => setNoteBody(event.target.value)} className="min-h-24" />
              <Button
                className={ACTION_BUTTON_CLASS}
                onClick={() => void addNote()}
                disabled={!activeKbId || !noteTitle.trim() || !noteBody.trim() || busy === "note"}
              >
                {busy === "note" ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                Save Note
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <Dialog
        open={selectedSource != null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedSource(null)
            setImagePreview(null)
            setVideoPreview(null)
          }
        }}
      >
        <DialogContent className="flex h-[calc(100vh-2rem)] max-h-[calc(100vh-2rem)] grid-rows-none flex-col overflow-hidden sm:max-w-6xl">
          {selectedSource && (
            <>
              <DialogHeader className="shrink-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{sourceKindLabel(selectedSource)}</Badge>
                  <Badge variant={selectedSource.parseStatus === "indexed" ? "secondary" : "outline"}>{selectedSource.parseStatus}</Badge>
                  <Badge variant="outline">{selectedSource.chunkCount ?? 0} chunks</Badge>
                </div>
                <DialogTitle className="leading-snug">{selectedSource.title}</DialogTitle>
                <DialogDescription>
                  {[selectedSource.sourceId, selectedSource.sourceSystem, selectedSource.sourcePath].filter(Boolean).join(" | ")}
                </DialogDescription>
              </DialogHeader>
              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                {selectedSourceShowsOriginalPreview && (
                  <section className="min-h-full space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold">Original Preview</h3>
                      {selectedSource.originalFilename && (
                        <span className="truncate font-mono text-[11px] text-muted-foreground">{selectedSource.originalFilename}</span>
                      )}
                    </div>
                    <div className="min-h-[72vh]">{renderOriginalPreview()}</div>
                  </section>
                )}
                <section className={cn("space-y-2", selectedSourceShowsOriginalPreview && "mt-4")}>
                  <h3 className="text-sm font-semibold">
                    {selectedSource.sourceType === "vault_task" ? "Task Content" : "Indexed Text"}
                  </h3>
                  <div
                    className="requirement-source-md rounded-lg border bg-muted/25 p-4"
                    onClick={handleSourceContentClick}
                    onKeyDown={handleSourceContentKeyDown}
                    dangerouslySetInnerHTML={{ __html: selectedSourceHtml }}
                  />
                </section>
              </div>
              <DialogFooter className="shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  className={OUTLINE_ACTION_BUTTON_CLASS}
                  onClick={() => setSelectedSource(null)}
                >
                  Close
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setSourceToRemove(selectedSource)}
                >
                  <Trash2 className="size-4" />
                  Remove
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={imagePreview != null} onOpenChange={(open) => !open && setImagePreview(null)}>
        <DialogContent className="flex h-[calc(100vh-2rem)] max-h-[calc(100vh-2rem)] grid-rows-none flex-col overflow-hidden sm:max-w-7xl">
          <DialogHeader className="shrink-0">
            <DialogTitle className="leading-snug">{imagePreview?.alt || "Attachment image"}</DialogTitle>
            <DialogDescription>Image attachment preview</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-auto rounded-lg border bg-black/90 p-3">
            {imagePreview && (
              <img
                src={imagePreview.src}
                alt={imagePreview.alt}
                className="mx-auto block max-h-[calc(100vh-10rem)] max-w-full rounded-md bg-white object-contain"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={videoPreview != null} onOpenChange={(open) => !open && setVideoPreview(null)}>
        <DialogContent className="flex h-[calc(100vh-2rem)] max-h-[calc(100vh-2rem)] grid-rows-none flex-col overflow-hidden sm:max-w-7xl">
          <DialogHeader className="shrink-0">
            <DialogTitle className="leading-snug">{videoPreview?.label || "Attachment video"}</DialogTitle>
            <DialogDescription>Video attachment playback</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-auto rounded-lg border bg-black p-3">
            {videoPreview && (
              <video
                src={videoPreview.src}
                className="mx-auto block max-h-[calc(100vh-10rem)] w-full rounded-md bg-black"
                controls
                preload="metadata"
                autoPlay
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={sourceToRemove != null} onOpenChange={(open) => !open && setSourceToRemove(null)}>
        <DialogContent>
          {sourceToRemove && (
            <>
              <DialogHeader>
                <DialogTitle>Remove Source</DialogTitle>
                <DialogDescription>
                  Remove this source from the active knowledge base? The original task or document will not be deleted.
                </DialogDescription>
              </DialogHeader>
              <div className="rounded-lg border bg-muted/25 p-3">
                <div className="text-sm font-medium">{sourceToRemove.title}</div>
                <div className="mt-1 truncate text-xs text-muted-foreground">{sourceToRemove.sourcePath}</div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  className={OUTLINE_ACTION_BUTTON_CLASS}
                  onClick={() => setSourceToRemove(null)}
                  disabled={busy === "remove-source"}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => void removeSource()}
                  disabled={busy === "remove-source"}
                >
                  {busy === "remove-source" ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                  Remove
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
