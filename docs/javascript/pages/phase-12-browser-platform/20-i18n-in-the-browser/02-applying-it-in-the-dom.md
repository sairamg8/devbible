---
title: "02 · Applying it in the DOM"
sidebar_label: "02 · Applying it in the DOM"
sidebar_position: 2
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [`lang` global attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/lang), [`dir` global attribute](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/dir), [`<time>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/time), [`Intl.PluralRules`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/PluralRules), [`Intl.Collator`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Collator), [`String.prototype.localeCompare()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/localeCompare), [`Intl.NumberFormat.prototype.formatToParts()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/formatToParts), [CSS logical properties](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_logical_properties_and_values). Documentation-validated; **no timings and no console output**.

Negotiating a locale is the easy half. This is the half that shows: the attributes the document
must carry, where formatted output belongs in the markup, and the four mistakes that survive every
translation project.

⚠️ The formatter API itself lives in
[Phase 5 · 20 · `Intl`](../../phase-5-built-in-library/20-intl/README.md) — this page is about
applying it.

## The document has to say what it is

```html
<html lang="de">          <!-- 🔴 not decoration -->
<html lang="ar" dir="rtl">
```

`lang` drives the screen reader's voice and pronunciation, hyphenation, quotation marks, font
selection and `:lang()` styling. Getting it wrong makes a screen reader read German with an English
voice — which is not a subtle degradation, it is unintelligible.

```js
document.documentElement.lang = locale;      // 🔴 update BOTH on a client-side switch
document.documentElement.dir = isRTL(locale) ? 'rtl' : 'ltr';
```

A client-side language switch that changes only the strings leaves the document lying about itself.
And for **mixed-language content**, mark the exception on the element:
`<span lang="fr">déjà vu</span>` — that is what stops the pronunciation switching wholesale.

**Direction is a layout decision, not a string decision.** Set `dir` on the root, then let CSS
logical properties (`margin-inline-start`, `padding-block`, `inset-inline-end`) do the mirroring
instead of hand-swapping `left` and `right`. For a single value of unknown direction — a user's
display name, a search query — `dir="auto"` asks the browser to infer it from the first strong
character.

## Formatted output belongs in the markup, not only in the pixels

```html
<time datetime="2026-08-15T09:00:00Z">15 August 2026, 11:00</time>
```

The `datetime` attribute keeps a machine-readable value next to the human one, which matters for
crawlers, assistive technology and your own code re-reading the DOM. The same idea generalises:
keep the raw value in a `data-` attribute or in state, and render the formatted string — never
parse your own formatted output back.

🔴 **There is no `Intl` parser.** `Intl.NumberFormat` formats; nothing in the standard library turns
`"1.234,50"` back into a number. So for user input use `<input type="number">` (which handles the
locale's separators natively) and keep the value as a number. If you must reverse a formatted
string, `formatToParts()` at least tells you which characters are the group and decimal separators
for that locale — but a plain `replace(',', '.')` is a bug in most of the world.

## Reuse the formatters

Constructing an `Intl` formatter is the expensive part, and `toLocaleString()` /
`localeCompare()` are hidden constructor calls — so a table of a thousand rows that calls
`toLocaleDateString()` per cell constructs a thousand formatters.

```js
const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
rows.forEach((r) => (cell.textContent = dateFmt.format(r.date)));   // ✅ one formatter
```

Build them once per locale (a small cache keyed by locale plus options), and rebuild only when the
locale changes.

## Sorting is not `<`

```js
const collator = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' });
items.sort((a, b) => collator.compare(a.name, b.name));
```

🔴 **`a < b` and a bare `sort()` compare UTF-16 code units**, which puts every capital letter before
every lowercase one and files `Ä` after `Z`. `Intl.Collator` sorts the way the language does, and
`numeric: true` is what makes *"Item 2"* come before *"Item 10"*. Reuse the collator for the same
reason you reuse a formatter.

## Plurals and interpolation

```js
const pr = new Intl.PluralRules(locale);
const key = pr.select(count);        // 'one' | 'other' | 'few' | 'many' | 'zero' | 'two'
label.textContent = MESSAGES[key].replace('{count}', numberFmt.format(count));
```

⚠️ **`count === 1 ? 'item' : 'items'` is an English-only assumption.** CLDR defines six plural
categories and languages use different subsets — a message catalogue therefore stores *a category
per string*, and `Intl.PluralRules` picks it.

🔴 **Never build a sentence by concatenating translated fragments.** Word order differs between
languages, so `"Deleted " + n + " files"` is untranslatable; a message with a placeholder —
`"Deleted {count} files"` — can be reordered by the translator. The same rule kills the "clever"
optimisation of translating a shared noun once and reusing it in three sentences.

## The mismatch that only appears in production

🔴 **Server and client must format with the same locale, time zone and calendar**, or a
server-rendered page will disagree with its own hydration — a visible flash, a hydration warning, or
a date that changes on first paint. The server does not know the browser's time zone unless it is
told, so either format dates client-side after mount, or send the zone (from
`Intl.DateTimeFormat().resolvedOptions().timeZone`) up with the request and format consistently on
both sides.

## The rest of the checklist

- **Leave room.** German and Finnish strings routinely run far longer than English; a button sized
  to its English label breaks. Test with the longest locale you ship.
- **Never concatenate a date into a translated string** by hand — format the whole message.
- **Do not translate names, codes or identifiers**, and do not localise the values you send to your
  API. Format at the edge, transport raw.
- **Test with a real RTL locale**, not by flipping `dir` on the English build; mirrored icons,
  parenthesis handling and mixed-direction text only show up with real content.
- **Numbers in the DOM are still numbers.** Sorting a table by a formatted string sorts text.

## Gotchas

**Symptom: a screen reader reads translated content with the wrong accent.**
Cause — `<html lang>` never changed on the client-side language switch.
Fix — set `document.documentElement.lang` (and `dir`) whenever the locale changes.

**Symptom: an Arabic or Hebrew layout is a mirror image except for the parts that are not.**
Cause — hard-coded `left`/`right` in CSS.
Fix — logical properties, `dir` on the root, and testing with real content.

**Symptom: "Item 10" sorts before "Item 2".**
Cause — code-unit comparison.
Fix — `Intl.Collator` with `numeric: true`.

**Symptom: a large table becomes sluggish after adding date formatting.**
Cause — constructing a formatter per cell, usually via `toLocaleDateString()`.
Fix — one cached formatter per locale and options.

**Symptom: plurals are wrong in Polish or Russian but fine in English.**
Cause — a binary singular/plural assumption.
Fix — `Intl.PluralRules.select()` and a category-keyed message catalogue.

**Symptom: the date flickers to a different value right after page load.**
Cause — server and client formatted with different time zones or locales.
Fix — format on one side, or pass the resolved time zone so both agree.

**Symptom: a decimal typed as `1,5` reaches the API as `1`.**
Cause — parsing a localised number with `parseFloat`.
Fix — `<input type="number">` and keep a numeric value; there is no `Intl` parser to reach for.

## Interview questions

**★ Why does `<html lang>` matter beyond documentation?**
It drives screen-reader pronunciation, hyphenation, quotes, font selection and `:lang()` styling. A
client-side language switch that does not update it produces content read in the wrong voice.

**★ Why can't you sort names with `array.sort()`?**
Because the default comparison is by UTF-16 code unit: uppercase before lowercase, accented letters
after `Z`. `Intl.Collator` sorts by the language's rules, and `numeric: true` handles embedded
numbers.

**★ What is wrong with `count === 1 ? 'item' : 'items'`?**
It assumes English's two plural forms. CLDR defines six categories and languages use different
subsets — `Intl.PluralRules.select(count)` returns the category, and the catalogue supplies the
string.

**★ Why must you never concatenate translated fragments?**
Word order varies between languages, so a sentence assembled from pieces cannot be translated
correctly. Use one message with placeholders and let the translator move them.

**★ Why do server-rendered dates flicker?**
Because the server does not know the browser's time zone or negotiated locale, so it formats
differently from the client. Format on one side only, or send the resolved time zone with the
request.

---

← [01 · Locale and negotiation](./01-locale-and-negotiation.md) · [Topic index](./README.md)
