---
title: "Attribute selectors in full"
sidebar_label: "03 · Attribute selectors"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 in **Firefox 153.0.3** via `sandbox/css/ex09-selector-families.mjs`.

**Seven operators for matching on attribute values.** They are how you style
state without inventing a class for every combination, and how you style content
you did not author.

## The complete set

| Syntax | Matches when the value… | Example |
|---|---|---|
| `[attr]` | exists, any value | `[disabled]` |
| `[attr="v"]` | equals `v` exactly | `[type="checkbox"]` |
| `[attr~="v"]` | is a **space-separated list** containing `v` | `[class~="lead"]` |
| `[attr\|="v"]` | equals `v`, or starts `v-` | `[lang\|="en"]` matches `en-GB` |
| `[attr^="v"]` | starts with `v` | `[href^="https://"]` |
| `[attr$="v"]` | ends with `v` | `[href$=".pdf"]` |
| `[attr*="v"]` | contains `v` anywhere | `[class*="col-"]` |

Measured against real markup:

```console
$ node ex09-selector-families.mjs
  [data-state]                   1  attribute presence
  [data-kind="beta"]             1  exact =
  [data-kind^="alpha"]           2  starts with ^=      span.tag[a]  span.tag[c]
  [data-kind$="-1"]              1  ends with $=        span.tag[a]
  [data-kind*="lph"]             2  contains *=         span.tag[a]  span.tag[c]
  [lang|="en"]                   1  hyphen prefix |=    main[lang="en-GB"]
  [href$=".pdf" i]               1  case-insensitive i  a[pdf]
  [href^="mailto:"]              1  protocol match      a[mail]
```

Note `[lang|="en"]` matched `lang="en-GB"` — the `|=` operator exists
specifically for language subtags and is nearly useless elsewhere.

## Case sensitivity, and the `i` flag

Attribute **values** are case-sensitive in HTML; attribute **names** are not.
Add a space and `i` before the closing bracket to make the value comparison
case-insensitive:

```css
a[href$=".pdf"]      { }  /* misses "REPORT.PDF" */
a[href$=".pdf" i]    { }  /* matches it — measured */
```

There is a matching `s` flag forcing case-sensitivity, which you will almost
never need since that is already the default.

**This matters for real content.** File extensions, email domains and
user-entered values arrive in whatever case the author used.

## What they are actually for

**1 — State, driven by one attribute instead of many classes:**

```css
[data-state="loading"] .spinner { display: block; }
[data-state="error"]   .message { color: var(--danger); }
[aria-expanded="true"] .chevron { rotate: 180deg; }
[aria-current="page"]           { font-weight: 700; }
```

Styling on `aria-*` attributes is the pattern worth internalising: **the
accessibility state and the visual state cannot drift apart**, because they are
the same attribute. A class can be forgotten; the ARIA attribute is required
anyway.

**2 — Content you did not author,** where no class is available:

```css
a[href^="http"]:not([href*="mysite.com"])::after { content: " ↗"; }
a[href^="mailto:"]::before { content: "✉ "; }
a[href$=".pdf"]::after     { content: " (PDF)"; }
```

**3 — Form controls, by type:**

```css
input[type="checkbox"], input[type="radio"] { inline-size: 1.15em; }
input:not([type="checkbox"]):not([type="radio"]) { inline-size: 100%; }
```

## Specificity: they count as a class

`[data-state="open"]` is `0,1,0` — the same weight as `.open`. That makes them a
drop-in replacement for state classes with no specificity change, which is why
migrating from `.is-open` to `[data-state="open"]` never breaks a cascade.

## `~=` versus `*=`, which is a real bug source

```css
[class~="col"]  /* the class LIST contains exactly "col"  */
[class*="col"]  /* the class STRING contains "col" anywhere —
                   also matches "column-header" and "protocol" */
```

`*=` on `class` is almost always wrong. If you want "any class starting with
`col-`", the honest version is `[class*=" col-"]` plus a leading-space
normalisation problem — at which point a `data-*` attribute is the better design.

## Gotchas

**Symptom:** `[href$=".pdf"]` misses some PDF links.
**Cause:** attribute values are case-sensitive, and the links end in `.PDF`.
**Fix:** add the `i` flag — `[href$=".pdf" i]`.

**Symptom:** `[class*="btn"]` also matched an element with
`class="submit-button"`.
**Cause:** `*=` is a plain substring match over the whole attribute string, with
no word boundaries.
**Fix:** `[class~="btn"]` for a whole class name, or better, a `data-*`
attribute for the thing you are actually matching.

**Symptom:** `[data-count="1"]` fails when the value was set from script.
**Cause:** the value is compared as a string, and the script wrote a number that
serialised differently (`"1.0"`, `" 1"`).
**Fix:** normalise when writing the attribute; attribute matching is textual and
does no type coercion.

**Symptom:** `[lang="en"]` does not match a page with `lang="en-GB"`.
**Cause:** `=` is exact.
**Fix:** `[lang|="en"]`, which is exactly what that operator exists for.

## Interview questions

**★ What is the difference between `[class~="a"]` and `[class*="a"]`?**
`~=` treats the value as a space-separated list and matches a whole item, so it
is equivalent to `.a`. `*=` is a substring match over the entire attribute
string, so it also matches `alpha`, `banana` and `data-a`. `*=` on `class` is a
common source of accidental matches.

**★ Why style on `aria-*` attributes rather than state classes?**
Because it makes the visual state and the accessibility state the same source of
truth. `[aria-expanded="true"] .chevron { rotate: 180deg }` cannot get out of
sync with the attribute a screen reader reads, whereas a parallel `.is-open`
class can be forgotten or left behind.

**What specificity does an attribute selector have?**
The same as a class — `0,1,0`. That is what makes `[data-state="open"]` a
drop-in replacement for `.is-open` with no cascade consequences.

**How do you match a value case-insensitively?**
Add the `i` flag before the closing bracket: `[href$=".pdf" i]`. Attribute values
are case-sensitive by default in HTML, which bites on file extensions and
user-entered data.

**What is `|=` for?**
Language subtag matching: `[lang|="en"]` matches `en` and anything beginning
`en-`, such as `en-GB`. It has essentially no other use.

---

← [02 · Combinators](./02-combinators.md) · Next: [04 · Selector lists](./04-selector-lists.md) →
