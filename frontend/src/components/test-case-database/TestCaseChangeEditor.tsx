import { Archive, Download, ExternalLink, FileUp, Plus, Save, Trash2 } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import type {
  TestCaseChange,
  TestCaseChangeAttachment,
  TestCaseChangeLink,
  TestCaseChangePayload,
  TestCaseChangeStatus,
} from "@/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RichTextTextarea } from "@/components/shared/RichTextTextarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const EMPTY_DRAFT: TestCaseChangePayload = {
  test_case_id: "",
  title: "",
  test_case_url: "",
  change_summary: "",
  before_state: "",
  after_state: "",
  changed_by: "",
  change_date: new Date().toISOString().slice(0, 10),
  status: "Active",
  tags: [],
  associated_bugs: [],
  associated_tasks: [],
}

interface TestCaseChangeEditorProps {
  selectedChange: TestCaseChange | null
  attachments: TestCaseChangeAttachment[]
  attachmentsLoading: boolean
  attachmentsUploading: boolean
  saving: boolean
  onSave: (draft: TestCaseChangePayload) => Promise<void>
  onArchive: (changeId: number) => Promise<void>
  onUploadAttachments: (files: File[]) => Promise<void>
  onDownloadAttachment: (attachment: TestCaseChangeAttachment) => Promise<void>
  onDeleteAttachment: (attachmentId: number) => Promise<void>
}

export function TestCaseChangeEditor({
  selectedChange,
  attachments,
  attachmentsLoading,
  attachmentsUploading,
  saving,
  onSave,
  onArchive,
  onUploadAttachments,
  onDownloadAttachment,
  onDeleteAttachment,
}: TestCaseChangeEditorProps) {
  const [draft, setDraft] = useState<TestCaseChangePayload>(EMPTY_DRAFT)
  const nextDraftLinkId = useRef(-1)
  const isSaved = selectedChange !== null
  const isArchived = selectedChange?.archived_at !== null && selectedChange?.archived_at !== undefined

  useEffect(() => {
    if (!selectedChange) {
      setDraft({ ...EMPTY_DRAFT, change_date: new Date().toISOString().slice(0, 10) })
      return
    }

    setDraft({
      test_case_id: selectedChange.test_case_id,
      title: selectedChange.title,
      test_case_url: selectedChange.test_case_url,
      change_summary: selectedChange.change_summary,
      before_state: selectedChange.before_state,
      after_state: selectedChange.after_state,
      changed_by: selectedChange.changed_by,
      change_date: selectedChange.change_date,
      status: selectedChange.status,
      tags: selectedChange.tags,
      associated_bugs: selectedChange.associated_bugs,
      associated_tasks: selectedChange.associated_tasks,
    })
  }, [selectedChange])

  const tagText = useMemo(() => draft.tags.join(", "), [draft.tags])

  function updateField<K extends keyof TestCaseChangePayload>(
    key: K,
    value: TestCaseChangePayload[K]
  ) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  function updateLinks(
    key: "associated_bugs" | "associated_tasks",
    links: TestCaseChangeLink[]
  ) {
    setDraft((current) => ({ ...current, [key]: links }))
  }

  function createDraftLink(): TestCaseChangeLink {
    const id = nextDraftLinkId.current
    nextDraftLinkId.current -= 1
    return { id, label: "", url: "" }
  }

  return (
    <section className="flex h-full min-h-0 flex-col bg-card/40">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-foreground">
            {isSaved ? selectedChange.title : "New test case change"}
          </h2>
          <p className="text-xs text-muted-foreground">
            Manual history for Zephyr test case updates.
          </p>
          {isArchived ? (
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Archive className="size-3.5" aria-hidden="true" />
              Archived changes are read-only.
            </p>
          ) : null}
        </div>
        <div className="flex gap-2">
          {selectedChange && !selectedChange.archived_at ? (
            <Button type="button" variant="outline" onClick={() => void onArchive(selectedChange.id)}>
              Archive
            </Button>
          ) : null}
          <Button
            type="button"
            onClick={() => void onSave(draft)}
            disabled={isArchived || saving || !draft.test_case_id.trim() || !draft.title.trim()}
          >
            <Save className="size-4" aria-hidden="true" />
            {saving ? "Saving" : "Save"}
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-6 overflow-auto p-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              label="Test Case ID"
              value={draft.test_case_id}
              onChange={(value) => updateField("test_case_id", value)}
              disabled={isArchived}
            />
            <Field
              label="Title"
              value={draft.title}
              onChange={(value) => updateField("title", value)}
              disabled={isArchived}
            />
            <LinkField
              label="Test Case URL"
              value={draft.test_case_url}
              placeholder="https://..."
              onChange={(value) => updateField("test_case_url", value)}
              disabled={isArchived}
            />
            <Field
              label="Changed By"
              value={draft.changed_by}
              onChange={(value) => updateField("changed_by", value)}
              disabled={isArchived}
            />
            <Field
              label="Change Date"
              type="date"
              value={draft.change_date}
              onChange={(value) => updateField("change_date", value)}
              disabled={isArchived}
            />
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={draft.status}
                onValueChange={(value) => updateField("status", value as TestCaseChangeStatus)}
                disabled={isArchived}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Draft">Draft</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Superseded">Superseded</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <TextBlock
            label="Change Summary"
            value={draft.change_summary}
            onChange={(value) => updateField("change_summary", value)}
            disabled={isArchived}
          />
          <div className="grid gap-4 lg:grid-cols-2">
            <TextBlock
              label="Before"
              value={draft.before_state}
              onChange={(value) => updateField("before_state", value)}
              disabled={isArchived}
            />
            <TextBlock
              label="After"
              value={draft.after_state}
              onChange={(value) => updateField("after_state", value)}
              disabled={isArchived}
            />
          </div>
          <Field
            label="Tags"
            value={tagText}
            onChange={(value) =>
              updateField(
                "tags",
                value
                  .split(",")
                  .map((tag) => tag.trim())
                  .filter(Boolean)
              )
            }
            disabled={isArchived}
          />
        </div>

        <aside className="space-y-5">
          <LinkRows
            title="Associated Bugs"
            links={draft.associated_bugs}
            onChange={(links) => updateLinks("associated_bugs", links)}
            disabled={isArchived}
            createDraftLink={createDraftLink}
          />
          <LinkRows
            title="Associated Tasks"
            links={draft.associated_tasks}
            onChange={(links) => updateLinks("associated_tasks", links)}
            disabled={isArchived}
            createDraftLink={createDraftLink}
          />
          <Attachments
            disabled={!isSaved || isArchived}
            attachments={attachments}
            loading={attachmentsLoading}
            uploading={attachmentsUploading}
            onUpload={onUploadAttachments}
            onDownload={onDownloadAttachment}
            onDelete={onDeleteAttachment}
          />
        </aside>
      </div>
    </section>
  )
}

function Field({
  label,
  value,
  type = "text",
  onChange,
  disabled = false,
}: {
  label: string
  value: string
  type?: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        type={type}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}

function LinkField({
  label,
  value,
  placeholder,
  onChange,
  disabled = false,
}: {
  label: string
  value: string
  placeholder?: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  const openable = isOpenableHttpUrl(value)

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          type="url"
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
        {openable ? (
          <a
            href={value}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open ${label} in new tab`}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-input bg-transparent text-foreground shadow-xs transition-[color,box-shadow] hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <ExternalLink className="size-4" aria-hidden="true" />
          </a>
        ) : null}
      </div>
    </div>
  )
}

function TextBlock({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <RichTextTextarea
        value={value}
        disabled={disabled}
        onChange={onChange}
        rows={5}
      />
    </div>
  )
}

function LinkRows({
  title,
  links,
  onChange,
  disabled = false,
  createDraftLink,
}: {
  title: string
  links: TestCaseChangeLink[]
  onChange: (links: TestCaseChangeLink[]) => void
  disabled?: boolean
  createDraftLink: () => TestCaseChangeLink
}) {
  return (
    <div className="space-y-2 rounded-md border border-border bg-background/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => onChange([...links, createDraftLink()])}
        >
          <Plus className="size-4" aria-hidden="true" />
          Add
        </Button>
      </div>
      <div className="space-y-2">
        {links.map((link, index) => (
          <div key={link.id ?? `${title}-${link.label}-${link.url}-${index}`} className="grid gap-2">
            <Input
              value={link.label}
              disabled={disabled}
              placeholder="BUG-1234"
              onChange={(event) => {
                const next = [...links]
                next[index] = { ...next[index], label: event.target.value }
                onChange(next)
              }}
            />
            <div className="flex gap-2">
              <Input
                value={link.url}
                disabled={disabled}
                placeholder="https://..."
                onChange={(event) => {
                  const next = [...links]
                  next[index] = { ...next[index], url: event.target.value }
                  onChange(next)
                }}
              />
              {isOpenableHttpUrl(link.url) ? (
                <a
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open ${link.label || title} link`}
                  className="inline-flex size-9 items-center justify-center rounded-md border border-input bg-transparent text-foreground shadow-xs transition-[color,box-shadow] hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <ExternalLink className="size-4" aria-hidden="true" />
                </a>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={disabled}
                onClick={() => onChange(links.filter((_, itemIndex) => itemIndex !== index))}
                aria-label={`Remove ${title} row ${index + 1}`}
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function isOpenableHttpUrl(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) {
    return false
  }

  try {
    const parsed = new URL(trimmed)
    return parsed.protocol === "http:" || parsed.protocol === "https:"
  } catch {
    return false
  }
}

function Attachments({
  disabled,
  attachments,
  loading,
  uploading,
  onUpload,
  onDownload,
  onDelete,
}: {
  disabled: boolean
  attachments: TestCaseChangeAttachment[]
  loading: boolean
  uploading: boolean
  onUpload: (files: File[]) => Promise<void>
  onDownload: (attachment: TestCaseChangeAttachment) => Promise<void>
  onDelete: (attachmentId: number) => Promise<void>
}) {
  return (
    <div className="space-y-2 rounded-md border border-border bg-background/60 p-3">
      <h3 className="text-sm font-semibold">Attachments</h3>
      <Input
        type="file"
        multiple
        disabled={disabled || uploading}
        onChange={(event) => {
          const files = Array.from(event.target.files || [])
          if (files.length) void onUpload(files)
          event.currentTarget.value = ""
        }}
      />
      <p className="text-xs text-muted-foreground">
        {disabled ? "Save the record before adding attachments." : "10 MB limit per file."}
      </p>
      {loading ? <p className="text-xs text-muted-foreground">Loading attachments...</p> : null}
      <div className="space-y-2">
        {attachments.map((attachment) => (
          <div
            key={attachment.id}
            className="flex items-center justify-between gap-2 rounded-md border border-border/70 p-2"
          >
            <span className="min-w-0 truncate text-xs">{attachment.filename}</span>
            <div className="flex gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => void onDownload(attachment)}
              >
                <Download className="size-4" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => void onDelete(attachment.id)}
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        ))}
      </div>
      {uploading ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <FileUp className="size-3" aria-hidden="true" />
          Uploading...
        </p>
      ) : null}
    </div>
  )
}
