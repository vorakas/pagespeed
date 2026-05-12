"""Requirement knowledge-base ingestion, discovery, and retrieval."""

from __future__ import annotations

import csv
import html
import io
import json
import mimetypes
import re
import zipfile
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any
from xml.etree import ElementTree as ET

from data_access.connection import ConnectionManager
from exceptions import ValidationError
from services.ai_claude import ClaudeClient
from services.ai_openai import OpenAIClient
from services.ai_usage import estimate_ai_cost, normalize_provider, should_use_ai_for_requirement_question


@dataclass(frozen=True)
class SourceText:
    text: str
    parse_status: str
    metadata: dict[str, Any]


class RequirementKbService:
    """Owns requirement KB persistence and source ingestion."""

    CALCULATOR_TERMS = [
        "minimum pricing",
        "minimum price",
        "mpr",
        "umrp",
        "discount",
        "discounting",
        "vendor approval",
        "DiscountRequirement",
        "OnlineDiscountRequirement",
        "QuantityRestriction",
        "OnlineQuantityRestriction",
        "InternetDiscounting",
        "StoreDiscount",
        "OnlineCoupon",
        "lp_quote_minimum_price",
        "consumer_discount_requirement",
        "calculator",
    ]

    CALCULATOR_DOC_NAMES = [
        "Discounting Requirements v4.docx",
        "Discounting Requirements v3.docx",
        "Discounting Requirements v2.docx",
        "Discounting Requirements.docx",
        "AC Minimum Pricing Logic v3.json",
        "AC Minimum Pricing Logic v3.vsdx",
        "minimum-pricing-flow-kb.md",
    ]

    CALCULATOR_SEED_KEYS = {
        "LAMPSPLUS-445",
        "LAMPSPLUS-492",
        "LAMPSPLUS-458",
        "LAMPSPLUS-238",
        "ACE2E-221",
        "DBADMIN-6393",
        "DBADMIN-6395",
        "DBADMIN-6389",
        "DBADMIN-6662",
        "LP-70181",
        "ACE2E-52",
        "ACE2E-305",
    }

    def __init__(self, conn_mgr: ConnectionManager, vault_root: str | Path | None = None) -> None:
        self.conn_mgr = conn_mgr
        self.vault_root = Path(vault_root) if vault_root else None

    # ------------------------------------------------------------------
    # KB lifecycle
    # ------------------------------------------------------------------

    def list_knowledge_bases(self) -> list[dict[str, Any]]:
        ph = self.conn_mgr.placeholder()
        with self.conn_mgr.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                SELECT kb.*,
                       COUNT(DISTINCT src.id) AS source_count,
                       COUNT(DISTINCT ch.id) AS chunk_count
                FROM requirement_knowledge_bases kb
                LEFT JOIN requirement_sources src ON src.kb_id = kb.id
                LEFT JOIN requirement_chunks ch ON ch.kb_id = kb.id
                GROUP BY kb.id
                ORDER BY kb.name
                """
            )
            rows = self.conn_mgr.rows_to_dicts(cursor)
        for row in rows:
            row["sourceCount"] = int(row.pop("source_count", 0) or 0)
            row["chunkCount"] = int(row.pop("chunk_count", 0) or 0)
        return rows

    def create_knowledge_base(
        self,
        name: str,
        description: str = "",
    ) -> dict[str, Any]:
        clean_name = name.strip()
        if not clean_name:
            raise ValidationError("Knowledge base name is required")

        slug = self._slugify(clean_name)
        with self.conn_mgr.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"SELECT * FROM requirement_knowledge_bases WHERE slug = {self.conn_mgr.placeholder()}",
                (slug,),
            )
            existing = self.conn_mgr.row_to_dict(cursor)
            if existing:
                return existing

            cursor.execute(
                f"""
                INSERT INTO requirement_knowledge_bases (name, slug, description)
                VALUES ({self.conn_mgr.placeholder()}, {self.conn_mgr.placeholder()}, {self.conn_mgr.placeholder()})
                {self.conn_mgr.returning_id()}
                """,
                (clean_name, slug, description.strip()),
            )
            kb_id = self.conn_mgr.last_insert_id(cursor)
            cursor.execute("SELECT * FROM requirement_knowledge_bases WHERE id = " + self.conn_mgr.placeholder(), (kb_id,))
            return self.conn_mgr.row_to_dict(cursor) or {"id": kb_id, "name": clean_name, "slug": slug}

    def create_knowledge_base_from_candidates(
        self,
        name: str,
        description: str,
        search_terms: list[str],
        candidates: list[dict[str, Any]],
    ) -> dict[str, Any]:
        kb = self.create_knowledge_base(name, description)
        self._store_discovery_run(kb["id"], search_terms, candidates)
        for candidate in candidates:
            source_path = candidate.get("sourcePath") or candidate.get("source_path")
            if source_path:
                self.add_vault_source(kb["id"], source_path)
        return self.get_knowledge_base(kb["id"])

    def get_knowledge_base(self, kb_id: int) -> dict[str, Any]:
        with self.conn_mgr.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM requirement_knowledge_bases WHERE id = " + self.conn_mgr.placeholder(), (kb_id,))
            row = self.conn_mgr.row_to_dict(cursor)
        if not row:
            raise ValidationError("Knowledge base not found")
        return row

    def ensure_calculator_seed(self) -> dict[str, Any]:
        kb = self.create_knowledge_base(
            "Calculator",
            "Minimum pricing, discounting, and financial calculator requirements.",
        )
        candidates = self.discover_candidates(self.CALCULATOR_TERMS, limit=40)
        selected = [
            candidate
            for candidate in candidates
            if candidate["relevanceScore"] >= 5
            or candidate.get("taskKey") in self.CALCULATOR_SEED_KEYS
        ][:24]
        self._store_discovery_run(kb["id"], self.CALCULATOR_TERMS, selected)
        for candidate in selected:
            self.add_vault_source(kb["id"], candidate["sourcePath"])
        for key in self.CALCULATOR_SEED_KEYS:
            for source_path in self._find_vault_paths_by_key(key):
                self.add_vault_source(kb["id"], source_path)
        for file_path in self._calculator_document_paths():
            if file_path.exists():
                source = self._extract_file(file_path.name, file_path.read_bytes())
                self._upsert_source(
                    kb["id"],
                    source_type="uploaded_file",
                    source_system="File",
                    source_id=file_path.name,
                    title=file_path.stem,
                    source_path=str(file_path),
                    source_text=source,
                )
        return self.get_knowledge_base(kb["id"])

    # ------------------------------------------------------------------
    # Discovery
    # ------------------------------------------------------------------

    def discover_candidates(self, terms: list[str], limit: int = 50) -> list[dict[str, Any]]:
        clean_terms = [term.strip() for term in terms if term.strip()]
        if not clean_terms:
            raise ValidationError("At least one search term is required")
        if not self.vault_root or not self.vault_root.exists():
            return []

        candidates: list[dict[str, Any]] = []
        for path in self._iter_vault_task_files():
            try:
                text = path.read_text(encoding="utf-8", errors="ignore")
            except OSError:
                continue
            rel_path = self._rel_vault_path(path)
            score, matched_terms = self._score_text(path.name + "\n" + text, clean_terms)
            if score <= 0:
                continue
            frontmatter = self._frontmatter(text)
            title = self._title_from_text(path, text)
            source_system, project, section = self._source_parts(rel_path)
            snippets = self._snippets(text, clean_terms)
            candidates.append(
                {
                    "sourceSystem": source_system,
                    "project": project,
                    "section": section,
                    "taskKey": self._task_key(title, path.name),
                    "sourceId": self._task_key(title, path.name) or path.stem,
                    "title": title,
                    "sourcePath": rel_path,
                    "status": frontmatter.get("task_status") or frontmatter.get("status") or "",
                    "uatStatus": frontmatter.get("uat_status") or "",
                    "e2eStatus": frontmatter.get("e2e_status") or "",
                    "matchedTerms": matched_terms,
                    "snippets": snippets,
                    "relevanceScore": score,
                }
            )
        candidates.sort(key=lambda item: (-item["relevanceScore"], item["sourceSystem"], item["sourcePath"]))
        return candidates[:limit]

    def add_vault_source(self, kb_id: int, source_path: str) -> dict[str, Any]:
        if not self.vault_root:
            raise ValidationError("Vault root is not configured")
        safe_rel = self._resolve_vault_reference(source_path)
        path = (self.vault_root / safe_rel).resolve()
        try:
            path.relative_to(self.vault_root.resolve())
        except ValueError as exc:
            raise ValidationError("Source path must stay inside the vault") from exc
        if not path.exists():
            raise ValidationError(f"Source not found: {source_path}")

        text = path.read_text(encoding="utf-8", errors="ignore")
        title = self._title_from_text(path, text)
        source_system, _project, _section = self._source_parts(safe_rel)
        source_text = SourceText(
            text=text,
            parse_status="indexed",
            metadata={"sourcePath": safe_rel, "frontmatter": self._frontmatter(text)},
        )
        return self._upsert_source(
            kb_id,
            source_type="vault_task",
            source_system=source_system,
            source_id=self._task_key(title, path.name) or path.stem,
            title=title,
            source_path=safe_rel,
            source_text=source_text,
        )

    # ------------------------------------------------------------------
    # User-added sources
    # ------------------------------------------------------------------

    def add_note(
        self,
        kb_id: int,
        title: str,
        body: str,
        category: str,
        tags: list[str] | None = None,
        source_link: str = "",
    ) -> dict[str, Any]:
        if not title.strip() or not body.strip():
            raise ValidationError("Note title and body are required")
        source_text = SourceText(
            text=body.strip(),
            parse_status="indexed",
            metadata={"category": category, "tags": tags or [], "sourceLink": source_link},
        )
        source = self._upsert_source(
            kb_id,
            source_type="manual_note",
            source_system="Manual",
            source_id=f"manual-{self._slugify(title)}",
            title=title.strip(),
            source_path=source_link.strip(),
            source_text=source_text,
        )
        with self.conn_mgr.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                INSERT INTO requirement_notes (kb_id, source_id, title, body, category, tags_json, source_link)
                VALUES ({self._ph(7)})
                {self.conn_mgr.returning_id()}
                """,
                (kb_id, source["id"], title.strip(), body.strip(), category, json.dumps(tags or []), source_link.strip()),
            )
            note_id = self.conn_mgr.last_insert_id(cursor)
        source["noteId"] = note_id
        return source

    def ingest_uploaded_file(self, kb_id: int, filename: str, payload: bytes, title: str = "") -> dict[str, Any]:
        if not filename:
            raise ValidationError("Filename is required")
        source_text = self._extract_file(filename, payload)
        return self._upsert_source(
            kb_id,
            source_type="uploaded_file",
            source_system="File",
            source_id=filename,
            title=title.strip() or Path(filename).stem,
            source_path=filename,
            source_text=source_text,
            original_filename=filename,
            mime_type=self._mime_type(filename),
            file_payload=payload,
        )

    def list_sources(self, kb_id: int | None = None) -> list[dict[str, Any]]:
        params: tuple[Any, ...] = ()
        where = ""
        if kb_id is not None:
            where = "WHERE src.kb_id = " + self.conn_mgr.placeholder()
            params = (kb_id,)
        with self.conn_mgr.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                SELECT src.id,
                       src.kb_id,
                       src.source_type,
                       src.source_system,
                       src.source_id,
                       src.title,
                       src.source_path,
                       src.parse_status,
                       src.metadata_json,
                       src.extracted_text,
                       src.original_filename,
                       src.mime_type,
                       src.file_size,
                       CASE WHEN src.file_bytes IS NULL THEN NULL ELSE 1 END AS file_bytes,
                       src.created_at,
                       src.ingested_at,
                       kb.name AS kb_name,
                       (
                         SELECT COUNT(*)
                         FROM requirement_chunks ch
                         WHERE ch.source_id = src.id
                       ) AS chunk_count
                FROM requirement_sources src
                JOIN requirement_knowledge_bases kb ON kb.id = src.kb_id
                {where}
                ORDER BY src.ingested_at DESC, src.id DESC
                """,
                params,
            )
            rows = self.conn_mgr.rows_to_dicts(cursor)
        return [self._source_api(row) for row in rows]

    def remove_source(self, kb_id: int, source_id: int) -> dict[str, Any]:
        self.get_knowledge_base(kb_id)
        with self.conn_mgr.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                SELECT id, title
                FROM requirement_sources
                WHERE kb_id = {self.conn_mgr.placeholder()} AND id = {self.conn_mgr.placeholder()}
                """,
                (kb_id, source_id),
            )
            source = self.conn_mgr.row_to_dict(cursor)
            if not source:
                raise ValidationError("Source not found")

            cursor.execute("DELETE FROM requirement_chunks WHERE source_id = " + self.conn_mgr.placeholder(), (source_id,))
            cursor.execute("DELETE FROM requirement_notes WHERE source_id = " + self.conn_mgr.placeholder(), (source_id,))
            cursor.execute(
                f"""
                DELETE FROM requirement_sources
                WHERE kb_id = {self.conn_mgr.placeholder()} AND id = {self.conn_mgr.placeholder()}
                """,
                (kb_id, source_id),
            )
        return {"removed": True, "sourceId": source_id, "title": source.get("title")}

    def get_source_file(self, kb_id: int, source_id: int) -> dict[str, Any]:
        self.get_knowledge_base(kb_id)
        with self.conn_mgr.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                SELECT original_filename, mime_type, file_size, file_bytes
                FROM requirement_sources
                WHERE kb_id = {self.conn_mgr.placeholder()} AND id = {self.conn_mgr.placeholder()}
                """,
                (kb_id, source_id),
            )
            row = self.conn_mgr.row_to_dict(cursor)
        if not row or not row.get("file_bytes"):
            raise ValidationError("Original file is not available for this source")
        payload = row["file_bytes"]
        if isinstance(payload, memoryview):
            payload = payload.tobytes()
        return {
            "filename": row.get("original_filename") or f"requirement-source-{source_id}",
            "mimeType": row.get("mime_type") or "application/octet-stream",
            "fileSize": row.get("file_size") or len(payload),
            "payload": bytes(payload),
        }

    def list_common_questions(self, kb_id: int) -> list[dict[str, Any]]:
        self.get_knowledge_base(kb_id)
        with self.conn_mgr.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                SELECT *
                FROM requirement_common_questions
                WHERE kb_id = {self.conn_mgr.placeholder()}
                ORDER BY usage_count DESC, last_asked_at DESC, id DESC
                """,
                (kb_id,),
            )
            rows = self.conn_mgr.rows_to_dicts(cursor)
        return [self._common_question_api(row) for row in rows]

    # ------------------------------------------------------------------
    # Questions
    # ------------------------------------------------------------------

    def ask_question(
        self,
        kb_id: int,
        question: str,
        limit: int = 10,
        ai_options: dict[str, Any] | None = None,
        answer_mode: str = "auto",
    ) -> dict[str, Any]:
        terms = self._question_terms(question)
        if not terms:
            raise ValidationError("Question is required")

        mode = (answer_mode or "auto").strip().lower()
        if mode not in {"auto", "exact", "summary"}:
            mode = "auto"

        saved = self._get_saved_common_question(kb_id, question) if mode != "summary" else None
        if saved:
            saved["answerSource"] = "common_question"
            saved["apiUsed"] = False
            saved["commonQuestionId"] = saved.get("id")
            return saved

        with self.conn_mgr.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                SELECT ch.*, src.title, src.source_type, src.source_system, src.source_path
                FROM requirement_chunks ch
                JOIN requirement_sources src ON src.id = ch.source_id
                WHERE ch.kb_id = {self.conn_mgr.placeholder()}
                """,
                (kb_id,),
            )
            chunks = self.conn_mgr.rows_to_dicts(cursor)

        chunk_index = {}
        for chunk in chunks:
            chunk_index[(chunk["source_id"], chunk["chunk_index"])] = chunk

        scored = []
        for chunk in chunks:
            score, matched = self._score_text(chunk["content"], terms)
            if score > 0:
                scored.append((score, matched, chunk))
        scored.sort(key=lambda item: -item[0])
        top = scored[:limit]

        seen = {(c["source_id"], c["chunk_index"]) for _, _, c in top}
        expanded = []
        for score, matched, chunk in top:
            src_id = chunk["source_id"]
            idx = chunk["chunk_index"]
            prev_key = (src_id, idx - 1)
            if prev_key not in seen:
                prev = chunk_index.get(prev_key)
                if prev:
                    seen.add(prev_key)
                    n_score, n_matched = self._score_text(prev["content"], terms)
                    expanded.append((n_score, n_matched or matched, prev))
            expanded.append((score, matched, chunk))
            next_key = (src_id, idx + 1)
            if next_key not in seen:
                nxt = chunk_index.get(next_key)
                if nxt:
                    seen.add(next_key)
                    n_score, n_matched = self._score_text(nxt["content"], terms)
                    expanded.append((n_score, n_matched or matched, nxt))
        top = expanded

        if not top:
            return {
                "answer": "This knowledge base does not contain enough information to answer that question.",
                "citations": [],
                "answerSource": "kb_search",
                "apiUsed": False,
            }

        citations = self._citations_from_top(top)
        score_payload = [{"score": score, "matchedTerms": matched} for score, matched, _chunk in top]
        use_ai = mode == "summary" or (
            mode == "auto" and should_use_ai_for_requirement_question(question, score_payload)
        )
        if use_ai:
            ai_answer = self._try_ai_answer(
                kb_id,
                question,
                top,
                citations,
                ai_options or {},
                save_common=mode != "summary",
            )
            if ai_answer:
                return ai_answer

        answer_lines = ["I found these relevant requirement notes:"]
        for score, matched, chunk in top:
            snippet = self._clean(chunk["content"])
            answer_lines.append(f"- {snippet}")
        answer = {"answer": "\n".join(answer_lines), "citations": citations, "answerSource": "kb_search", "apiUsed": False}
        if mode != "summary":
            common_question = self._save_common_question(kb_id, question.strip(), answer["answer"], citations)
            answer["commonQuestionId"] = common_question["id"]
        return answer

    def rechunk_knowledge_base(self, kb_id: int) -> dict[str, Any]:
        self.get_knowledge_base(kb_id)
        with self.conn_mgr.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"SELECT * FROM requirement_sources WHERE kb_id = {self.conn_mgr.placeholder()}",
                (kb_id,),
            )
            sources = self.conn_mgr.rows_to_dicts(cursor)
            total_chunks = 0
            for source in sources:
                source_id = source["id"]
                text = source.get("extracted_text") or ""
                cursor.execute(
                    "DELETE FROM requirement_chunks WHERE source_id = " + self.conn_mgr.placeholder(),
                    (source_id,),
                )
                for idx, chunk in enumerate(self._chunk_text(text)):
                    cursor.execute(
                        f"""
                        INSERT INTO requirement_chunks (kb_id, source_id, chunk_index, heading, content, token_count, metadata_json)
                        VALUES ({self._ph(7)})
                        """,
                        (
                            kb_id,
                            source_id,
                            idx,
                            chunk["heading"],
                            chunk["content"],
                            len(chunk["content"].split()),
                            json.dumps(chunk.get("metadata", {})),
                        ),
                    )
                    total_chunks += 1
            conn.commit()
        return {"rechunked": True, "sources": len(sources), "chunks": total_chunks}

    def list_ai_usage_summary(self) -> dict[str, Any]:
        with self.conn_mgr.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT provider, model, feature,
                       COUNT(*) AS call_count,
                       COALESCE(SUM(input_tokens), 0) AS input_tokens,
                       COALESCE(SUM(output_tokens), 0) AS output_tokens,
                       COALESCE(SUM(estimated_cost), 0) AS estimated_cost
                FROM ai_api_usage
                GROUP BY provider, model, feature
                ORDER BY estimated_cost DESC
                """
            )
            totals = self.conn_mgr.rows_to_dicts(cursor)
            cursor.execute(
                """
                SELECT id, feature, provider, model, input_tokens, output_tokens,
                       estimated_cost, metadata_json, created_at
                FROM ai_api_usage
                ORDER BY created_at DESC, id DESC
                LIMIT 20
                """
            )
            recent = self.conn_mgr.rows_to_dicts(cursor)

        normalized_totals = []
        for row in totals:
            normalized_totals.append(
                {
                    "provider": row["provider"],
                    "model": row["model"],
                    "feature": row["feature"],
                    "callCount": int(row["call_count"] or 0),
                    "inputTokens": int(row["input_tokens"] or 0),
                    "outputTokens": int(row["output_tokens"] or 0),
                    "estimatedCost": float(row["estimated_cost"] or 0),
                }
            )

        normalized_recent = []
        for row in recent:
            try:
                metadata = json.loads(row.get("metadata_json") or "{}")
            except json.JSONDecodeError:
                metadata = {}
            normalized_recent.append(
                {
                    "id": row["id"],
                    "feature": row["feature"],
                    "provider": row["provider"],
                    "model": row["model"],
                    "inputTokens": int(row["input_tokens"] or 0),
                    "outputTokens": int(row["output_tokens"] or 0),
                    "estimatedCost": float(row["estimated_cost"] or 0),
                    "metadata": metadata,
                    "createdAt": row["created_at"],
                }
            )

        return {
            "totals": normalized_totals,
            "recent": normalized_recent,
            "estimatedCost": float(sum(item["estimatedCost"] for item in normalized_totals)),
        }

    # ------------------------------------------------------------------
    # Persistence internals
    # ------------------------------------------------------------------

    def _get_saved_common_question(self, kb_id: int, question: str) -> dict[str, Any] | None:
        normalized = self._normalize_question(question)
        if not normalized:
            return None
        with self.conn_mgr.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                SELECT *
                FROM requirement_common_questions
                WHERE kb_id = {self.conn_mgr.placeholder()}
                  AND normalized_question = {self.conn_mgr.placeholder()}
                """,
                (kb_id, normalized),
            )
            existing = self.conn_mgr.row_to_dict(cursor)
            if not existing:
                return None
            cursor.execute(
                f"""
                UPDATE requirement_common_questions
                SET usage_count = usage_count + 1,
                    last_asked_at = CURRENT_TIMESTAMP
                WHERE id = {self.conn_mgr.placeholder()}
                """,
                (existing["id"],),
            )
            cursor.execute(
                "SELECT * FROM requirement_common_questions WHERE id = " + self.conn_mgr.placeholder(),
                (existing["id"],),
            )
            row = self.conn_mgr.row_to_dict(cursor)
        return self._common_question_api(row or {})

    def _citations_from_top(self, top: list[tuple[int, list[str], dict[str, Any]]]) -> list[dict[str, Any]]:
        citations = []
        for _score, matched, chunk in top:
            snippet = self._clean(chunk["content"])
            citations.append(
                {
                    "sourceId": chunk["source_id"],
                    "sourceType": chunk["source_type"],
                    "sourceSystem": chunk["source_system"],
                    "title": chunk["title"],
                    "sourcePath": chunk["source_path"],
                    "chunkIndex": chunk["chunk_index"],
                    "matchedTerms": matched,
                    "snippet": snippet,
                }
            )
        return citations

    def _try_ai_answer(
        self,
        kb_id: int,
        question: str,
        top: list[tuple[int, list[str], dict[str, Any]]],
        citations: list[dict[str, Any]],
        ai_options: dict[str, Any],
        save_common: bool = True,
    ) -> dict[str, Any] | None:
        provider = normalize_provider(str(ai_options.get("provider") or ""))
        if provider not in {"claude", "openai"}:
            return None

        api_key = str(ai_options.get("apiKey") or "")
        model = str(ai_options.get("model") or "")
        if not api_key or not model:
            return None

        system_prompt = (
            "You answer QA requirement questions using only the provided knowledge-base excerpts. "
            "Synthesize across excerpts when useful, call out uncertainty, and do not invent requirements. "
            "Keep the answer concise and cite source titles naturally."
        )
        context_blocks = []
        for index, (_score, matched, chunk) in enumerate(top, start=1):
            context_blocks.append(
                "\n".join(
                    [
                        f"[Source {index}] {chunk['title']}",
                        f"System: {chunk['source_system']}",
                        f"Path: {chunk['source_path']}",
                        f"Matched terms: {', '.join(matched)}",
                        "Excerpt:",
                        self._compact(chunk["content"], 1800),
                    ]
                )
            )
        user_message = f"Question: {question.strip()}\n\nKnowledge-base excerpts:\n\n" + "\n\n---\n\n".join(context_blocks)

        if provider == "claude":
            result = ClaudeClient(api_key=api_key, model=model).analyze(system_prompt, user_message)
        else:
            result = OpenAIClient(api_key=api_key, model=model).analyze(system_prompt, user_message)

        usage = estimate_ai_cost(provider, result.get("model") or model, result.get("usage") or {})
        self._log_ai_usage(
            feature="requirement_questions",
            provider=provider,
            model=result.get("model") or model,
            usage=usage,
            metadata={"kbId": kb_id, "question": question.strip()},
        )

        answer = {
            "answer": result.get("analysis") or "",
            "citations": citations,
            "answerSource": "ai",
            "apiUsed": True,
            "aiProvider": provider,
            "aiModel": result.get("model") or model,
            "usage": usage,
        }
        if save_common:
            common_question = self._save_common_question(kb_id, question.strip(), answer["answer"], citations)
            answer["commonQuestionId"] = common_question["id"]
        return answer

    def _log_ai_usage(
        self,
        feature: str,
        provider: str,
        model: str,
        usage: dict[str, Any],
        metadata: dict[str, Any],
    ) -> None:
        with self.conn_mgr.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                INSERT INTO ai_api_usage
                (feature, provider, model, input_tokens, output_tokens, estimated_cost, metadata_json)
                VALUES ({self._ph(7)})
                """,
                (
                    feature,
                    provider,
                    model,
                    int(usage.get("inputTokens") or 0),
                    int(usage.get("outputTokens") or 0),
                    float(usage.get("estimatedCost") or 0),
                    json.dumps(metadata, ensure_ascii=True),
                ),
            )

    def _save_common_question(
        self,
        kb_id: int,
        question: str,
        answer: str,
        citations: list[dict[str, Any]],
    ) -> dict[str, Any]:
        normalized = self._normalize_question(question)
        if not normalized:
            raise ValidationError("Question is required")
        citations_json = json.dumps(citations, ensure_ascii=True)
        with self.conn_mgr.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                SELECT *
                FROM requirement_common_questions
                WHERE kb_id = {self.conn_mgr.placeholder()}
                  AND normalized_question = {self.conn_mgr.placeholder()}
                """,
                (kb_id, normalized),
            )
            existing = self.conn_mgr.row_to_dict(cursor)
            if existing:
                cursor.execute(
                    f"""
                    UPDATE requirement_common_questions
                    SET answer = {self.conn_mgr.placeholder()},
                        citations_json = {self.conn_mgr.placeholder()},
                        usage_count = usage_count + 1,
                        updated_at = CURRENT_TIMESTAMP,
                        last_asked_at = CURRENT_TIMESTAMP
                    WHERE id = {self.conn_mgr.placeholder()}
                    """,
                    (answer, citations_json, existing["id"]),
                )
                question_id = existing["id"]
            else:
                cursor.execute(
                    f"""
                    INSERT INTO requirement_common_questions
                    (kb_id, question, normalized_question, answer, citations_json)
                    VALUES ({self._ph(5)})
                    {self.conn_mgr.returning_id()}
                    """,
                    (kb_id, question, normalized, answer, citations_json),
                )
                question_id = self.conn_mgr.last_insert_id(cursor)

            cursor.execute(
                "SELECT * FROM requirement_common_questions WHERE id = " + self.conn_mgr.placeholder(),
                (question_id,),
            )
            row = self.conn_mgr.row_to_dict(cursor)
        return self._common_question_api(row or {})

    def _upsert_source(
        self,
        kb_id: int,
        source_type: str,
        source_system: str,
        source_id: str,
        title: str,
        source_path: str,
        source_text: SourceText,
        original_filename: str | None = None,
        mime_type: str | None = None,
        file_payload: bytes | None = None,
    ) -> dict[str, Any]:
        self.get_knowledge_base(kb_id)
        metadata_json = json.dumps(source_text.metadata, ensure_ascii=True)
        with self.conn_mgr.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                SELECT id FROM requirement_sources
                WHERE kb_id = {self.conn_mgr.placeholder()} AND source_path = {self.conn_mgr.placeholder()}
                """,
                (kb_id, source_path),
            )
            existing = self.conn_mgr.row_to_dict(cursor)
            if existing:
                source_id_db = existing["id"]
                cursor.execute(
                    f"""
                    UPDATE requirement_sources
                    SET source_type = {self.conn_mgr.placeholder()},
                        source_system = {self.conn_mgr.placeholder()},
                        source_id = {self.conn_mgr.placeholder()},
                        title = {self.conn_mgr.placeholder()},
                        parse_status = {self.conn_mgr.placeholder()},
                        metadata_json = {self.conn_mgr.placeholder()},
                        extracted_text = {self.conn_mgr.placeholder()},
                        original_filename = {self.conn_mgr.placeholder()},
                        mime_type = {self.conn_mgr.placeholder()},
                        file_size = {self.conn_mgr.placeholder()},
                        file_bytes = {self.conn_mgr.placeholder()},
                        ingested_at = CURRENT_TIMESTAMP
                    WHERE id = {self.conn_mgr.placeholder()}
                    """,
                    (
                        source_type,
                        source_system,
                        source_id,
                        title,
                        source_text.parse_status,
                        metadata_json,
                        source_text.text,
                        original_filename,
                        mime_type,
                        len(file_payload) if file_payload is not None else None,
                        file_payload,
                        source_id_db,
                    ),
                )
                cursor.execute("DELETE FROM requirement_chunks WHERE source_id = " + self.conn_mgr.placeholder(), (source_id_db,))
            else:
                cursor.execute(
                    f"""
                    INSERT INTO requirement_sources
                    (kb_id, source_type, source_system, source_id, title, source_path, parse_status, metadata_json, extracted_text,
                     original_filename, mime_type, file_size, file_bytes)
                    VALUES ({self._ph(13)})
                    {self.conn_mgr.returning_id()}
                    """,
                    (
                        kb_id,
                        source_type,
                        source_system,
                        source_id,
                        title,
                        source_path,
                        source_text.parse_status,
                        metadata_json,
                        source_text.text,
                        original_filename,
                        mime_type,
                        len(file_payload) if file_payload is not None else None,
                        file_payload,
                    ),
                )
                source_id_db = self.conn_mgr.last_insert_id(cursor)

            for idx, chunk in enumerate(self._chunk_text(source_text.text)):
                cursor.execute(
                    f"""
                    INSERT INTO requirement_chunks (kb_id, source_id, chunk_index, heading, content, token_count, metadata_json)
                    VALUES ({self._ph(7)})
                    """,
                    (
                        kb_id,
                        source_id_db,
                        idx,
                        chunk["heading"],
                        chunk["content"],
                        len(chunk["content"].split()),
                        json.dumps(chunk.get("metadata", {})),
                    ),
                )

            cursor.execute("SELECT * FROM requirement_sources WHERE id = " + self.conn_mgr.placeholder(), (source_id_db,))
            row = self.conn_mgr.row_to_dict(cursor)
        return self._source_api(row or {})

    def _store_discovery_run(self, kb_id: int, search_terms: list[str], candidates: list[dict[str, Any]]) -> None:
        with self.conn_mgr.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                INSERT INTO requirement_discovery_runs (kb_id, search_terms_json, selected_candidates_json)
                VALUES ({self._ph(3)})
                """,
                (kb_id, json.dumps(search_terms), json.dumps(candidates)),
            )

    # ------------------------------------------------------------------
    # Source extraction
    # ------------------------------------------------------------------

    def _extract_file(self, filename: str, payload: bytes) -> SourceText:
        suffix = Path(filename).suffix.lower()
        metadata: dict[str, Any] = {"filename": filename}
        try:
            if suffix == ".docx":
                return SourceText(self._extract_docx(payload), "indexed", metadata)
            if suffix in {".xlsx", ".xls"}:
                return SourceText(self._extract_xlsx(payload), "indexed", metadata)
            if suffix == ".csv":
                return SourceText(self._decode(payload), "indexed", metadata)
            if suffix == ".json":
                text, graph = self._extract_lucid_json(payload)
                metadata["diagram"] = graph
                return SourceText(text, "structured_diagram", metadata)
            if suffix == ".vsdx":
                return SourceText(self._extract_vsdx(payload), "structured_diagram", metadata)
            if suffix == ".svg":
                text = self._extract_svg(payload)
                return SourceText(text, "indexed" if text.strip() else "visual_only", metadata)
            if suffix == ".pdf":
                return SourceText("", "visual_only", metadata)
            if suffix in {".png", ".jpg", ".jpeg"}:
                return SourceText("", "visual_only", metadata)
            return SourceText(self._decode(payload), "indexed", metadata)
        except Exception as exc:
            metadata["error"] = str(exc)
            return SourceText("", "needs_review", metadata)

    def _extract_docx(self, payload: bytes) -> str:
        with zipfile.ZipFile(io.BytesIO(payload)) as archive:
            document = ET.fromstring(archive.read("word/document.xml"))
        ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
        paragraphs = []
        for paragraph in document.findall(".//w:p", ns):
            text = "".join(node.text or "" for node in paragraph.findall(".//w:t", ns)).strip()
            if text:
                paragraphs.append(text)
        return "\n".join(paragraphs)

    def _extract_xlsx(self, payload: bytes) -> str:
        with zipfile.ZipFile(io.BytesIO(payload)) as archive:
            shared = []
            if "xl/sharedStrings.xml" in archive.namelist():
                root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
                shared = ["".join(item.itertext()) for item in root]
            sheet_names = [name for name in archive.namelist() if re.match(r"xl/worksheets/sheet\d+\.xml", name)]
            rows = []
            for sheet_name in sheet_names:
                root = ET.fromstring(archive.read(sheet_name))
                rows.append(f"# {sheet_name}")
                for row in root.findall(".//{*}row"):
                    values = []
                    for cell in row.findall("{*}c"):
                        value = cell.find("{*}v")
                        if value is None or value.text is None:
                            continue
                        if cell.attrib.get("t") == "s":
                            idx = int(value.text)
                            values.append(shared[idx] if idx < len(shared) else "")
                        else:
                            values.append(value.text)
                    if values:
                        rows.append(" | ".join(values))
            return "\n".join(rows)

    def _extract_lucid_json(self, payload: bytes) -> tuple[str, dict[str, Any]]:
        data = json.loads(self._decode(payload))
        items = ((data.get("pages") or [{}])[0].get("items") or {}) if isinstance(data, dict) else {}
        shapes = items.get("shapes") or []
        lines = items.get("lines") or []
        shape_text: dict[str, str] = {}
        labels = []
        for shape in shapes:
            text = self._text_areas(shape)
            if text:
                shape_text[shape.get("id", "")] = text
                labels.append(text)
        edges = []
        for line in lines:
            start = (line.get("endpoint1") or {}).get("connectedTo")
            end = (line.get("endpoint2") or {}).get("connectedTo")
            if start and end and (start in shape_text or end in shape_text):
                edges.append(
                    {
                        "from": shape_text.get(start, start),
                        "label": self._text_areas(line) or "then",
                        "to": shape_text.get(end, end),
                    }
                )
        text_lines = ["# Diagram labels", *labels, "# Diagram edges"]
        text_lines.extend(f"{edge['from']} --{edge['label']}--> {edge['to']}" for edge in edges)
        return "\n".join(text_lines), {"shapeCount": len(shapes), "edgeCount": len(edges)}

    def _extract_vsdx(self, payload: bytes) -> str:
        texts = []
        with zipfile.ZipFile(io.BytesIO(payload)) as archive:
            page_names = [name for name in archive.namelist() if re.match(r"visio/pages/page\d+\.xml", name)]
            for page_name in page_names:
                root = ET.fromstring(archive.read(page_name))
                for text_node in root.findall(".//{*}Text"):
                    text = self._clean(" ".join(text_node.itertext()))
                    if text:
                        texts.append(text)
        return "\n".join(dict.fromkeys(texts))

    def _extract_svg(self, payload: bytes) -> str:
        raw = self._decode(payload)
        texts = re.findall(r"<(?:text|tspan)\b[^>]*>(.*?)</(?:text|tspan)>", raw, flags=re.I | re.S)
        return "\n".join(self._clean(re.sub(r"<[^>]+>", " ", text)) for text in texts if self._clean(text))

    # ------------------------------------------------------------------
    # Text helpers
    # ------------------------------------------------------------------

    def _chunk_text(self, text: str, max_chars: int = 2500) -> list[dict[str, Any]]:
        clean = text.strip()
        if not clean:
            return [{"heading": "Visual source", "content": "Visual-only source. Review original file.", "metadata": {}}]
        chunks = []
        current_heading = "Source"
        current = []
        for line in clean.splitlines():
            stripped = line.strip()
            if not stripped:
                continue
            if stripped.startswith("#"):
                if current:
                    chunks.extend(self._split_chunk(current_heading, "\n".join(current), max_chars))
                    current = []
                current_heading = stripped.lstrip("#").strip() or current_heading
                continue
            current.append(stripped)
            if sum(len(item) for item in current) >= max_chars:
                chunks.extend(self._split_chunk(current_heading, "\n".join(current), max_chars))
                current = []
        if current:
            chunks.extend(self._split_chunk(current_heading, "\n".join(current), max_chars))
        return chunks or [{"heading": "Source", "content": clean[:max_chars], "metadata": {}}]

    def _split_chunk(self, heading: str, content: str, max_chars: int) -> list[dict[str, Any]]:
        parts = []
        text = content.strip()
        while text:
            if len(text) <= max_chars:
                parts.append({"heading": heading, "content": text, "metadata": {}})
                break
            cut = max_chars
            for sep in (". ", ".\n", ";\n", ";\n", "\n"):
                pos = text.rfind(sep, 0, max_chars)
                if pos > max_chars // 3:
                    cut = pos + len(sep)
                    break
            parts.append({"heading": heading, "content": text[:cut].strip(), "metadata": {}})
            text = text[cut:].strip()
        return parts

    def _iter_vault_task_files(self) -> list[Path]:
        raw = self.vault_root / "raw" if self.vault_root else None
        if not raw or not raw.exists():
            return []
        files: list[Path] = []
        for path in raw.rglob("*.md"):
            rel = self._rel_vault_path(path)
            parts = rel.split("/")
            if "_attachments" in parts or ".obsidian" in parts:
                continue
            if parts[:2] == ["raw", "asana"] and len(parts) >= 5:
                files.append(path)
            elif len(parts) >= 4 and parts[0] == "raw" and parts[1] != "asana":
                files.append(path)
        return files

    def _find_vault_paths_by_key(self, key: str) -> list[str]:
        matches = []
        for path in self._iter_vault_task_files():
            if key.lower() in path.name.lower():
                matches.append(self._rel_vault_path(path))
        return sorted(matches)

    def _resolve_vault_reference(self, source_reference: str) -> str:
        clean = source_reference.strip().replace("\\", "/").lstrip("/")
        if not clean:
            raise ValidationError("Source path or task ID is required")
        if "/" in clean or clean.lower().endswith(".md"):
            return clean
        if self._task_key(clean) == clean.upper():
            matches = self._find_vault_paths_by_key(clean)
            if not matches:
                raise ValidationError(f"Task ID not found in vault: {clean}")
            return matches[0]
        return clean

    def _calculator_document_paths(self) -> list[Path]:
        roots = [
            Path("docs/requirements/calculator"),
            Path.home() / "Downloads" / "Minimum Pricing Requirements",
            Path.home() / "Downloads",
        ]
        paths = []
        for root in roots:
            for name in self.CALCULATOR_DOC_NAMES:
                candidate = root / name
                if candidate.exists():
                    paths.append(candidate)
        return paths

    def _source_parts(self, rel_path: str) -> tuple[str, str, str]:
        parts = rel_path.split("/")
        if parts[:2] == ["raw", "asana"]:
            return "Asana", parts[2] if len(parts) > 2 else "", parts[3] if len(parts) > 3 else ""
        if parts and parts[0] == "raw":
            return "Jira", parts[1] if len(parts) > 1 else "", parts[2] if len(parts) > 2 else ""
        return "File", "", ""

    def _rel_vault_path(self, path: Path) -> str:
        return path.resolve().relative_to(self.vault_root.resolve()).as_posix()

    def _frontmatter(self, text: str) -> dict[str, str]:
        if not text.startswith("---"):
            return {}
        end = text.find("\n---", 3)
        if end == -1:
            return {}
        values = {}
        for line in text[3:end].splitlines():
            if ":" not in line:
                continue
            key, value = line.split(":", 1)
            values[key.strip()] = value.strip().strip('"')
        return values

    def _title_from_text(self, path: Path, text: str) -> str:
        match = re.search(r"^#\s+(.+)$", text, flags=re.M)
        if match:
            return re.sub(r"^\[[ xX]\]\s*", "", match.group(1).strip())
        return path.stem

    def _task_key(self, *values: str) -> str:
        for value in values:
            match = re.search(r"\b[A-Z][A-Z0-9]+-\d+\b", value)
            if match:
                return match.group(0)
        return ""

    def _score_text(self, text: str, terms: list[str]) -> tuple[int, list[str]]:
        lowered = text.lower()
        score = 0
        matched = []
        title = text.splitlines()[0].lower() if text.splitlines() else ""
        for term in terms:
            needle = term.lower()
            count = lowered.count(needle)
            if count == 0 and "pricing" in needle:
                count = lowered.count(needle.replace("pricing", "price"))
            if count == 0 and "price" in needle:
                count = lowered.count(needle.replace("price", "pricing"))
            if count == 0:
                words = [word for word in re.findall(r"[a-z0-9_]+", needle) if len(word) >= 3]
                count = sum(1 for word in words if word in lowered)
            if count:
                matched.append(term)
                score += count
                if needle in title:
                    score += 10
        return score, matched

    def _snippets(self, text: str, terms: list[str], limit: int = 3) -> list[str]:
        snippets = []
        for line in text.splitlines():
            clean = self._clean(line)
            if clean and any(term.lower() in clean.lower() for term in terms):
                snippets.append(self._compact(clean, 220))
            if len(snippets) >= limit:
                break
        return snippets

    def _question_terms(self, question: str) -> list[str]:
        terms = re.findall(r"[A-Za-z0-9_'-]{3,}", question)
        stop = {"what", "when", "where", "which", "does", "with", "from", "that", "this", "should", "would", "about"}
        return [term for term in terms if term.lower() not in stop]

    def _normalize_question(self, question: str) -> str:
        return re.sub(r"\s+", " ", question.strip().lower())

    def _source_api(self, row: dict[str, Any]) -> dict[str, Any]:
        metadata = row.get("metadata_json")
        try:
            parsed_metadata = json.loads(metadata) if metadata else {}
        except json.JSONDecodeError:
            parsed_metadata = {}
        result = dict(row)
        result["metadata"] = parsed_metadata
        result["chunkCount"] = int(result.pop("chunk_count", 0) or 0)
        file_bytes = result.pop("file_bytes", None)
        result["hasOriginalFile"] = bool(file_bytes)
        if "kb_name" in result:
            result["kbName"] = result.pop("kb_name")
        for snake, camel in [
            ("kb_id", "kbId"),
            ("source_type", "sourceType"),
            ("source_system", "sourceSystem"),
            ("source_id", "sourceId"),
            ("source_path", "sourcePath"),
            ("parse_status", "parseStatus"),
            ("metadata_json", "metadataJson"),
            ("extracted_text", "extractedText"),
            ("original_filename", "originalFilename"),
            ("mime_type", "mimeType"),
            ("file_size", "fileSize"),
            ("created_at", "createdAt"),
            ("ingested_at", "ingestedAt"),
        ]:
            if snake in result:
                result[camel] = result.pop(snake)
        return result

    def _common_question_api(self, row: dict[str, Any]) -> dict[str, Any]:
        try:
            citations = json.loads(row.get("citations_json") or "[]")
        except json.JSONDecodeError:
            citations = []
        citations = self._hydrate_citation_snippets(citations)
        result = dict(row)
        result["citations"] = citations
        for snake, camel in [
            ("kb_id", "kbId"),
            ("normalized_question", "normalizedQuestion"),
            ("citations_json", "citationsJson"),
            ("usage_count", "usageCount"),
            ("created_at", "createdAt"),
            ("updated_at", "updatedAt"),
            ("last_asked_at", "lastAskedAt"),
        ]:
            if snake in result:
                result[camel] = result.pop(snake)
        return result

    def _hydrate_citation_snippets(self, citations: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """Refresh cached citation snippets from current chunk content.

        Older saved FAQ rows may contain compacted snippets ending in ellipses.
        The citation identity is stable, so we can replace the display snippet
        from ``requirement_chunks`` without changing the saved question row.
        """
        if not citations:
            return citations
        ph = self.conn_mgr.placeholder()
        hydrated: list[dict[str, Any]] = []
        with self.conn_mgr.get_connection() as conn:
            cursor = conn.cursor()
            for citation in citations:
                next_citation = dict(citation)
                source_id = citation.get("sourceId")
                chunk_index = citation.get("chunkIndex")
                if source_id is not None and chunk_index is not None:
                    cursor.execute(
                        f"""
                        SELECT content
                        FROM requirement_chunks
                        WHERE source_id = {ph}
                          AND chunk_index = {ph}
                        """,
                        (source_id, chunk_index),
                    )
                    row = self.conn_mgr.row_to_dict(cursor)
                    if row and row.get("content"):
                        next_citation["snippet"] = self._clean(row["content"])
                hydrated.append(next_citation)
        return hydrated

    def _text_areas(self, item: dict[str, Any]) -> str:
        values = []
        for area in item.get("textAreas") or []:
            text = area.get("text") or area.get("label") or ""
            if text:
                values.append(self._clean(text))
        return " ".join(values).strip()

    def _decode(self, payload: bytes) -> str:
        return payload.decode("utf-8", errors="ignore")

    def _clean(self, value: str) -> str:
        return re.sub(r"\s+", " ", html.unescape(value)).strip()

    def _compact(self, value: str, limit: int) -> str:
        clean = self._clean(value)
        return clean if len(clean) <= limit else clean[: limit - 3].rstrip() + "..."

    def _mime_type(self, filename: str) -> str:
        suffix = Path(filename).suffix.lower()
        known = {
            ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ".xls": "application/vnd.ms-excel",
            ".pdf": "application/pdf",
            ".svg": "image/svg+xml",
            ".vsdx": "application/vnd.visio",
        }
        return known.get(suffix) or mimetypes.guess_type(filename)[0] or "application/octet-stream"

    def _slugify(self, value: str) -> str:
        slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
        return slug or f"kb-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"

    def _ph(self, count: int) -> str:
        return ", ".join([self.conn_mgr.placeholder()] * count)
