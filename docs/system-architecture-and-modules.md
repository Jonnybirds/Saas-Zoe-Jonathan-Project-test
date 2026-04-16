# AegisRisk Intelligence Cloud — Phase 2 & 3
## Enterprise System Architecture + Detailed Module Breakdown

This document implements:
- **Phase 2:** Full enterprise architecture design.
- **Phase 3:** Detailed definition of all 25 core platform modules.

---

## 1) Architecture Principles

1. **Tenant isolation first**: all data and compute paths are tenant-scoped by design.
2. **Auditability by default**: every write action and AI recommendation produces immutable audit evidence.
3. **Explainability over black box**: decision outputs include rationale, factors, confidence, and source lineage.
4. **Secure-by-default APIs**: zero trust, short-lived credentials, strict authorization checks.
5. **Composable platform**: modular architecture so insurers, lenders, and asset managers can adopt incrementally.
6. **Operational reliability**: SLO-driven engineering with graceful degradation and backpressure controls.

---

## 2) High-Level System Architecture

## 2.1 Chosen approach: **Modular Monolith + Event-Driven Spine**

### Why not pure microservices on day 1
- Pure microservices increase operational and cognitive overhead (service sprawl, version drift, complex local dev).
- Early-stage product-market fit is faster with cohesive domain boundaries and shared transaction integrity.

### Why this choice wins
- **Modular monolith (NestJS)** enforces bounded contexts via internal modules and explicit contracts.
- **Event-driven spine** (Kafka-compatible) decouples heavy workloads, async integrations, and analytics pipelines.
- Enables later extraction into microservices with low rewrite risk where scaling boundaries become clear.

## 2.2 Core topology

- **Frontend**: Next.js (TypeScript) web app + admin console.
- **API layer**: NestJS HTTP API + webhook API + internal worker APIs.
- **Core datastore**: PostgreSQL (OLTP) with row-level tenant isolation and audit schemas.
- **ORM**: Prisma for type-safe data access and migration discipline.
- **Cache/queue**: Redis for caching, rate-limit counters, short-lived jobs.
- **Event bus**: Kafka/Redpanda for durable domain events.
- **Object storage**: S3-compatible storage for documents and report artifacts.
- **Search & retrieval**: OpenSearch + vector index extension (or pgvector initially).
- **AI orchestration**: model gateway + prompt registry + policy guardrails.
- **Observability**: OpenTelemetry, Prometheus, Loki/ELK, Grafana, alerting stack.

---

## 3) Domain-Driven Design (Bounded Contexts)

1. **Identity & Access**
2. **Tenant & Org Management**
3. **Data Ingestion & Connectors**
4. **Financial Data Processing**
5. **Risk Scoring & Policy Rules**
6. **AI Decisioning & Explainability**
7. **Underwriting Operations**
8. **Claims Operations**
9. **Fraud Signals**
10. **Portfolio Analytics**
11. **Workflow Automation**
12. **Billing & Usage**
13. **Audit & Compliance**
14. **Notifications**
15. **Platform Admin/Back-office**

Each context has:
- isolated module folder,
- own service + repository layer,
- explicit DTO contracts,
- event publishers/subscribers,
- permission guards.

---

## 4) Multi-Tenant Isolation Model

## 4.1 Isolation strategy
- **Primary model:** shared PostgreSQL cluster, shared schema, strict tenant partition keys (`tenant_id`) + Postgres RLS.
- **Optional enterprise tier:** dedicated database per tenant (logical isolation upgrade).
- **Storage isolation:** object paths include `tenant_id` and encryption context per tenant.

## 4.2 Request scoping
- Tenant context resolved from signed JWT + org membership.
- Every query passes through tenant-aware repository helpers.
- Runtime check blocks unscoped data access.

## 4.3 Data movement controls
- Cross-tenant joins blocked by design.
- Event payloads include tenant metadata and are encrypted where required.
- Audit events store actor, tenant, object id, old/new value hashes.

---

## 5) Secure API Layer

- **Protocol:** HTTPS only, TLS 1.2+.
- **Auth:** JWT access tokens + refresh flow, API keys for machine integrations.
- **AuthZ:** RBAC + attribute checks (ABAC) for sensitive actions.
- **Idempotency:** required for payment writes, ingestion imports, webhook callbacks.
- **Rate limiting:** per tenant, per IP, per endpoint risk tier.
- **Input security:** schema validation, payload size limits, file type and malware scanning.
- **Output controls:** field-level redaction for PII based on role.

---

## 6) Data Ingestion and Processing Pipeline

## 6.1 Ingestion sources
- REST pull connectors (core systems).
- Webhook push connectors.
- SFTP batch (CSV/JSON).
- Manual upload (portal).

## 6.2 Pipeline stages
1. Ingest
2. Validate schema and tenant ownership
3. Normalize to canonical financial/risk model
4. Enrich with third-party signals
5. Persist raw + curated tables
6. Publish domain events for scoring/analytics/AI workflows

## 6.3 Guarantees
- At-least-once event delivery.
- Idempotency keys prevent duplicate writes.
- Dead-letter queues for failed records with replay UI.

---

## 7) AI Inference and Decision Layer

- **Model gateway** routes tasks to best-fit model (LLM, tabular model, anomaly model).
- **Prompt registry** version-controls prompts by use case and compliance policy.
- **Context builder** fetches tenant-scoped facts/docs.
- **Tool orchestration** allows AI to call approved calculators, policy engines, and retrieval tools.
- **Decision package output:** recommendation, confidence, rationale, feature contributions, citations, model/prompt versions.

---

## 8) Analytics, Reporting, and Compliance Architecture

- OLTP -> event stream -> analytics store (near real-time).
- Precomputed risk aggregates for dashboard speed.
- Reporting service generates immutable PDF/CSV with checksum.
- Compliance service can reconstruct decision timeline for any case.

---

## 9) Reference Runtime Architecture (Kubernetes-ready)

- `web-app` deployment (Next.js)
- `api-core` deployment (NestJS)
- `worker-jobs` deployment (async processors)
- `event-consumers` deployment (Kafka consumers)
- `postgres` managed service
- `redis` managed service
- `object-storage` managed service
- `kafka/redpanda` managed service
- `otel-collector` + `prometheus` + `grafana`

Scaling:
- HPA on CPU + queue lag + p95 latency.
- Separate worker pools for ingestion, AI, and reporting.

---

## 10) Detailed Module Breakdown (25 Modules)

Format per module:
- **Purpose**
- **Features**
- **Data Models**
- **API Endpoints**
- **Permissions**
- **Business Rules**
- **Events**
- **Dependencies**
- **Edge Cases**

---

## Module 1 — Authentication & Security
- **Purpose:** secure access and session lifecycle.
- **Features:** login, token refresh, session revocation, MFA-ready factors, device fingerprinting.
- **Data Models:** `auth_sessions`, `mfa_factors`, `security_events`, `password_reset_tokens`.
- **API Endpoints:** `POST /v1/auth/login`, `POST /v1/auth/refresh`, `POST /v1/auth/logout`, `POST /v1/auth/mfa/challenge`.
- **Permissions:** public for login endpoints; authenticated for session controls.
- **Business Rules:** lockout after configurable failed attempts; risk-based step-up auth.
- **Events:** `auth.login.succeeded`, `auth.login.failed`, `auth.session.revoked`.
- **Dependencies:** Users/RBAC, Audit, Notifications.
- **Edge Cases:** clock skew token failures, brute-force attacks, compromised refresh token replay.

## Module 2 — Multi-tenant Organization Management
- **Purpose:** lifecycle of organizations/tenants and business units.
- **Features:** create org, environments, tenant settings, data residency options.
- **Data Models:** `tenants`, `organizations`, `org_units`, `tenant_settings`.
- **API Endpoints:** `POST /v1/tenants`, `GET /v1/tenants/:id`, `PATCH /v1/tenants/:id/settings`.
- **Permissions:** `platform_admin`, `tenant_owner`.
- **Business Rules:** immutable tenant identifier; soft-delete with retention policy.
- **Events:** `tenant.created`, `tenant.updated`, `tenant.suspended`.
- **Dependencies:** Billing, Audit, Auth.
- **Edge Cases:** tenant merge/split requests, suspended tenant reactivation.

## Module 3 — Users, Roles, Permissions (RBAC)
- **Purpose:** enterprise-grade authorization controls.
- **Features:** role templates, custom roles, scoped permissions, approval for privilege escalation.
- **Data Models:** `users`, `roles`, `permissions`, `user_roles`, `policy_bindings`.
- **API Endpoints:** `POST /v1/roles`, `POST /v1/users/:id/roles`, `GET /v1/permissions`.
- **Permissions:** `iam_admin`.
- **Business Rules:** least privilege defaults; dual-control for high-risk permissions.
- **Events:** `iam.role.created`, `iam.assignment.changed`.
- **Dependencies:** Auth, Audit.
- **Edge Cases:** orphaned admin risk, role conflict resolution.

## Module 4 — Data Ingestion Layer
- **Purpose:** bring external/internal data into platform safely.
- **Features:** connectors, schema mapping, import jobs, error replay queue.
- **Data Models:** `data_sources`, `ingestion_jobs`, `ingestion_records`, `schema_mappings`.
- **API Endpoints:** `POST /v1/ingestion/jobs`, `GET /v1/ingestion/jobs/:id`, `POST /v1/ingestion/replay`.
- **Permissions:** `data_engineer`, `ops_admin`.
- **Business Rules:** enforce tenant-bound source credentials; immutable raw zone.
- **Events:** `ingestion.job.started`, `ingestion.record.failed`, `ingestion.job.completed`.
- **Dependencies:** Storage, Workflow, Notifications.
- **Edge Cases:** duplicate files, partial schema drift, malformed CSV encoding.

## Module 5 — Financial Data Processing Engine
- **Purpose:** normalize and enrich financial entities for downstream risk/AI.
- **Features:** canonicalization, reconciliation, derived metrics, quality scoring.
- **Data Models:** `accounts`, `transactions`, `counterparties`, `financial_metrics`.
- **API Endpoints:** `POST /v1/finance/process/:jobId`, `GET /v1/finance/metrics`.
- **Permissions:** `risk_analyst`, `data_engineer`.
- **Business Rules:** deterministic transforms with version tags.
- **Events:** `finance.dataset.ready`, `finance.metric.updated`.
- **Dependencies:** Ingestion, Risk Engine, Analytics.
- **Edge Cases:** currency conversion gaps, timestamp timezone drift.

## Module 6 — Risk Scoring Engine
- **Purpose:** generate risk scores and policy outcomes.
- **Features:** scorecards, model registry bindings, challenger models, calibration tracking.
- **Data Models:** `risk_models`, `risk_scores`, `risk_factors`, `policy_decisions`.
- **API Endpoints:** `POST /v1/risk/score`, `GET /v1/risk/scores/:caseId`, `POST /v1/risk/recalculate`.
- **Permissions:** `risk_manager`, `underwriter` (read), `model_admin` (write).
- **Business Rules:** score explainability required for production decisions.
- **Events:** `risk.score.generated`, `risk.policy.decisioned`.
- **Dependencies:** Financial Processing, AI Decision Engine, Audit.
- **Edge Cases:** sparse data fallback, model version rollback.

## Module 7 — AI Decision Engine
- **Purpose:** orchestrate AI recommendations across workflows.
- **Features:** LLM prompts, retrieval context, tool calls, confidence scoring.
- **Data Models:** `ai_runs`, `prompt_versions`, `ai_recommendations`, `ai_confidence`.
- **API Endpoints:** `POST /v1/ai/decide`, `GET /v1/ai/runs/:id`, `POST /v1/ai/feedback`.
- **Permissions:** `ai_operator`, `underwriter`, `risk_analyst`.
- **Business Rules:** no autonomous final approval for regulated high-risk decisions by default.
- **Events:** `ai.recommendation.created`, `ai.run.failed`.
- **Dependencies:** Knowledge Base, Risk Engine, Audit, Workflow.
- **Edge Cases:** hallucinated rationale, missing retrieval context, model timeout.

## Module 8 — Underwriting Assistant
- **Purpose:** accelerate underwriting decisions.
- **Features:** case summarization, checklist completion, recommendation drafting.
- **Data Models:** `underwriting_cases`, `uw_recommendations`, `uw_actions`.
- **API Endpoints:** `GET /v1/underwriting/cases/:id`, `POST /v1/underwriting/cases/:id/recommend`.
- **Permissions:** `underwriter`, `uw_manager`.
- **Business Rules:** manual override reason required when diverging from policy.
- **Events:** `uw.case.created`, `uw.recommendation.accepted`, `uw.decision.overridden`.
- **Dependencies:** AI Engine, Risk Engine, Document Intelligence.
- **Edge Cases:** incomplete submissions, conflicting risk signals.

## Module 9 — Fraud Detection Signals
- **Purpose:** detect suspicious behavior across claims/apps/transactions.
- **Features:** anomaly scoring, graph links, watchlist matching, alert queue.
- **Data Models:** `fraud_alerts`, `anomaly_scores`, `entity_links`, `watchlist_hits`.
- **API Endpoints:** `POST /v1/fraud/evaluate`, `GET /v1/fraud/alerts`, `PATCH /v1/fraud/alerts/:id`.
- **Permissions:** `fraud_analyst`, `fraud_manager`.
- **Business Rules:** high-severity alerts require escalation SLA.
- **Events:** `fraud.alert.created`, `fraud.alert.escalated`, `fraud.alert.closed`.
- **Dependencies:** Ingestion, AI Engine, Notifications.
- **Edge Cases:** false-positive bursts, external watchlist outages.

## Module 10 — Portfolio Analytics Dashboard
- **Purpose:** track exposure, performance, and concentration risk.
- **Features:** KPI cards, cohort analysis, scenario stress views.
- **Data Models:** `portfolios`, `positions`, `portfolio_exposures`, `scenario_runs`.
- **API Endpoints:** `GET /v1/portfolio/summary`, `POST /v1/portfolio/scenarios/run`.
- **Permissions:** `portfolio_manager`, `risk_exec`.
- **Business Rules:** scenario definitions versioned and immutable once approved.
- **Events:** `portfolio.scenario.completed`.
- **Dependencies:** Analytics Store, Risk Engine.
- **Edge Cases:** stale market data, incomplete holdings ingestion.

## Module 11 — Claims Processing Assistant
- **Purpose:** prioritize and streamline claim handling.
- **Features:** triage score, document checklist, suspicious indicators, next-best-action.
- **Data Models:** `claims`, `claim_triage_scores`, `claim_actions`, `claim_notes`.
- **API Endpoints:** `POST /v1/claims/triage`, `GET /v1/claims/:id/workbench`.
- **Permissions:** `claims_adjuster`, `claims_manager`.
- **Business Rules:** regulatory response deadlines tracked per claim type.
- **Events:** `claim.triaged`, `claim.escalated`.
- **Dependencies:** Fraud Module, AI Engine, Document Intelligence.
- **Edge Cases:** catastrophic event surge volumes, missing policy docs.

## Module 12 — Document Intelligence
- **Purpose:** extract and structure data from policies, contracts, statements.
- **Features:** OCR pipeline, entity extraction, clause detection, document classification.
- **Data Models:** `documents`, `document_pages`, `extracted_entities`, `doc_classifications`.
- **API Endpoints:** `POST /v1/documents`, `GET /v1/documents/:id/extractions`.
- **Permissions:** `doc_user`, `underwriter`, `claims_adjuster`.
- **Business Rules:** original artifact immutable; extraction versioning mandatory.
- **Events:** `document.uploaded`, `document.extracted`, `document.failed`.
- **Dependencies:** Storage, AI Engine.
- **Edge Cases:** low-quality scans, encrypted PDFs, unsupported formats.

## Module 13 — Knowledge Base + Semantic Search
- **Purpose:** retrieval of policies, procedures, and prior decisions.
- **Features:** chunking, embeddings, semantic + keyword search, citation surfacing.
- **Data Models:** `kb_documents`, `kb_chunks`, `kb_embeddings`, `kb_access_policies`.
- **API Endpoints:** `POST /v1/kb/index`, `GET /v1/kb/search`.
- **Permissions:** read scoped by role and document classification.
- **Business Rules:** tenant-only embeddings namespace.
- **Events:** `kb.document.indexed`, `kb.search.executed`.
- **Dependencies:** Document Intelligence, AI Engine.
- **Edge Cases:** embedding model upgrades, access policy mismatches.

## Module 14 — AI Copilot (Internal Assistant)
- **Purpose:** assistant for risk/ops teams in daily tasks.
- **Features:** Q&A, workflow action suggestions, policy lookup, decision drafting.
- **Data Models:** `copilot_conversations`, `copilot_messages`, `copilot_actions`.
- **API Endpoints:** `POST /v1/copilot/chat`, `POST /v1/copilot/action`.
- **Permissions:** role-specific tool grants.
- **Business Rules:** all tool actions require explicit user confirmation.
- **Events:** `copilot.response.generated`, `copilot.action.executed`.
- **Dependencies:** Knowledge Base, Workflow, AI Engine.
- **Edge Cases:** prompt injection attempts, unauthorized tool requests.

## Module 15 — Workflow Automation Engine
- **Purpose:** orchestrate approvals, tasks, and SLAs.
- **Features:** BPMN-like workflows, conditional branches, timers, escalations.
- **Data Models:** `workflows`, `workflow_versions`, `workflow_runs`, `workflow_tasks`.
- **API Endpoints:** `POST /v1/workflows`, `POST /v1/workflows/:id/publish`, `GET /v1/workflow-runs/:id`.
- **Permissions:** `workflow_admin`, `ops_manager`.
- **Business Rules:** published workflow versions immutable.
- **Events:** `workflow.run.started`, `workflow.task.assigned`, `workflow.sla.breached`.
- **Dependencies:** Notifications, RBAC, Webhooks.
- **Edge Cases:** cyclic workflow definitions, stuck human tasks.

## Module 16 — Notifications System
- **Purpose:** deliver alerts and operational notices.
- **Features:** email, SMS, in-app, webhook notifications; per-user preferences.
- **Data Models:** `notifications`, `notification_channels`, `notification_preferences`.
- **API Endpoints:** `POST /v1/notifications/send`, `PATCH /v1/notifications/preferences`.
- **Permissions:** system + role-based send rights.
- **Business Rules:** critical alerts bypass non-essential preference filters.
- **Events:** `notification.sent`, `notification.failed`.
- **Dependencies:** Workflow, Fraud, Claims.
- **Edge Cases:** provider outage fallback, duplicate sends.

## Module 17 — Billing & Usage Metering
- **Purpose:** monetize subscriptions and AI usage.
- **Features:** plan management, usage metering, invoice sync, entitlement checks.
- **Data Models:** `subscriptions`, `plan_catalog`, `usage_meters`, `invoices`.
- **API Endpoints:** `GET /v1/billing/plans`, `POST /v1/billing/usage`, `GET /v1/billing/invoices`.
- **Permissions:** `tenant_billing_admin`, `platform_finance`.
- **Business Rules:** hard/soft limits by plan, grace periods before throttling.
- **Events:** `billing.usage.recorded`, `billing.invoice.generated`, `billing.payment.failed`.
- **Dependencies:** Stripe adapter, Tenant Management.
- **Edge Cases:** clock drift in usage windows, retries causing duplicate meter writes.

## Module 18 — Admin Console
- **Purpose:** tenant and platform configuration UI/APIs.
- **Features:** settings, policy management, connector health, user management.
- **Data Models:** uses cross-module views + `admin_actions`.
- **API Endpoints:** `GET /v1/admin/health`, `PATCH /v1/admin/settings`.
- **Permissions:** `tenant_admin`, `platform_admin`.
- **Business Rules:** privileged changes require reason and audit capture.
- **Events:** `admin.setting.changed`.
- **Dependencies:** IAM, Audit, Observability.
- **Edge Cases:** misconfiguration rollback needs one-click restore.

## Module 19 — Audit & Compliance Module (Critical)
- **Purpose:** immutable evidence trail for regulators/internal controls.
- **Features:** append-only audit logs, evidence export, policy compliance checks.
- **Data Models:** `audit_logs`, `audit_evidence`, `compliance_controls`, `control_results`.
- **API Endpoints:** `GET /v1/audit/logs`, `POST /v1/audit/export`, `GET /v1/compliance/controls`.
- **Permissions:** `auditor`, `compliance_officer`, read-only exec roles.
- **Business Rules:** no hard delete; tamper-evident hashes chained by time bucket.
- **Events:** `audit.record.created`, `compliance.control.failed`.
- **Dependencies:** Every module publishes events here.
- **Edge Cases:** high-volume backfill, timezone/legal hold requirements.

## Module 20 — Reporting & Export
- **Purpose:** deliver scheduled/ad-hoc regulatory and business reports.
- **Features:** report templates, scheduled jobs, signed exports.
- **Data Models:** `reports`, `report_runs`, `report_artifacts`.
- **API Endpoints:** `POST /v1/reports/run`, `GET /v1/reports/:id/download`.
- **Permissions:** `report_admin`, `risk_exec`, `auditor`.
- **Business Rules:** generated reports are immutable and checksum-stamped.
- **Events:** `report.generated`, `report.delivery.failed`.
- **Dependencies:** Analytics, Storage, Notifications.
- **Edge Cases:** very large exports, partial data windows.

## Module 21 — API Platform (External Integrations)
- **Purpose:** partner/developer access to platform capabilities.
- **Features:** API keys, OAuth client credentials, quota controls, developer docs.
- **Data Models:** `api_clients`, `api_keys`, `api_quotas`, `api_logs`.
- **API Endpoints:** `POST /v1/developer/clients`, `POST /v1/developer/keys/rotate`.
- **Permissions:** `integration_admin`.
- **Business Rules:** key rotation every 90 days (policy-configurable).
- **Events:** `api.key.created`, `api.quota.exceeded`.
- **Dependencies:** Auth, Rate Limiter, Audit.
- **Edge Cases:** leaked key response workflow.

## Module 22 — Webhooks & Event System
- **Purpose:** outbound event delivery to customer systems.
- **Features:** subscription management, signed webhooks, retry policy, dead-letter handling.
- **Data Models:** `webhook_endpoints`, `webhook_subscriptions`, `webhook_deliveries`.
- **API Endpoints:** `POST /v1/webhooks/endpoints`, `GET /v1/webhooks/deliveries`.
- **Permissions:** `integration_admin`, `ops_admin`.
- **Business Rules:** exponential backoff retries; disable endpoint on repeated 410/401.
- **Events:** `webhook.delivery.succeeded`, `webhook.delivery.failed`.
- **Dependencies:** Event bus, API Platform.
- **Edge Cases:** downstream latency spikes, replay storms.

## Module 23 — Feature Flags
- **Purpose:** controlled rollout and safe experimentation.
- **Features:** tenant-level flags, percentage rollout, kill switch.
- **Data Models:** `feature_flags`, `flag_rules`, `flag_audits`.
- **API Endpoints:** `POST /v1/flags`, `PATCH /v1/flags/:id`, `GET /v1/flags/evaluate`.
- **Permissions:** `platform_admin`, `product_ops`.
- **Business Rules:** risky features require canary and monitoring gates.
- **Events:** `flag.changed`.
- **Dependencies:** Observability, Audit.
- **Edge Cases:** stale flag caches causing inconsistent behavior.

## Module 24 — Observability & Monitoring
- **Purpose:** ensure reliability, latency, and error visibility.
- **Features:** distributed tracing, SLO dashboards, alert routes, runbook linking.
- **Data Models:** `service_slos`, `alert_rules`, `incident_tickets`.
- **API Endpoints:** `GET /v1/ops/slo`, `POST /v1/ops/alerts/test`.
- **Permissions:** `sre`, `platform_admin`, read-only for execs.
- **Business Rules:** sev1 pages on critical path SLO breaches.
- **Events:** `incident.opened`, `incident.resolved`.
- **Dependencies:** all services instrumented with OTel.
- **Edge Cases:** alert fatigue, missing spans from async workers.

## Module 25 — Internal Back-office Tools
- **Purpose:** support operations, customer success, incident response.
- **Features:** tenant impersonation (safe mode), support notes, remediation tasks.
- **Data Models:** `support_cases`, `support_actions`, `impersonation_sessions`.
- **API Endpoints:** `POST /v1/backoffice/cases`, `POST /v1/backoffice/impersonate/start`.
- **Permissions:** `support_agent`, `support_admin` with strict policy controls.
- **Business Rules:** impersonation always read-only by default; elevated mode needs approval.
- **Events:** `support.case.opened`, `support.impersonation.started`.
- **Dependencies:** IAM, Audit, Notifications.
- **Edge Cases:** abuse prevention, PII exposure controls.

---

## 11) Cross-Module Event Taxonomy (Core)

- **Identity:** `auth.*`, `iam.*`
- **Tenant:** `tenant.*`
- **Data:** `ingestion.*`, `finance.*`
- **Risk/AI:** `risk.*`, `ai.*`, `fraud.*`
- **Ops:** `workflow.*`, `notification.*`, `report.*`
- **Commercial:** `billing.*`
- **Governance:** `audit.*`, `compliance.*`

Event envelope standard:
- `event_id`, `event_type`, `occurred_at`, `tenant_id`, `actor_id`, `trace_id`, `payload_version`, `payload`.

---

## 12) Major Technical Decisions and Justifications

1. **NestJS + modular monolith** for speed, structure, and easier team onboarding.
2. **PostgreSQL + Prisma** for transactional integrity, mature tooling, and type safety.
3. **Redis** for low-latency caching and queue primitives.
4. **Kafka/Redpanda** to scale async throughput and decouple producers/consumers.
5. **S3-compatible storage** for durable document and report artifacts.
6. **RLS + tenant-scoped repositories** for defense-in-depth data isolation.
7. **OpenTelemetry-first** to support enterprise SRE expectations and faster RCA.
8. **Stripe usage-metered billing** for recurring + variable AI consumption monetization.

---

## 13) Non-Functional Targets (Initial)

- **API availability:** 99.9% (MVP) -> 99.95% (enterprise maturity).
- **p95 read latency:** < 250ms for core dashboards.
- **p95 write latency:** < 400ms for core transactional endpoints.
- **AI recommendation latency:** < 4s p95 for standard cases.
- **RPO/RTO:** RPO <= 15 min, RTO <= 2 hours.
- **Audit completeness:** 100% for privileged and decision-impacting actions.

---

## 14) Delivery Sequence for Architecture Buildout

1. Foundation: IAM, Tenant, Audit, API gateway, observability.
2. Data path: ingestion + processing + canonical model.
3. Decision path: risk scoring + AI decision package + HITL workflow.
4. Operational modules: underwriting/claims/fraud + portfolio dashboards.
5. Commercial controls: billing, usage, enterprise admin + developer platform.

This sequence minimizes compliance risk while maximizing early customer ROI and expansion potential.
