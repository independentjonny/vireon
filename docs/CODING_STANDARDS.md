# Coding Standards

## React and Next.js

- Read relevant Next.js docs in `node_modules/next/dist/docs/` before app-level code changes.
- Prefer Server Components unless client state, browser APIs, or interactivity require Client Components.
- Keep route files thin; move domain logic into `src/lib`.
- Preserve existing folder conventions unless a change clearly improves architecture.

## TypeScript

- Use explicit types for financial records, evidence, decisions, scores, scenarios, and timeline events.
- Avoid `any` for domain data.
- Keep calculations in shared engines, not UI components.
- Prefer discriminated unions for decision types, statuses, and source domains.

## Components

- Components should be purposeful and domain-aware.
- Reusable UI should not hide financial meaning.
- Dense dashboard components must keep stable dimensions and responsive constraints.
- Avoid nested cards.

## Data and Calculations

- Never duplicate calculations across pages.
- Financial Vault owns verified facts.
- Domain engines own derived values.
- Decision Engine owns recommendation scoring.
- UI owns presentation.

## Naming

- Use Vireon for product-facing copy.
- Keep legacy tool paths or env names only when needed for compatibility.
- Name workflow actions by outcome, such as `prepareLenderPack`, `reduceMonthlySpending`, or `completeFinancialProfile`.
