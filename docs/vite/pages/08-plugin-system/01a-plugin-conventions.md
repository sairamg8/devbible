---
title: "Plugin Conventions: the Prefix Is an Interface Claim, and Presets Break Your Mental Model of Ordering"
sidebar_label: "Conventions & Discovery"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-07 against the Vite documentation — [Plugin API § Conventions](https://vite.dev/guide/api-plugin), [Features](https://vite.dev/guide/features). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ Plugin Conventions: the Prefix Is an Interface Claim

Naming, discovery and the plugins array look like filing rules. They are not — **the prefix encodes
which interface you used**, presets quietly change what "plugin order" means, and the docs name one
third-party debugging tool by hand because the pipeline is otherwise opaque.

---

## 1. Under-The-Hood Mechanics

### Naming — and the v8 change here too

> *"If the plugin doesn't use Vite specific hooks and can be implemented as a Compatible Rolldown Plugin, then it is recommended to use the Rolldown Plugin naming conventions."*
> *"Rolldown Plugins should have a clear name with `rolldown-plugin-` prefix."*
> *"Include `rolldown-plugin` and `vite-plugin` keywords in package.json `keywords` field."*

For genuinely Vite-only plugins:

> *"Vite Plugins should have a clear name with `vite-plugin-` prefix."*
> *"Include a section in the plugin docs detailing **why it is a Vite only plugin** (for example, it uses Vite specific plugin hooks)."*

And framework-specific plugins carry the framework in the prefix — `vite-plugin-vue-`,
`vite-plugin-react-`, `vite-plugin-svelte-`.

🔴 **This is a design instruction wearing a filing rule's clothes.** If your plugin needs no
Vite-specific hook, name it `rolldown-plugin-`, because *"This exposes the plugin to be also used in
pure Rolldown or Rollup based projects."* And a Vite-only plugin is asked to **justify itself in its
own docs** — the convention is telling you that reaching for a Vite-specific hook narrows your
audience, and to notice before you pay for it.

### Configuration: falsy entries and presets

> *"Falsy plugins will be ignored, which can be used to easily activate or deactivate plugins."*

```js
plugins: [react(), isDev && devOnlyPlugin()]   // no .filter(Boolean) needed
```

> *"`plugins` also accepts presets including several plugins as a single element. This is useful for complex features (like framework integration) that are implemented using several plugins. The array will be flattened internally."*

🔴 **Flattening is why reasoning about order from the array is unreliable.** `@vitejs/plugin-react`
is one entry and several plugins; each of those can carry its own `enforce`, so one array position
can become three plugins at three different positions in the resolved order. See
[chunk 1d](01p-plugin-ordering-and-enforce.md).

### Before you write one

> *"Vite strives to offer established patterns out of the box, so before creating a new plugin make sure that you check the [Features guide](https://vite.dev/guide/features) to see if your need is covered. Also review available community plugins, both in the form of a compatible Rollup plugin and Vite Specific plugins."*

Note that it says to check **both** ecosystems. The Rollup/Rolldown ecosystem is older and larger,
and a plugin with no "vite" in its name frequently works — which is the same fact the naming
convention is trying to make visible from the other direction.

### The debugging tool the docs name by hand

> *"When learning, debugging, or authoring plugins, we suggest including [vite-plugin-inspect](https://github.com/antfu/vite-plugin-inspect) in your project. It allows you to inspect the intermediate state of Vite plugins. After installing, you can visit `localhost:5173/__inspect/` to inspect the modules and transformation stack of your project."*

Documentation naming a specific third-party tool is unusual, and worth reading as the hint it is:
**the plugin pipeline is opaque by construction**, and this is the supported way to see into it. It
answers the one question logging cannot — *which* plugin produced this output, and what the input
already looked like when yours received it.

---

## 2. Real-World Engineering Scenario

**A plugin that could not be adopted, because of its name.**

A team wrote a genuinely useful transform — a small plugin rewriting a bespoke asset-reference
syntax used across three of their repositories. It used exactly one hook, `transform`, and nothing
Vite-specific. They published it as `vite-plugin-acme-assets`.

Eighteen months later a fourth repository needed the same transform, and that repository was a
library built with **Rollup** directly. The plugin worked there unchanged — it was a plain
Rolldown/Rollup-shaped plugin — but nobody looked, because the name says Vite and the package
`keywords` said `vite-plugin`. The team wrote a second copy.

The two copies then drifted. A fix landed in one and not the other, and the discrepancy surfaced
months later as two builds producing different asset URLs from the same source file — a bug whose
root cause was a package name chosen in an afternoon.

The convention exists precisely to prevent this: *"This exposes the plugin to be also used in pure
Rolldown or Rollup based projects."* `rolldown-plugin-acme-assets`, with both `rolldown-plugin` and
`vite-plugin` keywords, would have been discoverable from either side.

**The generalisable point:** a plugin's name is an interface claim, and claiming a narrower interface
than you implement costs you reuse you never see yourself declining.

---

## 3. Production-Grade Code Example

```json
// package.json — the naming convention, applied. This plugin uses only `transform`,
// so it is named for the WIDER audience and carries both keywords.
{
  "name": "rolldown-plugin-acme-assets",
  "keywords": ["rolldown-plugin", "vite-plugin"],
  "peerDependencies": { "vite": "^8.0.0" }
}
```

```typescript
// vite.config.ts — falsy entries and presets, both documented behaviours.
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';   // a PRESET: several plugins, one entry
import { acmeAssets } from 'rolldown-plugin-acme-assets';

const isDev = process.env.NODE_ENV !== 'production';

export default defineConfig({
  plugins: [
    react(),

    // "Falsy plugins will be ignored" — no .filter(Boolean) needed, and the
    // conditional reads as a conditional rather than as array surgery.
    isDev && devOnlyPlugin(),
    process.env.ANALYZE && visualizer(),

    acmeAssets({ base: '/static/' }),
  ],
});
```

```typescript
// A preset: "several plugins as a single element … flattened internally".
// This is how one entry becomes three, and why the array is not the resolved order.
export default function framework(config) {
  return [
    { ...frameworkRefresh(config), enforce: 'pre' },   // lands EARLY
    frameworkCore(config),                              // lands in the middle
    { ...frameworkDevtools(config), enforce: 'post' },  // lands LATE
  ];
}
```

```bash
# The debugging tool the docs name by hand. Nothing else answers
# "which plugin produced this output" without guessing.
pnpm add -D vite-plugin-inspect
# then: vite  →  open http://localhost:5173/__inspect/

# Before writing a plugin, check BOTH ecosystems — the docs say to.
npm search rolldown-plugin-<thing>
npm search rollup-plugin-<thing>
npm search vite-plugin-<thing>
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1 — Naming a portable plugin `vite-plugin-`

If it uses no Vite-specific hook, the convention says `rolldown-plugin-`, with both keywords. The
cost of the narrower name is invisible: you never meet the people who did not find it.

### ⚠️ Pitfall 2 — Reasoning about order from the plugins array alone

A preset is *"several plugins as a single element"* and *"the array will be flattened internally"*,
so one entry can become three at three different positions.

### ⚠️ Pitfall 3 — Writing a plugin before checking Features

The docs open with this instruction for a reason: glob imports, worker imports, WASM, `?url` /
`?raw` / `?inline` and asset handling are all built in. A plugin duplicating a built-in is a
maintenance liability that also fights the built-in.

### ⚠️ Pitfall 4 — Searching only for "vite plugin"

The docs say to review *"both in the form of a compatible Rollup plugin and Vite Specific plugins"*.
The Rollup/Rolldown ecosystem is older and larger; a plugin with no "vite" in its name frequently
works unchanged.

### ⚠️ Pitfall 5 — Debugging a pipeline by logging inside your own plugin

Your log tells you what *you* did. It cannot tell you what ran before you, what the input already
was, or which of eleven plugins mangled a file. That is what `vite-plugin-inspect` is for, and the
docs recommending it by name is a statement about the pipeline's opacity.

### ⚠️ Pitfall 6 — Shipping a Vite-only plugin without saying why

The convention asks for *"a section in the plugin docs detailing why it is a Vite only plugin"*.
Skipping it means consumers cannot tell whether the restriction is essential or accidental — and
accidental restrictions are the ones worth fixing.

---

## Gotchas

**★ Symptom: two repositories carry two drifting copies of the same transform.** Cause: the plugin was named `vite-plugin-*` although it uses no Vite-specific hooks, so a Rollup-based project never found it. Fix: `rolldown-plugin-` prefix with both `rolldown-plugin` and `vite-plugin` keywords.

**★ Symptom: a `.filter(Boolean)` on the plugins array looks necessary and is not.** Cause: an assumption. Fix: *"Falsy plugins will be ignored"* — `isDev && plugin()` is the documented idiom and the filter is noise.

**★ Symptom: plugin ordering does not match the array and nobody can explain it.** Cause: a preset entry expanded to several plugins, or `enforce` moved one. Fix: [chunk 1d](01p-plugin-ordering-and-enforce.md), plus `vite-plugin-inspect`. The array is not the resolved order.

**★ Symptom: a hand-written plugin duplicates something Vite already does.** Cause: it was written before reading the Features guide, which the docs tell you to check first. Fix: delete it. Glob imports, workers, WASM and the asset suffixes are built in.

**★ Symptom: no "vite plugin" exists for a file type and the team plans to write one.** Cause: searching one ecosystem. Fix: search Rolldown and Rollup plugins too — the docs explicitly say to review both. This is the highest-value thirty minutes available before writing any plugin.

**★ Symptom: you cannot tell which plugin produced a given transformed module.** Cause: there is no built-in trace. Fix: `vite-plugin-inspect` at `localhost:5173/__inspect/` shows the transformation stack per module. It is recommended by name in the docs, which is unusual and deliberate.

**★ Symptom: a consumer asks whether your plugin works with Rollup and nobody knows.** Cause: no Vite-only justification section, so the restriction's basis is unrecorded. Fix: write the section the convention asks for — and if you cannot name a Vite-specific hook you depend on, the plugin is not Vite-only and the name is wrong.

**★ Symptom: an `enforce` on a preset's wrapper has no effect.** Cause: the preset returns an array, and spreading a Vite property onto the array rather than onto each plugin object does nothing. Fix: set `enforce` inside the preset on the specific plugin that needs it, as in the example above.

**★ Symptom: a conditional plugin is active in production because the condition was truthy.** Cause: `process.env.ANALYZE && visualizer()` is falsy-checked, but `process.env.ANALYZE` is the string `"false"` when set that way — which is truthy. Fix: the same string-coercion trap as [`import.meta.env`](../07-env-variables-and-modes/01c-built-in-constants-and-typing.md); compare explicitly rather than relying on truthiness.

---

## Interview questions

**★ Why does the naming convention distinguish `rolldown-plugin-` from `vite-plugin-`?**
Because the prefix is a claim about which interface you used, and therefore about who can use your
plugin. The docs are explicit that the Rolldown prefix *"exposes the plugin to be also used in pure
Rolldown or Rollup based projects"*, and they ask a Vite-only plugin to *"include a section in the
plugin docs detailing why it is a Vite only plugin"* — i.e. to justify the narrower audience. Read
as a design instruction rather than a filing rule, it says that reaching for a Vite-specific hook has
a cost, and asks you to notice before paying it.

**★ Your plugin uses only `transform`. What should it be called and why does it matter?**
`rolldown-plugin-<thing>`, with both `rolldown-plugin` and `vite-plugin` in `keywords`. It matters
because a plugin using no Vite-specific hook is usable from Rollup and Rolldown projects directly,
and the name is the only signal most people ever see. The failure mode is not an error — it is a
second copy of the same transform, written by someone who searched, found nothing applicable, and
reimplemented it. Naming is a discovery mechanism, and the cost of getting it wrong is paid by people
you never meet, in the form of drift between copies nobody knows are copies.

**★ Why can't you read plugin execution order off the plugins array?**
Because a single array entry is not necessarily a single plugin. Presets are *"several plugins as a
single element"* and *"the array will be flattened internally"*, so `@vitejs/plugin-react` may
contribute three plugins — and each of those can carry its own `enforce`, which moves it into a
different band of the resolved order entirely.

⚠️ **The documentation lists the seven bands and never states how plugins are ordered *within* one.**
Array order is the obvious guess and this page does not assert it. Treat intra-band order as
unspecified, design so it does not matter, and use `vite-plugin-inspect` to observe what actually
happened rather than reasoning about it.

**★ What does `vite-plugin-inspect` do that logging cannot?**
It shows the **intermediate state** of the transformation stack per module — every plugin that
touched a file and what it produced, in order. Logging inside your own plugin tells you what your
plugin did; it cannot tell you what ran before it, what the input already was, or which of eleven
plugins mangled a file. The docs recommend it by name in the plugin-authoring section, which is
unusual for a third-party tool and worth taking as the hint it is: the pipeline is opaque by
construction, and this is the supported way to see into it.

**★ The docs tell you to check the Features guide before writing a plugin. Why is that instruction first?**
Because the most common plugin is one that should not exist. Vite handles glob imports, worker and
WASM imports, the `?url` / `?raw` / `?inline` asset suffixes, CSS preprocessors and TS/JSX natively,
and a plugin that reimplements any of them does not merely duplicate work — it *competes* with the
built-in, producing ordering-dependent behaviour that is very hard to debug because both mechanisms
are doing something reasonable. The second instruction, to check both plugin ecosystems, has the
same shape: the cheapest plugin is one someone else maintains.

---

← [Plugin API & Conventions](01-plugin-api.md) · [Vite overview](../../README.md) · Next → [Dev vs Build Hooks](01b-the-hook-set.md)
