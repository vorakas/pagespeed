import { Download, ExternalLink, FileUp, Plus, Save, Trash2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

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
  const isSaved = selectedChange !== null

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
            disabled={saving || !draft.test_case_id.trim() || !draft.title.trim()}
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
            />
            <Field label="Title" value={draft.title} onChange={(value) => updateField("title", value)} />
            <Field
              label="Test Case URL"
              value={draft.test_case_url}
              onChange={(value) => updateField("test_case_url", value)}
            />
            <Field
              label="Changed By"
              value={draft.changed_by}
              onChange={(value) => updateField("changed_by", value)}
            />
            <Field
              label="Change Date"
              type="date"
              value={draft.change_date}
              onChange={(value) => updateField("change_date", value)}
            />
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={draft.status}
                onValueChange={(value) => updateField("status", value as TestCaseChangeStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Draft">Draft</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Superseded">Superseded</SelectItem>
                  <SelectItem value="Archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <TextBlock
            label="Change Summary"
            value={draft.change_summary}
            onChange={(value) => updateField("change_summary", value)}
          />
          <div className="grid gap-4 lg:grid-cols-2">
            <TextBlock
              label="Before"
              value={draft.before_state}
              onChange={(value) => updateField("before_state", value)}
            />
            <TextBlock
              label="After"
              value={draft.after_state}
              onChange={(value) => updateField("after_state", value)}
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
          />
        </div>

        <aside className="space-y-5">
          <LinkRows
            title="Associated Bugs"
            links={draft.associated_bugs}
            onChange={(links) => updateLinks("associated_bugs", links)}
          />
          <LinkRows
            title="Associated Tasks"
            links={draft.associated_tasks}
            onChange={(links) => updateLinks("associated_tasks", links)}
          />
          <Attachments
            disabled={!isSaved}
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
}: {
  label: string
  value: string
  type?: string
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  )
}

function TextBlock({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Textarea value={value} onChange={(event) => onChange(event.target.value)} rows={5} />
    </div>
  )
}

function LinkRows({
  title,
  links,
  onChange,
}: {
  title: string
  links: TestCaseChangeLink[]
  onChange: (links: TestCaseChangeLink[]) => void
}) {
  return (
    <div className="space-y-2 rounded-md border border-border bg-background/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...links, { label: "", url: "" }])}
        >
          <Plus className="size-4" aria-hidden="true" />
          Add
        </Button>
      </div>
      <div className="space-y-2">
        {links.map((link, index) => (
          <div key={index} className="grid gap-2">
            <Input
              value={link.label}
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
                placeholder="https://..."
                onChange={(event) => {
                  const next = [...links]
                  next[index] = { ...next[index], url: event.target.value }
                  onChange(next)
                }}
              />
              {link.url ? (
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
