---
title: "A string in `children` is markup, not text — the automatic-escaping guarantee is attached to `attrs` and stops there, which makes an inline body the one place a tag descriptor hands you a loaded gun"
sidebar_label: "HTML `children` & Composition"
sidebar_position: 15
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-07 against the Vite documentation — [Plugin API § `transformIndexHtml`](https://vite.dev/guide/api-plugin) (the `IndexHtmlTransformResult` and `HtmlTagDescriptor` type definitions and the `order` paragraph). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ HTML `children` & Composition

This is the sibling of [HTML Tag Descriptors](01m-html-tag-descriptors.md). That page argued *why*
you return descriptors instead of a string. This one is about the single field inside a descriptor
that quietly hands back every hazard descriptors were supposed to remove — a **string** in
`children` — and how to use it without reopening them. The array branch of that same field, the
`{ html, tags }` return form and what happens when several plugins inject into one `index.html`
continue in [Nested Descriptors & `{ html, tags }`](01na-html-injection-composition.md).

---

## 1. Under-The-Hood Mechanics

### One field, two entirely different types

The type definition, verbatim from the Plugin API page:

```ts
interface HtmlTagDescriptor {
  tag: string
  /**
   * attribute values will be escaped automatically if needed
   */
  attrs?: Record<string, string | boolean>
  children?: string | HtmlTagDescriptor[]
  /**
   * default: 'head-prepend'
   */
  injectTo?: 'head' | 'body' | 'head-prepend' | 'body-prepend'
}
```

`children` is a union, and its two branches do unrelated jobs:

| Branch | What it produces | Legitimate use |
|---|---|---|
| `string` | the element's **inner markup**, emitted as written | an inline `<script>` or `<style>` body, literal `<title>` text |
| `HtmlTagDescriptor[]` | nested child elements, each built by the same rules | `<noscript>` wrappers, structured `<head>` blocks |

They are mutually exclusive — it is a union, not an intersection. One descriptor cannot have both a
text body and nested children; a nested descriptor carrying its own `children: string` is how you
get both. This page is about the first row; the second is covered in
[Nested Descriptors & `{ html, tags }`](01na-html-injection-composition.md).

### 🔴 The escaping guarantee is attached to `attrs`, and to nothing else

Look at where the doc comment sits in that type block. Vite's own comment says:

> *"attribute values will be escaped automatically if needed"*

It is directly above `attrs`. **`children` carries no comment at all.**

⚠️ The documentation does not state that `children` strings are escaped, and it does not state that
they are not. Treat a string in `children` as **raw markup** regardless, for two independent
reasons. First, it is the only reading under which the field's own purpose works: an escaped
`<script>` body is inert text, so a field that escaped its input could never carry one, and the
docs describe descriptors as `{ tag, attrs, children }` precisely so you can build such tags.
Second, the assumption is asymmetric — code that escapes its own body strings is correct whether or
not Vite also escapes them, and code that relies on an unstated guarantee is an injection the day
the guarantee turns out not to exist.

**The operational rule:** `attrs` may carry values from anywhere. `children` may carry only strings
**you** built, from data you control, with your own escaping already applied.

### What a `children` string is genuinely for

Exactly one thing no attribute can express: an element **body**.

```ts
// The runtime-config pattern — data the app reads before any bundle loads.
{ tag: 'script',
  children: `window.__APP_CONFIG__ = ${serialized};`,
  injectTo: 'head-prepend' }
```

There is no `attrs` key that does this and no separate "text content" field. That is why `children`
exists, and it is also why it is the one place in the descriptor API where you are back to string
concatenation with all of its consequences.

---

## 2. Real-World Engineering Scenario

**A tenant's display name ended a script element.**

A runtime-config plugin injected per-tenant settings into `index.html` so the SPA could read them
before any bundle loaded:

```ts
transformIndexHtml() {
  return [{ tag: 'script',
            children: `window.__CFG__ = ${JSON.stringify(cfg)};`,
            injectTo: 'head-prepend' }];
}
```

It ran for two years. Then a tenant set their display name to a string containing the literal text
`</script>` — pasted, of all places, out of a support ticket about escaping.

The HTML tokenizer, not the JavaScript parser, decides where a script element ends. It scans the
raw character stream for `</script` and stops there — inside the JSON string, mid-object.
Everything after that point became document text: the remainder of the config object rendered as
visible characters at the top of the page, and `window.__CFG__` was assigned a truncated,
syntactically invalid literal that threw before the app booted. A blank page, a `SyntaxError`, and
a stray fragment of JSON above it.

Three things made this hard to find. The stack trace pointed at `index.html`, which no one had
edited. The failure was tenant-specific, so it reproduced on exactly one deployment. And the plugin
used tag descriptors — the *recommended* API — so the team's mental model said escaping was already
handled.

⚠️ This is HTML parsing, not a Vite rule; the Vite documentation does not discuss inline script
bodies at all. It matters here because `children` is the one descriptor field that hands you raw
markup, and at that moment the tokenizer's rules become yours.

**The transferable point:** the descriptor API's safety is real but narrow. It covers attribute
values. The moment you serialise anything into a body you own the escaping — and the failure that
produces does not look like an HTML bug, it looks like a JavaScript one.

---

## 3. Production-Grade Code Example

```typescript
// ✅ Serialising data into an inline body safely.
import type { Plugin } from 'vite';

/**
 * Escape the one character that lets a payload break OUT of a script element.
 * `<` covers `</script`, `<!--` and `<!` in a single pass. The result is still
 * valid JSON to JSON.parse, because \uXXXX is a legal JSON string escape.
 */
function jsonForHtml(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

/** Never serialise the whole config object — build the public subset explicitly. */
function publicConfig(cfg: AppConfig) {
  return { apiBase: cfg.apiBase, locale: cfg.locale, tenantName: cfg.tenantName };
}

export function runtimeConfig(cfg: AppConfig): Plugin {
  return {
    name: 'runtime-config',
    transformIndexHtml() {
      return [
        // Data, not code: no script-src policy applies to a non-executable type,
        // and nothing here is evaluated even if the escaping were to fail.
        { tag: 'script',
          attrs: { type: 'application/json', id: 'app-config' },
          children: jsonForHtml(publicConfig(cfg)),
          injectTo: 'head-prepend' },
      ];
    },
  };
}
```

```typescript
// The client side of the same pattern — parse, do not eval.
const el = document.getElementById('app-config');
const config = JSON.parse(el!.textContent!);
```

```typescript
// ⛔ Three defects in one descriptor.
transformIndexHtml() {
  return [{
    tag: 'script',
    // 1. raw JSON.stringify — a `</script>` in any value ends the element early
    // 2. an executable inline body — blocked by any script-src 'self' CSP on the page
    // 3. the whole config object, secrets included, in view-source
    children: `window.__CFG__ = ${JSON.stringify(cfg)};`,
  }];
}
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1 — Reading the escaping comment as covering the whole descriptor

*"attribute values will be escaped automatically if needed"* is attached to `attrs`. Everything in a
`children` string is yours, and the documentation is **silent** about it rather than reassuring.

### ⚠️ Pitfall 2 — Treating `JSON.stringify` as HTML-safe

It is not and never was: it emits `<` unescaped, because `<` is a legal JSON character. Run
`.replace(/</g, '\\u003c')` over the result before it reaches `children`; the string still parses as
the same JSON.

### ⚠️ Pitfall 3 — Emitting executable code where data would do

`{ tag: 'script', attrs: { type: 'application/json' }, children: … }` is never evaluated, so an
escaping mistake is a parse failure in your own code rather than script execution. It also survives
a strict `script-src` policy, which an inline `window.__CFG__ = …` does not.

### ⚠️ Pitfall 4 — Putting secrets in a `children` body

`index.html` is served to the browser, and an inline body is the most convenient place in the whole
plugin API to leak a token. Escaping is orthogonal: a perfectly escaped API key is still an API key
in the page source. Build an allow-listed public subset and serialise that.

---

## Gotchas

**★ Symptom: a fragment of JSON renders as visible text at the top of the page.** Cause: a value inside a `children` script body contained `</script>`, and the HTML tokenizer ended the element there. Fix: `JSON.stringify(value).replace(/</g, '\\u003c')` before the string reaches `children`.

**★ Symptom: a `SyntaxError` on the first script in the document, before any bundle runs.** Cause: the same early-terminated inline script — the assignment was cut mid-literal. Fix: the same escape. The visible JSON and the `SyntaxError` are one bug, not two.

**★ Symptom: an injected attribute is escaped but injected body text is not.** Cause: the guarantee is written on `attrs`; `children` has no such comment. Fix: escape body text yourself, or move the value into an attribute, where the guarantee does apply.

**★ Symptom: an internal API base URL shows up in view-source.** Cause: the whole config object was serialised into a `children` body. Fix: build an explicit public subset — `{ apiBase: cfg.apiBase, locale: cfg.locale }` — and serialise that.

---

## Interview questions

**★ Is a string in `children` escaped?**
The documentation attaches escaping to `attrs` only — *"attribute values will be escaped
automatically if needed"* — and says nothing at all about `children`, so strictly the docs do not
settle it. Treat it as raw markup anyway, for two independent reasons. The field's whole purpose is
element bodies, and an escaped `<script>` body would be inert, so escaping would break the
documented use. And the assumption is asymmetric: code that escapes its own body strings is correct
either way, while code trusting an unstated guarantee becomes an injection the moment the guarantee
turns out not to exist. In practice the rule is that `attrs` may carry values from anywhere and
`children` may carry only strings you built.

**★ Why is `JSON.stringify` insufficient for embedding config in an inline script?**
Because the HTML tokenizer, not the JavaScript parser, decides where a script element ends: it scans
the raw character stream for `</script` and stops there, even in the middle of a JSON string
literal. `JSON.stringify` emits `<` verbatim, since `<` is a perfectly legal JSON character, so any
user-controlled value containing `</script>` truncates the element. The symptom is not an HTML
error — it is a `SyntaxError` from the half-written statement plus the rest of the payload rendered
as page text. Replacing `<` with the escape `\u003c` fixes it and changes nothing about what
`JSON.parse` sees. This is HTML behaviour rather than anything Vite does, which is exactly why it
surprises people who are using a Vite API and assume the API covers it.

**★ Why does the escaping rule live on `attrs` rather than on the descriptor as a whole?**
Because the two fields have different jobs. An attribute value is always data — there is no
legitimate way to express markup in one — so escaping it unconditionally is always right. An element
body is sometimes data and sometimes deliberately markup: a `<noscript>` block, a `<style>` rule, an
inline bootstrap script. A single rule cannot serve both, so the API splits them: the field that can
be escaped safely is, and the field that cannot is left to the plugin author, with nested descriptors
offered as the escape hatch for the structured case. That is a defensible design, and the cost is
that the safety boundary is invisible unless you read where the comment sits.

**★ Why prefer `<script type="application/json">` over an inline assignment for runtime config?**
Because it converts a code-execution surface into a parse surface. A `type="application/json"` block
is never evaluated, so a serialisation mistake produces a `JSON.parse` failure inside your own
startup path — which you can catch and report — instead of arbitrary script running in the page. It
also survives a strict Content-Security-Policy, since `script-src 'self'` blocks inline executable
scripts but does not govern a non-executable data block. The cost is one line on the client to find
the element and parse its `textContent`, which is a good trade for removing an entire class of
injection from the page.

**★ A reviewer says "you are using tag descriptors, so escaping is handled." What is your response?**
That escaping is handled for `attrs` and only for `attrs`, and the descriptor under review puts a
serialised object into `children`, which the documentation never claims to escape. Then point at the
concrete failure: a value containing `</script>` ends the element at the tokenizer level, and the
page dies with a `SyntaxError` and visible JSON. Then show the fix — escape `<` to `\u003c`, and
prefer `type="application/json"` so the body is data rather than code. The broader point worth
making in review is that "we use the safe API" is not a property of a plugin; it is a property of
each field of each descriptor.

---

← [HTML Tag Descriptors](01m-html-tag-descriptors.md) · [Vite overview](../../README.md) · Next → [Nested Descriptors & `{ html, tags }`](01na-html-injection-composition.md)
