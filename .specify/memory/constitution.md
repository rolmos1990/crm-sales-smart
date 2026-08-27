# Karia App CRM Constitution

## Core Principles

### I. Modular Business Architecture

Code MUST be organized by business capability: CRM, Conversations, Sales, Products, Automations, Integrations, and Identity. UI components, application logic, persistence, and external providers MUST remain separated. React components MUST NOT access Prisma or provider SDKs directly. New features MUST extend existing modules before introducing parallel abstractions.

### II. Server-Enforced Business Rules

The server is the authority for validation, authorization, state transitions, monetary calculations, and channel restrictions. Inputs MUST be validated at system boundaries with typed schemas such as Zod. Client-side validation improves UX but MUST NOT be the only enforcement. Opportunity, quotation, and order states MUST change through explicit use cases.

### III. Reliable Data and Events

Operations requiring immediate consistency MUST use database transactions. Side effects such as messages, notifications, AI processing, and synchronization MUST run only after the primary operation succeeds, using domain events and RabbitMQ where appropriate. Webhooks, consumers, and retryable jobs MUST be idempotent and tolerate duplicate or out-of-order delivery.

### IV. Replaceable Integrations

Instagram, WhatsApp, email, S3, and AI providers MUST be accessed through internal contracts and adapters. Business logic MUST NOT depend on provider SDK types, payloads, or error codes. Integrations MUST define timeouts, bounded retries, error handling, and safe degradation. AI output MUST NOT bypass deterministic rules, permissions, or validation.

### V. Security and Quality (NON-NEGOTIABLE)

Every business query and mutation MUST be scoped to the authenticated tenant. Secrets and personal data MUST NOT appear in source control or logs. Changes MUST include tests proportional to risk: unit tests for business rules, integration tests for persistence/events/adapters, and Playwright tests for critical user journeys. A change is not complete unless it builds and all relevant tests pass.

## Technical Constraints

- Approved stack: Next.js 15, React 19, TypeScript, Node.js 20+, Prisma, PostgreSQL, Zod, Vitest, Playwright, and RabbitMQ.
- Prisma migrations MUST be versioned, reviewable, and safe for existing data. Destructive changes require an explicit migration or rollback strategy.
- UI changes MUST remain responsive and accessible, preserve desktop behavior when optimizing mobile, and avoid unjustified performance regressions.
- Dates, time zones, currency, taxes, identifiers, and state values MUST use explicit, consistent representations.
- New dependencies require a concrete need and MUST NOT duplicate an existing capability.

## Development Workflow

Every feature MUST begin with a specification defining scope, acceptance criteria, business rules, edge cases, and exclusions. The implementation plan MUST identify affected modules, data changes, events, integrations, and tests. Missing business decisions MUST be recorded as assumptions or raised for clarification; AI agents MUST NOT invent requirements that materially alter product behavior.

Pull requests MUST verify constitutional compliance, relevant tests, tenant isolation, migration safety, and backward compatibility. Any intentional exception MUST be documented and approved before merge.

## Governance

This constitution supersedes ad hoc implementation choices, prompts, and plans. Specifications may add constraints but MUST NOT weaken these principles. Amendments require a documented rationale, impact analysis, migration considerations, approval, and a constitution version update.

Version changes follow semantic versioning: MAJOR for principle removal or redefinition, MINOR for new principles or material obligations, and PATCH for clarifications that do not change intent.

**Version**: 1.0.0 | **Ratified**: 2026-08-27 | **Last Amended**: 2026-08-27
