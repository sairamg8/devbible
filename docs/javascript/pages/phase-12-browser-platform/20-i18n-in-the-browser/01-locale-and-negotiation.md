---
title: "01 · Locale and negotiation"
sidebar_label: "01 · Locale and negotiation"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-15 against MDN — [`Navigator.languages`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/languages), [`Navigator.language`](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/language), [`Window: languagechange` event](https://developer.mozilla.org/en-US/docs/Web/API/Window/languagechange_event), [`Accept-Language`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Accept-Language), [`Intl.DateTimeFormat.supportedLocalesOf()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/supportedLocalesOf), [`Intl.getCanonicalLocales()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/getCanonicalLocales), [BCP 47 language tag](https://developer.mozilla.org/en-US/docs/Glossary/BCP_47_language_tag). Documentation-validated; **no timings and no console output**.

⚠️ **This topic is deliberately about the browser, not about `Intl`.** The formatter API — every
constructor, every option, the reuse rule — belongs to
[Phase 5 · 20 · `Intl`](../../phase-5-built-in-library/20-intl/README.md), and is not repeated here.
What follows is the part that only exists in a browser: **whose locale is it, how do you choose one,
and where does the choice get applied.**

## What the browser tells you

```js
navigator.language;      // "en-US" — always languages[0]
navigator.languages;     // ["en-US", "zh-CN", "ja-JP"] — most preferred first
```

`navigator.languages` is an ordered list of [BCP 47](https://developer.mozilla.org/en-US/docs/Glossary/BCP_47_language_tag)
tags from the user's browser or OS settings, and `navigator.language` is simply its first entry. It
is read-only: the user chooses, you do not.

⚠️ **The list may be shortened for privacy.** MDN notes that both `Accept-Language` and
`navigator.languages` may omit the full preference list — **Safari always, and Chrome in incognito**
— reporting a single language. So "the user only speaks one language" is not something this data
can tell you.

**`languagechange`** fires on `window` when the preferences change. Like every other preference in
this phase, it is state to watch, not a value to read once
([12 · Feature detection](../12-feature-detection/README.md)).

## 🔴 Negotiation: never use `navigator.language` as your locale

The tag you get is what the *user* wants. The locale you render in must be one **you actually
support**, and the gap between those two is where the bugs live: a user asking for `pt-BR` when you
ship `pt-PT`, or `en-AU` when you ship `en`.

```js
const SUPPORTED = ['en', 'de', 'fr', 'pt-BR'];

function negotiate(requested = navigator.languages, supported = SUPPORTED) {
  for (const tag of requested) {
    const exact = supported.find((s) => s.toLowerCase() === tag.toLowerCase());
    if (exact) return exact;                                  // en-US → en-US
    const base = tag.split('-')[0].toLowerCase();             // en-AU → en
    const loose = supported.find((s) => s.toLowerCase().split('-')[0] === base);
    if (loose) return loose;
  }
  return supported[0];                                        // 🔴 always have a default
}
```

Three rules that fall out of this:

- **Walk the whole list, in order.** The user's second choice beats your default.
- **Fall back by stripping subtags**, never by string-matching prefixes in the other direction
  (`de` must not match `de-CH`'s formatting expectations by accident — match language first, then
  prefer the closest region you support).
- **Honour an explicit choice above everything.** A language switcher in your UI is the user
  telling you directly; persist it and let it override the browser list.

⚠️ **Formatting locale and translation locale are different questions.** The `Intl` constructors do
their own negotiation and will happily take the raw list — `new Intl.NumberFormat(navigator.languages)`
is correct, and `supportedLocalesOf()` tells you what the engine could match. Your *translations*
negotiate against your bundle list instead, because the engine knows nothing about which strings you
shipped.

`Intl.getCanonicalLocales()` normalises tags (case and structure) and **throws a `RangeError` on a
malformed one**, which makes it a decent validator for a locale that arrived from a URL, a cookie or
a database.

## Where the decision belongs

| Signal | Strength | Notes |
|---|---|---|
| An explicit choice in your UI | 🔴 strongest | persist it; a cookie the server can read is best |
| The URL (`/de/…` or a subdomain) | strong | shareable, cacheable, indexable |
| `Accept-Language` on the request | good | the server can pick **before** rendering |
| `navigator.languages` | good | client-side only, and may be truncated |
| IP geolocation | ⚠️ weakest | country ≠ language, and travellers hate it |

🔴 **Prefer negotiating on the server.** The `Accept-Language` header carries the same preferences
before a byte of HTML is generated, so the server can render the right language directly instead of
shipping one language and swapping it after hydration. Send `Content-Language`, and **`Vary:
Accept-Language`** so caches do not serve the German page to everyone
([13 · What belongs on the server](../13-what-belongs-on-the-server/README.md)).

⚠️ **A language switcher must change the URL**, not just in-memory state. A page whose language is
invisible to the address bar cannot be shared, bookmarked or indexed in that language, and the
History API is what makes that cheap
([08 · The History API and client-side routing](../08-history-and-routing/README.md)).

## The other half of a locale: the time zone

```js
const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;   // "Europe/Berlin"
```

`resolvedOptions()` is how you learn what the environment actually chose — the negotiated locale,
the calendar, the numbering system and the **IANA time zone**. That time zone matters more than the
language for anything with dates in it: two users with the same locale in different zones must see
different clock times for the same instant.

🔴 **Never guess currency from a locale.** A price is data that belongs to the transaction — the
locale decides how `1234.5` is *written*, not whether it is euros. Locale is presentation; currency
is business.

## Gotchas

**Symptom: the app renders in a language the user did not ask for.**
Cause — using `navigator.language` directly instead of negotiating against the supported list.
Fix — walk `navigator.languages` in order, fall back by base language, then to a default.

**Symptom: everyone gets one language, even users with several configured.**
Cause — the list is reduced for privacy in Safari and in Chrome incognito.
Fix — do not treat a single-entry list as evidence; offer an explicit switcher.

**Symptom: a cached page serves German content to English users.**
Cause — server-side negotiation without `Vary: Accept-Language`.
Fix — send the `Vary` header, or put the language in the URL.

**Symptom: the language resets on reload.**
Cause — the choice lived in memory only.
Fix — persist it (a cookie the server can read, or the URL) and read it before render.

**Symptom: `RangeError` deep inside a formatter.**
Cause — a malformed locale tag from a URL or a stored preference.
Fix — validate with `Intl.getCanonicalLocales()` at the boundary.

**Symptom: users in one country see the wrong currency.**
Cause — currency inferred from the locale.
Fix — currency comes from the order or the account, and is passed to the formatter explicitly.

## Interview questions

**★ Why is `navigator.language` the wrong thing to render with?**
Because it is the user's preference, not your capability. You negotiate: walk `navigator.languages`
in order, match against the locales you actually ship, fall back by base language, and keep a
default.

**★ What is the relationship between `navigator.language` and `navigator.languages`?**
`navigator.language` is `navigator.languages[0]` — the same data, first entry only. Both may be
truncated to a single entry for anti-fingerprinting reasons.

**★ Where should locale negotiation happen, and why?**
On the server where possible, using `Accept-Language`, so the first render is already correct — with
`Vary: Accept-Language` so caches stay honest. The client can only fix it after the fact.

**★ How do you find the user's time zone?**
`Intl.DateTimeFormat().resolvedOptions().timeZone` — the negotiated environment settings, including
the IANA zone. Language and time zone are independent, and dates depend on the latter.

**★ Should the currency follow the locale?**
No. The locale governs formatting; the currency is part of the transaction data. Passing a
locale-derived currency to a formatter is how a price silently changes meaning.

---

[Topic index](./README.md) · [02 · Applying it in the DOM](./02-applying-it-in-the-dom.md) →
