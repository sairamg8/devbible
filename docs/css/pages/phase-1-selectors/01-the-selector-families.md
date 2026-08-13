---
title: "The selector families"
sidebar_label: "01 · Selector families"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 in **Firefox 153.0.3** via `sandbox/css/ex09-selector-families.mjs`.

**Five ways to name an element, and each one is a decision about coupling.**
The syntax takes ten minutes; knowing which to reach for is what keeps a
stylesheet maintainable.

## The five

```css
p          { }   /* type      — every <p> */
.lead      { }   /* class     — every element with class="lead" */
#app       { }   /* id        — the one element with id="app" */
*          { }   /* universal — every element */
[data-x]   { }   /* attribute — every element with that attribute */
```

Matched against a real document:

```console
$ node ex09-selector-families.mjs
  p                              3  type
                                    p.lead[first]  p[second]  p.lead[nested lead]
  .lead                          2  class
                                    p.lead[first]  p.lead[nested lead]
  #app                           1  id
                                    main#app.layout
  *                             23  universal
                                    html  head  body  main#app.layout  h2.title.heading  p.lead
  [data-state]                   1  attribute presence
                                    main#app.layout
```

Note `*` matched **23** elements, including `html`, `head` and `body`. The
universal selector really does mean everything, which is why
`* { margin: 0 }` in a reset is a heavier statement than it looks.

## Which to use, and the coupling each creates

| Selector | Couples your CSS to | Use it for |
|---|---|---|
| **class** | a name you control | ✅ almost everything |
| **type** | the document's semantics | base/reset styles, and `article p`-style content styling |
| **attribute** | a state or data contract | state hooks (`[data-state="open"]`), and `[href^="mailto:"]`-style content rules |
| **id** | one specific element in one page | ❌ essentially never in component CSS |
| **universal** | nothing | resets, and `* + *` spacing utilities |

**Class is the default because it is the only one that says nothing about the
document.** A `.card` rule survives the `<div>` becoming an `<article>`; a
`div.card` rule does not.

## Why `id` is a mistake in stylesheets

Three separate problems, and only the first is the famous one:

1. **Specificity.** An id is `1,0,0` — it beats any number of classes. Once one
   rule uses an id, every override of it must too, and the escalation spreads.
2. **It cannot repeat.** An id is unique per document, so an id-based style can
   never apply to the second instance of anything. Components are, by
   definition, repeated.
3. **It is someone else's namespace.** Ids are the anchor-link and
   `aria-labelledby` namespace. Styling on them means a JavaScript refactor that
   renames an id silently breaks the design.

The exception that is not really an exception: `#app` or `#root` as a
**container** for a page-level rule is harmless, because it is unique by nature
and never overridden.

## Type selectors are for content you do not control

The place type selectors earn their keep is content that arrives as HTML — a CMS
body, rendered Markdown, a rich-text field — where you cannot add classes:

```css
/* the "prose" pattern: type selectors, scoped to one container */
.prose h2      { font-size: 1.5rem; margin-block: 1.5em 0.5em; }
.prose p       { margin-block: 0 1em; }
.prose a       { text-decoration-thickness: 2px; }
.prose ul      { padding-inline-start: 1.25em; }
```

Scoping them under one class is what keeps them from leaking into components.
Bare `h2 { }` in a shared stylesheet will eventually hit a heading inside a
component that wanted something else.

## Case sensitivity, which surprises people

- **Type selectors are case-insensitive in HTML.** `P` matches `<p>`.
- **Class and id selectors are case-sensitive.** `.Card` does not match
  `class="card"`.
- **Attribute *names* are case-insensitive; attribute *values* are not**, unless
  you add the `i` flag — measured, `[href$=".pdf" i]` matched `x.pdf`.

## Gotchas

**Symptom:** a class rule works everywhere except one component, where an
older-looking rule wins.
**Cause:** that rule uses an id, at specificity `1,0,0`.
**Fix:** convert the id rule to a class. Adding a competing id is how a
stylesheet ends up with `#app #main #card .title`.

**Symptom:** `.Card` does not match `class="card"`.
**Cause:** class selectors are case-sensitive; type selectors are not, which is
why the inconsistency goes unnoticed.
**Fix:** pick one convention — kebab-case is conventional — and lint for it.

**Symptom:** `* { margin: 0 }` in a reset also removed spacing you wanted inside
rich text.
**Cause:** the universal selector matched all 23 elements on the page, including
content you do not author.
**Fix:** keep the universal reset, and re-add spacing inside a `.prose`-style
container using type selectors.

**Symptom:** styles broke after a JavaScript refactor that renamed an id.
**Cause:** the stylesheet was coupled to an identifier owned by scripts and
anchor links.
**Fix:** style on classes or `data-*` attributes; leave ids to fragments and
ARIA relationships.

## Interview questions

**★ Why avoid id selectors in CSS?**
Three reasons. Specificity: `1,0,0` beats any number of classes, so one id rule
forces every override to escalate. Uniqueness: an id can only exist once per
document, so it cannot style a repeated component. Ownership: ids are the anchor
and ARIA namespace, so a script or markup refactor that renames one silently
breaks styling. A class does none of these things.

**★ When is a type selector the right choice over a class?**
For base styles, and for content you cannot add classes to — CMS output,
rendered Markdown, rich-text fields. The safe pattern is to scope them under one
container class (`.prose h2`) so they cannot leak into components.

**Are CSS selectors case-sensitive?**
Type selectors are not, in HTML — `P` matches `<p>`. Class and id selectors are.
Attribute names are case-insensitive; attribute values are case-sensitive unless
you add the `i` flag.

**What does `*` actually match?**
Every element, including `html`, `head` and `body` — measured, 23 elements on a
small test page. That is worth knowing before putting expensive declarations on
it.

**Is there a performance reason to prefer classes?**
Not meaningfully at typical page sizes; selector matching is rarely the
bottleneck. The reason is maintainability — coupling and specificity — not speed.

---

← [Phase index](./) · Next: [02 · Combinators](./02-combinators.md) →
