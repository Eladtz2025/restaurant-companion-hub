# Phase 5 — AI Document Editor + SOPs + Knowledge Base

> **Covers:** Steps 5.1–5.5. Full document management with AI editor, version history, digital signatures, SOP library, employee training docs.

---

## Pre-flight check

```
git log --oneline -5
pnpm db:test
pnpm typecheck
```

Expected: Phase 4 complete. Sales data, floor performance, AI brief all working.

---

# Step 5.1 — Documents Schema + PDF Template

## Division of labor

**Claude Code:** schema, PDF render pipeline, version logic, Lovable prompt.
**Lovable:** document library UI.

## Task 1 — Schema + PDF Pipeline (Claude Code)

### Context to load

- `ARCHITECTURE.md` §13 (Documents, Storage)

### Prompt for Claude Code

Create document schema and unified PDF template.

Requirements:

1. Migration `{timestamp}_documents.sql`:

```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('sop', 'menu', 'event_quote', 'brief', 'training', 'contract')),
  title_he TEXT NOT NULL,
  current_version_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version INT NOT NULL,
  content_md TEXT NOT NULL,
  rendered_pdf_url TEXT,
  created_by UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'approved', 'superseded')),
  ai_metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, version)
);

CREATE TABLE document_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  document_version_id UUID NOT NULL REFERENCES document_versions(id),
  signed_by UUID NOT NULL REFERENCES auth.users(id),
  signed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  signature_image_url TEXT,
  ip_address TEXT,
  UNIQUE (document_version_id, signed_by)
);

-- Add FK from documents to current_version
ALTER TABLE documents ADD CONSTRAINT fk_current_version
  FOREIGN KEY (current_version_id) REFERENCES document_versions(id) DEFERRABLE INITIALLY DEFERRED;

-- Indexes + RLS
CREATE INDEX idx_documents_tenant_type ON documents(tenant_id, type);
CREATE INDEX idx_doc_versions_document ON document_versions(document_id, version);
```

2. Create `src/lib/actions/documents.ts`:
   - `getDocuments(tenantId, type?)` → list
   - `getDocument(tenantId, id)` → with current version content
   - `createDocument(tenantId, data)` → new document + V1 draft
   - `saveDocumentDraft(tenantId, docId, content_md)` → upsert draft version
   - `approveDocument(tenantId, docId)` → mark current version approved
   - `publishNewVersion(tenantId, docId, content_md)` → creates V+1, supersedes previous
   - `getSignatureStatus(tenantId, docVersionId)` → who signed, who hasn't

3. Create `src/lib/documents/pdf-renderer.ts`:
   - Uses `@react-pdf/renderer` or `puppeteer` (prefer react-pdf for Vercel compatibility)
   - Unified template: Heebo font, header (logo + restaurant name + date), footer (page/version), RTL
   - `renderDocumentToPDF(content_md, metadata)` → Buffer
   - Upload to Supabase Storage, return signed URL
   - Cache: same version → same PDF (don't re-render)

4. Tests `tests/documents/`:
   - Version bump on publishNewVersion
   - Approve marks status correctly
   - PDF render produces non-empty Buffer
   - At least 6 tests

### Validation

- [ ] Migration clean
- [ ] `publishNewVersion` creates V+1, previous becomes superseded
- [ ] PDF renders with Hebrew content and Heebo font
- [ ] PDF uploaded to Storage, URL returned
- [ ] `pnpm test` green

### Commit

`feat(documents): schema, versioning, PDF render pipeline`

### Branch

`feat/phase-5-step-1-task-1`

---

## Task 2 — Write Lovable Prompt + Wire (Claude Code)

Save to `prompts/lovable/phase-5-document-library.md`.

Build:

1. **`/[tenantSlug]/knowledge` page** — document library:
   - Tabs: "נהלים" | "תפריטים" | "הדרכות" | "חוזים"
   - Document cards: title, type badge, last updated, version, status
   - "מסמך חדש" button (manager/owner)
   - Search by title

2. **`/[tenantSlug]/knowledge/[docId]` page** — document view/edit:
   - Title (editable)
   - Status badge: "טיוטה" / "מאושר" / "ממתין לאישור"
   - Version selector (V1, V2, V3...)
   - Content area (markdown rendered, edit mode toggle)
   - "הורד PDF" button
   - Signature status panel (who signed, who hasn't)

After Lovable:

1. Wire library to `getDocuments`.
2. Wire document view to `getDocument`.
3. Wire PDF download to `renderDocumentToPDF` + Storage URL.
4. Wire approve to `approveDocument`.

### Commit

`feat(documents): document library and view UI`

---

# Step 5.2 — AI Editor

## Task 1 — AI Editor Backend (Claude Code)

### Context to load

- `ARCHITECTURE.md` §7 (AI Gateway)
- `prompts/` directory

### Prompt for Claude Code

Build the AI document editor backend.

Requirements:

1. Create prompt `prompts/document-editor/v1.md`:

```
אתה עורך מסמכים מקצועי למסעדות ישראליות.
קיבלת מסמך בעברית ובקשת עריכה מהמשתמש.

מסמך מקורי:
{document_content}

בקשת עריכה:
{user_instruction}

הנחיות:
- שמור על פורמט markdown מדויק
- שמור על RTL ועברית תקנית
- אל תוסיף תוכן שלא התבקש
- אם לא ברור מה לשנות — שאל בחזרה
- החזר JSON: { "edited_content": string, "changes_summary": string, "confidence": "high"|"medium"|"low" }
```

2. Add to AI Gateway routing:

```typescript
'document.edit': { model: 'claude-sonnet-4-6', maxTokens: 4096, temp: 0.2 },
'document.summarize': { model: 'claude-sonnet-4-6', maxTokens: 512, temp: 0.1 },
'document.create_from_template': { model: 'claude-sonnet-4-6', maxTokens: 3000, temp: 0.3 },
```

3. Create `src/lib/actions/ai-document.ts`:
   - `editDocumentWithAI(tenantId, userId, docId, instruction)` → edited content + summary
   - `summarizeDocument(tenantId, docId)` → short Hebrew summary
   - `createDocumentFromTemplate(tenantId, type, context)` → full draft from scratch

4. Tests: mock AI Gateway, verify prompt construction, JSON parse.

### Validation

- [ ] `editDocumentWithAI` returns edited content
- [ ] AI call logged to `ai_calls` table
- [ ] Cost ceiling checked
- [ ] JSON parse handles malformed AI response gracefully

### Commit

`feat(ai): document editor backend with AI Gateway`

---

## Task 2 — Write Lovable Prompt + Wire (Claude Code)

Save to `prompts/lovable/phase-5-ai-editor.md`.

Add to document view page:

1. **AI Editor panel** (Sheet from bottom on mobile, side panel on desktop):
   - "שאל AI" button on every document page
   - Text input: "מה לשנות?"
   - Send button
   - Loading: "AI עורך..."
   - Response: diff view (before/after, color coded)
   - "אשר שינויים" → saves as new draft
   - "דחה" → no change
   - "סכם מסמך" quick action button

2. **Document creation wizard** (new doc modal):
   - Type selector
   - "צור עם AI" option → text field for context → AI generates full draft
   - "צור ידנית" option → blank editor

After Lovable:

1. Wire AI panel to `editDocumentWithAI`.
2. Wire diff view (use `react-diff-viewer` or simple before/after).
3. Wire "create with AI" to `createDocumentFromTemplate`.
4. Show token cost per AI call (optional, for owner visibility).

### Commit

`feat(ai-editor): AI editor panel with diff view`

---

# Step 5.3 — SOPs + Digital Signatures

## Task 1 — Signature Flow + Notifications (Claude Code)

### Prompt for Claude Code

Build SOP management with mandatory re-signature on new versions.

Requirements:

1. Create `src/lib/actions/signatures.ts`:
   - `signDocument(tenantId, docVersionId, userId, signatureDataUrl)` → create signature record
   - `getPendingSignatures(tenantId, userId)` → doc versions needing this user's signature
   - `getUnsignedUsersForVersion(tenantId, docVersionId)` → users who haven't signed

2. Create Inngest job `inngest/functions/signature-reminder.ts`:
   - Cron: daily at 09:00 IST
   - Find all users with pending signatures
   - Send in-app notification (and web push if enabled)

3. On `publishNewVersion` of type `sop`:
   - Automatically create pending signature requirement for all active tenant members
   - Trigger immediate notification

4. Update middleware: on login, check `getPendingSignatures`. If any → show banner "יש לך X נהלים לחתום".

5. Tests:
   - Publish SOP → pending signatures created for all members
   - Sign → removed from pending
   - Re-publish V2 → new pending signatures for all (even those who signed V1)

### Validation

- [ ] Publish SOP → all members have pending signature
- [ ] Banner appears on login when unsigned SOPs exist
- [ ] Sign with canvas → stored in Storage + DB

### Commit

`feat(sop): SOP signature flow with re-sign on new version`

---

## Task 2 — Write Lovable Prompt + Wire (Claude Code)

Save to `prompts/lovable/phase-5-sop.md`.

Build:

1. **SOP library** (`/knowledge/sops`):
   - List with signature completion badge: "12/15 חתמו"
   - Click → SOP detail with signature panel

2. **Staff signature page** (`/knowledge/sign`):
   - List of pending SOPs to sign
   - Tap → read SOP → signature canvas at bottom
   - "חתום ואשר" button

3. **Signature progress panel** (manager view):
   - Per SOP: who signed, who hasn't, send reminder button

4. **Login banner**: "יש לך 2 נהלים לחתימה" → link to `/knowledge/sign`

After Lovable: wire all actions.

### Commit

`feat(sop): SOP library with signature UI`

---

# Step 5.4 — Training Docs + Employee File

## Task 1 — Write Lovable Prompt + Wire (Claude Code)

Save to `prompts/lovable/phase-5-training.md`.

Build:

1. **Training library** (`/knowledge/training`):
   - Docs organized by role: "כל הצוות" | "מלצרים" | "מטבח" | "בר"
   - Each doc: read + quiz (optional, Phase 9+)
   - Completion tracking per employee

2. **Employee file** (`/settings/team/[userId]`):
   - Basic info: name, role, start date
   - Training completion: list of completed docs + dates
   - Pending signatures
   - Manager notes

After Lovable: wire training library to `getDocuments({ type: 'training' })`.

### Commit

`feat(training): training docs library and employee file`

---

# Step 5.5 — Polish + E2E

## Task 1 — E2E + Polish (Claude Code)

### Prompt for Claude Code

Complete Phase 5 E2E tests.

Requirements:

1. E2E `tests/e2e/phase5.spec.ts`:
   - Create SOP → publish → all members get pending signature
   - Staff signs → removed from pending list
   - Manager edits with AI → approves diff → new version published
   - Download PDF → file non-empty

2. Verify AI editor never breaks Hebrew RTL in output (test with a document containing tables).

3. Performance: document list page < 1.5s with 20 documents.

### Commit

`test(phase5): E2E tests for documents, SOPs, AI editor`

---

## End of Phase 5

Phase 5 Definition of Done:

- [ ] Manager creates SOP in 15 min via AI
- [ ] 100% staff signs within a week of publish
- [ ] AI editor preserves Hebrew RTL in all tested cases
- [ ] PDF downloads work for all document types
- [ ] All E2E tests pass
- [ ] `pnpm db:test` green
- [ ] `pnpm test` green

Read `TIMELINE.md`. Next is Phase 6. Check if `PHASE-6-PROMPTS.md` exists. If yes, begin. If no, stop and wait for Elad.
