---
title: "HTML Tag Descriptors: Automatic Escaping, Declarative Position, and a Default of `head-prepend`"
sidebar_label: "HTML Tag Descriptors"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-07 against the Vite documentation — [Plugin API § `transformIndexHtml`](https://vite.dev/guide/api-plugin) (the `IndexHtmlTransformResult` and `HtmlTagDescriptor` type definitions). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · methods + output provenance · session 84f95c0c

# ⚡ HTML Tag Descriptors

[`transformIndexHtml`](01l-transform-index-html.md) accepts three return shapes. Almost everyone
uses the first — a transformed string — and almost everyone should be using the second.

---

## 1. Under-The-Hood Mechanics

### The three return shapes

> *"Transformed HTML string · An array of tag descriptor objects (`{ tag, attrs, children }`) to inject to the existing HTML. Each tag can also specify where it should be injected to (default is prepending to `<head>`) · An object containing both as `{ html, tags }`"*

```ts
type IndexHtmlTransformResult =
  | string
  | HtmlTagDescriptor[]
  | { html: string; tags: HtmlTagDescriptor[] }

interface HtmlTagDescriptor {
  tag: string
  /** attribute values will be escaped automatically if needed */
  attrs?: Record<string, string | boolean>
  children?: string | HtmlTagDescriptor[]
  /** default: 'head-prepend' */
  injectTo?: 'head' | 'body' | 'head-prepend' | 'body-prepend'
}
```

### 🔴 Why descriptors beat string replacement

Three reasons, and the first is written into the type definition as a comment:

**1. Escaping.** *"attribute values will be escaped automatically if needed"* — a comment that
applies to descriptors and to nothing else. `html.replace` escapes nothing, so an injected value
containing a quote produces broken markup, and an injected value from an untrusted source produces
an injection vulnerability.

**2. No anchor string.** `html.replace('</body>', …)` depends on a substring that may be absent
(minified HTML, a framework template, uppercase `</BODY>`), duplicated, or already consumed by
another plugin's replacement. When it misses, **it does nothing and reports nothing**.

**3. Declarative position.** `injectTo` says where; string replacement encodes position as an
accident of where a substring happens to be.

```
html.replace('</head>', tag + '</head>')     imperative, unescaped, silently fragile
{ tag: 'script', attrs: {...},               declarative, escaped, position explicit
  injectTo: 'head' }
```

### ⚠️ The default is `head-prepend`, not append

A descriptor with no `injectTo` lands at the **top** of `<head>`, before everything already there.

```
head-prepend   (default)   first child of <head>
head                       appended to <head>
body-prepend               first child of <body>
body                       appended to <body>
```

For a CSP `<meta>` or an early theme script that is exactly right — they must precede what they
govern. For a script expecting the app's config object to exist, it is wrong, and the symptom is a
`ReferenceError` at the very start of page execution.

### The `{ html, tags }` form

Use it when you genuinely need both: rewrite something in the existing markup **and** add tags. It
saves a second hook and keeps the two operations in one atomic return.

---

## 2. Real-World Engineering Scenario

**A title tag that broke on an apostrophe.**

A team injected a per-tenant page title from a configuration value:

```ts
transformIndexHtml(html, ctx) {
  const title = tenants[ctx.originalUrl ?? ''].title;
  return html.replace('<title>App</title>', `<title>${title}</title>`);
}
```

It worked for thirty tenants. The thirty-first was **"Bob's Hardware"**.

The apostrophe itself was harmless in element text. What broke was the *next* tenant onboarded, whose
name contained a `<` — the string went straight into the markup, the parser saw a new tag, and the
rest of `<head>` was reinterpreted as that element's content. The page rendered blank.

Two separate defects, and both are removed by the same change:

- **No escaping.** `html.replace` is string concatenation; the tag-descriptor path escapes attribute
  values automatically.
- **A brittle anchor.** `'<title>App</title>'` matched only because nobody had changed the default
  title. The day someone did, the injection silently stopped and every tenant saw "App" — a failure
  with no error at all.

The rewrite used the `{ html, tags }` form: a descriptor for the tags, and a narrow, deliberate
replacement for the title with a comment explaining what it depends on.

**The transferable point:** any code that builds markup by concatenation is one unusual input away
from a parser surprise, and `transformIndexHtml` is unusually easy to write that way because its
first documented return shape is a string.

---

## 3. Production-Grade Code Example

```typescript
// ✅ Descriptors: escaped attributes, declarative position, no anchor string.
import type { Plugin } from 'vite';

export function securityMeta(): Plugin {
  return {
    name: 'security-meta',
    transformIndexHtml() {
      return [
        // A CSP must precede what it governs — head-prepend is the DEFAULT,
        // but say it explicitly so the requirement is visible.
        { tag: 'meta',
          attrs: { 'http-equiv': 'Content-Security-Policy', content: "default-src 'self'" },
          injectTo: 'head-prepend' },

        // A boolean attribute is `true`, not the string "true".
        { tag: 'script',
          attrs: { src: 'https://cdn.example.com/a.js', defer: true, crossorigin: 'anonymous' },
          injectTo: 'head' },
      ];
    },
  };
}
```

```typescript
// ✅ Nesting via `children`, and the { html, tags } form when you need BOTH.
export function tenantChrome(titles: Record<string, string>): Plugin {
  return {
    name: 'tenant-chrome',
    transformIndexHtml(html, ctx) {
      const title = titles[ctx.originalUrl ?? ''] ?? 'App';
      return {
        // A narrow, deliberate replacement — and a comment saying what it depends on.
        // Depends on index.html containing exactly `<title>App</title>`.
        html: html.replace('<title>App</title>', `<title>${escapeHtml(title)}</title>`),
        tags: [
          { tag: 'noscript',
            children: [{ tag: 'iframe', attrs: { src: '/no-js', title: 'JavaScript required' } }],
            injectTo: 'body-prepend' },
        ],
      };
    },
  };
}
```

```typescript
// ⛔ The anti-pattern. Two defects, one line.
transformIndexHtml(html, ctx) {
  const title = tenants[ctx.originalUrl!].title;   // "Bob's <Hardware>"
  //  - unescaped: a `<` reinterprets the rest of <head>
  //  - brittle anchor: silently no-ops the day the default title changes
  return html.replace('<title>App</title>', `<title>${title}</title>`);
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1 — String replacement instead of tag descriptors

No escaping (*"attribute values will be escaped automatically if needed"* applies to descriptors
only), and a hard dependency on an anchor string that may be absent, duplicated or differently
formatted. When it misses it does so silently.

### ⚠️ Pitfall 2 — Forgetting the default is `head-prepend`

A descriptor with no `injectTo` lands at the **top** of `<head>`, before existing tags. Right for a
CSP meta; wrong for a script that expects earlier tags to have run.

### ⚠️ Pitfall 3 — Writing `defer: 'true'`

`attrs` is `Record<string, string | boolean>`. A boolean attribute takes `true`; the string
`'true'` renders `defer="true"`, which happens to work for `defer` and does not for attributes where
the value is meaningful.

### ⚠️ Pitfall 4 — Returning a string when you only needed to add tags

The array form exists for injection. Reaching for the string form to add one tag imports every
escaping and anchoring hazard for no benefit.

### ⚠️ Pitfall 5 — An undocumented dependency on the HTML's exact content

If you must replace, say so in a comment naming the exact substring. A future edit to `index.html`
otherwise disables a plugin silently, and nothing connects the two changes.

---

## Gotchas

**★ Symptom: an injected attribute containing a quote breaks the markup.** Cause: `html.replace` does no escaping. Fix: return a tag descriptor — *"attribute values will be escaped automatically if needed"*.

**★ Symptom: a page renders blank after onboarding one customer.** Cause: an unescaped `<` in an interpolated value reopened the parser inside `<head>`. Fix: descriptors for attributes, and an explicit escape for anything interpolated into element text.

**★ Symptom: `html.replace('</body>', …)` silently injects nothing.** Cause: the anchor string was absent, cased differently, or already consumed by another plugin's replacement. Fix: descriptors have no anchor to miss; `injectTo: 'body'` says where declaratively.

**★ Symptom: an injected tag appears above tags it should follow.** Cause: the default `injectTo` is `head-prepend`, not append. Fix: set it explicitly — `'head'`, `'body'`, `'head-prepend'` or `'body-prepend'`.

**★ Symptom: an injected script throws `ReferenceError` at the very start of page execution.** Cause: it landed at `head-prepend`, before the config or polyfill it depends on. Fix: `injectTo: 'head'` to append, or `'body-prepend'` if it needs the document to have started.

**★ Symptom: `defer="true"` renders where a bare `defer` was wanted.** Cause: a string was passed where a boolean belongs. Fix: `defer: true`. The type is `string | boolean` precisely so boolean attributes can be expressed properly.

**★ Symptom: a plugin stops injecting after someone edits `index.html`.** Cause: an undocumented dependency on an exact substring. Fix: prefer descriptors; where a replacement is genuinely needed, comment the dependency so the connection is findable from the HTML side.

**★ Symptom: two plugins' replacements interact and the second no-ops.** Cause: the first consumed the anchor. Fix: descriptors compose — several plugins can all return tags without competing for a substring. This is the strongest argument for the array form in a codebase with more than one HTML plugin.

---

## Interview questions

**★ Why prefer tag descriptors over `html.replace`?**
Three reasons, and the first is stated in the type definition: *"attribute values will be escaped
automatically if needed"* — string replacement escapes nothing, so any injected value containing a
quote produces broken markup and any value from an untrusted source is an injection. Second,
`replace` depends on an anchor string that may be absent, duplicated, or already consumed by another
plugin's replacement, and when it misses it does so silently. Third, descriptors express position
declaratively via `injectTo`, so position is a stated intent rather than an accident of where a
substring happens to be. The thing to remember is that the default `injectTo` is `head-prepend`, not
append.

**★ When would you use the `{ html, tags }` form?**
When you need to modify existing markup *and* add tags, and want both in one atomic return rather
than two hooks or two plugins. A per-tenant title rewrite plus a `<noscript>` fallback is the
canonical shape. It is worth preferring over doing the replacement in a separate plugin because the
two changes are then visibly one decision — and because splitting them across plugins reintroduces
an ordering question that neither of them needed.

**★ Why does the default `injectTo` catch people out?**
Because `head-prepend` is the opposite of what "inject into head" suggests to most readers, who
expect an append. For the tags Vite most expects you to inject — a CSP meta, a theme script that must
run before first paint — prepending is correct, because those must precede what they govern. For a
script that depends on something already in `<head>`, it is wrong, and the symptom is a
`ReferenceError` at the very start of page execution, before any application code runs, which reads
like a much deeper problem than an ordering default.

**★ Two plugins both inject into `index.html`. What could go wrong with the string form that cannot with descriptors?**
The first plugin's `replace` can consume the anchor the second depends on, so the second silently
does nothing — with no error and no obvious relationship between the two plugins. Descriptors have no
anchors, so any number of plugins can return tags and Vite composes them; the only remaining ordering
concern is `injectTo` and hook `order`, both of which are explicit. In a codebase with more than one
HTML-transforming plugin this composability is the strongest argument for the array form, ahead even
of escaping.

---

← [`transformIndexHtml`](01l-transform-index-html.md) · [Vite overview](../../README.md) · Next → [HTML `children` & Composition](01n-html-children-and-composition.md)
