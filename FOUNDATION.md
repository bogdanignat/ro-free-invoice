# RO Free Invoice Foundation

Status: architecture baseline of a standalone application, with plugin selection through `RFI_PLUGINS` and conditional plugin composition in the kernel
Package manager: pnpm
Runtime: Node.js + TypeScript + **Effect 3.x as primary runtime** (`effect`, `@effect/platform`) — all cube application logic, host capabilities (Clock, Store, IdGenerator, Auth), and HTTP handling are modelled as `Effect`
UI: React 19 + TypeScript styled with Tailwind CSS 4, a single-page application in `frontend/` built with Vite and routed with TanStack Router (file routes in `frontend/src/routes/`); the kernel serves the build (`RFI_UI_DIR`) and the API (`/api/*`) on one origin, `PUBLIC_ORIGIN`, so the browser calls `/api` directly with its session cookie; TanStack Query integrates server state with React. The boundary remains API-first: every cube use-case has a corresponding authenticated HTTP endpoint, and the UI contains no fiscal business logic

## 1. Purpose

Build an invoicing application that:

- runs standalone: its own kernel, its own PostgreSQL, its own login and sessions;
- has one main cube, `invoicing`, with `payments`, `efactura` and `company-lookup` as
  plugins, i.e. optional child cubes chosen at startup with `RFI_PLUGINS`;
- keeps its business logic in cubes that do not depend on the host that runs them;
- enforces its isolation, size, test and boundary rules with its own gates.

## 2. Cubes

A cube is an application, not merely a module inside a separate `Application` abstraction.
A cube may contain other cubes. The model is recursive:

```text
runtime root
└── cube/application
    ├── cube/application
    │   └── cube/application
    └── cube/application
```

Today the tree has three levels: `invoicing`, its children, and the children of
`efactura` (`invoicing/efactura/connection` and its siblings).

A cube is the semantic and runtime application unit; `cubes.json` lists them (section 13).

### When to split

Do not create one cube per table or screen. Split a child cube only when at least one real
boundary exists:

- independent lifecycle or enablement;
- independent data ownership;
- independent permission surface;
- a coherent domain that can be understood and tested alone;
- the size gate proves the current cube is too large.

## 3. Host boundaries

Standalone is the only runtime mode:

```text
kernel                      composition root, own PostgreSQL, own login
├── authentication adapter  API token, browser session
├── organization adapter    ORGANIZATION_ID
├── plugin selection        RFI_PLUGINS, read once at start
└── invoicing (required)
    ├── parties, items, money, issues, customers, catalog, issuer, drafts,
    │   issuance, corrections, documents (required)
    ├── payments (plugin, required: false)
    ├── efactura (plugin, required: false)
    │   └── connection, submissions, reconciliation, received, received-ubl (required inside the plugin)
    └── company-lookup (plugin, required: false)
```

The kernel reaches outside the installation only for the plugins that need it: ANAF's
e-Factura API for `efactura` (`kernel/efactura/`), and ANAF or openapi.ro for
`company-lookup` (`kernel/company-lookup/`), asked about a CUI or a name. The cubes hold the
rules and the mapping; HTTP, caches and the encryption of stored secrets are the host's.

The cubes depend on host-provided contracts and never embed an authentication
implementation in business logic. The kernel is a composition root and operational shell,
not part of the invoicing domain.

## 4. Authentication and authorization

### Authentication belongs to the host

One runtime has one identity/session provider. Login, token verification, session expiry,
and logout belong to the kernel (`kernel/auth/`). The local API token is exchanged for a
revocable, opaque session persisted server-side and referenced by an HttpOnly
`SameSite=Strict` cookie, with CSRF protection; the Bearer API is refused on the public
listener unless `RFI_BEARER_API=on` (`kernel/http/edge-guard.ts`).

The invoicing cube:

- requires an authenticated identity;
- receives the current identity from the request context the host provides;
- never stores password hashes;
- never parses or validates bearer tokens itself;
- never imports an auth implementation.

The identity contract is declared in `cubes/invoicing/contracts/host.ts`:

```ts
interface CurrentIdentity {
  readonly id: string
  readonly username: string
  readonly roles: ReadonlyArray<string>
  readonly permissions: ReadonlyArray<string>
}
```

Today the kernel yields one principal, `kernel-owner`, with the permissions below and the
configured organization; there is no multi-user authorization yet.

### Authorization belongs to the cube

The host proves who the caller is. The cube decides what that caller may do. Each unit
declares its permission vocabulary with its identity as prefix:

```text
invoicing:read
invoicing:customer.manage
invoicing:invoice.draft
invoicing:invoice.issue
invoicing:invoice.void
invoicing:proforma.issue
invoicing:settings.manage
documents:read
documents:render
payments:read
payments:payment.record
efactura:read
efactura:connection.manage
efactura:submit
efactura:reconcile
efactura:receive
company-lookup:company.lookup
```

Payments also accepts the aliases `invoicing:read` and `invoicing:payment.record`. A
plugin's permissions are granted only while the plugin is on (`kernel/auth/auth.ts`);
`invoicing:read` stays, because it is the invoicing base permission. The e-Factura grants
carry the plugin's name and are declared by `efactura/connection`. Administering company
lookup takes the parent's `invoicing:settings.manage`.

Authentication and authorization remain separate checks:

1. middleware establishes the request context;
2. handlers require a coarse permission;
3. entity authorization checks ownership, grants, or organization scope.

Every `/api` endpoint carries real authentication middleware in the runtime Effect graph
(`kernel/api/http-api-shared.ts`, `kernel/api/http-endpoints-host.ts`), and each handler
then performs its own permission and resource/organization checks. The exceptions are
exactly these:

- `POST /api/session`, the login, throttled per client address;
- `GET /api/anaf/callback`, ANAF's OAuth redirect, whose only credential is the one-time
  `rfi_anaf_oauth` attempt cookie (`kernel/efactura/anaf/callback-http.ts`);
- `GET /api`, the API docs, which resumes the browser session itself and redirects to
  `/unlock` without one (`kernel/http/http-docs-route.ts`);
- `GET /health/live` and `GET /health/ready`, and the static UI build, which carry no
  application data (`kernel/http/http-request-listener.ts`).

### Organization context is mandatory

An invoice belongs to an issuer/legal entity, not merely to a user. The application requires
a host-provided organization context:

```ts
interface CurrentOrganization {
  readonly id: string
}
```

The kernel reads it from `ORGANIZATION_ID` and refuses requests when it is missing. A
client-supplied organization id is never trusted.

## 5. Cube public seam

Each unit exports one plain `cube` object from its `index.ts`:

```ts
export const cube = {
  manifest: {
    name: "invoicing",
    summary: "Romanian invoicing with immutable issued-document snapshots",
    required: true,
    tables: [/* the tables it owns */],
  },
}
```

The manifest declares `name` (equal to the directory leaf), `parent` on children, a
`summary`, `required`, and the `tables` the unit owns. `probes/package-gate.mjs` checks the
first four; `kernel/storage/schema-baseline.test.ts` checks the tables. Manifests are static: the plugin selection filters the active surface and never
rewrites a manifest. The host files a new unit touches are listed in section 7.

Next to the manifest, `index.ts` exports the unit's public surface: services, contracts,
permissions and pure functions. The kernel owns every HTTP endpoint (`kernel/api/`) and
mounts only those of the required cubes and the selected plugins, for routing and OpenAPI
alike: a disabled plugin's route is a 404 from the router.

### Injected capabilities

Business code receives narrow capabilities rather than global infrastructure: the request
context, a clock, an id generator, and the unit's own transaction ports. Do not pass
filesystem handles, raw database connections, process control, or foreign stores into a
cube.

## 6. Isolation and communication paths

A cube never imports a cube of another top-level tree. The application has a single tree,
`cubes/invoicing`, and `probes/boundary-rules.mjs` keeps the separate-tree refusal and its
tests on synthetic top-level trees.

Static boundaries (`dependency-cruiser.config.cjs`, `probes/boundary-rules.mjs`) reject:

- imports between separate top-level trees, and past a unit's `index.ts` inside a tree;
- cube imports of the host or tooling, and kernel imports past a cube's public surface;
- direct `node:sqlite` and direct PostgreSQL driver (`pg`, `pg-pool`, `pg-native`, `pg-cursor`) access from cube code;
- direct filesystem/process/module/vm access from cube code;
- imports from a required unit into a plugin;
- circular dependencies.

This is lint isolation, not a security sandbox.

Inside the tree, a child cube may import the kernel of any ancestor (the parent's domain, ports and contracts); every other unit, whether a child seen from its parent, a sibling or a nested child, is entered only through its exact `index.ts`, type-only imports and re-exports included. Each child's interior stays private to it, and the parent never reaches past a child's index, so the graph stays acyclic. No edge is exempt. A child that persists documents of its own declares its own transaction port (`ProformaTransaction` in `issuance/`, `CorrectionsTransaction` in `corrections/`, `PaymentsTransaction` in `payments/`, beside `CustomersTransaction`, `CatalogTransaction` and `IssuerTransaction`), and the composition root in `application/invoicing.ts` intersects the required ports with the kernel port; the host implements the intersection over one connection.

Plugins stay optional in the graph. The boundary gate refuses any import from a
`required: true` unit into a `required: false` unit, and `invoicing/index.ts` does not
re-export the plugins. The kernel composes a plugin only when it is selected
(`kernel/api/api-services.ts`). A plugin's internal modules import their leaf
modules, never their own `index.ts`, so re-exports create no cycle.

## 7. Data ownership

> One cube equals one directory: a cube's code lives in its own directory only.

The host composes it, so adding a unit also touches:

- `cubes.json`, its entry in the inventory;
- with tables: its scope in `migrationScopes` (`kernel/storage/postgres-migration-plans.ts`)
  and its migrations in `kernel/storage/migrations.lock.json` (`pnpm migrations:lock`);
- with routes: its endpoints and handlers in `kernel/api/`;
- as a plugin: `optionalPlugins`, `PluginSelection` and `allPlugins` in `kernel/plugins.ts`,
  which `kernel/plugins.test.ts` holds equal to the manifests with `required: false`, its
  grants in `kernel/auth/auth.ts`, and its composition in `kernel/api/api-services.ts`.

Each cube owns the tables its manifest declares. The application owns its database:
PostgreSQL 16, run by its own bundle. The schema owner role (`rfi_owner`) owns the `public`
schema that `migrate` builds, and the application connects as `rfi_app`, DML only
(`deploy/postgres/grants.sql`), so the running application cannot change the schema.

Issued legal documents preserve the relevant snapshot (issuer, customer, lines, totals, tax
breakdown) instead of changing when a referenced record changes later. References to other
records use stable ids.

### Schema and migrations

Every cube scope starts with one baseline, `<cube>-001-baseline`, holding the tables its manifest declares, with their indexes and triggers; `kernel/storage/schema-baseline.test.ts` asserts that each baseline creates exactly the declared tables. Shipped migrations, the baselines included, are frozen: `kernel/storage/migrations.lock.json` records each one's name and SHA-256, and `pnpm verify` refuses one that was edited, removed, renamed or moved. A schema change is a new migration at the end of the owning cube's scope (`<cube>-002-<description>`), recorded with `pnpm migrations:lock`; a new `NOT NULL` column brings its default or backfill in the same migration. `migrate` applies only what the ledger lacks, so a database with data is upgraded, never recreated. A schema the ledger does not explain is drift: `migrate` refuses it before writing and `doctor` reports it. The migrator never deletes a database itself.

The runner applies twelve scopes in a fixed order, one PostgreSQL database: foundation, customers, catalog, issuer, invoicing, payments, documents, company-lookup, connection, submissions, received and the host's `kernel` — a cube whose tables others reference first, never sorted by name, and no migration depends on a later scope. Migrations always run for every unit, so a disabled plugin keeps its schema and data. The foundation scope is the host's: it owns `rfi_abort()`, the single trigger function every refusal trigger calls, so the cube baselines are not self-sufficient SQL (`.architecture/contract.json`, kept in hub (`~/projects/hub`), local copy ignored by git; decision `functii-de-trigger-in-scope-foundation`). The immutability triggers are part of the baselines, and `kernel/ops/kernel.test.ts` still asserts that every one of them exists after migration. The full rules are in README, "Schema and migrations".

## 8. Events are not workflows

The application has no event bus. Fiscal workflows (issuance, numbering allocation,
e-invoice submission and its retries, payment recording, corrections) keep their state in
the database, with idempotency, an audit trail and resumable effects; an in-memory
notification is never their source of truth. A transactional outbox or workflow journal is
designed when a slice needs one.

## 9. Identity

The main cube has the identity `invoicing`; each child declares its leaf `name` and its
`parent` in its manifest, and nowhere else. Do not hardcode a parent in business logic,
route logic, permission checks, storage names, or entity references.

## 10. Size and split gates

The size policy applies from the first source file, with no baseline debt. The limits are
in `gates.config.json` and measure code lines after comments and blank lines are removed:

| Limit | Value |
|---|---:|
| Maximum code lines per source file | 200 |
| Maximum code lines per unit/cube | 800 |
| Maximum source files per unit/cube | 15 |

Unit tests do not count toward size. They are governed by a separate mandatory test gate.

Rules:

- a file over 200 code lines is split by responsibility;
- a unit over 800 code lines or 15 files is examined for a real child-cube boundary;
- do not raise a cap merely to make a build green;
- do not delete useful comments because comments are not counted;
- do not create tiny pass-through modules only to manipulate the metric.

The same 200-line file cap covers production TypeScript/JavaScript in `kernel/`,
`cubes/`, `frontend/src/`, `probes/` and `bin/`, via `sizeFileRoots`. These are
file-only roots, not cube units: the 800-line / 15-file unit caps still apply to
each cube's own sources. Test/spec/test-support sources and ordinary build/dependency
directories are not production measurements; a generated file is exempt only when
`sizeGeneratedFiles` names it with a reason. Overlapping roots are deduplicated and
invalid roots or caps fail the gate. Root tooling/config files are outside the file roots.

The gates discover units from `cubes.json`, not from per-directory manifests; a missing
inventory or zero units fails the gate. Each cube is measured as its own unit, and a
parent's own size excludes source owned by child-cube directories; otherwise splitting into
a legitimate child could not reduce the parent's measurement. Gate self-tests prove that an
oversized or testless cube fails.

Host adapters follow the existing domain ports rather than arbitrary file slices.
`postgres-store.ts` owns transaction lifetime and composes same-connection adapters
over one pooled client; payments has its own adapter and store. API handlers receive a request-scoped service
access function, not database or renderer factories. Service construction remains
per request. Browser transport/session state has one owner, workflow hooks compose
pure state and domain clients, and views compose presentation components. Existing
public entry points remain facades; internal modules import leaf dependencies, not
their own facade.

The mappers from invoicing's model to the e-Factura document stay in `kernel/efactura/`
as a host adapter, outside the plugin's unit budget; with e-Factura off the XML routes are
not mounted, so the mappers are never called. `cubes/invoicing/company-lookup` follows the
same split: the cube keeps the settings rules, the CUI/name thresholds and the pure mapping
of each provider's answer; the HTTP clients, the lookup cache and the key cipher live in
`kernel/company-lookup/`.

## 11. Tests and verification

Every cube ships with tests; there are no untested-unit exemptions.

Verification layers:

1. unit tests through public domain interfaces;
2. manifest/directory parity (package gate) and HTTP API contract tests;
3. authentication and permission refusal tests;
4. store ownership and restart persistence tests;
5. input validation at the HTTP boundary;
6. plugin selection tests for all four `payments`/`efactura` combinations, with
   `company-lookup` on in two of them and off in the other two: the app boots,
   login, readiness, issuance, proforma, storno, and PDF work; a disabled plugin's routes,
   OpenAPI entries are absent (company lookup included, `kernel/api/company-lookup-api.test.ts`)
   and `eFacturaStatus` is `null` with e-Factura off; re-enabling
   keeps its data and idempotency; an unknown name in `RFI_PLUGINS` refuses start
   (`kernel/plugins.test.ts`, `kernel/http/plugins-http.test.ts`). The UI sends no request
   to a disabled plugin and hides its actions (`frontend/src/hooks/plugins-off.test.ts`);
7. inventory tests: every declared unit exists, no unit is undeclared or duplicated,
   a missing inventory or zero units fails;
8. decoupling: disabling a plugin leaves the host and every required cube operational;
9. size, test, dependency-boundary and migration-lock gates;
10. TypeScript strict typecheck.

The test surface uses the same public interfaces as production callers. Tests do not reach
around a seam into kernel internals. The gates run in `pnpm verify` (`package.json`,
`probes/`).

## 12. TypeScript and Effect baseline

Effect is the mandatory application runtime — every cube operation, transaction, and HTTP handler is an `Effect` with typed failures (`ValidationFailure`, `DomainConflict`, `PermissionDenied`, `PersistenceFailure`, among those in `cubes/invoicing/contracts/failures.ts`).

Pinned versions (`package.json`):

- Node.js `24.19.0`, pnpm `11`;
- ESM (`"type": "module"`);
- TypeScript source executed with Node type stripping; imports include `.ts`;
- `effect` `3.21.2` — core runtime;
- `@effect/platform` `0.96.1` — HTTP API surface;
- `pg` `8.23.0` — the PostgreSQL driver, a host concern; cubes never import it.

Rule: do not introduce an alternative async/runtime abstraction. New code uses `Effect.gen`/`Effect.flatMap` and the injected capabilities. Every cube use-case exposed via `InvoicingService` has a 1:1 authenticated HTTP endpoint in `kernel/api/`.

Compiler policy (`tsconfig.json`):

- `strict`;
- `exactOptionalPropertyTypes`;
- `noUncheckedIndexedAccess`;
- `noImplicitOverride`;
- `noFallthroughCasesInSwitch`;
- `noImplicitReturns`;
- `noUnusedLocals`;
- `noUnusedParameters`;
- `verbatimModuleSyntax`;
- `module` and `moduleResolution`: `nodenext`;
- `noEmit` for the typecheck gate.

The application ships its own pinned Node, pnpm, TypeScript, Effect, and platform versions
in its Docker image. Do not rely on broad semver coincidence.

## 13. Unit inventory and plugins

- `cubes.json`, at the repository root, has a `summary` and a `cubes` array listing all
  20 units: `invoicing`, `invoicing/<child>` and `invoicing/efactura/<child>`, plugins
  included. There are no per-directory manifests to register.
- The inventory is static. Neither the gates nor the migrations filter it by configuration;
  migrations always run for every unit, so a disabled plugin keeps its schema and data.
- `required` is `true` for `invoicing` and its components, `false` for `payments`,
  `efactura` and `company-lookup`; `efactura`'s own children are `true`: required inside
  the plugin, so they are on exactly when it is.
- `RFI_PLUGINS` selects the plugins at start (`kernel/config.ts`, `kernel/plugins.ts`):
  absent means every plugin, empty means none, any name that is not a plugin refuses start,
  spaces are ignored and duplicates tolerated, and any change needs a restart. The known
  names are the units whose manifest says `required: false`. Required units are always active.
- The gates check the declared list against the tree: declared units exist, no unit is
  undeclared or duplicated, paths are valid, and a missing inventory or zero units fails.

Distribution is the Docker image and Compose bundle (`PRODUCT.md` section 7); there is no
installer or packaged artifact of the units.

## 14. Repository shape

This is the shape the repository has; a new directory appears only when a file needs it.
The full unit list is `cubes.json`.

```text
ro-free-invoice/
├── FOUNDATION.md
├── cubes.json                  inventory of the 20 units
├── gates.config.json           size gate roots and caps
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── cubes/
│   └── invoicing/              main cube, required
│       ├── index.ts            named `cube` export
│       ├── domain/             shared model, VAT arithmetic, date validation
│       ├── application/        ports, idempotency, service composition
│       ├── contracts/          schemas and host-facing seams
│       ├── parties/            CUI/CNP, counties and sectors for every party
│       ├── items/              article code, GTIN and unit-of-measure rules
│       ├── money/              decimal money arithmetic on bigint, half-up rounding
│       ├── issues/             validation issue codes, templates and constructors
│       ├── customers/          saved customers, their table and baseline
│       ├── catalog/            saved products and services, their table and baseline
│       ├── issuer/             issuer profile, branding, VAT and baseline
│       ├── drafts/             authoring and draft editing
│       ├── issuance/           document series, numbered invoices and proformas
│       ├── corrections/        storno documents
│       ├── documents/          rendered artifacts
│       ├── payments/           plugin: payment records and derived payment status
│       ├── efactura/           plugin: RO e-Factura UBL, CIUS-RO limits, EN 16931 validation
│       │   ├── connection/     ANAF OAuth connection: environment, token pair state, attempts
│       │   ├── submissions/    ANAF submissions: states, answers, polling, call budgets
│       │   ├── reconciliation/ manual reconciliation of unknown submissions
│       │   ├── received/       invoices received through the SPV and their archives
│       │   └── received-ubl/   reading third-party UBL invoices and credit notes
│       └── company-lookup/     plugin: company lookup settings, thresholds, ANAF/openapi.ro mapping
├── kernel/                     kernel and adapters; config.ts, plugins.ts, failure-log.ts at its root
│   ├── http/                   server, security headers, readiness, API docs
│   ├── auth/                   credentials, browser session, login throttle
│   ├── api/                    HttpApi contract, schemas, handlers
│   ├── storage/                PostgreSQL pool and store, row mappers, migration runner, schema fingerprint
│   ├── documents/              PDF renderer, artifact store and recovery, fonts
│   ├── efactura/               host mapping into the e-Factura plugin; anaf/, dispatch/, reconciliation/
│   ├── company-lookup/         ANAF and openapi.ro clients, lookup cache, openapi.ro key cipher
│   ├── crypto/                 secrets at rest (AES-256-GCM with caller-owned associated data)
│   ├── outbound/               outbound HTTP: bounded reads, no redirects, not_sent | ambiguous
│   └── ops/                    CLI, backup, restore
├── frontend/                   browser UI: Vite + TanStack Router, built into frontend/dist and served by the kernel
├── bin/                        CLI entry point and container command
├── probes/                     package, persistence, gate, and decoupling checks
├── scripts/                    fixtures and local helpers
└── docs/                       development, release, e-Factura, VAT treatment
```

The PDF renderer stays in `kernel/documents/` because it needs the filesystem and fonts.
Kernel code depends only on the cubes' public surface; cube code never imports the kernel.

Tests are colocated with what they exercise. Do not create empty directories or placeholder abstractions.

## 15. Rules for a new slice

Before writing business code:

1. define the vertical use case;
2. define the host capability contracts it needs;
3. define the cube-owned data and invariants;
4. define observable failure types;
5. write one red test through the public interface;
6. implement the smallest complete slice;
7. run type, unit, boundary, and size gates.

## 16. Architecture decisions

1. Exact invoicing scope and jurisdiction: `PRODUCT.md`.
2. Organization context: one organization per installation, from `ORGANIZATION_ID`
   (section 4); a multi-organization authorization contract is still open.
3. Issued invoices are immutable snapshots with numbering that never reuses a number.
4. Resolved: the application owns its persistence (PostgreSQL 16) and its login.
5. Durable e-invoice submission workflow: state in the database (section 8).
6. Resolved: a React SPA in `frontend/` (Vite, TanStack Router and Query) on top of an
   API-first kernel; Effect is the backend's runtime only.
7. Resolved: the units are listed in `cubes.json` and the plugins chosen with
   `RFI_PLUGINS` (section 13).
8. Which further domains become child cubes is decided by real ownership/lifecycle and
   size evidence (section 2).
