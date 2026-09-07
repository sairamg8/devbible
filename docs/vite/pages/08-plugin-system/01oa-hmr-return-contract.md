---
title: "Returning `undefined`, a narrowed array and `[]` are three different instructions — and the empty array is a claim of ownership, so a plugin that returns it and sends nothing turns a save into silence"
sidebar_label: "The `handleHotUpdate` Return Contract"
sidebar_position: 21
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the Vite documentation — [Plugin API § `handleHotUpdate`](https://vite.dev/guide/api-plugin) (the Type and Kind lines and the three documented choices) and [Environment API § The `hotUpdate` Hook](https://vite.dev/guide/api-environment-plugins). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ The `handleHotUpdate` Return Contract

[`handleHotUpdate`](01o-handle-hot-update.md) covered the hook and its context. This page is about
the one line of it that decides everything: what comes back. The type allows three shapes and they
mean three unrelated things, which is why the most common HMR plugin bug is a file that saves
cleanly and updates nothing.

---

## 1. Under-The-Hood Mechanics

### The three documented choices

> *"The hook can choose to:"*
>
> *"Filter and narrow down the affected module list so that the HMR is more accurate."*
>
> *"Return an empty array and perform a full reload:"*
>
> *"Return an empty array and perform complete custom HMR handling by sending custom events to the
> client:"*

Notice what the second and third have in common: **both are `[]` plus an explicit message to the
client.** The empty array on its own is not one of the three choices — it is half of two of them.

### 🔴 The return value is the update set

| You return | Vite does | Use it when |
|---|---|---|
| `undefined` / nothing | proceeds with its own `modules` list | the change is not yours, or you have no opinion |
| a narrowed `Array<ModuleNode>` | updates exactly those modules | you can prove a subset is sufficient |
| `[]` **plus a send** | updates nothing; your message drives the client | you are doing the update yourself |
| `[]` **with no send** | 🔴 nothing happens at all | never |

An empty array is not "no change", it is *"I have handled it"*. If you return `[]` and forget to
send anything, the file change produces silence — no update, no reload, no error, nothing in the
browser console. It is the hardest HMR failure to diagnose precisely because every layer reports
success.

⚠️ The documentation describes *"filter and narrow down"*. It does not describe returning modules
that were **not** in `ctx.modules`, so treat augmenting the list as unspecified rather than
supported; if you need something else updated, drive it explicitly with a message to the client.

### `sequential`, and what it does not tell you

> *"**Kind:** `async`, `sequential`"*

Sequential means the hooks run in order rather than in parallel — so an `async` hook that awaits a
slow read holds up the HMR pipeline for that change, for every plugin behind it. Guard on `ctx.file`
before doing anything expensive.

⚠️ The documentation does not state whether a later plugin's `ctx.modules` reflects an earlier
plugin's returned array. Do not build on either reading. A plugin that must guarantee an outcome
should take the `[]`-plus-explicit-message route instead of relying on narrowing surviving.

### Per-environment, so "it ran twice" is normal

`handleHotUpdate` is **Per-environment**. The Environment API page says the same thing about its
environment-scoped counterpart in so many words:

> *"When a file changes, the HMR algorithm is run for each environment in series according to the
> order in `server.environments`, so the `hotUpdate` hook will be called multiple times."*

Any "only handle this once" flag will therefore suppress the environment that runs second. Make the
hook a pure function of `ctx` instead.

---

## 2. Real-World Engineering Scenario

**The `catch` that ate every broken save.**

A plugin parsed a schema file on change and narrowed the update to the modules that imported the
changed types. It was written defensively:

```ts
async handleHotUpdate(ctx) {
  try {
    const schema = parse(await ctx.read());
    return ctx.modules.filter((m) => usesTypes(m, changedTypes(schema)));
  } catch {
    return [];                                  // ⛔ "be safe, do nothing"
  }
}
```

The intent was "if I cannot understand the file, stay out of the way". The effect was the opposite:
`[]` told Vite the plugin had handled the change, so nothing was updated and nothing was sent. Every
save made while the schema was mid-edit — which is most saves, since developers save constantly —
produced no update at all. Developers learned to hard-refresh after editing schemas and stopped
reporting it, which is how the bug survived two releases.

The one-character fix is `return;` instead of `return [];`. Undefined means abstain, and Vite then
performs its normal update with the module list it had computed anyway.

**The second half.** After that was fixed, someone noticed the hook ran twice per save on the SSR
project and added `if (handled) return; handled = true;`. That reintroduced the same silence for the
second environment: *"the HMR algorithm is run for each environment in series"*, so the flag stopped
the environment that ran second from ever updating. A guard that produced a correct-looking client
and a stale SSR render.

**The transferable point:** every wrong answer in this hook is an *empty array*, and empty arrays
look harmless in review. Ask what the plugin is claiming, not what it is returning.

---

## 3. Production-Grade Code Example

```typescript
// ✅ The three shapes, each used for what it means.
import type { Plugin, HmrContext, ModuleNode } from 'vite';

export function schemaHmr(): Plugin {
  return {
    name: 'schema-hmr',

    async handleHotUpdate(ctx: HmrContext): Promise<ModuleNode[] | void> {
      // 1. Not ours → abstain. Vite proceeds with its own list.
      if (!ctx.file.endsWith('.schema.json')) return;

      let schema: Schema;
      try {
        schema = parse(await ctx.read());
      } catch {
        // 2. Cannot understand it → abstain, NOT `[]`.
        //    `[]` would mean "I handled it" and the save would do nothing.
        return;
      }

      const affected = ctx.modules.filter((mod) => usesSchema(mod, schema));

      // 3. A narrowed list only when it is provably sufficient.
      //    Never wider than ctx.modules — augmenting it is unspecified.
      return affected;
    },
  };
}
```

```typescript
// ✅ Taking ownership: `[]` is only ever half of the instruction.
async handleHotUpdate({ file, server }) {
  if (!file.endsWith('.locale.json')) return;
  server.ws.send({ type: 'custom', event: 'app:locale-changed', data: { file } });
  return [];                                   // paired with the send above — never alone
}
```

```typescript
// ⛔ Every way to get the return wrong, in one hook.
let handled = false;

async handleHotUpdate(ctx) {
  if (handled) return [];                      // 1. per-environment: kills the 2nd environment
  handled = true;
  try {
    return ctx.modules.filter(mine);
  } catch {
    return [];                                 // 2. abstain written as ownership → silence
  }
  // 3. and nothing here ever sends a message, so every [] above is a dead end
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1 — Returning `[]` as a way of saying "ignore this"

`[]` means the hook has taken over. `undefined` means "carry on normally". Confusing the two turns
an ordinary save into a change that never reaches the browser.

### ⚠️ Pitfall 2 — `catch { return [] }`

The most common shape of the previous pitfall, and the most defensible-looking. The correct fallback
from a parse failure is `return;`.

### ⚠️ Pitfall 3 — Cross-invocation state in a per-environment hook

The hook is called for each environment, so a `handled` flag suppresses the one that runs second.
State that must not be shared has to be keyed by environment.

### ⚠️ Pitfall 4 — Assuming a narrowed list survives to the client unchanged

Other plugins run too, and the docs do not describe how your returned array relates to the
`ctx.modules` a later plugin receives. If the outcome must be guaranteed, take it over explicitly.

### ⚠️ Pitfall 5 — Expensive work before the `ctx.file` guard

`sequential` means every plugin's hook is in the critical path of every file change. An `await` on a
network call or a full project scan makes every save slower for everyone, including changes the
plugin does not care about.

### ⚠️ Pitfall 6 — Returning modules you constructed rather than filtered

The documented action is *"filter and narrow down"*. Returning module objects that were not in
`ctx.modules` is not described anywhere, so it is a bet on an implementation detail. Send a custom
event instead.

### ⚠️ Pitfall 7 — Narrowing to an empty list by accident

A filter that matches nothing returns `[]`, which is the ownership signal. If an empty filter result
means "nothing to do", convert it back to abstention explicitly: `return affected.length ? affected
: undefined;`.

---

## Gotchas

**★ Symptom: editing a file produces no update, no reload and no error.** Cause: the hook returned `[]` without sending anything to the client. Fix: `return;` to abstain, or pair the `[]` with an explicit `server.ws.send(...)`.

**★ Symptom: saves stopped updating only for files the plugin handles, and only when the file is mid-edit.** Cause: `catch { return [] }`. Fix: `catch { return; }` — a parse failure is abstention, not ownership.

**★ Symptom: a filter that matches nothing silently disables HMR for that file.** Cause: an empty filter result is `[]`, which claims ownership. Fix: `return affected.length ? affected : undefined;`.

**★ Symptom: the hook fires twice for one file change.** Cause: it is **Per-environment** — *"the HMR algorithm is run for each environment in series"*. Fix: treat that as normal and make the hook pure in `ctx`; do not add a flag.

**★ Symptom: the client updates correctly but the SSR render is stale.** Cause: a `handled` flag suppressed the second environment. Fix: remove the flag, or key the state by environment.

**★ Symptom: every save in the project feels slower after installing one plugin.** Cause: an `await` before the `ctx.file` guard, in a `sequential` hook. Fix: guard first, then do work.

**★ Symptom: a plugin's narrowing is ignored when another plugin is installed.** Cause: several plugins implement the hook and the docs do not describe how the returned lists interact. Fix: if the outcome must hold, take the `[]`-plus-message route rather than narrowing.

**★ Symptom: an update reaches modules the plugin never listed.** Cause: returning `undefined` from some branches, which hands the decision back to Vite's own list. Fix: intended behaviour — be explicit about which branches abstain and say so in a comment.

---

## Interview questions

**★ What is the difference between returning `undefined`, a narrowed array, and `[]`?**
`undefined` means the hook has no opinion and Vite proceeds with the module list it computed. A
narrowed array replaces that list, which is the documented first choice — *"filter and narrow down
the affected module list so that the HMR is more accurate"*. `[]` means the update set is empty and
the plugin has taken responsibility, which is why both documented `[]` recipes are immediately
followed by an explicit message to the client: a full reload, or a custom event. The trap is using
`[]` to mean "ignore this file"; that produces a save with no update, no reload and no error, which
is far harder to diagnose than a wrong update because every layer reports success.

**★ A colleague wraps the whole hook body in `try { … } catch { return [] }`. What do you say?**
That the catch has turned a recoverable parse failure into a silently dropped update. `[]` tells
Vite the plugin has handled the change, and nothing is then sent to the client, so a developer who
saves a file mid-edit sees nothing happen and has no error to search for. The correct fallback is
`return` — undefined — which lets Vite perform its normal update with the module list it computed.
The broader point is that in this hook the two "empty" values are not interchangeable: one is
abstention and one is a claim of ownership, and a catch block is exactly where a tired author picks
the wrong one.

**★ The hook is `sequential` and per-environment. What does each of those change about your code?**
`sequential` means plugins run one after another rather than concurrently, so an `async` hook that
awaits a slow read delays the whole HMR pipeline for that change — guard on `ctx.file` before doing
anything expensive, because your hook is in the critical path of every file change in the project.
Per-environment means the hook is called for each environment: *"the HMR algorithm is run for each
environment in series according to the order in `server.environments`"*, so one file change invokes
it more than once, any state kept between calls is shared, and any "only run once" flag breaks the
environment that runs second. What `sequential` does not tell you is how your returned array relates
to the `ctx.modules` another plugin later receives; the docs are silent, so do not depend on it.

**★ Can you return modules that were not in `ctx.modules`?**
The documentation describes filtering and narrowing, and says nothing about adding, so the honest
answer is that augmenting the list is unspecified rather than supported — and building a plugin on
unspecified behaviour means a silent breakage at some future minor version, in a subsystem where
silent breakage is the norm. If something outside the affected set genuinely needs to react, the
documented mechanism is to return `[]` and send a custom event, then do the work on the client where
you control it. That is more code, and it is code whose contract is written down.

**★ Why is "every wrong answer here is an empty array" a useful thing to remember in review?**
Because `return []` reads as conservative and defensive in every context a reviewer meets it —
inside a `catch`, behind a guard flag, at the end of a filter that matched nothing — while it
actually means "I have taken over, and nothing further will happen unless I send a message". Once
you know that, reviewing an HMR plugin becomes a single mechanical question asked of each `[]`: what
is sent immediately after this line? If the answer is nothing, the line is a bug regardless of how
sensible the surrounding logic looks.

---

← [`handleHotUpdate`](01o-handle-hot-update.md) · [Vite overview](../../README.md) · Next → [HMR: Full Reload & Invalidation](01ob-hmr-full-reload-and-invalidation.md)
