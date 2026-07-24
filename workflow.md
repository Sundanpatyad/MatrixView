# Enterprise Work OS — Product Requirements Document

**Status:** Living document — Part 1 of N
**Owner:** Product Management
**Last Updated:** 2026-07-19
**Product brand:** DockX
**Distribution:** Product, Design, Frontend, Backend, Desktop, DevOps, QA, AI Engineering, Investors

> This is Part 1 of an incrementally-built PRD. Because the full platform spans 26 modules with 24 required sub-sections each, plus full screen specs, this document is built module-by-module across multiple sessions and appended to. Part 1 covers the strategic foundation, system architecture, release phasing, and full detail for the three Phase 1 "trust layer" modules: **Authentication, Organization Management, Employee Management**.

> **Living implementation rule:** whenever code/UI is shipped, update **Part C — Implementation Progress** in this same file so the PRD always reflects what exists in the repo.

---

## Table of Contents — Part 1

- A1. Executive Summary
- A2. Product Vision
- A3. Target Users & Market
- A4. Personas
- A5. User Roles
- A6. System Architecture
- A7. Global RBAC Permission Matrix
- A8. Release Phasing Strategy (MVP → Phase 4)
- B1. Module: Authentication
- B2. Module: Organization Management
- B3. Module: Employee Management
- C1. Repo layout & stack (as built)
- C2. Web UI checklist (trust layer)
- C3. Next implementation slices
- Appendix: What's Coming in Part 2

---

# PART A — STRATEGIC FOUNDATION

## A1. Executive Summary

Enterprise Work OS is a unified workforce operating system that replaces the fragmented stack most companies run today — a project tool (Jira/ClickUp/Monday), a chat tool (Slack/Teams), a monitoring tool (Hubstaff/Time Doctor), a docs tool (Notion), a storage tool (Drive), and a recording tool (Loom) — with **one platform, two purpose-built clients, and one backend of record**.

The core insight driving the architecture: **employees and managers do fundamentally different jobs inside the product**, and forcing them into the same UI is why competitors feel bloated. Employees need a lightweight always-on workspace that tracks time and surfaces their tasks with minimal friction. Managers need a management console with visibility, reporting, and configuration. Enterprise Work OS ships these as two clients — a **Desktop Agent** (execution surface) and a **Web Application** (management surface) — both backed by a single Node.js/MongoDB modular monolith backend, so data is captured once and consumed everywhere.

## A2. Product Vision

> "One backend of record for how work actually happens — captured automatically at the point of execution (Desktop), and made actionable at the point of decision (Web)."

Design principles that every feature in this PRD must satisfy:

1. **Capture at the source.** Time, activity, and task state should update themselves from real work (opening an app, clicking a task, checking in) rather than requiring employees to manually log data wherever avoidable.
2. **Two clients, one truth.** The Desktop Agent and Web App are different views over the same backend entities — never divergent data models.
3. **Manager needs visibility, not surveillance theater.** Monitoring features exist to answer "is work progressing and is anyone blocked," not to produce anxiety; this shapes defaults (e.g., no screenshots in MVP, aggregate productivity scores visible to employees themselves).
4. **Offline-first at the edge.** The Desktop Agent must function through network loss and sync later — a laptop closing on a plane cannot lose a day of attendance data.
5. **AI is a cross-cutting capability, not a product silo.** AI features attach to existing modules (summarize this project, generate this report) rather than living in an isolated "AI tab." In the backend this is an in-process `ai` module inside the modular monolith — not a separate microservice.

## A3. Target Users & Market

| Segment | Why they buy | Primary modules they lean on |
|---|---|---|
| Software companies (10–500 devs) | Replace Jira + Slack + Hubstaff with one bill | Task Mgmt, Chat, Desktop Monitoring |
| Digital marketing / design agencies | Client-billable time accuracy, project profitability | Time Tracking, Client Portal, Reports |
| IT consultancies / BPOs / call centers | Compliance-grade attendance & productivity proof | Attendance, Monitoring, Payroll |
| Construction / field service | Distributed, non-desk workforce needing mobile-first check-in | Mobile app (Phase 4), Attendance |
| Enterprise businesses (500+) | Consolidation, SSO, audit, RBAC at scale | RBAC, Audit Logs, Integrations, API |

## A4. Personas

| Persona | Role | Primary client | Top 3 jobs-to-be-done |
|---|---|---|---|
| **Riya**, Software Engineer | Employee | Desktop Agent | See my tasks, track time without thinking about it, message my team |
| **Karan**, Engineering Manager | Team Lead / PM | Web App | See who's blocked, reassign work, ship weekly status to leadership |
| **Neha**, Head of HR | HR / Admin | Web App | Track attendance & leave accurately, run payroll-ready reports |
| **Arjun**, Agency Founder | Org Owner | Web App | See project profitability, prove billable hours to clients |
| **Meera**, Client Stakeholder | Client | Web App (scoped) | See project progress without seeing internal chat/HR data |
| **Vikram**, IT/DevOps Admin | Super Admin | Web App | Provision org, configure SSO, own security/compliance posture |

## A5. User Roles

| Role | Scope | Typical client |
|---|---|---|
| Super Admin | Platform-wide, multi-tenant operator (Enterprise Work OS's own ops team) | Web (internal console) |
| Organization Owner | Full control of one tenant, billing owner | Web |
| Admin | Full operational control, no billing | Web |
| HR | Employee lifecycle, attendance, leave, payroll | Web |
| Project Manager | Projects/tasks under their scope | Web (+ Desktop for their own tasks) |
| Team Lead | Team-level task & monitoring visibility | Web (+ Desktop) |
| Employee | Own tasks, own time, chat | Desktop (+ light Web) |
| Client | Read-only scoped project visibility | Web (client portal view) |
| Guest | Time-boxed, single-project access | Web (client portal view) |

Full permission-by-module matrix: see **A7**.

---

## A6. System Architecture

### A6.1 High-Level Architecture

```text
                          Enterprise Work OS
        ┌──────────────────────────────────────────────┐
        │     Backend — Node.js Modular Monolith        │
        │              (MongoDB)                        │
        │------------------------------------------------│
        │ Authentication      Notifications              │
        │ Organizations       Reports                    │
        │ Employees           Analytics                  │
        │ Projects            AI (in-process module)     │
        │ Tasks               Files                      │
        │ Chat                Audit / RBAC                │
        └──────────────────────────────────────────────┘
                    ▲                         ▲
             REST API / WebSocket      REST API / WebSocket
                    │                         │
        ┌───────────┘                         └───────────┐
        ▼                                                  ▼
   Desktop Agent                                   Web Application
 (Tauri + React, per-OS)                          (React.js SPA)
   "Employee Workspace"                            "Management Portal"
                                                              ▲
                                                     REST API │
                                                              ▼
                                                  Mobile App (Phase 4, React Native)
```

**Architecture style:** modular monolith — one deployable Node.js process, one MongoDB database, modules owning their routes/services/models. No separate microservices in MVP (or planned phases); AI, jobs, and realtime all live inside the same backend process (or worker process of the same codebase).

**Design rule:** the backend is the single source of truth for every entity. Neither client is permitted to hold business logic that the other client must replicate — e.g., "what counts as idle time" is a backend rule, not a Desktop Agent constant, so a future web-based lightweight tracker or mobile check-in can reuse it.

### A6.2 Client Feature Ownership

This determines which client a feature is built into. Getting this split wrong is the #1 way this category of product becomes bloated — so it is treated as an architectural contract, not a UI preference.

| Module | Desktop Agent | Web App | Notes |
|---|---|---|---|
| Authentication | Silent/session login | Full login, SSO, password reset | Desktop uses long-lived device session |
| Attendance | Primary (check in/out, break, lunch) | Read-only history + manual correction (Admin/HR) | |
| Employee Monitoring | Data producer (all tracking signals) | Data consumer (dashboards, live view) | Desktop never shows other employees' data |
| Task Management | Execute (view, start, pause, complete, comment) | Author (create, assign, plan, Kanban/Timeline/Table views) | Employees can create subtasks/comments on Desktop; full authoring is Web |
| Project Management | Not present | Full ownership | |
| Chat | Full client (DM, channels, calls-lite) | Full client (same backend, web-optimized layout) | Shared Socket.IO channel |
| Notifications | OS-level toast + in-app feed | In-app feed + email digest | |
| Files | Upload/attach from task context | Full file browser, folders, permissions | |
| Knowledge Base | Read-only quick view | Full authoring (wiki) | |
| Reports / Analytics | Not present | Full ownership | |
| AI Assistant | Lightweight chat widget (my day, my tasks) | Full AI dashboard (org-wide queries) | Same AI module inside the monolith, scoped by role |
| Settings / RBAC / Org Mgmt | Not present | Full ownership | |
| Payroll / Leave | Request leave (lightweight) | Full ownership | |

### A6.3 Technology Stack

| Layer | Stack | Rationale |
|---|---|---|
| Desktop | Tauri + React + TypeScript, Rust core, SQLite (offline cache), native auto-updater, OS-level activity APIs, WebSocket client | Tauri gives native OS hooks (idle/lock/sleep detection) at a fraction of Electron's memory/binary footprint — critical since this runs all day in the background on every employee machine |
| Web | React.js + TypeScript (Vite), React Router, Tailwind CSS, shadcn/ui | SPA management portal; shared component patterns with Desktop; client-side routing for dashboards and settings |
| Backend | Node.js (TypeScript), Express or Fastify, MongoDB (system of record via Mongoose), Redis (cache + pub/sub + session revocation), Socket.IO (realtime chat/presence/live monitoring), BullMQ (background jobs: report generation, AI summarization, offline-sync reconciliation) | Modular monolith: each domain (auth, orgs, employees, …) is a folder-owned module with its own routes/services/models, deployed as one API. Maps 1:1 to the module list in A5 without microservice overhead |
| Mobile (Phase 4) | React Native | Field-service / on-the-go check-in and approvals; not a full monitoring surface |
| AI | LLM calls from an in-process `ai` module inside the backend (never called directly by clients) | Keeps prompts, cost control, and data-scoping centralized; no separate AI microservice |

### A6.4 Core Data Flow — "A Day in the Life"

```text
Laptop powers on
   ↓
Desktop Agent auto-starts, resumes session silently
   ↓
Heartbeat to backend every 30s (liveness + clock sync)
   ↓
Employee clicks Check In  →  Attendance record opened
   ↓
Manager assigns a task on Web  →  pushed to Desktop via WebSocket in real time
   ↓
Employee starts task  →  Desktop begins granular tracking:
      active app / active window / website / idle / locked
   ↓
Employee comments + uploads a file on the task
   ↓
Employee marks task complete
   ↓
Manager sees status change instantly on Web (no refresh)
   ↓
Employee checks out  →  Attendance record closed
   ↓
Nightly job: daily report + productivity score computed (BullMQ worker in same codebase)
   ↓
Analytics dashboards refresh for managers
```

### A6.5 Sync & Offline Model

- **Heartbeat:** Desktop Agent pings every 30s; 3 missed heartbeats (90s) without a lock/sleep signal ⇒ flagged as possible "internet disconnect," not idle.
- **Offline cache:** all tracking events are written to local SQLite first, then flushed to backend in batches; if offline >X minutes, events queue and sync on reconnect with original timestamps preserved (never re-stamped to reconnect time).
- **Conflict resolution:** attendance/task-state conflicts (e.g., manager edits attendance while Desktop is offline) resolve by "server wins" for administrative edits, with an audit trail entry showing the override.
- **Clock authority:** the backend clock is authoritative; Desktop Agent reports client time only as a courtesy and drift is corrected server-side to prevent time-tampering.

---

## A7. Global RBAC Permission Matrix (Module-Level)

`F` = Full · `S` = Scoped (own team/project only) · `R` = Read-only · `O` = Own records only · `–` = No access

| Module | Super Admin | Org Owner | Admin | HR | PM | Team Lead | Employee | Client | Guest |
|---|---|---|---|---|---|---|---|---|---|
| Org Management | F | F | F | R | – | – | – | – | – |
| Employee Management | F | F | F | F | R | S | O | – | – |
| RBAC / Roles | F | F | S | – | – | – | – | – | – |
| Attendance | F | F | F | F | S | S | O | – | – |
| Monitoring | F | F | F | S | S | S | O (self) | – | – |
| Projects | F | F | F | R | S | S | O | S | O |
| Tasks | F | F | F | R | S | S | O | R | O |
| Chat | F | F | F | F | F | F | F | S | S |
| Files | F | F | F | R | S | S | O | S | O |
| Reports | F | F | F | S | S | S | O | S | – |
| Analytics | F | F | F | S | S | S | – | – | – |
| Payroll | F | F | S | F | – | – | O | – | – |
| Leave | F | F | F | F | S | S | O | – | – |
| Audit Logs | F | F | S | R (HR-scope) | – | – | – | – | – |
| Settings | F | F | S | – | – | – | – | – | – |
| Integrations / API | F | F | S | – | – | – | – | – | – |

*This matrix is expanded to field-level permissions inside each module's own section (see B1–B3 below for Authentication/Org/Employee; remaining modules follow in later parts).*

---

## A8. Release Phasing Strategy

Rather than a flat feature list, the platform ships in four phases. Each phase is a shippable, sellable product — not an internal milestone.

### Phase 0 → Phase 1 (MVP): "Launch Core" — *Prove the two-client model works*

**Goal:** an org can onboard, employees can be added, RBAC works, and basic time + task truth is captured automatically. This is the minimum an agency or software team would pay for instead of Toggl + Trello.

| Module | Included in MVP |
|---|---|
| Authentication | Email/password, invite flow, session mgmt (SSO deferred to Phase 4) |
| Organization Management | Org setup, departments, teams (basic) |
| Employee Management | Onboarding, profiles, deactivation |
| RBAC | Core 9 roles, module-level permissions (field-level deferred) |
| Attendance | Check in/out, break, lunch, manual correction |
| Desktop Agent — Monitoring (MVP subset) | Heartbeat, idle detection, lock/sleep/shutdown detection, active app/window tracking |
| Project Management (basic) | Create project, add members, milestones |
| Task Management (core) | Task/subtask, Kanban, List view, comments, attachments, priority |
| Notifications | In-app + email, task assigned/mentioned/due |
| Settings | Org profile, basic preferences |
| Audit Logs (basic) | Login events, permission changes, attendance edits |
| Reports (basic) | Attendance, task status |

### Phase 2: "Collaboration Layer"

Chat (DM, channels, threads, reactions), Calendar, Meetings (scheduling + basic video via 3rd-party embed), Files (full drive-style browser), Knowledge Base (wiki), Leave Management, Team Collaboration surfaces, Client portal (scoped read-only view).

### Phase 3: "Depth & Proof" — Advanced Monitoring, Analytics, Payroll

Full monitoring stack (website/app usage detail, timeline view, productivity scoring, screenshots as opt-in), Analytics (leaderboards, heatmaps, department comparison), advanced Reports, Payroll integration (export + provider integrations), Sprints/Roadmaps/Dependencies/Automation in Task Mgmt, Guest role, advanced audit (full compliance trail).

### Phase 4: "Scale & Intelligence"

AI Assistant across all modules via the in-process `ai` module (summary, generation, workload balancing, predictive completion dates), public API + webhook platform, third-party Integrations (Slack, Google Workspace, Microsoft 365, Zoom, payroll providers), SSO/SAML, mobile app (React Native) for field/on-the-go roles, workflow automation builder.

### Why this order

- Phase 1 must nail **trust and correctness** (who is who, who can see what, is the time data accurate) — everything downstream depends on this being right, including AI and payroll later.
- Phase 2 is what makes the product *sticky* daily (chat/calendar are visited constantly even when monitoring isn't top of mind).
- Phase 3 is what makes it *sellable to skeptical buyers* (proof, analytics, payroll-grade reporting).
- Phase 4 is what makes it *defensible* (AI, integrations, SSO — hard for a scrappy competitor to match, and where most margin/lock-in lives).

---

# PART B — MODULE SPECIFICATIONS (Phase 1)

---

## B1. Module: Authentication

### 1. Overview
Authentication is the trust root for every other module. It governs how a user proves identity to obtain a session on either the Desktop Agent or the Web App, and how that session is maintained, refreshed, and revoked.

### 2. Business Objective
Enable secure, low-friction access for every role while giving Org Owners/Admins full control over who can enter their tenant, on which devices, and for how long.

### 3. Business Value
- Reduces support burden (password reset self-service)
- Reduces breach risk (session revocation, device management)
- Enables the "silent login" Desktop UX that is core to the low-friction monitoring value prop — an employee should never have to think about logging into the Desktop Agent after the first setup.

### 4. User Stories
- As a new employee, I receive an invite email, set a password, and land in the Desktop Agent already checked into my org.
- As an Org Owner, I can force-logout a departed employee's session on all devices instantly.
- As an Admin, I can require 2FA for all Admin/HR roles.
- As an employee, if I forget my password, I can reset it without contacting IT.
- As a Super Admin, I can see all active sessions across an org for security review.

### 5. Functional Requirements
- Email + password registration (invite-only in MVP; self-signup deferred)
- Login (Web + Desktop), logout, "logout of all devices"
- Password reset via emailed time-limited token (30 min expiry)
- Password requirements enforced (see Validation Rules)
- Session issued as short-lived JWT access token (15 min) + long-lived refresh token (Web: 7 days sliding; Desktop: 30 days sliding, since it must survive weekends/leave without re-prompting)
- 2FA (TOTP) — optional per user in MVP, enforceable org-wide by Admin as a policy toggle
- Device registration for Desktop Agent (one org account may run Desktop Agent on N devices, each independently revocable)
- Account lockout after 5 failed attempts within 15 minutes (progressive backoff)
- Silent re-auth on Desktop Agent using refresh token — no UI shown unless refresh fails

### 6. Non-Functional Requirements
- Auth endpoints p95 latency < 200ms
- Passwords hashed with bcrypt (cost factor ≥ 12) or argon2id
- All tokens signed, access tokens never persisted to disk on Desktop (memory only); refresh token stored in OS-native secure storage (Keychain/Credential Manager/libsecret)
- 99.95% auth module / API uptime (it is a hard dependency for every other module)

### 7. User Flow — Web Login
1. User lands on `/login` → enters email/password
2. If 2FA enabled → prompted for TOTP code
3. On success → JWT issued → redirected to role-appropriate dashboard
4. On failure → generic "invalid credentials" (no user-enumeration hint)

### 7b. User Flow — Desktop Silent Login
1. First run: user enters email/password once (or clicks emailed magic-link from invite)
2. Refresh token stored securely on device
3. Every subsequent app launch: Desktop Agent silently exchanges refresh token for a new access token in the background, before UI even paints
4. If refresh token invalid/revoked → falls back to visible login screen with a clear reason ("Your session was revoked by your administrator")

### 8. Edge Cases
- Employee's account deactivated by HR while Desktop Agent is running → next heartbeat/token-refresh fails → Desktop Agent shows "Access revoked, contact your admin" and stops tracking immediately (no zombie tracking).
- Two devices logged in simultaneously with different clocks → server-side clock is authoritative, not device clock, to prevent tampering with attendance timestamps.
- Password reset requested for an email that doesn't exist → return identical success message as valid case (prevents enumeration) but send no email.
- User invited twice (duplicate invite) → second invite invalidates the first token.
- 2FA device lost → Admin can force-disable 2FA for that user after identity verification (manual, logged in Audit).

### 9. Validation Rules
- Password: min 10 chars, at least 1 upper, 1 lower, 1 number (no forced special-char requirement — reduces "P@ssw0rd1" anti-patterns per current NIST guidance)
- Email: standard RFC validation + domain must match an allowed org domain if Admin has enabled domain restriction
- TOTP code: 6 digits, 30s window, ±1 step tolerance for clock drift

### 10. Business Rules
- A user's role/permissions are evaluated fresh on every request (not cached in the JWT beyond a short TTL) so a permission downgrade takes effect within 15 minutes max, not at next login.
- Deactivated users' sessions are revoked immediately (push-based, not wait-for-expiry) via a Redis-backed revocation list checked on token refresh.
- Only Org Owner/Admin can enforce org-wide 2FA policy.

### 11. Permission Rules
| Action | Super Admin | Org Owner | Admin | HR | Employee |
|---|---|---|---|---|---|
| View all sessions (org) | ✔ | ✔ | ✔ | – | – |
| Force logout another user | ✔ | ✔ | ✔ | – | – |
| Set org 2FA policy | ✔ | ✔ | ✔ | – | – |
| Reset own password | ✔ | ✔ | ✔ | ✔ | ✔ |
| Reset another user's password | ✔ | ✔ | ✔ | – | – |

### 12. Acceptance Criteria
- Given a valid invite link, when the employee sets a password, then they are logged into the Desktop Agent automatically without a second login step.
- Given an Admin deactivates a user, when that user's Desktop Agent next attempts a token refresh, then tracking stops within 60 seconds and a clear message is shown.
- Given 5 failed login attempts, when the 6th attempt is made within 15 minutes, then the account is temporarily locked and the user is informed of the cooldown.

### 13. Success Metrics
- < 1% of invited users fail to complete first login
- < 0.1% of sessions require manual support intervention
- Median time from "invite sent" to "first Desktop check-in" < 10 minutes

### 14. UI Requirements (Web)
- Marketing / website home with CTAs to Log in and Sign up
- Login (`/login`) and Sign in (`/signin` alias): email, password, "forgot password" link, SSO button (Phase 4, hidden until enabled), error state, loading state
- Sign up (`/signup`): Org Owner self-serve — full name, work email, organization name, password → lands in org creation wizard
- Password reset: request screen → "check your email" confirmation screen → new-password screen with strength meter
- Accept invite (`/invite/:token`): set password and join org
- 2FA challenge screen when TOTP is enabled
- Session management screen (Settings → Security): table of active sessions (device, location approx., last active, "revoke" button)

### 15. Mobile Behaviour
Deferred to Phase 4. When shipped: biometric unlock (Face ID/fingerprint) backing the same refresh-token model as Desktop.

### 16. Desktop Behaviour
- First-run setup wizard: email/password or magic-link → auto-detects OS → registers device → begins heartbeat
- Tray icon reflects auth state (grey = signed out, colored = signed in)
- No password ever re-typed on subsequent launches unless refresh token is explicitly revoked

### 17. Notifications
- Email: new device login, password changed, 2FA enabled/disabled, account locked
- In-app: "Your session was revoked by an admin"

### 18. APIs Required
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /auth/logout-all`
- `POST /auth/invite` (Admin-only)
- `POST /auth/accept-invite`
- `POST /auth/password/forgot`
- `POST /auth/password/reset`
- `POST /auth/2fa/enable` / `POST /auth/2fa/verify` / `POST /auth/2fa/disable`
- `GET /auth/sessions` / `DELETE /auth/sessions/:id`

### 19. MongoDB Collections
```
users { _id, orgId, email, passwordHash, status, roleId, createdAt }
sessions { _id, userId, deviceType[web|desktop|mobile], deviceId, refreshTokenHash, ip, userAgent, createdAt, lastActiveAt, revokedAt }
inviteTokens { _id, orgId, email, roleId, tokenHash, expiresAt, usedAt }
passwordResetTokens { _id, userId, tokenHash, expiresAt, usedAt }
twoFactorSecrets { _id, userId, secretEncrypted, enabledAt }
```

### 20. Audit Logs
Log: login success/failure, logout, invite sent/accepted, password reset requested/completed, 2FA enabled/disabled, session revoked (by whom), account locked/unlocked. Each entry: actor, target user, IP, timestamp, org.

### 21. Security Requirements
- Rate limiting on `/auth/login` and `/auth/password/forgot` (per IP and per account)
- Refresh tokens rotated on every use (rotation detection flags token theft — reused old refresh token invalidates the whole session family)
- All auth traffic TLS 1.2+
- Secrets (2FA seeds) encrypted at rest with envelope encryption

### 22. Performance Requirements
Login p95 < 200ms; token refresh p95 < 100ms (this runs constantly in the background across every Desktop Agent, so it must be cheap).

### 23. Error Handling
Generic, non-enumerating error messages for login/reset; specific, actionable errors for authenticated-context failures (e.g., "Your admin has revoked this device").

### 24. Future Scope
SSO/SAML/OIDC (Phase 4), passkeys/WebAuthn, org-level IP allowlisting, biometric Desktop unlock.

---

## B2. Module: Organization Management

### 1. Overview
The container module: everything else in the platform (employees, projects, tasks, chat) exists inside exactly one Organization (tenant). This module governs org creation, structure (departments/teams), and org-level configuration.

### 2. Business Objective
Give every tenant a clean, correctly-isolated space, with a structural hierarchy (departments → teams → employees) that reporting, RBAC, and monitoring all key off of.

### 3. Business Value
Multi-tenant isolation is a sales-blocker if wrong (enterprise buyers will not sign without it) and a reporting-accuracy enabler if right (department-level rollups depend entirely on this structure being clean).

### 4. User Stories
- As an Org Owner, I create my organization and become its first Admin automatically.
- As an Admin, I create departments (Engineering, Design, Sales) and assign teams under them.
- As an Org Owner, I set org-wide policies (working hours, timezone, 2FA requirement).
- As a Super Admin, I can view (not edit) any tenant's org structure for support purposes, with access logged.

### 5. Functional Requirements
- Org creation wizard: org name, industry, size band, default timezone, default working hours
- Departments: CRUD, each department has a head (any employee role, typically Team Lead+)
- Teams: CRUD, nested under a department, has a Team Lead
- Org-wide settings: default working hours/week, timezone, weekend days, fiscal year start (for reporting), branding (logo, primary color for white-label header)
- Org-wide policy toggles: enforce 2FA, allow self-registration (off by default), password policy strictness

### 6. Non-Functional Requirements
- Strict document-level tenant isolation (every query scoped by `orgId`, enforced via Mongoose middleware/plugins — not only ad-hoc application checks — to prevent cross-tenant leakage bugs)
- Org settings changes propagate to all connected clients within 5 seconds via WebSocket push (e.g., a working-hours change should reflect in Desktop Agent immediately)

### 7. User Flow — Org Setup
1. Org Owner completes signup → org creation wizard (5 steps: org info → timezone/hours → branding → invite first admins → done)
2. Wizard is skippable after step 1 (sensible defaults applied) — never blocks time-to-value
3. Org lands on empty-state dashboard with a checklist: "Invite employees," "Create your first department," "Create your first project"

### 8. Edge Cases
- Org Owner leaves the company → must transfer ownership to another Admin before their own account can be deactivated (ownership can never be orphaned).
- Department deleted while employees still assigned → block deletion, require reassignment first (or offer "move all to Unassigned" as an explicit confirmed action).
- Team Lead removed from org → team requires a new lead assignment before certain team-level reports (which key off lead) break; system prompts Admin to reassign.

### 9. Validation Rules
- Org name: 2–100 chars, unique per Super Admin's platform namespace is not required (orgs are isolated, names can collide across tenants)
- Department/team name: 1–80 chars, unique within its parent scope
- Working hours: end time must be after start time; overnight shifts (e.g., BPO night shift) explicitly supported via an "overnight shift" flag rather than requiring end < start hacks

### 10. Business Rules
- Every org starts with exactly one Org Owner; ownership transfer requires the current owner's confirmation (or Super Admin override for account-recovery scenarios, fully audited)
- Org-level working hours are the *default* for attendance/monitoring calculations, but individual employees or teams can override (e.g., a night-shift team) — override always wins over org default over role default

### 11. Permission Rules
| Action | Super Admin | Org Owner | Admin | HR | Others |
|---|---|---|---|---|---|
| Create org | ✔ | ✔ (self-serve signup) | – | – | – |
| Edit org settings | Support-only, logged | ✔ | ✔ | – | – |
| Transfer ownership | Emergency override, logged | ✔ | – | – | – |
| Create/edit departments | ✔ | ✔ | ✔ | – | – |
| View org structure | ✔ | ✔ | ✔ | ✔ | Read-only for own dept (Team Lead) |

### 12. Acceptance Criteria
- Given an Admin deletes a department with active employees, when they confirm, then all affected employees are moved to "Unassigned" and this is logged in Audit.
- Given an org sets working hours to 9am–6pm IST, when an employee in that org checks in on Desktop, then idle-time thresholds and productive-hours reporting use that window by default.

### 13. Success Metrics
- < 5 minutes median time to complete org setup wizard
- 0 cross-tenant data leakage incidents (hard security gate, not a target — this is a launch blocker if violated)

### 14. UI Requirements (Web)
- Org Settings page: tabs for General, Structure (departments/teams tree view), Policies, Branding
- Department/team management: tree/nested-list view with drag-to-reassign, empty state ("No departments yet — create your first one")

### 15. Mobile Behaviour
Read-only org structure view (Phase 4).

### 16. Desktop Behaviour
Not directly exposed; consumes org-level settings (working hours, timezone) silently to drive local tracking logic.

### 17. Notifications
Org settings changed (notify Admins), ownership transferred (notify old + new owner + all Admins), department deleted (notify affected employees' new department assignment).

### 18. APIs Required
- `POST /orgs` / `GET /orgs/:id` / `PATCH /orgs/:id`
- `POST /orgs/:id/transfer-ownership`
- `POST /departments` / `PATCH /departments/:id` / `DELETE /departments/:id`
- `POST /teams` / `PATCH /teams/:id` / `DELETE /teams/:id`
- `GET /orgs/:id/structure` (full tree)

### 19. MongoDB Collections
```
organizations { _id, name, industry, sizeBand, timezone, defaultWorkingHours, weekendDays, fiscalYearStart, logoUrl, brandColor, createdAt }
departments { _id, orgId, name, headUserId, createdAt }
teams { _id, orgId, departmentId, name, leadUserId, createdAt }
orgPolicies { orgId, enforce2fa, allowSelfRegistration, passwordPolicyLevel }
```

### 20. Audit Logs
Log: org created, org settings changed (field-level diff), ownership transferred, department/team created/edited/deleted, policy toggles changed.

### 21. Security Requirements
Tenant isolation enforced at Mongoose middleware/plugin level (every query auto-injects `orgId` filter); Super Admin cross-tenant access requires a logged support-access justification.

### 22. Performance Requirements
Org structure tree (departments/teams/employee counts) loads in < 500ms up to 10,000 employees.

### 23. Error Handling
Blocking validation errors shown inline (e.g., "Cannot delete department with 12 active employees — reassign first").

### 24. Future Scope
Multi-org "holding company" view for agencies managing sub-brands, custom domain mapping, org-level data residency selection (EU/US) for compliance.

---

## B3. Module: Employee Management

### 1. Overview
Manages the employee lifecycle from invite through offboarding: profiles, role assignment, department/team placement, and status (active/on-leave/deactivated).

### 2. Business Objective
Give HR/Admin a single accurate source of "who works here, in what capacity, reporting to whom" that every other module (tasks, monitoring, payroll) reads from.

### 3. Business Value
Bad employee data (stale roles, orphaned accounts of departed staff still tracked) is both a security risk and the single most common source of support tickets in this product category — getting this right reduces churn from operational friction.

### 4. User Stories
- As HR, I invite a new employee with name, email, department, team, role, and start date.
- As HR, I offboard an employee: their account deactivates, their data is retained for reporting, but they can no longer log in or be assigned new work.
- As a Team Lead, I can view (not edit) my team members' profiles.
- As an employee, I can update my own profile photo, phone number, and emergency contact, but not my role or department.

### 5. Functional Requirements
- Employee profile: name, photo, email, phone, role, department, team, manager (reporting line), start date, employment type (full-time/contractor/intern), status
- Bulk invite via CSV upload
- Offboarding flow: deactivate (soft — data retained, login blocked) vs. delete (hard — GDPR-style erasure request, logged, restricted to Org Owner)
- Org chart view (reporting lines)
- Employee status: Active / On Leave / Deactivated

### 6. Non-Functional Requirements
Employee list/search must return results in < 300ms for orgs up to 10,000 employees (indexed search on name/email/department).

### 7. User Flow — Invite Employee
1. HR clicks "Invite Employee" → fills form (name, email, role, department, team, manager) or bulk-uploads CSV
2. System sends invite email (see Authentication module)
3. Employee record created with status = "Invited" until they accept
4. On acceptance → status = "Active"

### 8. Edge Cases
- CSV bulk upload contains a duplicate email already in the org → skip with a per-row error report, don't fail the whole batch
- Employee's manager is deactivated → system flags "reporting line broken" and prompts HR to reassign, but does not block other operations
- Employee deactivated mid-task-assignment → their active tasks are flagged for reassignment, not silently orphaned
- Re-inviting a previously deactivated employee (rehire) → reuses existing record, resets status, preserves historical attendance/task data rather than creating a duplicate

### 9. Validation Rules
- Email must be unique within the org (not globally — same person could legitimately exist in two client orgs, e.g. a consultant)
- Start date cannot be more than 1 year in the future (data-entry sanity check)
- CSV bulk upload: max 5,000 rows per batch, required columns validated before any row is processed

### 10. Business Rules
- Deactivating an employee immediately revokes all active sessions (ties into Authentication module's revocation) and stops Desktop Agent tracking within one heartbeat cycle
- An employee's `role` determines their default RBAC permission set; per-user overrides are possible (Phase 3) but MVP ships role-only
- Deleting (hard-delete/GDPR erasure) is restricted to Org Owner and requires a confirmation step + reason field, fully audited, and anonymizes historical records (attendance/task counts remain for aggregate reporting integrity, but PII is scrubbed)

### 11. Permission Rules
| Action | Super Admin | Org Owner | Admin | HR | Team Lead | Employee |
|---|---|---|---|---|---|---|
| Invite employee | ✔ | ✔ | ✔ | ✔ | – | – |
| Edit any employee's role/department | ✔ | ✔ | ✔ | ✔ | – | – |
| Deactivate employee | ✔ | ✔ | ✔ | ✔ | – | – |
| Hard-delete (GDPR erasure) | Support-only | ✔ | – | – | – | – |
| View own team's profiles | ✔ | ✔ | ✔ | ✔ | ✔ (own team) | – |
| Edit own profile (non-role fields) | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |

### 12. Acceptance Criteria
- Given HR uploads a CSV with 200 rows including 3 duplicate emails, when the upload completes, then 197 employees are invited and a downloadable error report lists the 3 skipped rows with reasons.
- Given an employee is deactivated, when their Desktop Agent sends its next heartbeat, then tracking stops and the app shows an access-revoked state within 60 seconds.

### 13. Success Metrics
- Bulk invite success rate > 98% of valid rows
- < 2% of employee profiles have a broken reporting line at any time (measured monthly)

### 14. UI Requirements (Web)
- Employee directory: searchable/filterable table (department, team, role, status), pagination, bulk-select for bulk actions
- Employee detail page: profile tab, activity/attendance summary tab (read-only rollup, links to full Reports module), permissions tab
- Org chart: visual tree, expand/collapse by department
- States: loading skeleton, empty ("No employees yet — invite your first one"), error (retry action)

### 15. Mobile Behaviour
Read-only directory + own profile edit (Phase 4).

### 16. Desktop Behaviour
Displays only the logged-in employee's own profile (Settings → My Profile); no visibility into other employees' data.

### 17. Notifications
Employee invited (to invitee), employee invite accepted (to inviting HR/Admin), employee deactivated (to their Team Lead/PM, so active work gets reassigned), reporting line broken (to HR).

### 18. APIs Required
- `POST /employees` / `POST /employees/bulk`
- `GET /employees` (filterable/paginated) / `GET /employees/:id`
- `PATCH /employees/:id`
- `POST /employees/:id/deactivate` / `POST /employees/:id/reactivate`
- `DELETE /employees/:id` (hard-delete, Org Owner only)
- `GET /employees/org-chart`

### 19. MongoDB Collections
```
employees {
  _id, orgId, userId (ref → users),
  firstName, lastName, photoUrl, phone, emergencyContact,
  roleId, departmentId, teamId, managerId (ref → employees, self-referencing),
  employmentType, startDate, status[invited|active|on_leave|deactivated],
  createdAt, updatedAt
}
```

### 20. Audit Logs
Log: employee invited, role/department/manager changed (field-level diff), status changed (active↔on_leave↔deactivated), hard-delete performed (with reason).

### 21. Security Requirements
PII fields (phone, emergency contact) encrypted at rest; hard-delete permanently scrubs PII while retaining anonymized aggregate records for reporting continuity.

### 22. Performance Requirements
Employee directory search < 300ms at 10,000-employee scale; bulk CSV import processes 5,000 rows in < 2 minutes (async job with progress indicator, not a blocking request).

### 23. Error Handling
Per-row CSV error reporting (not all-or-nothing failure); inline field validation on manual entry forms; clear distinction in UI between "deactivate" (reversible) and "delete" (irreversible, extra confirmation).

### 24. Future Scope
Custom fields per org (e.g., "T-shirt size," "cost center"), org chart drag-to-reorganize, employee self-service org-directory search, integration with HRIS systems (BambooHR, Workday) for Phase 4.

---

# PART C — IMPLEMENTATION PROGRESS

> Status values: `designed` (UI + mock data) · `scaffolded` (folders only) · `wired` (talks to API) · `done` (accepted). Update this section after every build slice.

## C1. Repo layout & stack (as built)

```text
DockX/
├── backend/     # Express + Mongoose modular monolith — Auth APIs live
├── desktop/     # React (Vite) employee workspace; auth wired to backend
├── web/         # React (Vite) management portal — full Phase 1 MVP screens designed
├── docs/prd/
├── infra/
├── scripts/
└── workflow.md  # this PRD (living)
```

| Layer | Confirmed stack | Status |
|---|---|---|
| Web | React + TypeScript, Vite, React Router, Tailwind CSS v4, Fraunces + Manrope, teal/slate design tokens | Full Phase 1 MVP web UI `designed` (mock auth/data) |
| Backend | Node.js + Express + Mongoose; Auth + Workspace (projects, members, board/tasks, comments, attachments, timeline) | Auth + Workspace `wired` |
| Desktop | React + TypeScript + Vite UI (port 5175); Tauri/Rust offline/tracking core still `scaffolded` | Auth + workspace APIs `wired` |
| AI | In-process `ai` module inside backend (not a microservice) | Not started |

**Design system:** Discord dark theme — Blurple `#5865F2` brand, dark surfaces (`#1E1F22` → `#313338`), status greens/yellows/reds from Discord palette. Shared visual language across web + desktop.

**Run locally**
- Backend: `cd backend && npm install && npm run dev` → http://localhost:4000 (demo: `riya@acme.dev` / `Password123`)
- Web: `cd web && npm install && npm run dev` → http://localhost:5173
- Desktop UI (browser): `cd desktop && npm install && npm run dev` → http://localhost:5175 (proxies `/api` → `:4000`)
- Desktop app (Tauri window): `cd desktop && npm run tauri:dev`

## C2. Web UI checklist (management portal)

### Auth & marketing

| Route | Screen | Folder / file | Status |
|---|---|---|---|
| `/` | Marketing home | `web/src/pages/website/HomePage.tsx` | `designed` |
| `/login`, `/signin` | Login | `web/src/pages/auth/login/LoginPage.tsx` | `designed` |
| `/signup` | Org owner signup | `web/src/pages/auth/signup/SignupPage.tsx` | `designed` |
| `/forgot-password` | Request reset | `web/src/pages/auth/forgot-password/ForgotPasswordPage.tsx` | `designed` |
| `/reset-password` | New password | `web/src/pages/auth/reset-password/ResetPasswordPage.tsx` | `designed` |
| `/invite/:token` | Accept invite | `web/src/pages/auth/invite/AcceptInvitePage.tsx` | `designed` |
| `/2fa` | TOTP challenge | `web/src/pages/auth/two-factor/TwoFactorPage.tsx` | `designed` |

### Dashboard modules (all sidebar items live — no "Soon")

| Route | Screen | Folder / file | Status |
|---|---|---|---|
| `/dashboard` | Overview stats + checklist + shortcuts | `web/src/pages/dashboard/DashboardPage.tsx` | `designed` |
| `/org` | Org settings tabs | `web/src/pages/org/OrgPage.tsx` | `designed` |
| `/org/setup` | 5-step org setup wizard | `web/src/pages/org/OrgSetupPage.tsx` | `designed` |
| `/employees` | Directory + invite modal | `web/src/pages/employees/EmployeesPage.tsx` | `designed` |
| `/projects` | Project list + create modal | `web/src/pages/projects/ProjectsPage.tsx` | `designed` |
| `/tasks` | Kanban + List views | `web/src/pages/tasks/TasksPage.tsx` | `designed` |
| `/attendance` | History table + correction CTA | `web/src/pages/attendance/AttendancePage.tsx` | `designed` |
| `/monitoring` | Live employee signals (managers) | `web/src/pages/monitoring/MonitoringPage.tsx` | `designed` |
| `/reports` | Attendance / task report cards | `web/src/pages/reports/ReportsPage.tsx` | `designed` |
| `/audit` | Audit log table | `web/src/pages/audit/AuditPage.tsx` | `designed` |
| `/settings` | Profile / Security / Preferences | `web/src/pages/settings/SettingsPage.tsx` | `designed` |

**Shared web infra:** `web/src/styles/globals.css`, `web/src/components/ui/*`, layouts, mock auth, mock data under `web/src/data/*`.

## C2b. Desktop UI checklist (current MVP slice)

**Desktop MVP:** home dashboard + board workspace.

| Route | Screen | Folder / file | Status |
|---|---|---|---|
| `/login` | Login → Dashboard (API) | `desktop/src/pages/auth/LoginPage.tsx` | `wired` |
| `/register` | Org bootstrap signup (API) | `desktop/src/pages/auth/RegisterPage.tsx` | `wired` |
| `/` | Home dashboard tabs: Overview (graphs), Tasks list, Users list, Admin Timeline | `desktop/src/pages/dashboard/DashboardPage.tsx` | `wired` |
| `/board` | Board: projects, multi-select member boards, invite, tasks | `desktop/src/pages/board/BoardWorkspacePage.tsx` | `wired` |

**Desktop infra:** `AppShell` nav (Dashboard + Board), live session timer, `WorkspaceContext` loads from `/api/workspace`. Auth via `lib/api/*` + JWT refresh. Vite proxies `/api` + `/uploads` → `:4000`. Tauri 2 (`npm run tauri:dev`).

### Backend Auth APIs (live)

| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/register` | Create org + Admin user, issue session |
| POST | `/api/auth/login` | Email/password; deviceType desktop/web |
| POST | `/api/auth/refresh` | Rotate refresh token |
| POST | `/api/auth/logout` | Revoke current session |
| POST | `/api/auth/logout-all` | Revoke all sessions (auth required) |
| GET | `/api/auth/me` | Current user (auth required) |

### Backend Workspace APIs (live)

| Method | Path | Notes |
|---|---|---|
| GET | `/api/workspace` | Bootstrap projects + tasks + timeline |
| POST | `/api/projects` | Create project (caller = admin) |
| POST/PATCH/DELETE | `/api/projects/:id/members…` | Invite / role / remove |
| POST/PATCH/DELETE | `/api/projects/:id/columns…` | Board columns |
| GET/POST | `/api/projects/:id/tasks` | Board list / create task |
| PATCH | `/api/tasks/:id` | Update task / status |
| POST | `/api/tasks/:id/comments` | Comment + multipart `files` |
| POST/DELETE | `/api/tasks/:id/attachments…` | Multipart upload / remove |
| POST | `/api/timeline` | Admin backlog (+ files) |
| POST | `/api/timeline/:id/assign` | Assign → creates board task |
| DELETE | `/api/timeline/:id` | Delete pending item |
| GET | `/uploads/:file` | Attachment files |

## C3. Next implementation slices

1. Wire web portal to the same Auth + Workspace APIs.
2. Org / Employees / Attendance modules; email invite accept flow.
3. Secure refresh-token storage in Tauri; idle/lock detection beyond active-app tracking.
4. Real Kanban drag-and-drop polish.

### Desktop activity tracking (live)

| Event | Behavior |
|---|---|
| Check in | Starts activity session (`POST /api/activity/sessions/start`); polls foreground app every 5s via Tauri |
| Break | Pauses sampling |
| Check out | Flushes samples + closes session |
| Exclude | DockX / `com.dockx` never counted |
| UI | Dashboard Overview → App activity panel; header shows current app |

---

# Appendix: What's Coming in Part 2

The following modules follow the same 24-point template and will be appended next, in this order (Phase 1 completion first, then Phase 2):

1. RBAC (field-level detail beyond the module matrix above)
2. Attendance
3. Desktop Agent — Monitoring (MVP subset: heartbeat, idle/lock/sleep detection, active app/window tracking)
4. Project Management (basic)
5. Task Management (core) — including full screen specs for Kanban/List views
6. Notifications
7. Settings
8. Audit Logs (system-wide)
9. Reports (basic)

Then Phase 2: Chat, Calendar, Meetings, Files, Knowledge Base, Leave Management, Client Portal.

Say **"continue"** (or name a specific module you want prioritized) and I'll append the next batch to this same file.


git tag v0.1.2
git push origin v0.1.2