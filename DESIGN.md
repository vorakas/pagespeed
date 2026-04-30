# DESIGN.md — Pharos Beacon register

## Status
Round 1 prototype. Scoped to the **Builds page only**. Visual language only,
no structural changes. The Beacon register is opt-in via a `.beacon` ancestor
class so the rest of the app continues to render in its current styling
unchanged.

## Philosophy
The lighthouse is a *function*, not decoration. Every visual choice should
make the operator's read faster, never prettier. When color, motion, or
ornament does not convey state, it is waste.

## Type

| Role | Family | Notes |
|---|---|---|
| Prose | Inter | Headings, page descriptions, button labels. Tighter tracking on display sizes. |
| Data | Cascadia Code (system) → Fira Code → Consolas | Build numbers, durations, IDs, status pills, table columns, branch names. Tabular numerals always on. |

Scale (fixed rem, no fluid):

```
10px — beacon-label (small caps, letterspaced 0.18em)
11px — table cells, status pills, secondary metadata
12px — body small, button labels
13px — body
15px — section titles
18px — page H2
24px — page H1
```

Letterspacing:
- Display headlines: -0.01em
- Beacon labels (uppercase): 0.18em
- Status pills: 0.04em

## Color (OKLCH)

All within the `.beacon` scope. The rest of the app keeps its existing
shadcn tokens.

### Neutrals
```
--beacon-ground:    oklch(13% 0.012 240);  /* page bg */
--beacon-surface:   oklch(19% 0.018 240);  /* card */
--beacon-elevated:  oklch(23% 0.020 240);  /* card hover / panel */
--beacon-border:    oklch(28% 0.025 240);
--beacon-hairline:  oklch(28% 0.025 240 / 0.6);
```

### Text
```
--beacon-text:        oklch(96% 0.005 240);
--beacon-text-muted:  oklch(72% 0.010 240);
--beacon-text-faint:  oklch(52% 0.015 240);
```

### Signature — signal amber
```
--beacon-amber:       oklch(78% 0.16 70);
--beacon-amber-soft:  oklch(78% 0.16 70 / 0.12);
--beacon-amber-line:  oklch(78% 0.16 70 / 0.30);
```
Used ONLY for: brand mark, primary action (Run/Trigger), currently-selected
state, "polling active" indicator. Never decoration.

### State (functional only)
```
--beacon-pass: oklch(72% 0.14 145);
--beacon-fail: oklch(64% 0.18 25);
--beacon-warn: oklch(78% 0.16 70);  /* same as signature — partial/cancelling */
--beacon-info: oklch(70% 0.13 230); /* running */
--beacon-idle: oklch(48% 0.005 240);
```

## Surfaces

- Solid backgrounds. No `backdrop-filter`, no glass.
- Cards: 1px `--beacon-border`, 4px corner radius, no shadow.
- Density via spacing rhythm and tabular alignment, not fills.
- Section dividers: 1px `--beacon-hairline` rule, never colored.

## Components

### Beacon dot
Filled circle inside a thin concentric ring. Shape doubles as a non-color
cue for screen readers and color-blind operators.

```html
<span class="beacon-dot text-pass" />
```

Pulse animation reserved for `running` and `cancelling` states only.
Healthy/passed states are static — pulsing the OK state inverts convention.

### Type badge
Lowercase mono with hairline border, no fill. Carries kind only, never
status — status lives on the dot.

```html
<span class="beacon-typebadge">visual</span>
```

### Status pill
Mono 11px, letterspaced 0.04em, color follows state. Right-aligned.

```html
<span class="beacon-status text-pass">PASSED 2:14</span>
```

### Section label
Uppercase, mono, letterspaced 0.18em, 10px. Sits above a hairline rule when
demarcating a section.

```html
<div class="beacon-section">
  <span class="beacon-label">WARMUP</span>
  <hr class="beacon-rule" />
</div>
```

### Buttons
Beacon prefers ghost / outline buttons with hairline border + amber text on
hover for primary actions. Destructive buttons use `--beacon-fail` for both
border and text. No filled buttons except for the orchestrator's Run All —
that one is the apex action and earns the amber fill.

## Motion

- 150ms `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out-quart) on state changes.
- Beacon dot pulse: 1.6s ease-in-out, only when `running` or `cancelling`.
- Polling indicator: a 4s linear sweep on the lighthouse mark when the
  Builds page is actively polling. This is the diegetic flourish — when
  it stops sweeping, polling has stopped.
- No idle motion. No drift backgrounds. No decorative shimmer.

## Distinctive flourishes

1. **Beacon dot** (status indicator with intrinsic non-color cue)
2. **Lowercase mono type tags** (`functional` / `visual` / `warmup`) — flips
   the SaaS convention of UPPERCASE-PILLS
3. **Tabular monospace numbers everywhere** (build #s, durations, counts) —
   immediate visual signal of "this is a tool"
4. **Hairline section rules** with letterspaced uppercase labels — replaces
   the card-everywhere reflex

## What this register is NOT

- Not glass. Not gradient. Not glowing.
- Not generic shadcn-blue.
- Not a marketing site. The Aurora Launch / Workstream / Obsidian routes
  are out of scope for the Beacon register and remain unchanged.

## Scope of round 1

Touched:
- `frontend/src/styles/beacon.css` (new)
- `frontend/src/main.tsx` (1 import)
- `frontend/src/pages/Builds.tsx` (wrap content in `.beacon`, restyle inline elements)
- `frontend/src/components/builds/BuildCard.tsx`
- `frontend/src/components/builds/BuildGrid.tsx`
- `frontend/src/components/builds/OrchestratorPanel.tsx`
- `frontend/src/components/builds/SpreadsheetWidget.tsx`
- `frontend/src/components/builds/DevOpsConfigPanel.tsx`

Not touched (per "visual only, no structural changes"):
- Any layout / DOM restructure
- Sidebar, Header, AppLayout (would affect every page)
- Any other page (Dashboard, NewRelic, IisLogs, etc.)
- BuildResultsPanel internals (round 2)
- PipelineMapper, ApplitoolsConfigPanel (round 2)

## Round 2 candidates
- Self-host JetBrains Mono + Inter Tight
- Apply Beacon to BuildResultsPanel + sub-config panels
- Lighthouse mark + sweep animation in shared Header
- Decide whether to propagate to other pages or keep Beacon scoped to Builds
