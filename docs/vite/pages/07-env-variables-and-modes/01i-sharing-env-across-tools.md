---
title: "One `.env`, Two Dialects: Reverse-Order Expansion and Why a Shared File Is Not a Single Source of Truth"
sidebar_label: "Sharing `.env` Across Tools"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-07 against the Vite documentation — [Env Variables and Modes](https://vite.dev/guide/env-and-mode). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> ⚠️ Scope: only Vite's own documented behaviour is asserted. `docker compose`'s and `dotenv`'s parsing rules are described as the Vite docs describe them — *"This does not work in shell scripts and other tools like docker compose"* — and were **not** independently fetched from those projects.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ One `.env`, Two Dialects

A `.env` file looks like the most portable thing in a repository. It is a text file of `KEY=VALUE`
lines; what could possibly differ between readers? One row of one table — and that row is enough to
make a pure-reordering commit break production.

---

## 1. Under-The-Hood Mechanics

### Reverse-order expansion

> *"Vite supports expanding variables in reverse order. For example, the `.env` below will be evaluated as `VITE_FOO=foobar`, `VITE_BAR=bar`."* — [Env Variables and Modes](https://vite.dev/guide/env-and-mode)

```bash
VITE_FOO=foo${VITE_BAR}
VITE_BAR=bar
```

A shell reads this top to bottom and produces `VITE_FOO=foo`. Vite produces `foobar`. The docs are
unusually direct about both the reason and the consequence:

> *"This does not work in shell scripts and other tools like docker compose. That said, Vite supports this behavior as this has been supported by dotenv-expand for a long time and other tools in JavaScript ecosystem use older versions that support this behavior."*

> *"To avoid interop issues, it is recommended to avoid relying on this behavior. Vite may start emitting warnings for this behavior in the future."*

That is documentation telling you a feature exists **and** telling you not to use it, which is worth
taking at face value.

### The comparison table

| | Vite (`dotenv-expand`) | shell / `docker compose` |
|---|---|---|
| `$VAR` defined **above** | expands | expands |
| `$VAR` defined **below** | expands | does **not** expand |
| `\$` escape | literal `$` | literal `$` |
| undefined `$VAR` | empty string | empty string |

🔴 **Only the second row differs.** That single row is what produces a byte-identical file with two
meanings — and it is why ordering is *semantics*, not formatting, in any file more than one tool
reads.

### The general interop rule

Write a shared `.env` to the **stricter** reader's semantics, which is the shell's: define before
you reference, escape every literal `$`, and use nothing you have not verified in both.

The deeper rule is that a shared file is only a single source of truth if every reader agrees on
what it says. When two dialects are involved, `.env` is better treated as an **output format** —
generated per tool from one input — than as a source document.

---

## 2. Real-World Engineering Scenario

**A shared `.env` that made local development a worse test than no test.**

A team ran their API in `docker compose` and their frontend with `vite dev`, both reading a single
`.env` at the repository root — deliberately, so "there is one place to change a URL". It worked for
a year.

Then someone reorganised the file into sections, moving the shared `HOST` definition to the bottom
under a "shared" heading. Vite kept working: reverse-order expansion resolved the forward reference.
`docker compose` did not — the API container came up with an empty host and defaulted to
`localhost`, which inside a container means the container itself.

The symptom was that **the frontend worked perfectly** and the API's outbound calls to a sibling
service failed. Two tools, one file, one commit that changed no values at all. The diff was a pure
move, so review approved it in seconds — and there is no version of a human review process that
reliably catches this, because the change genuinely looks like nothing.

Two outcomes, and the second is the one that generalises:

- **Immediate:** define before referencing, plus a CI check for forward references.
- **Structural:** stop sharing the file. One document interpreted in two dialects is a latent bug
  even while it currently agrees. The team generated each tool's environment from one input —
  two rendered outputs, each in its own dialect — which also let each tool have keys the other did
  not need, something a shared file quietly discourages.

---

## 3. Production-Grade Code Example

```bash
#!/usr/bin/env bash
# scripts/lint-env.sh — forward-reference check. Runs in CI.
# A pure reordering commit is what broke the scenario above; review cannot catch it.
status=0
for f in .env .env.*; do
  [ -f "$f" ] || continue
  awk -F= '/^[A-Za-z_]/ {
    line = $0
    while (match(line, /\$\{?[A-Za-z_][A-Za-z0-9_]*\}?/)) {
      ref = substr(line, RSTART, RLENGTH); gsub(/[${}]/, "", ref)
      if (!(ref in seen)) {
        print FILENAME ":" NR ": forward reference to " ref " — Vite resolves this, a shell does not"
        bad = 1
      }
      line = substr(line, RSTART + RLENGTH)
    }
    seen[$1] = 1
  } END { exit bad ? 1 : 0 }' "$f" || status=1
done
exit $status
```

```javascript
// scripts/render-env.mjs — the structural fix: one input, two dialects out.
// env.config.mjs is the source of truth; nothing reads a .env file by hand.
import { writeFileSync } from 'node:fs';
import { config } from '../env.config.mjs';

/** Both dialects agree on backward references, so render fully-resolved values. */
const resolve = (v, all) => v.replace(/\$\{?([A-Za-z_]\w*)\}?/g, (_, k) => all[k] ?? '');

const render = (entries) =>
  Object.entries(entries)
    .map(([k, v]) => `${k}=${resolve(String(v), entries).replaceAll('$', '\\$')}`)
    .join('\n') + '\n';

writeFileSync('.generated/api.env', render(config.api));   // for docker compose
writeFileSync('.env.production', render(config.web));      // for vite
```

```yaml
# docker-compose.yml — each tool reads a file in its own dialect.
services:
  api:
    env_file: [.generated/api.env]     # produced by scripts/render-env.mjs
  # the frontend reads .env / .env.[mode] as Vite expects — also generated
```

```bash
# The rule, if you must keep one shared file: define BEFORE reference.
# ✅ correct under every reader
HOST=api.acme.com
VITE_API_URL=https://${HOST}/v2

# ❌ correct under Vite only
# VITE_API_URL=https://${HOST}/v2
# HOST=api.acme.com
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1 — Reverse-order expansion that only works in Vite

Vite resolves a forward reference; `docker compose` and shell `source` do not. The file becomes a
source of drift between local dev and the container, and the drift is invisible because the file is
byte-identical. Always define before referencing.

### ⚠️ Pitfall 2 — Reordering a `.env` file as a "tidy-up"

A commit that moves lines without changing any value can change what the file *means* to a non-Vite
reader. This is the worst review target in the repository: a pure move, approved in seconds, with a
behavioural change hidden in the ordering.

### ⚠️ Pitfall 3 — Assuming one shared file is simpler

It is simpler until the two readers disagree, at which point it is a bug with no obvious owner. Two
generated files from one source is more machinery and strictly less risk.

### ⚠️ Pitfall 4 — Iterating in the permissive dialect

Vite's superset is a trap specifically because it is the environment you iterate in. Local
development validates a file that behaves differently in the container, so the feedback loop you
trust most is the one least able to catch the defect.

### ⚠️ Pitfall 5 — Assuming quoting and multi-line rules are shared

The Vite docs specify escaping with `\$` and say nothing else about quoting. Quoting, multi-line
values and comment handling belong to each reader's own parser and were **not** verified here for
either side. If a value's quoting matters, test it in both tools rather than reasoning from shell
habits.

---

## Gotchas

**★ Symptom: an env value differs between `vite dev` and `docker compose up` with an identical `.env`.** Cause: reverse-order expansion. Vite supports it; compose and shells do not. Fix: reorder so every reference comes after its definition — that form is correct under both readers.

**★ Symptom: a commit that only moved lines around broke a service.** Cause: the move turned a backward reference into a forward one, which Vite still resolves and a shell does not. Fix: the forward-reference lint above. Human review cannot catch this class — the diff genuinely contains no value change.

**★ Symptom: CI passes and a developer's local build differs.** Cause: a forward reference resolving under Vite locally, and a CI step that `source`s the same `.env` in a shell before building. Fix: eliminate forward references. A file read by both a shell and Vite must be written to the shell's semantics, which are the stricter of the two.

**★ Symptom: a container comes up pointing at `localhost` and cannot reach a sibling service.** Cause: an undefined or unexpanded host variable left an empty value, and the application's own fallback was `localhost` — which inside a container means the container itself. Fix: check the forward-reference case first; it is the most common way a host silently becomes empty in compose but not in Vite.

**★ Symptom: adding a second tool that reads `.env` immediately produces disagreements.** Cause: every reader implements its own dialect — quoting, multi-line and expansion order all vary. Fix: treat `.env` as an *output format*, not a source of truth, as soon as more than one tool reads it. Render per-tool files from one input.

**★ Symptom: the frontend works and only the backend is broken, from the same config change.** Cause: the two tools disagreed about the file, and the permissive reader is the one you were looking at. Fix: when a config change breaks exactly one of two tools that share a file, suspect the *file's dialect* before suspecting either tool.

**★ Symptom: a value with an escaped `\$` arrives with the backslash still attached in one tool.** Cause: escape handling is per-parser, and only Vite's `\$` behaviour is documented here. Fix: verify in both readers before shipping; prefer values with no `$` at all in a shared file, since that is the only form with no dialect risk.

**★ Symptom: a `.env.example` drifts from the real file and nobody notices.** Cause: nothing reads the example, so nothing validates it. Fix: generate it from the same source as the real files and diff the key sets in CI — the same "generate, do not share" principle, applied to documentation instead of configuration.

---

## Interview questions

**★ You have one `.env` read by both Vite and `docker compose`. What constraints does that impose?**
Write it to the stricter reader's semantics, which is the shell's: define before you reference,
escape every literal `$`, and use nothing you have not verified in both. Vite's superset —
reverse-order expansion — is a trap specifically because it works in the environment where you
iterate, so local development validates a file that behaves differently in the container. The better
answer is usually to stop sharing the file: generate each tool's environment from one source rather
than pointing both at a document each interprets in its own dialect. **A shared file is not a single
source of truth if the two readers disagree about what it says** — it is a single source of
ambiguity.

**★ Why is a pure-reordering commit to a `.env` file dangerous?**
Because ordering *is* semantics for any reader that does not support forward references. Vite
resolves `${VITE_BAR}` used above `VITE_BAR=bar`; a shell and `docker compose` do not. A commit that
moves lines into tidy sections therefore changes behaviour for one reader and not the other, with a
diff containing no value changes at all — the hardest possible thing for a human reviewer to catch,
because the change genuinely looks like nothing. It is a strong argument for a general principle:
any file whose meaning depends on line order deserves a linter, not a convention.

**★ Vite documents a feature and then tells you not to use it. How do you read that?**
At face value, and as a compatibility statement rather than a design one. The docs explain the
reason — *"this has been supported by dotenv-expand for a long time and other tools in JavaScript
ecosystem use older versions that support this behavior"* — so the behaviour exists to avoid
breaking existing files, not because anyone thinks forward references are good. They also warn that
Vite *"may start emitting warnings for this behavior in the future"*, which is as close to a
deprecation notice as an unversioned behaviour gets. Building on it means opting into a future
migration for no present benefit.

**★ Your frontend works and your API is broken after a config change. What is your first hypothesis?**
That the two tools disagree about the shared file, not that either tool is broken. The asymmetry is
the signal: one reader is permissive and one is strict, so a file that satisfies only the permissive
one produces exactly this shape — the thing you were looking at works, and the thing you were not
looking at does not. Diff the *parsed* environments rather than the file: `docker compose config`
renders what compose resolved, and comparing that against what Vite resolved localises the
disagreement in one step, without reading a single line of application code.

**★ How would you make a shared `.env` safe without giving up the single-source-of-truth goal?**
Keep the single source, change its format. Put the values in something with unambiguous semantics —
a JS or JSON module — and render a `.env` per tool from it, with every reference already resolved so
no consumer has to expand anything. You keep one place to change a hostname, you gain per-tool keys
without polluting a shared namespace, and you eliminate the dialect problem entirely rather than
documenting it. The cost is a build step and a `.gitignore` entry, which is small next to a class of
bug that survives code review by construction.

---

← [Composition & Tool Interop](01h-env-composition-and-interop.md) · [Vite overview](../../README.md) · Next → [Config-Time Env, `define` & HTML Replacement](02-config-time-env-and-define.md)
