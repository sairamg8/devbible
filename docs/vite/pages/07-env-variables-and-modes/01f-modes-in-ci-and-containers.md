---
title: "Where Mode Actually Gets Decided: CI Jobs, `vite preview` and Container Images"
sidebar_label: "Modes in CI & Containers"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-07 against the Vite documentation — [Env Variables and Modes](https://vite.dev/guide/env-and-mode), [Building for Production](https://vite.dev/guide/build), [CLI](https://vite.dev/guide/cli). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ Where Mode Actually Gets Decided: CI Jobs, `vite preview` and Container Images

[Chunk 1e](01e-modes-and-node-env.md) established the two axes. This chunk is about the three places
they are actually set in a real project — none of which is the application, and all three of which
are edited by people who are not thinking about `import.meta.env` at the time.

---

## 1. Under-The-Hood Mechanics

### `vite preview` serves an artefact; it does not rebuild one

`preview` starts a static server over `dist/`. By the time it runs, every `import.meta.env` reference
in that directory has already been replaced with a literal. Passing `--mode staging` to `preview`
selects which `.env` file **the preview server itself** reads for its own options — it cannot reach
into compiled JavaScript and change a string.

```
vite build --mode staging   →  dist/  contains  MODE = "staging"   (frozen here)
vite preview --mode qa      →  serves that same dist/. MODE is still "staging".
```

Every "why didn't my mode apply" question about `preview` reduces to this. The build is where the
decision was made.

### A mode with no file is silent, not an error

`--mode qa` with no `.env.qa` present produces no warning. Vite loads `.env` and `.env.local` — both
of which *"[are] loaded in all cases"* — and carries on. The build succeeds with configuration
silently missing, which is worse than failing, because the artefact is deployable.

There is no built-in assertion for this. If a mode is load-bearing, assert it in CI yourself.

### Containers set `NODE_ENV` for reasons that have nothing to do with you

Node base images and platform buildpacks commonly set `NODE_ENV=production` because Node's own
ecosystem uses it — `npm ci` skips devDependencies, Express disables view caching. That value
happens to be correct for a Vite build too.

The dangerous variants are the ones a human adds:

```dockerfile
ENV NODE_ENV=staging      # ⛔ inverts import.meta.env.PROD
ENV NODE_ENV=ci           # ⛔ same
ENV NODE_ENV=              # ⛔ empty string is "anything else" → DEV true
```

And there is a second, quieter interaction: everything the image exports lands in `process.env`, and
*"environment variables that already exist when Vite is executed have the highest priority and will
not be overwritten by `.env` files."* So an `ENV VITE_API_URL=...` in a Dockerfile silently outranks
every `.env` file in the repository.

### The multi-stage trap

```dockerfile
FROM node:24-alpine AS build
ENV NODE_ENV=production     # correct for the BUILD
RUN yarn install --frozen-lockfile   # ⚠️ and now devDependencies are skipped —
                                     #    including vite itself
```

`NODE_ENV=production` set before install makes package managers omit `devDependencies`, and `vite`
lives there in almost every project. The build then fails with "vite: not found", which reads like a
path problem and is a `NODE_ENV` problem. Install first, or install with the flag that overrides it.

---

## 2. Real-World Engineering Scenario

**Three environments, one CI file, and a mode that had never existed.**

A team's deploy workflow took the environment name from the branch:

```yaml
run: yarn build --mode ${{ github.ref_name }}
```

`main` → `.env.main`. Which did not exist. Neither did `.env.release-2026-08`. The only branch whose
name matched a real file was `staging`, so staging was the only environment configured correctly,
and it had been that way since the workflow was written.

Production had been building with only `.env` and `.env.local` — falling back to the shared defaults
for every value. It worked, because the shared defaults were *reasonable*: the API URL pointed at
production, because production was the common case. What silently fell back was analytics
(`false`), the Sentry environment tag (unset, so every production error was filed under
`development`) and a feature-flag default that had been meant to be `true` only in production.

Nobody noticed for months, because **there is no failure**. `--mode main` is a legal mode with no
file, and Vite's documented behaviour is to load the generic files and continue.

The fix was three lines of CI, and the useful half is the assertion rather than the mapping:

```yaml
- run: test -f ".env.$MODE" || { echo "no .env.$MODE"; exit 1; }
```

---

## 3. Production-Grade Code Example

```yaml
# .github/workflows/deploy.yml — everything this page is about, in one job.
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5

      # Map branch → mode EXPLICITLY. Never interpolate a branch name into --mode:
      # a mode with no file is silent, so a typo becomes a deployable artefact.
      - id: mode
        run: |
          case "${{ github.ref_name }}" in
            main)    echo "mode=production" >> "$GITHUB_OUTPUT" ;;
            staging) echo "mode=staging"    >> "$GITHUB_OUTPUT" ;;
            *)       echo "mode=preview"    >> "$GITHUB_OUTPUT" ;;
          esac

      # 1. The mode must correspond to a real file.
      - run: test -f ".env.${{ steps.mode.outputs.mode }}" || {
               echo "::error::missing .env.${{ steps.mode.outputs.mode }}"; exit 1; }

      # 2. NODE_ENV must be production or unset — anything else flips PROD to false.
      - run: |
          if [ -n "$NODE_ENV" ] && [ "$NODE_ENV" != "production" ]; then
            echo "::error::NODE_ENV=$NODE_ENV yields import.meta.env.DEV=true"; exit 1
          fi

      # 3. No VITE_* may leak in from the runner: process env outranks every .env file.
      - run: |
          if env | grep -q '^VITE_'; then
            echo "::error::VITE_* in the environment outranks .env files"
            env | grep '^VITE_' | cut -d= -f1; exit 1
          fi

      - run: yarn install --frozen-lockfile     # BEFORE any NODE_ENV=production
      - run: yarn build --mode ${{ steps.mode.outputs.mode }}
```

```dockerfile
# Dockerfile — install first, then build. Order is the whole lesson.
FROM node:24-alpine AS build
WORKDIR /app

# ⛔ An ENV NODE_ENV=production here makes yarn skip devDependencies,
#    and `vite` lives in devDependencies. "vite: not found" is a NODE_ENV bug.
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY . .
# vite build already sets NODE_ENV=production internally. Mode carries the identity.
RUN yarn build --mode staging

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
```

```bash
# Previewing a specific environment: build with that mode, THEN preview.
# The mode has to be on the build; preview only serves what already exists.
vite build --mode staging && vite preview
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1 — Interpolating a branch name into `--mode`

A mode with no matching file is silent. Interpolating anything user- or branch-controlled into
`--mode` therefore turns a typo, a rename or a new branch pattern into a build that silently uses
the generic defaults. Map explicitly, and assert the file exists.

### ⚠️ Pitfall 2 — Passing `--mode` to `vite preview` and expecting it to matter

`preview` serves an artefact. The mode was frozen at build time. Passing `--mode` to `preview`
changes which `.env` file the preview *server* reads for its own options, not what the bundle says.

### ⚠️ Pitfall 3 — `ENV NODE_ENV=production` before `install`

Package managers read it and skip `devDependencies`, where `vite` lives. The failure is
`vite: not found` during the build step, which reads like a `PATH` problem.

### ⚠️ Pitfall 4 — `ENV VITE_*` in a Dockerfile

It lands in `process.env`, which outranks every `.env` file. This is occasionally what you want —
injecting a build arg — and is worth writing down as deliberate, because the next person will read
the `.env` file and believe it.

### ⚠️ Pitfall 5 — Assuming a platform's environment name is `NODE_ENV`-shaped

Hosting platforms expose an environment name (`preview`, `production`, `development`) and it is
tempting to wire it straight into `NODE_ENV`. Wire it into `--mode` instead. `NODE_ENV` is binary;
the platform's name is not.

---

## Gotchas

**★ Symptom: `import.meta.env.MODE` is `"production"` in a `vite preview` started with `--mode staging`.** Cause: `preview` serves an already-built artefact; the mode that mattered was the one at `vite build` time, when the value was statically substituted. Fix: build with the mode you want to preview.

```bash
vite build --mode staging && vite preview
```

**★ Symptom: a custom mode's env file is never read, and the build succeeds anyway.** Cause: the mode string must match the file suffix exactly, and a mode with no file is not an error — Vite loads `.env` and `.env.local` and carries on. Fix: assert the file exists in CI; the build succeeding is exactly what makes this dangerous.

```bash
test -f ".env.$MODE" || { echo "no .env.$MODE"; exit 1; }
```

**★ Symptom: production has been building with the generic `.env` for months and nothing broke.** Cause: an interpolated branch name produced a mode with no file, and the shared defaults were reasonable enough to hide it. Fix: map branch → mode explicitly with a `case`, never by interpolation. The tell is an environment tag — Sentry, analytics — reporting the wrong environment long before anything visibly fails.

**★ Symptom: `vite: not found` in a Docker build that works locally.** Cause: `ENV NODE_ENV=production` appears before the install step, so the package manager skipped `devDependencies` where `vite` lives. Fix: install before setting it, or use the package manager's flag to include dev dependencies regardless.

**★ Symptom: a build works locally and behaves differently in Docker with no code change.** Cause: the image sets `NODE_ENV`, or the platform injects it. Fix: `docker run --rm <image> env | grep NODE_ENV` before reading a line of application code. A base image setting `production` is fine; one setting a deployment name inverts `import.meta.env.PROD`.

**★ Symptom: a `.env` value is correct in the repo and wrong in the deployed app.** Cause: an `ENV VITE_*` line in the Dockerfile, or a CI `export`, and *"environment variables that already exist when Vite is executed have the highest priority."* Fix: pick one source per key. If the container must inject it, delete it from the `.env` file so the file stops lying.

**★ Symptom: `NODE_ENV=` (empty) in a CI job flips `DEV` to true.** Cause: the empty string is "anything else", and the docs' table sends everything that is not `production` to the development side. Fix: unset the variable rather than blanking it — `env -u NODE_ENV`, or simply omit the line.

**★ Symptom: a preview deployment reports itself as production in error tracking.** Cause: the mode was mapped from a branch that fell into a default case pointing at `.env.production`, or the environment tag reads `MODE` where the deployment differs. Fix: give preview deployments their own mode and their own file; a shared fallback that happens to be production is the same class of bug as no file at all.

---

## Interview questions

**★ You pass `--mode staging` to `vite preview` and `import.meta.env.MODE` still says `production`. Why?**
Because `preview` serves a build that already happened. The mode mattered at `vite build` time, when
`MODE` was statically replaced with a literal string in the emitted JavaScript. There is no variable
left for `preview` to set — it reads `.env.staging` for its *own* server options and cannot touch
the artefact. This is the best question in the topic for telling apart someone who memorised the API
from someone who understands it: every "why can't I change this after the build" question in Vite
has the same answer, and it generalises straight to why one artefact cannot be reconfigured per
environment at deploy time.

**★ Why is `--mode $BRANCH_NAME` a bug rather than a convenience?**
Because a mode with no matching `.env` file is not an error. Vite loads the generic files and
continues, so a typo, a branch rename or a new naming convention produces a **deployable artefact
with silently missing configuration** rather than a failed build. The failure surfaces months later
as an analytics gap or an error-tracker environment tag, both of which nobody is watching. Explicit
mapping plus a `test -f` assertion converts an invisible fallback into a red pipeline, which is the
entire value.

**★ A Docker build fails with `vite: not found` but works locally. What happened?**
`NODE_ENV=production` was set before `yarn install` / `npm ci`, so the package manager skipped
`devDependencies` — and `vite` is a dev dependency in essentially every project, because it is a
build tool rather than a runtime one. The fix is ordering: install, then build. The broader point is
that `NODE_ENV` is read by several tools that have nothing to do with each other — the package
manager, Vite, Express, React — and setting it early in a Dockerfile touches all of them at once.
That is precisely why the recommendation is to let `vite build` manage it rather than declaring it.

**★ A build works locally and behaves differently in a container with no code change. Where do you look?**
The process environment, in two places. `NODE_ENV` — set by an `ENV` line or the base image — decides
`import.meta.env.PROD`. And any `VITE_*` variable in the image outranks every `.env` file, because
*"environment variables that already exist when Vite is executed have the highest priority and will
not be overwritten by `.env` files."* `docker run --rm <image> env` and a diff against your `.env`
keys answers both questions in one command, and it is the right first move precisely because neither
symptom points at the environment.

**★ Where should the environment name actually live in a deployment pipeline?**
On `--mode`, and nowhere else. `NODE_ENV` is binary and the deployment name is not, so any mapping
that sends a platform's environment string into `NODE_ENV` will eventually hit a value that is not
`production` and invert `PROD`. Mode is free-form by design and is the axis that was added for
exactly this. The corollary is that the pipeline owns the mapping — an explicit `case` in one place
— rather than each job re-deriving it, because the moment two jobs derive it differently you get an
artefact built for one environment and deployed to another.

---

← [Modes & `NODE_ENV`](01e-modes-and-node-env.md) · [Vite overview](../../README.md) · Next → [`dotenv-expand` & Escaping](01g-dotenv-expansion.md)
