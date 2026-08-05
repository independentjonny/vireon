# Vireon Platform Roadmap

This roadmap converts the master product vision into buildable platform layers. Use it to decide what to build next when a task is open-ended.

## Layer 1: Vault-First Data Foundation

Goal: make the Financial Vault the source of truth for every recommendation.

- Define canonical records for transactions, documents, assets, liabilities, goals, investments, subscriptions, tax, employment, lending, and property.
- Attach evidence references to recommendations and scores.
- Normalize document extraction results into searchable structured fields with confidence and citations.
- Add completeness scoring for missing Vault data.
- Build cross-domain entity links, such as mortgage to property, loan to cash flow, tax return to borrowing capacity, and subscriptions to spending goals.

## Layer 2: AI Decision Engine 2.0

Goal: rank actions by expected financial value.

- Extend each decision with priority, financial impact, probability, confidence, difficulty, time required, risk reduction, cash improvement, net worth improvement, borrowing improvement, tax improvement, and life improvement.
- Calculate an Overall Opportunity Score and Expected Financial Value.
- Sort decisions by expected value rather than severity.
- Show why each recommendation exists, what evidence supports it, assumptions, risks, alternatives, and the next action.
- Track status from new to reviewed to workflow started to actioned.

## Layer 3: My AI CFO

Goal: replace generic chat with Vault-grounded decision support.

- Answer questions only from verified Vault context where possible.
- Cite supporting transactions, documents, assumptions, and confidence.
- Support decisions like buying a house, refinancing, salary sacrifice, reducing tax, buying ETFs, changing work days, renovating, retirement, and helping family.
- Escalate missing data as a concrete Vault completion task.
- Keep the CFO panel available globally as a pinned assistant.

## Layer 4: Timeline and Digital Twin

Goal: make the user's financial life explainable over time and simulatable into the future.

- Build a chronological Financial Timeline for statements, tax returns, income changes, property events, rate changes, renewals, dividends, goals, milestones, and documents.
- Create a simulation model for income, expenses, tax, assets, liabilities, investments, property, retirement, and goals.
- Support what-if scenarios including salary changes, job loss, baby, new mortgage, investment property, inheritance, divorce, holiday, market fall, rate rise, and super changes.
- Recalculate cash flow, borrowing, retirement, tax, net worth, goals, and timeline for each scenario.

## Layer 5: Goals, Automation, and Proactive AI

Goal: stop only reporting and start doing useful work.

- Make goals intelligent and automatically updated from transactions and Vault changes.
- Add automations for rates, insurance, utilities, subscriptions, salary missing, low cash, credit card due dates, tax documents, affordability changes, borrowing improvements, ETF triggers, and emergency fund thresholds.
- Build a daily proactive briefing that summarizes what changed overnight and offers one-click workflows.
- Convert passive review actions into workflows: Refinancing Wizard, Reduce Monthly Spending, Complete My Financial Profile, Prepare Lender Pack, and Tax Document Checklist.

## Layer 6: Experience Modes

Goal: serve both consumers and professionals without diluting either workflow.

- Executive Mode: net worth, cash, borrowing, goals, top five actions, upcoming events, and financial health.
- Professional Mode: deeper analytics, evidence, audit trail, assumptions, document citations, and confidence for accountants, advisers, mortgage brokers, and family offices.
- Money Map: interactive map of income, accounts, bills, subscriptions, savings, investments, loans, and net worth.
- Life Planner: model children, travel, semi-retirement, relocation, investment property, business, private school, renovation, and parent care.

## Build Order

1. Add data contracts for Vault evidence and decision scoring.
2. Upgrade the current AI Decision Centre to AI Decision Engine 2.0.
3. Expand My AI CFO into a real Vault-grounded workspace.
4. Add Timeline as a cross-domain event stream.
5. Add first Digital Twin scenario simulations.
6. Add proactive daily briefing and one-click workflows.
7. Add Money Map, Executive Mode, and Professional Mode.
