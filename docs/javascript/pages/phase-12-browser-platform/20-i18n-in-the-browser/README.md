---
title: "20 · Internationalisation in the browser"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [`Navigator.languages`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/languages), [`Accept-Language`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Accept-Language), [`Intl.getCanonicalLocales()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/getCanonicalLocales), [`lang`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/lang) and [`dir`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/dir), [`Intl.PluralRules`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/PluralRules), [`Intl.Collator`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Collator). Documentation-validated; **no timings and no console output**.

The syllabus row is *`navigator.language`, locale negotiation, and `Intl` applied to the DOM* — and
the emphasis is on the last three words.

⚠️ **The `Intl` API itself is not repeated here.** Every constructor and option is covered at depth
in [Phase 5 · 20 · `Intl`](../../phase-5-built-in-library/20-intl/README.md). This topic is the
browser half: whose locale it is, how you choose one you actually support, and what the document has
to do about it.

🔴 **The one-line version: the user's preference is not your locale.** `navigator.languages` is a
request; the locale you render in has to be negotiated against the set you ship, and then applied to
`<html lang>`, to `dir`, to formatters you reuse, and to messages that were written to be
translated.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[Locale and negotiation](./01-locale-and-negotiation.md)** | `navigator.language` / `languages` and ⚠️ **the list truncated for privacy** (Safari always, Chrome incognito); `languagechange`; a negotiation function and its three rules; formatting locale vs translation locale; `getCanonicalLocales` as a validator; the signal-strength table and 🔴 **why the server should negotiate** with `Accept-Language` + `Vary`; the URL as the language's home; `resolvedOptions().timeZone`; why currency never follows the locale |
| 02 | **[Applying it in the DOM](./02-applying-it-in-the-dom.md)** | `lang` and `dir` as behaviour, not decoration, and updating both on a client-side switch; logical properties instead of hand-mirrored CSS; `<time datetime>` and keeping raw values; 🔴 **there is no `Intl` parser**; reusing formatters and collators; sorting with `Intl.Collator`; `Intl.PluralRules` and the six categories; **never concatenating translated fragments**; the SSR/hydration locale-and-time-zone mismatch |

## Three facts worth carrying out of this topic

- **Negotiate, do not adopt.** Walk `navigator.languages` in order against the locales you ship,
  fall back by base language, and always keep a default.
- **`<html lang>` is functional.** Screen-reader pronunciation, hyphenation and font selection all
  hang off it — so a language switcher must set it.
- **Formatters are expensive to construct.** `toLocaleString()` and `localeCompare()` are hidden
  constructor calls; build one per locale and reuse it.

## Phase gate

You can move a 500 ms computation into a Web Worker, keep the page responsive, and prove it
in the performance panel.

## Where this connects

- [Phase 5 · 20 · `Intl`](../../phase-5-built-in-library/20-intl/README.md) — the formatter API in
  full: `NumberFormat`, `DateTimeFormat`, `RelativeTimeFormat`, `Collator`, `ListFormat`,
  `PluralRules`, `Segmenter`
- [11 · Accessibility from JavaScript](../11-accessibility-from-javascript/README.md) — `lang`,
  announcements, and preferences that are watched rather than sampled
- [13 · What belongs on the server instead](../13-what-belongs-on-the-server/README.md) —
  `Accept-Language`, `Content-Language` and `Vary`
- [08 · The History API and client-side routing](../08-history-and-routing/README.md) — putting the
  language in the URL so it can be shared and indexed

---

Start → [01 · Locale and negotiation](./01-locale-and-negotiation.md)
