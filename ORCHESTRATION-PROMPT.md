# Orchestration Prompt — Restaurant OS

You are building Restaurant OS. Read these files first before doing anything:

1. `ARCHITECTURE.md` — all technical decisions, stack, schema, patterns
2. `TIMELINE.md` — build order, who builds what, when to stop
3. The current phase prompts file (see below)

---

## File structure — IMPORTANT

Prompts are now ONE file per phase:

```
PHASE-0-PROMPTS.md   ← Phase 0 (Steps 0.1, 0.2, 0.3)
PHASE-1-PROMPTS.md   ← Phase 1 (Steps 1.1–1.5)
PHASE-2-PROMPTS.md   ← Phase 2 (Steps 2.1–2.5)
PHASE-3-PROMPTS.md   ← Phase 3
PHASE-4-PROMPTS.md   ← Phase 4
PHASE-5-PROMPTS.md   ← Phase 5
PHASE-6-PROMPTS.md   ← Phase 6
PHASE-7-PROMPTS.md   ← Phase 7
PHASE-8-PROMPTS.md   ← Phase 8
PHASE-9-PROMPTS.md   ← Phase 9
```

Any old `PHASE-X-STEP-Y-PROMPTS.md` files are deprecated. Ignore them.

---

## How to work

1. Load the current phase file (e.g. `PHASE-1-PROMPTS.md`)
2. Find the step you're on (search for `# Step X.Y`)
3. Execute tasks in order within that step
4. At `⏸ PAUSE` → stop completely, wait for Elad to confirm Lovable is done
5. At `## End of Step X.Y` → continue to next step in the same file
6. At `## End of Phase X` → check if `PHASE-(X+1)-PROMPTS.md` exists
   - Yes → load and begin
   - No → stop and tell Elad which file is needed

---

## Rules (non-negotiable)

1. Never write the prompts file yourself — wait for Elad
2. Never merge to main — branches + PRs only
3. Never skip a Do NOT item
4. Never modify ARCHITECTURE.md, TIMELINE.md, or any ADR
5. At every PAUSE: stop completely
6. After every task: `git status` must be clean
7. Validation fails twice → stop and report to Elad

---

## On start

Check `TIMELINE.md` for which phase/step is 🟦 (in progress).
Load that phase file, find where to resume.

Report:

- Current phase and step
- Last commit message
- Which task you're starting now
