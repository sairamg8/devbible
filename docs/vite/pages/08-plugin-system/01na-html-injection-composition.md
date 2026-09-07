---
title: "Nested descriptors keep attribute escaping all the way down, and `{ html, tags }` is for the one case where you need a rewrite and an injection in the same atomic return — not as a general wrapper"
sidebar_label: "Nested Descriptors & `{ html, tags }`"
sidebar_position: 16
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-07 against the Vite documentation — [Plugin API § `transformIndexHtml`](https://vite.dev/guide/api-plugin) (the return-shape list and the `IndexHtmlTransformResult` / `HtmlTagDescriptor` type definitions). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ Nested Descriptors & `{ html, tags }`

The second of five pages on `transformIndexHtml`.
[HTML `children` & Composition](01n-html-children-and-composition.md) covered the *string* branch of
`children` and the escaping it does not get. This page covers the *array* branch and the third
return shape. What happens when several plugins transform the same file is
[HTML Plugin Composition](01nb-html-plugin-composition.md).

---

## 1. Under-The-Hood Mechanics

### Nested descriptors: structure without a template string

```ts
{ tag: 'noscript',
  children: [
    { tag: 'div', attrs: { class: 'nojs-banner' }, children: 'JavaScript is required.' },
    { tag: 'img', attrs: { src: '/px.gif', alt: '', width: '1', height: '1' } },
  ],
  injectTo: 'body-prepend' }
```

Every nested child gets attribute escaping again, because *"attribute values will be escaped
automatically if needed"* is a property of descriptors and each child is one. The same block written
as a single `children` template string would be three lines shorter and would escape nothing —
that is the entire trade, and it is why the array branch exists at all.

⚠️ The documentation does not state whether `injectTo` is honoured on a **nested** descriptor. It
documents the field as *"default: 'head-prepend'"* for a tag being injected into the document, and
nesting is positional — a child's place is its index in the array. Do not set `injectTo` on a nested
descriptor; if a tag needs to live elsewhere in the document, return it as a top-level descriptor.

### The third return shape, and why both keys are required

> *"An object containing both as `{ html, tags }`"*

```ts
type IndexHtmlTransformResult =
  | string
  | HtmlTagDescriptor[]
  | {
      html: string
      tags: HtmlTagDescriptor[]
    }
```

Neither key is optional. The form exists for the case where you genuinely need **both** a rewrite of
existing markup and an injection, atomically, in one return — a per-page `<title>` rewrite alongside
injected Open Graph meta tags is the canonical shape. If you only have tags, return the bare array:
wrapping them forces you to hand back an `html` string you did not modify, which is the string form
wearing a costume, and the next person to edit the plugin will start replacing inside it because it
is right there.

### Choosing between the three shapes

| You need to | Return | Why |
|---|---|---|
| add tags | `HtmlTagDescriptor[]` | escaped attributes, declarative position, no anchor to miss |
| rewrite existing markup | `string` | the only shape that can; comment what substring it depends on |
| both, atomically | `{ html, tags }` | one hook, one decision, no implied ordering between two plugins |

---

## 2. Real-World Engineering Scenario

**A `<noscript>` fallback that shipped an unescaped `href`.**

The original was a template string, because it read better:

```ts
{ tag: 'noscript',
  children: `<div class="nojs"><a href="${cfg.fallbackUrl}">Static report</a></div>` }
```

`cfg.fallbackUrl` came from a per-deployment settings file. One deployment set it to a URL with a
query string containing a quoted parameter — `/report?title="Q3"` — and the attribute terminated
early. The `href` became `/report?title=`, the rest of the URL leaked into the tag as bogus
attributes, and the fallback link pointed at the wrong page for every JavaScript-disabled visitor.
Nobody noticed for months, because the block only renders when scripting is off.

Rewritten as nested descriptors it is four lines longer and the `href` is escaped by Vite, because
it is now an `attrs` value rather than a substring of a template.

**The second half of the story.** The same plugin also rewrote the page title, so at some point a
maintainer converted the return to `{ html, tags }`. That was correct. What was not correct was the
*other* three plugins in the repo that had been converted to `{ html, tags }` at the same time "for
consistency" — each of them returning `html` unchanged. Two releases later, one of those plugins
grew a `html.replace('</head>', …)` inside it, because the string was sitting in the return object
looking like an invitation. The array form is not just safer; it removes the affordance.

**The transferable point:** the return shape you choose is a constraint you are placing on future
edits to the plugin. `HtmlTagDescriptor[]` makes string surgery impossible; `{ html, tags }` makes
it one line away.

---

## 3. Production-Grade Code Example

```typescript
// ✅ Nested descriptors: every child keeps attribute escaping.
import type { Plugin } from 'vite';

export function noJsFallback(fallbackUrl: string): Plugin {
  return {
    name: 'no-js-fallback',
    transformIndexHtml() {
      return [
        { tag: 'noscript',
          children: [
            { tag: 'div',
              attrs: { class: 'nojs', role: 'alert' },
              children: 'This application requires JavaScript.' },
            // href is an attrs value, so Vite escapes it — the template-string
            // version of this line is where the quoted query parameter broke out.
            { tag: 'a', attrs: { href: fallbackUrl }, children: 'Static report' },
          ],
          // Position belongs to the TOP-LEVEL descriptor only.
          injectTo: 'body-prepend' },
      ];
    },
  };
}
```

```typescript
// ✅ { html, tags } — used only because BOTH are genuinely needed.
export function ogTags(meta: { title: string; image: string }): Plugin {
  return {
    name: 'og-tags',
    transformIndexHtml(html) {
      return {
        // Depends on index.html containing exactly `<title>App</title>`.
        // Documented here because a future edit to index.html disables it silently.
        html: html.replace('<title>App</title>', `<title>${escapeHtml(meta.title)}</title>`),
        tags: [
          { tag: 'meta', attrs: { property: 'og:title', content: meta.title }, injectTo: 'head' },
          { tag: 'meta', attrs: { property: 'og:image', content: meta.image }, injectTo: 'head' },
        ],
      };
    },
  };
}
```

```typescript
// ⛔ { html, tags } as a habit: an unmodified string handed back for no reason.
transformIndexHtml(html) {
  return {
    html,                                     // untouched — so why is it here?
    tags: [{ tag: 'meta', attrs: { name: 'robots', content: 'noindex' } }],
  };
}
// ✅ The same intent, with the affordance removed:
transformIndexHtml() {
  return [{ tag: 'meta', attrs: { name: 'robots', content: 'noindex' } }];
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1 — Building nested structure with a template string

If any inner element has attributes, use a nested descriptor array. That is the difference between
an escaped attribute and a concatenated one, and it costs about three lines.

### ⚠️ Pitfall 2 — Setting `injectTo` on a nested descriptor

Undocumented, and conceptually meaningless — a nested tag's position is its index in the array. If a
tag needs to live somewhere else in the document, promote it to a top-level descriptor.

### ⚠️ Pitfall 3 — Reaching for `{ html, tags }` when only tags are needed

Both keys are required in the type, so you end up returning an unmodified `html` string. Return the
bare `HtmlTagDescriptor[]` array instead — that is what the array form is for, and it makes later
string surgery impossible rather than merely discouraged.

### ⚠️ Pitfall 4 — Forgetting that the `html` half is still a string replacement

Everything the [tag descriptors page](01m-html-tag-descriptors.md) says about anchors applies to the
`html` key: no escaping, a substring that may be absent, and silence when it misses. Using
`{ html, tags }` does not upgrade the replacement half — comment the exact substring it depends on.

### ⚠️ Pitfall 5 — A nested descriptor with neither `attrs` nor `children`

`tag` is the only required field, so `{ tag: 'br' }` is valid and produces a bare element. That is
fine for void elements and a bug for anything else — an empty `<div>` injected every build is the
usual sign that a conditional built the descriptor before deciding what went in it.

---

## Gotchas

**★ Symptom: an attribute inside a `<noscript>` block breaks on a quoted value.** Cause: the block was built as a `children` template string, which is not escaped. Fix: nested descriptors — the value becomes an `attrs` entry and Vite escapes it.

**★ Symptom: nested markup written as a template string loses attribute escaping.** Cause: only descriptors are escaped, and a string body is not a descriptor. Fix: `children: [{ tag: 'div', attrs: { class: 'nojs' }, children: 'text' }]`.

**★ Symptom: `injectTo` on a nested child appears to do nothing.** Cause: nesting is positional and the docs do not define `injectTo` for a child. Fix: promote that tag to a top-level descriptor and give *it* the `injectTo`.

**★ Symptom: a `<noscript>` block lands at the top of `<head>`.** Cause: `head-prepend` is the default `injectTo` and applies to the top-level descriptor whatever it contains. Fix: `injectTo: 'body-prepend'`; the full position table is in [HTML Tag Descriptors](01m-html-tag-descriptors.md).

**★ Symptom: passing both a string and an array to `children` fails to typecheck.** Cause: `children?: string | HtmlTagDescriptor[]` is a union, not an intersection. Fix: nest — the child descriptor carries the string body.

**★ Symptom: returning `{ tags }` alone is a type error.** Cause: both keys are required in `{ html: string; tags: HtmlTagDescriptor[] }`. Fix: return the bare `HtmlTagDescriptor[]` array.

**★ Symptom: a plugin that only injected tags now also rewrites HTML, and nobody decided that.** Cause: it returned `{ html, tags }` with `html` unmodified, leaving a mutable string in the return object. Fix: return the array; the shape should not offer what the plugin does not do.

**★ Symptom: the `html` half of a `{ html, tags }` return silently stops matching.** Cause: it is an ordinary `String.replace` and someone edited `index.html`. Fix: comment the exact substring in the plugin, and prefer moving the change into a descriptor if it can be expressed as one.

**★ Symptom: an empty element appears in every build.** Cause: `tag` is the only required field, so a descriptor built before its content was decided still renders. Fix: build the descriptor only in the branch that has content, and return an empty array otherwise.

---

## Interview questions

**★ When is the `{ html, tags }` form the right return, and when is it a smell?**
It is right when you genuinely need to rewrite existing markup and add tags in the same pass — a
per-page `<title>` rewrite alongside injected Open Graph meta tags is the canonical case, and doing
both in one return keeps them visibly one decision instead of two plugins with an implied ordering
between them. It is a smell when you have only tags, because both keys are required in the type, so
you are forced to hand back an `html` string you did not modify. That is the string form with extra
steps, and it leaves a mutable HTML string in front of the next person who edits the plugin — who
will eventually replace inside it, because it is right there and it looks intended.

**★ Both a template string and a nested descriptor array produce the same markup. Why prefer the array?**
Because escaping is a property of descriptors, so every nested child's `attrs` is escaped, while a
template string is escaped nowhere. The failure that follows is quiet: a config-supplied `href`
containing a quote terminates the attribute early, the rest of the URL leaks into the tag as junk
attributes, and if the block is a `<noscript>` fallback nobody sees it for months. The array form is
also more resistant to later edits — adding an attribute is a key in an object rather than one more
interpolation site nobody will audit. The template string earns its place only for genuine bodies,
script and style content, where there is no nested element to describe.

**★ The docs do not say whether `injectTo` works on a nested descriptor. How do you write code under that uncertainty?**
You write the code that is correct under both readings. `injectTo` is documented as the position of
a tag *being injected into the document*, and a nested child is not being injected into the document
— it is being placed inside its parent, at its index in the array. So setting `injectTo` on a child
is at best a no-op and at worst a behaviour you would be relying on without a specification. The
rule that survives either answer is: position is a top-level concern, so if a tag needs to be
somewhere else in the document, return it as a top-level descriptor rather than nesting it and
hoping. Stating the uncertainty in a code comment is worth more than picking a side.

**★ What does choosing a return shape commit your team to?**
More than it looks like. `HtmlTagDescriptor[]` makes string surgery impossible inside that plugin —
there is no HTML string to reach for — so the escaping and anchoring failures cannot appear later.
`{ html, tags }` keeps a mutable document string in the return value, so it is one line away at all
times, and the plain string form makes descriptors the awkward option. The choice is a constraint on
future edits rather than a preference about this one, which is why "return the narrowest shape that
expresses what the plugin does" is a better rule than "return whatever is convenient".

---

← [HTML `children` & Composition](01n-html-children-and-composition.md) · [Vite overview](../../README.md) · Next → [HTML Plugin Composition](01nb-html-plugin-composition.md)
