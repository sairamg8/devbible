---
title: "`transformIndexHtml` is `sequential` and per-environment, so with the string form every plugin edits what the last one produced — descriptors are the only injection mechanism whose failure mode is not silence"
sidebar_label: "HTML Plugin Composition"
sidebar_position: 17
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-07 against the Vite documentation — [Plugin API § `transformIndexHtml`](https://vite.dev/guide/api-plugin) (the **Kind** and **Scope** lines, the `order` paragraph and the framework warning). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ HTML Plugin Composition

The third of five pages on `transformIndexHtml`, after
[HTML `children` & Composition](01n-html-children-and-composition.md) and
[Nested Descriptors & `{ html, tags }`](01na-html-injection-composition.md). Everything here is
about the question that only appears once a project has **more than one** HTML plugin: they all
transform the same file, in order, and one of them can lose without anybody finding out.

---

## 1. Under-The-Hood Mechanics

### Why descriptors compose and replacements collide

The hook's **Kind** line settles the shape of the problem:

> *"**Kind:** `async`, `sequential`"*

Sequential means every plugin's `transformIndexHtml` runs in turn rather than concurrently. With the
**string** form each one operates on the HTML as the previous plugin left it, so two plugins both
targeting `</head>` are reading and writing the same substring: the first can consume it, move it,
or reformat it, and the second then matches nothing, injects nothing and reports nothing.
`String.prototype.replace` returns the original string when the pattern is absent, so a failed
injection and a successful one are indistinguishable from the return value.

With the **descriptor** form there is no shared substring at all — each plugin contributes tags and
Vite places them. That is the strongest argument for the array form in any codebase with more than
one HTML plugin, stronger than escaping, because an escaping bug at least produces visible damage.

### `order` and `injectTo` are two different axes

> *"By default `order` is `undefined`, with this hook applied after the HTML has been transformed.
> In order to inject a script that should go through the Vite plugins pipeline, `order: 'pre'` will
> apply the hook before processing the HTML. `order: 'post'` applies the hook after all hooks with
> `order` undefined are applied."*

| Knob | Question it answers | Values |
|---|---|---|
| `order` | **when your hook runs**, relative to HTML processing | `'pre'` · undefined · `'post'` |
| `injectTo` | **where in the document** the tags land | `'head-prepend'` (default) · `'head'` · `'body-prepend'` · `'body'` |

They are routinely confused because both look like ordering. `order: 'pre'` will not move a tag
lower in the document, and `injectTo: 'body'` will not get a script through the plugin pipeline.
`order: 'post'` is for *reading* a finished document, and it makes a string replacement strictly
more fragile, because by then every other plugin has already rewritten the HTML.

---

## 2. Real-World Engineering Scenario

**Three correct plugins, one page that could not boot.**

The stack: a CSP plugin injecting `default-src 'self'` as a `<meta>`, a runtime-config plugin
injecting an inline bootstrap script, and an analytics plugin doing
`html.replace('</head>', snippet + '</head>')`.

**Failure one — the CSP blocked the config.** Both plugins were individually right. The CSP
descriptor defaulted to `head-prepend`, so it landed above everything and governed the whole
document; the inline config body is not `'self'`, so the browser refused to execute it. Nothing was
misconfigured — the two plugins simply had no way to know about each other. The fix was not to
weaken the policy but to stop shipping executable inline code: the config moved to a
`<script type="application/json">` block that no `script-src` directive governs, and the client
parsed it at startup.

**Failure two — the analytics snippet vanished.** It had worked for a year. Then someone switched
the analytics plugin to `order: 'post'` so it could "see the final HTML". Under `'post'` it ran
after every undefined-order hook, including one that had re-emitted `</head>` with different
surrounding whitespace. The anchor did not match, `replace` returned the input, and the plugin
returned perfectly valid HTML with nothing added. No error appeared anywhere. It was found weeks
later by someone asking why traffic numbers had dropped.

**The transferable point:** descriptors solve *placement* interference completely and *policy*
interference not at all. The first failure needed a content change; the second needed the array
form. Reaching for `html.replace` in a multi-plugin project is choosing the one injection mechanism
whose failure mode is silence.

---

## 3. Production-Grade Code Example

```typescript
// ✅ order: 'pre' + a virtual module — code that must go through the plugin pipeline.
import type { Plugin } from 'vite';

const VIRTUAL_ID = 'virtual:app-boot';
const RESOLVED_ID = '\0' + VIRTUAL_ID;

export function bootScript(source: string): Plugin {
  return {
    name: 'boot-script',
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : null;
    },
    load(id) {
      return id === RESOLVED_ID ? source : null;
    },
    transformIndexHtml: {
      // 'pre' applies the hook BEFORE the HTML is processed, so the tag injected
      // here goes through the rest of the pipeline like any other module.
      order: 'pre',
      handler() {
        return [
          { tag: 'script',
            attrs: { type: 'module', src: VIRTUAL_ID },
            injectTo: 'head-prepend' },
        ];
      },
    },
  };
}
```

```typescript
// ✅ Composable by construction: no state, no anchors, position stated.
export function analytics(siteId: string): Plugin {
  return {
    name: 'analytics',
    apply: 'build',                    // dev pages should not report traffic
    transformIndexHtml() {
      return [
        { tag: 'script',
          attrs: { src: `https://cdn.example.com/a.js?id=${encodeURIComponent(siteId)}`,
                   defer: true },
          injectTo: 'body' },
      ];
    },
  };
}
```

```typescript
// ⛔ The composition anti-pattern: an anchor two plugins can fight over,
//    plus a guard that breaks under a per-environment hook.
let injected = false;

const bad: Plugin = {
  name: 'analytics-fragile',
  transformIndexHtml: {
    order: 'post',                     // runs after every other hook has rewritten the HTML
    handler(html) {
      if (injected) return;            // suppresses the SECOND environment, not a duplicate
      injected = true;
      // If any earlier plugin reformatted, minified or consumed `</head>`,
      // this returns the input unchanged — no match, no error, no injection.
      return html.replace('</head>', ANALYTICS_SNIPPET + '</head>');
    },
  },
};
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1 — Two plugins racing for the same anchor

The hook is `sequential`, so with the string form the second plugin sees whatever the first
produced. Descriptors have nothing to race for; `order` and `injectTo` then express the two
remaining questions explicitly.

### ⚠️ Pitfall 2 — Confusing `order` with `injectTo`

`order` decides when your hook runs relative to HTML processing; `injectTo` decides where the tag
lands in the document. Setting `order: 'post'` to move a tag lower in the page does nothing except
make the plugin more fragile.

### ⚠️ Pitfall 3 — Assuming an injected inline body goes through the Vite pipeline

The docs say `order: 'pre'` exists *"in order to inject a script that should go through the Vite
plugins pipeline"*, without distinguishing a `src` script from an inline one. ⚠️ The documentation
does not state whether an inline `children` body is itself processed. Do not rely on it: inject
`<script type="module" src="virtual:app-boot">` and serve the module from `resolveId`/`load`, as in
the first example above.

### ⚠️ Pitfall 4 — A CSP injected by one plugin blocking a body injected by another

Both plugins are individually correct; the page is not. This is the composition failure descriptors
do **not** solve, because it is about content rather than placement. Prefer
`<script type="application/json">` for data and a real module URL for code.

### ⚠️ Pitfall 5 — Debugging composition by reading plugin source

The composed result is a property of the *set* of plugins, not of any one of them. Read the served
HTML, or inspect the intermediate state — the docs recommend
[vite-plugin-inspect](https://github.com/antfu/vite-plugin-inspect) for exactly this, describing it
as letting you *"inspect the intermediate state of Vite plugins"*.

---

## Gotchas

**★ Symptom: one plugin's injection disappears after another plugin is added.** Cause: the string form and a shared anchor — the earlier hook consumed or reformatted it, and `String.replace` returns the input unchanged on no match. Fix: both plugins return descriptors, so neither touches the other's substring.

**★ Symptom: `order: 'post'` made a fragile replacement more fragile, not more reliable.** Cause: `'post'` runs *"after all hooks with `order` undefined are applied"*, so the HTML has been rewritten by everything else. Fix: use descriptors; `'post'` is for reading a finished document, not for placing a tag.

**★ Symptom: an inline `children` script is not transformed the way source modules are.** Cause: with `order` undefined the hook runs *"after the HTML has been transformed"*, and the docs never promise inline bodies are processed at all. Fix: inject a `src` module URL served by your own `resolveId`/`load` with `order: 'pre'`.

**★ Symptom: an inline body works locally and is blocked in staging.** Cause: staging adds a `script-src` policy, and an inline script is not `'self'`. Fix: `type="application/json"` for data, a real module URL for code.

**★ Symptom: a tag appears twice.** Cause: two plugins in the pipeline both inject it — often the same plugin listed twice, or a framework preset that already includes it. Fix: descriptors compose by adding, never by deduplicating; check the resolved plugin list rather than adding a guard flag.

**★ Symptom: reordering plugins in `vite.config.js` changes nothing.** Cause: an `order`/`enforce` value pins the hook regardless of array position. Fix: read the resolved order rather than the config array — see [Plugin Ordering & `enforce`](01p-plugin-ordering-and-enforce.md).

**★ Symptom: an analytics tag lands above the app's own scripts.** Cause: `head-prepend` is the default `injectTo`. Fix: `injectTo: 'body'` for anything that should not compete with first paint.

---

## Interview questions

**★ Three plugins inject into one `index.html`. What breaks with the string form, and what still breaks with descriptors?**
With the string form the hook is `sequential`, so each plugin transforms whatever the previous one
produced; two plugins targeting `</head>` are competing for a substring, and the loser silently does
nothing because `String.replace` returns the input unchanged when the pattern is absent. Descriptors
remove that failure mode entirely — every plugin contributes tags, Vite composes them, `order`
decides when each hook runs and `injectTo` decides where its tags land. What descriptors do **not**
solve is content-level interference: a CSP `<meta>` from one plugin can block an inline body from
another, and both plugins are correct in isolation. Placement composes; policy does not.

**★ What is the difference between `order: 'pre'` and `injectTo: 'head-prepend'`?**
They answer different questions and are not substitutes. `order` positions your *hook* relative to
Vite's HTML processing: `'pre'` runs *"before processing the HTML"*, which is what makes an injected
script go through the rest of the plugin pipeline, while undefined runs *"after the HTML has been
transformed"* and `'post'` runs after every undefined-order hook. `injectTo` positions the resulting
*tag* in the document and defaults to `head-prepend`. Setting `order: 'post'` because you want a tag
at the bottom of the page achieves nothing except running your replacement against HTML that every
other plugin has already rewritten — the classic way a working injection becomes a silent no-op.

**★ Why is composability a stronger argument for tag descriptors than escaping?**
Because an escaping bug eventually announces itself — broken markup, a `SyntaxError`, a blank page —
whereas an anchor collision produces valid HTML with something missing from it. The analytics
snippet that stopped being injected does not fail a build, does not log and does not change any
type; it is found weeks later by someone asking why a number moved. Escaping is also solvable inside
one plugin, whereas anchor collisions are a property of the *set* of plugins installed, so no
individual author can reason about it in isolation. That is the case for making the array form the
default and treating any `html.replace` as a documented, commented exception.

---

← [Nested Descriptors & `{ html, tags }`](01na-html-injection-composition.md) · [Vite overview](../../README.md) · Next → [When `transformIndexHtml` Runs](01nc-html-hook-execution-contract.md)
