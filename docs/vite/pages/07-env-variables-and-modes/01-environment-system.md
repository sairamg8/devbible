---
title: "Env Variables & Modes: `.env` Files, the `VITE_` Prefix & `import.meta.env`"
sidebar_label: "Env Variables & Modes"
sidebar_position: 1
---

# ⚡ Env Variables & Modes: `.env` Files, the `VITE_` Prefix & `import.meta.env`

## 1. Under-The-Hood Mechanics

Vite's environment variable system is built around **modes** (not just the traditional dev/production binary) and a deliberate, security-motivated prefix requirement for exposing anything to client code at all.

```
.env                    ──► loaded in ALL modes — base/shared defaults
.env.local                ──► loaded in ALL modes, gitignored by convention — personal/machine-specific overrides
.env.[mode]                  ──► loaded ONLY in that specific mode (.env.production, .env.staging, ...)
.env.[mode].local               ──► mode-specific AND gitignored — e.g. a personal staging override

Loading PRIORITY (later overrides earlier): .env < .env.local < .env.[mode] < .env.[mode].local
```

### The `VITE_` Prefix: A Deliberate Security Boundary
Only environment variables prefixed with `VITE_` are exposed to client-side code via `import.meta.env` — this is **intentional**, not a naming convention nicety. Since client bundles are fully readable by anyone (view-source, dev tools), Vite refuses to expose arbitrary environment variables (which might include server secrets, database URLs, API keys meant to stay server-only) unless a variable is explicitly opted in via the prefix — a safe-by-default design, in contrast to naively exposing `process.env` wholesale.

### `import.meta.env`: Built-In Values Plus Custom Ones
Beyond custom `VITE_*` variables, Vite injects several built-ins automatically: `MODE` (the current mode string), `BASE_URL` (mirroring the `base` config option), `PROD`/`DEV` (boolean convenience flags), `SSR` (true when running in a server-side rendering context).

### Mode vs `NODE_ENV`: A Genuinely Different Axis
`--mode` determines which `.env.[mode]` file loads and what `import.meta.env.MODE` reports — it is **independent** of the traditional `NODE_ENV`/dev-vs-production binary, letting a project define arbitrary custom modes (`staging`, `qa`) beyond just development and production, each with their own `.env.staging`/`.env.qa` file.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Staging Environment Needing Its Own API URL Without Being Confused for "Production."
A team needed a genuine staging environment (separate from both local dev and production) with its own API base URL, its own analytics key, and its own feature-flag defaults — but `NODE_ENV` traditionally only recognizes 'development'/'production'/'test', with no first-class "staging" concept. Vite's `mode` system, entirely separate from `NODE_ENV`, let the team define a `.env.staging` file and build/run with `--mode staging`, getting a genuinely distinct environment configuration without hacking `NODE_ENV` into a value it wasn't designed to hold.

---

## 3. Production-Grade Code Example

```bash
# .env — shared defaults across all modes
VITE_APP_NAME=Acme Dashboard

# .env.production
VITE_API_URL=https://api.acme.com
VITE_ANALYTICS_ENABLED=true

# .env.staging
VITE_API_URL=https://api-staging.acme.com
VITE_ANALYTICS_ENABLED=false

# .env.local (gitignored — personal overrides, never committed)
VITE_API_URL=http://localhost:4000
```

```typescript
// Consuming env vars in application code — ONLY VITE_-prefixed vars are visible here
console.log(import.meta.env.VITE_API_URL);   // resolved per the currently active mode
console.log(import.meta.env.MODE);              // 'staging', 'production', 'development', etc.
console.log(import.meta.env.PROD);                // boolean — true only in an ACTUAL production build
console.log(import.meta.env.DATABASE_PASSWORD);     // undefined — NOT exposed, no VITE_ prefix, by design
```

```json
// package.json — running/building against different modes explicitly
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "build:staging": "vite build --mode staging",
    "preview:staging": "vite preview --mode staging"
  }
}
```

```typescript
// vite-env.d.ts — typing custom env vars for full IntelliSense/type safety
interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_ANALYTICS_ENABLED: string; // env vars are ALWAYS strings — 'true'/'false', not real booleans
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Assuming an Unprefixed Env Var Will Be Available Client-Side
```typescript
// ❌ WRONG: without the VITE_ prefix, this is undefined in client code — NOT a bug, a deliberate
// security boundary preventing arbitrary environment variables from leaking into the client bundle
console.log(import.meta.env.API_URL); // undefined — missing the required VITE_ prefix

// ✅ CORRECT: prefix any variable meant to be genuinely exposed to client code
console.log(import.meta.env.VITE_API_URL); // works
```

### ⚠️ Pitfall 2: Treating Env Var Values as Their "Natural" Type
```typescript
// ❌ WRONG: env vars are ALWAYS strings — this comparison is comparing a string to a boolean,
// which is NEVER true, regardless of the actual .env file's value
if (import.meta.env.VITE_ANALYTICS_ENABLED === true) { /* NEVER runs */ }

// ✅ CORRECT: explicitly compare against the STRING value, or parse it
if (import.meta.env.VITE_ANALYTICS_ENABLED === 'true') { /* correct */ }
```

### ⚠️ Pitfall 3: Forgetting `.env.local` Files Should Be Gitignored
```
❌ RISKY: .env.local and .env.[mode].local are meant for PERSONAL, machine-specific overrides
(a local API key, a local database URL) — committing them to version control by forgetting
to add them to .gitignore leaks personal/local credentials into the shared repository history

✅ CORRECT: Vite's official scaffolding templates already .gitignore *.local by convention —
verify this stays true for any custom project setup, especially one not started from `create vite`
```
