---
title: "Composition, the Prefix Filter's Position in the Pipeline, and Sharing One `.env` With Other Tools"
sidebar_label: "Composition & Tool Interop"
sidebar_position: 9
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-07 against the Vite documentation — [Env Variables and Modes](https://vite.dev/guide/env-and-mode), [`envPrefix`](https://vite.dev/config/shared-options#envprefix). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> ⚠️ Scope: the pipeline ordering below is **inferred from documented behaviour** — that unprefixed variables are usable as expansion sources while never reaching `import.meta.env`. Vite does not publish a stage diagram; treat the diagram as a model that explains the documented outcomes, not as a quoted specification.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ Composition, the Prefix Filter's Position, and Sharing One `.env` With Other Tools

[Chunk 1g](01g-dotenv-expansion.md) covered what `$` does to a single value. This chunk covers what
happens when values reference **each other**, and what happens when the same file is read by
something that is not Vite.

---

## 1. Under-The-Hood Mechanics

### Where each stage sits

```
.env file on disk
      │
      ▼  dotenv               parse KEY=VALUE lines
      ▼  dotenv-expand        substitute $VAR / ${VAR}    ← composition happens HERE
      ▼  process env merge    existing vars win, always
      ▼  envPrefix filter     keep only VITE_* (by default) ← exposure decided HERE
      ▼  static replacement   substitute into the module graph
   dist/
```

🔴 **Expansion happens before the prefix filter.** That ordering is not stated as a stage list in the
documentation, but it is the only ordering consistent with what *is* documented: an unprefixed
variable can be used as an expansion source, and an unprefixed variable never appears in
`import.meta.env`.

The useful consequence:

```bash
API_HOST=api.acme.com                    # unprefixed — never reaches the client
VITE_API_URL=https://${API_HOST}/v2      # prefixed — DOES reach the client
VITE_WS_URL=wss://${API_HOST}/socket     # one hostname, one place to change it
```

The dangerous consequence is the same sentence read the other way: **the private variable's
*value* is now inside a public one.** The prefix filter never sees `API_HOST`; it sees a finished
`VITE_API_URL` string that happens to contain it. So "it isn't prefixed, therefore it's safe" stops
being true the moment composition is in play.

```bash
# ⛔ DB_PASSWORD is unprefixed and "safe"… and its value is now in the bundle.
DB_PASSWORD=hunter2
VITE_DEBUG_DSN=postgres://app:${DB_PASSWORD}@db/app
```

Nothing warns. The audit has to be on the **output**:

```bash
grep -r 'hunter2\|internal\.acme\.com' dist/ && exit 1
```

---


## 3. Production-Grade Code Example

```bash
# .env — composition done deliberately, with the pitfalls annotated.

# ── 1. Legitimate reuse. Definition BEFORE reference, so every reader agrees. ──
API_HOST=api.acme.com
VITE_API_URL=https://${API_HOST}/v2
VITE_WS_URL=wss://${API_HOST}/socket

# ── 2. NEVER compose a public value out of a private one ──────────────────────
# ⛔ DB_PASSWORD is unprefixed and never reaches import.meta.env — but its VALUE
#    is inside VITE_DEBUG_DSN, which does. Expansion runs before the prefix filter.
# DB_PASSWORD=hunter2
# VITE_DEBUG_DSN=postgres://app:${DB_PASSWORD}@db/app

# ── 3. NEVER rely on reverse-order expansion ──────────────────────────────────
# ❌ Vite gives "foobar"; docker compose and `source` give "foo".
# VITE_FOO=foo${VITE_BAR}
# VITE_BAR=bar
```

```bash
# CI — prove no private value rode into the bundle via composition.
# Reads dist/, because the composed value is the only place the leak is visible.
- run: yarn build
- name: Assert no private hostnames or secrets in the artefact
  run: |
    for needle in 'internal.acme.com' 'db.internal' '@db/'; do
      if grep -rq "$needle" dist/; then
        echo "::error::'$needle' reached the bundle — check composed VITE_* values"
        exit 1
      fi
    done
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1 — Composing a public value out of a private one

`VITE_API_URL=https://${DB_HOST}/x` puts `DB_HOST`'s value into a variable that ships to the browser,
even though `DB_HOST` itself is unprefixed and "safe". Expansion runs **before** the prefix filter,
so the filter never sees the private name — only the composed public value. Grep `dist/` after any
change that introduces `${...}` into a prefixed value.

### ⚠️ Pitfall 2 — Expecting the prefix filter to protect a composed value

The filter operates on **names**, after values are final. It has no way to know that a public value
was assembled from a private one, and no warning exists for it. Only an output audit catches this.

---

## Gotchas

**★ Symptom: a private hostname or password appears in the production bundle although its variable was never prefixed.** Cause: a `VITE_*` variable composed from it. Expansion happens before the prefix filter, so the composed public value carries the private one. Fix: grep `dist/` after any change that introduces `${...}` into a prefixed value.

```bash
grep -r 'internal\.acme\.com' dist/ && exit 1
```

**★ Symptom: changing one hostname requires edits in four places.** Cause: composition was avoided out of caution. Fix: composition is the right tool here — define the host once, unprefixed, and reference it. The rule to keep is narrower than "avoid `${}`": never compose a **public** value out of a **secret** one.

**★ Symptom: a container comes up pointing at `localhost` and cannot reach a sibling service.** Cause: an undefined or unexpanded host variable defaulted to a literal `localhost`, which inside a container means the container itself. Fix: check the forward-reference case first — it is the most common way a host silently becomes empty in compose but not in Vite.

**★ Symptom: an audit of `import.meta.env` keys looks clean but a secret is still in `dist/`.** Cause: the audit enumerated **names**, and the leak was a **value** composed into a legitimately-named variable. Fix: audit for secret *shapes* and known private hostnames in the output, not only for key names — the two checks catch different failures.

---

## Interview questions

**★ Where in the pipeline does expansion happen relative to the `VITE_` prefix filter, and why does it matter?**
Before it. That ordering is not published as a stage list, but it is the only one consistent with the
documented behaviour: an unprefixed variable can be used as an expansion source, and an unprefixed
variable never appears in `import.meta.env`. The consequence people miss is that
`VITE_API_URL=https://${API_HOST}/v2` ships the composed value — including the private variable's
contents — to the browser. The prefix filter never sees `API_HOST`; it sees a finished string. So
"it isn't prefixed, therefore it's safe" is false whenever composition is in play, and the audit has
to run against the output rather than against the key list.

**★ Is composing env values with `${...}` good practice or bad?**
Good, with one hard exclusion. Defining a hostname once and referencing it from three URLs removes a
real class of bug — the four-places-to-change-one-value problem — and it is exactly what the feature
is for. The exclusion is that a **public** value must never be composed from a **secret** one,
because the prefix filter operates on names after values are final and cannot see that the resulting
string contains something private. So the rule is not "avoid expansion", it is "never let a
`VITE_*` value's expansion touch a secret", and the enforcement is an output grep rather than a
convention.

**★ How would you prove no secret reached the bundle when composition is in use?**
Two greps against `dist/`, not one, because they catch different failures. The first enumerates
exposed key names — `grep -roh 'VITE_[A-Z0-9_]*' dist/ | sort -u` — which catches something that was
prefixed by mistake. The second searches for secret *shapes* and known private strings: internal
hostnames, `sk_live_`, `-----BEGIN`, credentials in a DSN. Composition defeats the first check
entirely, since the key name is legitimate and only the value is wrong, so a project that composes
env values needs the second check specifically. Both belong in CI as failing steps; a review
checklist has already been shown, twice on these pages, not to catch this.

---

← [`dotenv-expand` & Escaping](01g-dotenv-expansion.md) · [Vite overview](../../README.md) · Next → [Sharing One `.env` Across Tools](01i-sharing-env-across-tools.md)
