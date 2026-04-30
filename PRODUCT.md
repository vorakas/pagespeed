# PRODUCT.md — Pharos

## Register
product

## Product Purpose
Pharos is an internal operations hub for Lamps Plus. It unifies surfaces that
were previously scattered across vendor consoles: Google PageSpeed Insights,
New Relic APM, Azure Log Analytics (IIS logs), Anthropic Claude + OpenAI
analysis, Azure DevOps automation orchestration and build monitoring,
BlazeMeter load testing, and (in progress) an Adobe Commerce migration
dashboard. The job: let one operator triage performance, run automation, and
read results without context-switching between five vendor UIs.

## Users
- **Primary:** Internal Lamps Plus ops, QA, and performance engineers. Power
  users. They open Pharos to do a task, not to browse. They are fluent in
  vendor consoles (New Relic One, Azure Portal, Azure DevOps, BlazeMeter) and
  will compare Pharos against those as the implicit baseline.
- **Secondary:** Devs auditing build health or running an ad-hoc PageSpeed
  test. Lower frequency, higher tolerance for self-service.
- **Not the audience:** External customers, executives reading a pretty
  report, anyone who needs hand-holding.

## Brand
- Parent identity: **Lamps Plus** (retail). Pharos is a sub-brand surfaced
  with a lighthouse mark and the subtitle "Operations Hub" in the sidebar.
- The header pairs the Lamps Plus wordmark with the Pharos lighthouse — both
  are present on every page.
- Theme: dark is the default. Light exists strictly as a user preference;
  no one alternates between them for day/night.
- Visual identity is currently shadcn-derived: tinted neutrals, OKLCH-friendly
  tokens, restrained accent. No marketing flourish.

## Tone
- Calm, dense, capable. Reads like an engineer's tool, not a marketing site.
- Plain language in labels and errors. No marketing copy. No emoji.
- Status is communicated through color + numbers, not adjectives.

## Strategic Principles
1. **The vendor console is the bar.** If Pharos can't beat New Relic / Azure
   DevOps at a specific task, it shouldn't reimplement that task, it should
   link out. Re-implementation is justified by aggregation or speed.
2. **Density is a feature.** Operators want everything visible; progressive
   disclosure is for noise, not for primary signal.
3. **Familiar affordances.** Tables, tabs, side panels, modals, standard
   product vocabulary. No invented controls.
4. **Speed of read >> beauty.** Color, weight, and position carry meaning.
   Decoration that doesn't convey state is waste.
5. **Credentials live with the user.** Per-user localStorage configs (NR,
   Azure, AI, Azure DevOps). Never assume server-side state.

## Anti-References
What Pharos should NOT look or feel like:
- **Consumer SaaS landing pages**, gradient hero, oversized illustrations,
  big-number-with-tiny-label cards. Pharos has no marketing surface.
- **Generic shadcn dashboard demos**, sidebar + 4 stat cards + chart + table.
  This is the AI-slop dashboard template; Pharos should not converge on it.
- **Vendor-portal density-without-hierarchy** (raw Azure Portal). Density is
  earned, but Pharos should still rank signal.
- **Glassmorphism, gradient text, neon accents.** Not the register.

## Reference Tools (the bar)
Linear, Vercel dashboard, Stripe Dashboard, Grafana, Datadog. These are the
products operators are fluent in. Pharos should sit comfortably next to them.
