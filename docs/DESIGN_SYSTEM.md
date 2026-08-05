# Design System

Vireon should feel like a professional financial operating system: quiet, dense, reliable, and decision-oriented.

## Visual Direction

- Use restrained surfaces, compact spacing, and strong information hierarchy.
- Avoid decorative cards inside cards.
- Avoid marketing-page patterns in product screens.
- Prefer high-density panels, tables, timelines, maps, and decision workspaces.
- Keep charts subordinate to recommendations and actions.

## Colour

- Use deep navy for primary navigation and high-emphasis action surfaces.
- Use white and light slate for workspace surfaces.
- Use blue for intelligence and links.
- Use emerald for positive financial movement or completion.
- Use amber/orange for warnings and attention.
- Use red only for material risk or negative financial impact.
- Avoid one-note palettes and excessive gradients.

## Typography

- Use concise labels and direct financial language.
- Headings should state the financial question or workspace purpose.
- Avoid hero-sized type inside dashboards and dense product panels.
- Use tabular numerals for financial values where possible.

## Components

- Decision cards show action, value, confidence, evidence, and next step.
- Metric cards must be clickable when a deeper workspace exists.
- Tables should support sorting, filtering, and evidence drill-down.
- Modals and side panels should explain assumptions and allow action.
- Command palette and universal search should become first-class navigation.

## Daily Briefing Pattern

Daily Review and future proactive workspaces should open as a calm briefing, not a KPI wall.

- First viewport: brief label, review period/freshness, headline, one-sentence summary, featured finding, up to three priority actions, and one primary action.
- Featured finding: choose deterministically by priority, urgency, actionability, confidence, and impact. Do not feature passive positive movement above an urgent actionable risk.
- Priority cards: maximum three above the fold, one visible action, compact benefit/risk and confidence.
- Financial wins: lightweight list or strip, capped initially at three items.
- System Health: collapsed by default; only emphasise when an engine failed, a material rule is stale, required data is missing, or confidence drops below threshold.
- Metadata, evidence, assumptions, snapshots, suppressed findings, and calculation IDs belong below the fold or inside details.

## Dashboard Command Centre Pattern

The main Dashboard summarises and routes. It should not duplicate the full Daily Review or expose diagnostics in the normal user path.

- First viewport: deterministic briefing headline, one-sentence summary, top priority action, strongest progress signal, current position strip, up to three secondary actions, and one clear route into AI CFO or Daily Review.
- Present one canonical priority. The hero may name the priority once; the active workflow or action card owns the execution detail.
- Current position: no more than four metrics. Prefer net worth, monthly surplus, emergency runway or available cash, and goal or borrowing readiness.
- Current-position metrics should render as a compact strip. Use sparklines only when they fit inside the metric and add context.
- Top priority: one dominant action selected from active workflows, Daily Review findings, Decision Centre items, missing evidence, blocked goals, and stale critical data. If a workflow is active, route to its next action instead of showing a competing recommendation.
- Secondary actions: cap at three above the fold. Each item gets one action only and should not visually compete with the primary workflow.
- Financial progress: lightweight verified wins only. Do not count checklist completion or expected outcomes as realised progress.
- Daily Review appears as a compact route to the full review when its findings already drive the Dashboard briefing.
- Charts: at most one above the fold, and only when it explains a decision. Detailed analytics belong in Cash Flow, Investments, Balance Sheet, Housing, or Reports.
- Contextual workspace links should be capped to the most relevant two destinations, with a separate text route for all workspaces.
- System Health and developer diagnostics do not appear on the normal Dashboard.

## Spacing

- Use compact vertical rhythm.
- Preserve enough space for scanability, but avoid dashboard whitespace that delays decisions.
- Fixed-format controls should have stable dimensions so labels and dynamic values do not shift layouts.

## Motion

- Use subtle motion only to clarify state changes, transitions, and timeline movement.
- Avoid decorative motion that does not improve comprehension.

## Accessibility

- Buttons and links require descriptive labels.
- Colour must not be the only signal for risk, status, or opportunity.
- Keyboard navigation should work for menus, dialogs, command palette, and key workflows.
