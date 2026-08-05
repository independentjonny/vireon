# Vireon

Vireon is an AI Financial Operating System. It is designed to become the single place where a person manages, models, and improves every aspect of their financial life.

The north star is a Vault-grounded AI CFO: every recommendation should connect to verified financial data, explain evidence and confidence, and rank actions by expected financial value.

See [docs/README.md](./docs/README.md) for the operating manual, [PRODUCT_VISION.md](./PRODUCT_VISION.md) for the master product vision, and [VIREON_PLATFORM_ROADMAP.md](./VIREON_PLATFORM_ROADMAP.md) for the build sequence.

## PostgreSQL Pilot v1

PostgreSQL Pilot v1 is complete and frozen as Vireon's migration safety platform for Supabase PostgreSQL. It provides target validation, restricted runtime-role provisioning, migration execution, post-migration verification, public-schema-only backup and disposable restore rehearsal.

Canonical operator commands:

```powershell
npm run postgres:pilot:validate-targets
npm run postgres:pilot:bootstrap
npm run postgres:pilot:execute:preflight
$env:VIREON_PILOT_EXECUTE_CONFIRM = "APPLY_MIGRATIONS_TO_PILOT"
npm run postgres:pilot:execute
npm run postgres:pilot:rollback-check
```

See [docs/POSTGRES_PILOT_V1.md](./docs/POSTGRES_PILOT_V1.md) and [docs/POSTGRES_PHASE2_ROADMAP.md](./docs/POSTGRES_PHASE2_ROADMAP.md).

PostgreSQL Phase 2 application persistence has completed the Financial Vault, shared financial read model, core decisioning domains, transactions/subscriptions and active Housing scenarios for private-beta review. Digital Twin, Decision Centre, Action Workflows, AI CFO history, Daily Review history, Goals, transaction imports, subscription intelligence and Housing scenario history now use PostgreSQL through the restricted runtime role for active routes and UI surfaces. See [docs/APPLICATION_PERSISTENCE_ARCHITECTURE.md](./docs/APPLICATION_PERSISTENCE_ARCHITECTURE.md), [docs/REPOSITORY_CONVENTIONS.md](./docs/REPOSITORY_CONVENTIONS.md), and [docs/API_PERSISTENCE_MATRIX.md](./docs/API_PERSISTENCE_MATRIX.md). Wider application persistence is not complete until excluded domains such as notifications, exports, account deletion and operational tooling are converted or explicitly retired.

## Engineering Supervisor

The Neven engineering supervisor can hand a high-level implementation task to Codex, run the repository validation gates, perform an independent implementation review, request OpenAI Responses API debugging guidance after failures, and resume through `.ai-supervisor` state without auto-committing or deploying.

```powershell
npm run engineer -- "Continue PostgreSQL Phase 2"
```

Passing tests alone is not enough for completion; the reviewer must return a sufficiently confident `PASS`. Every task automatically produces `.ai-supervisor/evidence/<task-id>/reviewer-input.json` with targeted diffs, command-level validation, named tests, persistence/integrity/secret/migration evidence and dirty-worktree provenance. Dry-run and mock-review modes are available for local bridge checks.

See [docs/ENGINEERING_SUPERVISOR.md](./docs/ENGINEERING_SUPERVISOR.md).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the main dashboard by modifying `src/app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Product Direction

Every page should become an AI workspace that answers:

- What changed?
- Why did it change?
- What should the user do?
- What happens if they do nothing?
- How much money is involved?
- What evidence and confidence supports the recommendation?

Core systems include the Financial Vault, AI Decision Engine 2.0, My AI CFO, Financial Timeline, Digital Financial Twin, Goal Engine, Automation Engine, Financial Health Score, Money Map, Life Planner, Refinance Engine, and Document Intelligence Engine.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
