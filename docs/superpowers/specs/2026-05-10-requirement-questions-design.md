# Requirement Questions Design

## Goal

Add a Migration page named Requirement Questions where QA can ask source-backed questions against curated requirement knowledge bases. The first knowledge base is Calculator, seeded from synced Jira/Asana vault tasks, uploaded requirement documents, and manual QA notes.

## Navigation

- Add Requirement Questions under the Migration section of the sidebar, below Workstreams.
- Route: `/dashboard/requirements`.
- Page title: Requirement Questions.

## First Knowledge Base

Calculator is the pilot KB.

Initial source set:

- Asana `LAMPSPLUS-445` Minimum Price Validation Support.
- Related Asana/Jira tasks identified from the vault, including `LAMPSPLUS-492`, `LAMPSPLUS-458`, `LAMPSPLUS-238`, `ACE2E-221`, `DBADMIN-6393`, `DBADMIN-6395`, `DBADMIN-6389`, `DBADMIN-6662`, `LP-70181`, `ACE2E-52`, and `ACE2E-305`.
- Uploaded docs from `C:\Users\AdamB\Downloads\Minimum Pricing Requirements`.
- Manual QA notes entered in Pharos.

`Discounting Requirements v4.docx` should be treated as the primary uploaded Word document unless a user chooses to preserve version differences.

## User Workflow

The page has four main areas:

- Ask: select KB, ask a question, receive answer with citations.
- Sources: view imported tasks, docs, diagrams, and notes.
- Add Source: add task key/path or upload requirement files.
- Add Note: capture QA knowledge manually.
- Create KB: create a new knowledge base and discover candidate Jira/Asana tasks from the synced vault.

Manual notes require:

- Title.
- Body.
- Category: requirement, test scenario, exception, decision, or open question.
- Optional source/task/doc link.
- Optional tags.

## Create KB From Vault Discovery

Users must be able to create a new KB and ask Pharos to find likely related tasks in the synced Jira/Asana vault.

Workflow:

1. User clicks Create KB.
2. User enters KB name and optional description.
3. User enters search terms or accepts terms derived from the KB name.
4. Pharos searches the configured vault task sources.
5. Pharos presents candidate Jira/Asana tasks with relevance evidence.
6. User can include, exclude, or manually add task keys/paths.
7. User confirms selection.
8. Pharos creates the KB, imports selected task files, chunks them, and indexes them into that KB.

Vault search scope:

- Use the configured `OBSIDIAN_VAULT_ROOT`.
- Search raw Asana task files under `raw/asana/<project>/<section>/*.md`.
- Search raw Jira task files under `raw/<jira-project>/<issue-type>/*.md`.
- Do not use dashboard snapshot summaries as the primary task source.
- Do not use `wiki/` workstream summaries as the primary task source for requirements extraction, except as supplemental navigation context.

Candidate results should show:

- Source system: Jira or Asana.
- Project.
- Task key or source id.
- Title.
- Status and QA/UAT fields when available.
- Source path.
- Matched terms.
- Short snippets showing why it matched.
- Relevance score.

Candidate review actions:

- Include.
- Exclude.
- Add task key/path manually.
- Re-run discovery with different terms.
- Create KB from selected sources.

Discovery must be auditable. The KB should store the search terms used, discovery timestamp, selected candidates, excluded candidates, and any manually added sources.

## Processing

Each source is stored as raw source metadata plus extracted text.

Processing steps:

1. Sanitize content.
2. Split into retrievable chunks.
3. Extract structured facts: requirement, rule, exception, test scenario, decision, and open question.
4. Tag chunks with KB, source type, source id/path, title, version, author/date when available, and confidence.
5. Re-index only the changed source.

Future answers retrieve from the selected KB only. Answers cite the source chunks used. If sources conflict, the answer must say so instead of silently choosing one.

## Uploaded Files

The Requirement Questions page must support uploading files into a selected KB.

Supported source types:

- Word documents: `.docx`
- PDFs: `.pdf`
- Spreadsheets: `.xlsx`, `.xls`, `.csv`
- Lucid/diagram exports: `.json`, `.vsdx`, `.svg`
- Visual fallback images: `.png`, `.jpg`, `.jpeg`

Upload flow:

1. User selects a target KB from a required dropdown.
2. User uploads one or more files.
3. User optionally sets source title, category, and tags.
4. Pharos stores the original file metadata with the selected KB id.
5. Pharos extracts text/structure from each file.
6. Pharos chunks and indexes the extracted content into the selected KB only.
7. Pharos marks each upload as indexed, partially indexed, or needs review.

The upload action is disabled until a KB is selected. Users cannot upload source files into an implicit or global bucket.

After upload, each source must show:

- Target KB.
- Source type.
- Parse/index status.
- Chunk count when indexed.
- Last ingested timestamp.

If the user later changes a source's KB assignment, Pharos must remove that source's chunks from the old KB and re-index them into the new KB.

Parser expectations:

- `.docx`: extract paragraphs/tables as requirement text.
- `.xlsx`, `.xls`, `.csv`: extract sheets/rows into structured table chunks.
- Lucid `.json`: extract diagram shapes, labels, connector edges, and decision paths.
- `.vsdx`: extract diagram text and use as visual/layout validation.
- `.svg`: extract text when available; mark flattened image-based exports as visual-only.
- `.pdf`: extract selectable text when available; mark scanned/image-only exports as visual-only unless OCR is added later.
- images: store as evidence only in the first version; OCR is later scope.

The UI should make parse quality visible, especially for diagrams. Example states:

- Full text extracted.
- Structured diagram extracted.
- Visual-only source.
- Needs review.

## Backend Shape

Follow existing Flask service/repository patterns.

Suggested tables:

- `requirement_knowledge_bases`
- `requirement_sources`
- `requirement_chunks`
- `requirement_notes`
- `requirement_questions`

Suggested services:

- `RequirementKbService`
- `RequirementIngestionService`
- `RequirementQuestionService`

Suggested route module:

- `routes/requirements_api.py`

## Frontend Shape

Suggested page:

- `frontend/src/pages/RequirementQuestions.tsx`

Suggested components:

- `components/requirements/KnowledgeBaseSelector.tsx`
- `components/requirements/QuestionPanel.tsx`
- `components/requirements/SourcesPanel.tsx`
- `components/requirements/AddTaskSourceDialog.tsx`
- `components/requirements/AddNoteDialog.tsx`

The first implementation can seed Calculator from known local vault paths and uploaded docs. Live Jira/Asana/SharePoint sync is later scope.

## Error Handling

- Unknown task key: show not found and suggest Add Note or upload source.
- Unparseable file: store metadata, mark source as needs review.
- No relevant evidence: answer should say the KB does not contain enough information.
- Conflicting evidence: show both claims with citations.

## Verification

- Sidebar shows Requirement Questions below Workstreams.
- `/dashboard/requirements` loads.
- Calculator KB appears.
- Add Note stores and displays a source.
- Known seed sources appear in Sources.
- Question flow refuses unsupported answers and cites evidence for supported answers.
