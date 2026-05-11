# Requirement Questions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Requirement Questions page, persistent requirements KB backend, and seed the first Calculator KB from vault tasks and uploaded requirement documents.

**Architecture:** Follow the existing Flask pattern: route blueprint -> service -> SQLite/Postgres via `ConnectionManager`. The frontend uses the existing React/Vite route and API client patterns. The first question flow uses deterministic retrieval and citations so it works without new API keys.

**Tech Stack:** Flask, SQLite/Postgres-compatible SQL, Python `unittest`, React 19, TypeScript, Vite, Tailwind, shadcn/base-ui components.

---

### Task 1: Backend Tests

**Files:**
- Create: `tests/test_requirement_kb_service.py`

- [ ] Write failing `unittest` coverage for creating a KB, adding a source/chunks, discovering vault tasks, and retrieving cited answer snippets.
- [ ] Run `python -m unittest tests.test_requirement_kb_service -v`; expected to fail because service does not exist.

### Task 2: Backend Storage And Service

**Files:**
- Modify: `data_access/connection.py`
- Create: `services/requirement_kb_service.py`

- [ ] Add requirement KB tables in schema initialization.
- [ ] Implement source/chunk/note persistence, Calculator seed, vault discovery, file text extraction, and deterministic question retrieval.
- [ ] Run backend tests; expected pass.

### Task 3: API Blueprint

**Files:**
- Create: `routes/requirements_api.py`
- Modify: `routes/__init__.py`
- Modify: `app.py`

- [ ] Register requirements API blueprint.
- [ ] Expose endpoints for KB list, create, seed Calculator, discover candidates, add selected task sources, add note, upload files, list sources, and ask question.
- [ ] Run backend tests and a smoke import of `create_app`.

### Task 4: Frontend API And Types

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/services/api.ts`

- [ ] Add requirement KB/source/candidate/question types.
- [ ] Add API client methods for all new endpoints.
- [ ] Run `npm run typecheck`; expected fail until page is added.

### Task 5: Requirement Questions Page

**Files:**
- Create: `frontend/src/pages/RequirementQuestions.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/layout/AppSidebar.tsx`

- [ ] Add `/dashboard/requirements` route.
- [ ] Add Migration sidebar link below Workstreams.
- [ ] Build top KB pill selector, ask panel, source panel, create KB discovery flow, upload form, add task form, and add note form.
- [ ] Run `npm run typecheck` and `npm run build`.

### Task 6: Verification

**Files:**
- No new files.

- [ ] Run `python -m unittest tests.test_requirement_kb_service -v`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run build`.
- [ ] Start local app if feasible and report URL.

