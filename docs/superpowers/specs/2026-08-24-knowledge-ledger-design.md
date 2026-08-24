# Pharos Knowledge Ledger Design

Date: 2026-08-24
Status: Approved for planning

## Purpose

Pharos needs a controlled knowledge system for project facts, requirements, rules, decisions, issues, processes, evidence, and open questions. The goal is to capture information as it is discovered, automatically timestamp it, and make it easy to retrieve later through search and, in a later phase, AI answers with citations.

This is not a task dump. Entries are deliberate knowledge records with a small required structure.

## Scope

The first implementation adds a Knowledge area inside Pharos with:

- Multiple domains, with the ability to add new domains.
- Manual-only knowledge entry creation.
- Fixed global entry types.
- One primary domain per entry.
- Editable entries.
- Simple lifecycle statuses.
- Search and filters.

The first implementation does not include document upload, document parsing, generated draft entries, AI question answering, per-user permissions, or full revision history.

## Approach

Use Pharos as the source of truth from the start. Add a dedicated Knowledge page and a backend slice that follows the existing three-layer pattern:

```text
routes/knowledge_api.py -> services/knowledge_service.py -> data_access/knowledge_repository.py
```

The MVP should be intentionally simple, but the database and service boundaries should leave room for two near-term additions:

- AI Q&A that answers only from saved entries and cites source entries.
- Document upload that extracts proposed draft entries for human approval before saving.

## Data Model

### knowledge_domains

- `id`
- `name`
- `description`
- `created_at`
- `updated_at`
- `archived_at`

Rules:

- Domain names are unique.
- Archived domains are hidden by default.
- New entries cannot be created in archived domains.

### knowledge_entries

- `id`
- `domain_id`
- `entry_type`
- `status`
- `title`
- `details`
- `source`
- `tags`
- `created_at`
- `updated_at`

Rules:

- Each entry has exactly one primary domain.
- Required fields are `domain_id`, `entry_type`, `title`, and `details`.
- `source`, `tags`, and `status` are optional at creation.
- If `status` is omitted, default to `Active`.
- Editing happens in place and updates `updated_at`.
- Archiving an entry sets status to `Archived`; it is not hard-deleted.

## Entry Types

Entry types are fixed globally:

- `Requirement`
- `Rule`
- `Decision`
- `Known Issue`
- `Process`
- `Environment Fact`
- `Open Question`
- `Evidence`

Each entry selects one type. The user does not need to fill out every type.

## Statuses

Supported statuses:

- `Draft`
- `Active`
- `Superseded`
- `Archived`

Search defaults to working memory: `Draft`, `Active`, and `Superseded`. `Archived` entries are excluded unless the user enables archived results.

## Search And Filters

The MVP includes keyword search and structured filters.

Search fields:

- `title`
- `details`
- `source`
- `tags`

Filters:

- domain
- entry type
- status
- tag
- include archived

Search should be deterministic and transparent. AI answers come later, after ordinary search and filtering work reliably.

## Frontend UX

Add a new React page at `/knowledge` and a sidebar nav item named `Knowledge`.

Page layout:

- Left rail: domain list, add-domain action, archived-domain visibility.
- Main area: search box, filters, entry list or table, add-entry action.
- Entry editor: domain selector, type selector, status selector, title, details textarea, source field, and tags input.

Editing:

- Entries can be opened and edited in place.
- Save updates `updated_at`.
- Archive is a visible action that changes status to `Archived`.
- Archived entries can be edited only when explicitly opened through archived results.

The page should leave room for a future `Ask Knowledge` tab, but the MVP should not include AI Q&A.

## API

Domains:

- `GET /api/knowledge/domains`
- `POST /api/knowledge/domains`
- `PUT /api/knowledge/domains/<id>`
- `POST /api/knowledge/domains/<id>/archive`

Entries:

- `GET /api/knowledge/entries`
- `POST /api/knowledge/entries`
- `GET /api/knowledge/entries/<id>`
- `PUT /api/knowledge/entries/<id>`
- `POST /api/knowledge/entries/<id>/archive`

The routes should be thin Flask blueprint handlers. Validation belongs in `KnowledgeService`; SQL belongs in `KnowledgeRepository`.

## Validation And Errors

Validation rules:

- Domain name cannot be blank.
- Entry title cannot be blank.
- Entry details cannot be blank.
- Entry type must be one of the fixed global types.
- Entry status must be one of the supported statuses.
- Domain must exist before entry creation.
- Entry creation fails for archived domains.

Errors should use the existing application exception pattern, especially validation errors for invalid user input.

## Future Document Upload

Document upload is deliberately out of MVP scope, but the design should not block it.

Later behavior:

- User uploads selected document types.
- Pharos extracts text and proposes draft entries.
- User reviews, edits, accepts, or rejects each draft.
- Nothing enters the knowledge base automatically.

Likely future tables:

- `knowledge_documents`
- `knowledge_document_chunks`
- `knowledge_entry_sources`

## Future AI Q&A

AI Q&A is deliberately out of MVP scope.

Later behavior:

- User asks a question against selected domains and filters.
- Pharos retrieves matching entries.
- AI answers only from retrieved entries.
- Every claim links back to saved entries.
- If no support exists, Pharos says the answer was not found in the knowledge base.

No citation means no answer.

## Testing

Backend:

- Repository tests for domain CRUD, entry CRUD, archive behavior, and search/filter behavior.
- Service tests for required fields, fixed type validation, status validation, and archived-domain entry blocking.
- API smoke tests for domain and entry endpoints.

Frontend:

- TypeScript build/typecheck.
- Component behavior for creating domains, creating entries, editing entries, archiving entries, and filtering/searching.

## Implementation Notes

Follow existing Pharos conventions:

- React frontend only; do not update legacy `templates/`, `static/css/`, or `static/js/`.
- Keep backend dependencies flowing routes to services to repositories.
- Add enums or constants for entry types and statuses instead of scattering magic strings.
- Keep MVP focused; do not add import, AI, permissions, or revision history in the first pass.
