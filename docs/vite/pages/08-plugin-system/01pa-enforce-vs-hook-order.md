---
title: "`enforce`, a hook's `order` and a hook's Kind are three different mechanisms sharing one name, and each is powerless against the problems the other two solve"
sidebar_label: "`enforce` vs Hook `order`"
sidebar_position: 33
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-07 against the Vite documentation — [Plugin API § Plugin Ordering](https://vite.dev/guide/api-plugin), [§ `transformIndexHtml`](https://vite.dev/guide/api-plugin), [§ `configResolved`](https://vite.dev/guide/api-plugin); Rolldown reference — [`ObjectHook` (`order`)](https://rolldown.rs/reference/TypeAlias.ObjectHook). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ `enforce` vs Hook `order` vs Hook Kind

**Three separate mechanisms are all called "plugin order" in review comments.** `enforce` puts a
plugin object in a band ([chunk 1p](01p-plugin-ordering-and-enforce.md)); a hook's `order`
positions *that one hook* among the plugins implementing it; the hook's **Kind** decides whether
any ordering is guaranteed at all. Reaching for the wrong one produces a change that appears to
help, which is worse than a change that does nothing.

---

## 1. Under-The-Hood Mechanics

### The disclaimer, verbatim

> *"Note that this is separate from hooks ordering, those are still separately subject to their
> [`order` attribute](https://rolldown.rs/reference/TypeAlias.ObjectHook#order) as usual for
> Rolldown hooks."*

| Mechanism | Written on | Decides | Chunk |
|---|---|---|---|
| `enforce: 'pre' \| 'post'` | the **plugin object** | which of three user bands the plugin lands in | [1p](01p-plugin-ordering-and-enforce.md) |
| `order: 'pre' \| 'post' \| null` | a **hook**, in object form | that hook's position among plugins implementing it | here |
| **Kind** — `sequential` / `parallel` | fixed by **Vite**, per hook | whether ordering between plugins is guaranteed *at all* | [1f](01f-hook-kinds-and-ordering-guarantees.md) |

Rolldown documents `order` as a per-hook attribute on the object form of a hook:

> *"If there are several plugins implementing this hook, either run this plugin first (`"pre"`),
> last (`"post"`), or in the user-specified position (no value or `null`)."*
>
> *"If several plugins use `"pre"` or `"post"`, Rolldown runs them in the user-specified order."*

```
enforce  → WHICH BAND the plugin object sits in       (config-time, once per plugin)
order    → WHERE THIS ONE HOOK sits among plugins     (per hook)
Kind     → WHETHER ORDER IS GUARANTEED at all         (parallel ⇒ it is not)
```

### Kind outranks both

Setting `enforce: 'pre'` so a plugin's `configResolved` beats another's does nothing:
`configResolved` is documented `parallel`, so there is no ordering to win. Neither `enforce` nor
`order` manufactures a guarantee the hook does not have. Check the Kind **first** — if it is
`parallel`, no ordering knob is the answer and the design has to change
([chunk 1f](01f-hook-kinds-and-ordering-guarantees.md)).

### Where each one is actually written

```ts
import type { Plugin } from 'vite'

export function myPlugin(): Plugin {
  return {
    name: 'my-plugin',

    // 1. PLUGIN property — which band this whole plugin lands in.
    enforce: 'pre',

    // 2. HOOK object form — where THIS hook sits among plugins implementing it.
    transform: {
      order: 'pre',
      filter: { id: /\.tsx?$/ },
      handler(code, id) {
        return null
      },
    },
  }
}
```

`enforce` is a sibling of `name`; `order` is a sibling of `handler` inside one hook. Writing
`order` at plugin level, or `enforce` inside a hook, is not an error in plain JavaScript — it is a
silently ignored key, which is why these bugs survive review.

### Exactly one Vite-specific hook documents an `order`

Vite's own hooks are documented with a **Kind** line rather than an `order` attribute — with one
exception. `transformIndexHtml`'s documented type is
`IndexHtmlTransformHook | { order?: 'pre' | 'post', handler: IndexHtmlTransformHook }`, and its
`order` is phase-relative rather than merely position-relative:

> *"By default `order` is `undefined`, with this hook applied after the HTML has been transformed.
> In order to inject a script that should go through the Vite plugins pipeline, `order: 'pre'` will
> apply the hook before processing the HTML. `order: 'post'` applies the hook after all hooks with
> `order` undefined are applied."*

`'pre'` there does not merely mean "earlier among plugins" — it changes *which stage of HTML
processing* your output is subject to. See [chunk 1l](01l-transform-index-html.md).

⚠️ For the other Vite-specific hooks — `config`, `configResolved`, `configureServer`,
`configurePreviewServer`, `handleHotUpdate` — the documented `Type` lines contain no `order`
property, and the Plugin Ordering note scopes `order` to *"Rolldown hooks"*. The documentation does
not state whether an `order` key on those hooks is honoured or ignored. Treat it as unsupported and
use `enforce` for them.

---

## 2. Real-World Engineering Scenario

A plugin injects a `<script type="module" src="/runtime-config.js">` tag into `index.html` so the
app can read deployment settings. It works in dev. In production the tag ships pointing at a path
that was never bundled, hashed or emitted, and the app 404s on first paint at the CDN.

Three fixes get tried, in this order, and the first two are the wrong mechanism:

1. `enforce: 'post'` — moves the plugin object to band 6. The tag is still injected after HTML
   processing. No change.
2. `enforce: 'pre'` — band 2. Still no change, because band is not the axis that matters here.
3. `transformIndexHtml: { order: 'pre', handler }` — this is the one. With `order` undefined the
   hook applies *"after the HTML has been transformed"*; `order: 'pre'` applies it *"before
   processing the HTML"*, which is exactly what makes the injected script *"go through the Vite
   plugins pipeline"* and therefore get resolved, bundled and hashed.

The lesson generalises: **ask which mechanism the symptom is about before touching any of them.**
"Runs at the wrong time relative to other plugins" is `enforce` or `order`; "runs at the wrong
stage of a pipeline" is that hook's own documented semantics; "runs at an unpredictable time" is
the Kind, and no knob fixes it.

---

## 3. Production-Grade Code Example

```ts
// plugins/runtime-config.ts — the fix from the scenario, with both mechanisms named.
import type { Plugin } from 'vite'

export function runtimeConfig(): Plugin {
  return {
    name: 'runtime-config',

    // Band only. Nothing here decides WHEN the HTML hook runs.
    enforce: 'pre',

    transformIndexHtml: {
      // Phase, not band: run BEFORE HTML processing so the injected
      // script goes through the Vite plugins pipeline and gets hashed.
      order: 'pre',
      handler() {
        return [
          {
            tag: 'script',
            attrs: { type: 'module', src: '/src/runtime-config.ts' },
            injectTo: 'head',
          },
        ]
      },
    },
  }
}
```

The two keys in that object are independent: deleting `enforce` changes which band the plugin sits
in and leaves the HTML behaviour identical; deleting `order` leaves the band identical and breaks
the feature. If you cannot say which of your keys is load-bearing, you have not diagnosed the bug.

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1 — Using `enforce` to win a `parallel` race

`configResolved` is `parallel`. `enforce` moves the plugin object; it does not make Vite await
anything. Working today is not a guarantee, it is an unstated implementation detail.

### ⚠️ Pitfall 2 — Reading `transformIndexHtml`'s `order` as Rolldown's

Its `'pre'` means *before HTML processing*, which is what sends injected scripts through the Vite
pipeline. Assuming it only reshuffles plugins is how a script tag ships un-processed.

### ⚠️ Pitfall 3 — Adding `order` to a hook with no documented `order`

⚠️ Unsupported keys are silently ignored, and the docs do not settle whether `config` or
`handleHotUpdate` honour `order`. Use `enforce` for those and keep the citation checkable.

### ⚠️ Pitfall 4 — Putting `order` at plugin level

`{ name: 'x', order: 'pre', transform() {} }` is valid JavaScript and does nothing. `order` belongs
inside the hook's object form; the plugin-level key is `enforce`.

### ⚠️ Pitfall 5 — Setting all three "just in case"

`enforce` plus `order` plus a defensive `await` reads as thoroughness and is actually an
undiagnosed bug with three unrelated keys pinned to it. Remove them one at a time until the failure
returns; the one that brings it back is the mechanism you were actually fighting.

---

## Gotchas

**★ Symptom: `order: 'pre'` was added to a hook and the plugin still runs in the same place.**
Cause: `order` sequences *that hook* among plugins implementing it; the plugin object stays in its
`enforce` band. Fix: decide which you meant — plugin band → `enforce` on the plugin; hook position
→ `order` inside the object form of that one hook.

**★ Symptom: an ordering bug reproduces on CI but not locally, or once in five runs.** Cause: it is
not ordering — it is a `parallel` hook, almost always `configResolved`, where no order is
guaranteed and both sequences are legal. Fix: stop tuning `enforce`, remove the cross-plugin read,
and see [chunk 1f](01f-hook-kinds-and-ordering-guarantees.md).

**★ Symptom: a `transformIndexHtml` hook injects a script tag that is never processed by Vite.**
Cause: the hook ran with `order` undefined, i.e. *"after the HTML has been transformed"*. Fix:
`transformIndexHtml: { order: 'pre', handler(html) { /* … */ } }` — the documented way to make an
injected script *"go through the Vite plugins pipeline"*.

**★ Symptom: `order` set at plugin level has no effect whatsoever.** Cause: `order` is a hook
attribute, not a plugin attribute, and an unknown plugin key is ignored rather than rejected. Fix:
move it inside the hook — `transform: { order: 'post', handler(code, id) { return null } }`.

**★ Symptom: a plugin's ordering fix stops working after a dependency upgrade, with no code
change.** Cause: it was resting on the observed sequence of a `parallel` hook, or on order within a
single `enforce` band, neither of which the documentation guarantees. Fix: re-derive the dependency
from something the docs do state — a band boundary, or a `sequential` hook — and record which
sentence you are relying on in a comment.

---

## Interview questions

**★ What is the difference between a plugin's `enforce` and a hook's `order`?**
`enforce` is a property of the plugin object and selects one of three user bands in the resolved
plugin list. `order` is a property of a hook written in object form (`{ order, handler }`) and, per
Rolldown, decides whether that hook runs *"first (`"pre"`), last (`"post"`), or in the
user-specified position"* among all plugins implementing the same hook. The Vite docs state the
separation explicitly — *"Note that this is separate from hooks ordering"*. In practice `enforce`
answers "which band is this plugin in" and `order` answers "where in this one hook's queue am I",
and they are written at different nesting levels of the same object, so a misplaced key is silently
ignored rather than rejected.

**★ A colleague sets `enforce: 'pre'` so their `configResolved` runs before another plugin's. What
do you tell them?**
That it cannot work, and that it appearing to work locally is the dangerous part. `configResolved`
is documented `parallel`, meaning Vite makes no ordering guarantee between plugins for it;
`enforce` decides which band the plugin object sits in, not whether Vite awaits anything. The
sequence observed today is an implementation detail that the next `await` added anywhere in the
chain can invert, and it will surface as a flaky CI build rather than an error. Coordinate through
a `sequential` hook, or remove the cross-plugin read so the ordering question stops existing.

**★ Is `order` on `transformIndexHtml` the same mechanism as `order` on a Rolldown hook?**
Not quite, and reading it as the same is a real bug source. Its documented type is
`{ order?: 'pre' | 'post', handler }`, but the semantics are phase-relative: with `order` undefined
the hook applies *"after the HTML has been transformed"*, while `order: 'pre'` applies it *"before
processing the HTML"* so that an injected script goes through the Vite plugins pipeline. So `'pre'`
is not merely "earlier among plugins" — it changes which stage of HTML processing your output is
subject to, which is exactly what you need when injecting a module script that must be resolved and
hashed like any other asset.

**★ You must guarantee plugin A's transform sees output from plugin B. Which mechanism do you reach
for, and in what order do you check them?**
Check the Kind first: if the hook you are coordinating through is `parallel`, nothing else matters
and the design must change. If it is `sequential`, ask whether the two plugins are in different
bands — if so, `enforce` is the lever and the band boundary is the documented guarantee. Only when
both are in the same band does the hook's own `order` become the tool, and even then order *within*
a band is not documented, so the more robust fix is usually to move one plugin to a different band
and make the dependency explicit rather than layering `order` on top.

**★ Why is "it works locally" specifically weak evidence for an ordering fix?**
Because two of the three mechanisms are guarantees and one is not, and the observable behaviour is
identical. A `parallel` hook that happens to resolve in the order you want on your machine will
keep doing so until an unrelated plugin adds an `await`, a file gets larger, or CI runs on a
different core count. The test that distinguishes a real fix from a coincidence is not a run, it is
a citation: name the sentence in the documentation that guarantees the ordering you rely on. If you
cannot find one, you have a race with a nice-looking diff.

---

← [Plugin Ordering & `enforce`](01p-plugin-ordering-and-enforce.md) · [Vite overview](../../README.md) · Next → [Augmenting Plugins You Do Not Own](01pb-augmenting-plugins-you-do-not-own.md)
