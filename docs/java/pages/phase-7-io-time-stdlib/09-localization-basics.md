---
title: "Localization basics"
sidebar_label: "09 · Localization basics"
sidebar_position: 9
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-18 against the JDK 25 Javadoc for `Locale` (including
> the constructor deprecation notes and `Locale.of`), `Locale.Category`,
> `ResourceBundle`, `PropertyResourceBundle`, `NumberFormat`,
> `DecimalFormat` and `DateTimeFormatter`; JEP 226 (UTF-8 property resource
> bundles, JDK 9); JEP 252 (CLDR as default locale data, JDK 9); and
> OpenJDK issue JDK-8282819 (Locale constructor deprecation, JDK 19).

**The localization bug class is not "we never translated the app" — it is
"we localized by accident." Every `toLowerCase()`, `String.format("%,d")`,
`NumberFormat.parse` and `Scanner.nextDouble` call that names no locale
silently uses the *server's* default locale, so the code that passed every
test on a developer's `en_US` machine misparses `"1.234"` as one-point-two
on a German host and breaks `equalsIgnoreCase("id", "ID")` on a Turkish
one. Knowing this tier means one discipline: any operation that formats,
parses or case-maps text names its `Locale` explicitly — `Locale.ROOT` for
machine-to-machine text, a user's locale for display.**

## `Locale` — a tag, not a translation

A `Locale` is an identifier (language, optional script, region, variant —
`en`, `en-US`, `sr-Latn-RS`) that other APIs use to select rules and data.
It does nothing by itself.

```java
Locale de   = Locale.GERMANY;                     // constants for common ones
Locale sr   = Locale.forLanguageTag("sr-Latn-RS"); // BCP 47 tag — the wire form
Locale ta   = Locale.of("ta", "IN");              // JDK 19+ factory
```

- **The constructors are deprecated since JDK 19** (JDK-8282819): they never
  validated arguments and always allocated. `Locale.of(...)` is the 1:1
  replacement and returns cached instances; `Locale.Builder` validates and
  throws on ill-formed input.
- `forLanguageTag` is the right way in from config or HTTP
  (`Accept-Language`), and `toLanguageTag()` the right way out — round-trip
  safe, unlike `toString()`'s legacy underscore form (`en_US`).
- **It never fails loudly:** `forLanguageTag("garbage tag")` quietly returns
  `Locale.ROOT`-ish results rather than throwing — validate with
  `Locale.Builder().setLanguageTag(...)` when the tag matters.

## The default locale — and why there are two

`Locale.getDefault()` is read from the OS/JVM at startup (`user.language`,
`user.country` system properties) and is *process-global mutable state* —
`Locale.setDefault` changes it for every thread. Since JDK 7 it is really
**two defaults** (`Locale.Category`): `DISPLAY` (which translation to show)
and `FORMAT` (how to render numbers and dates). `String.format`,
`NumberFormat.getInstance()` and friends use the FORMAT default when you
don't pass one.

The trap is that a *server's* default locale is an accident of the host
image. The rule for services:

- **Machine-to-machine text** (log lines, JSON keys, protocol tokens,
  lowercased cache keys): `Locale.ROOT`, always.
- **User-facing text**: the *user's* locale, carried per request — never
  the JVM default.
- Setting `-Duser.language=en -Duser.country=US` on the JVM is a blunt but
  honest containment when a dependency you don't control formats with the
  default.

### The Turkish-i bug

`String.toLowerCase()`/`toUpperCase()` with no argument use the default
locale. In Turkish (`tr`), the lowercase of `"I"` is dotless `"ı"` and the
uppercase of `"i"` is `"İ"` — so `"ID".toLowerCase().equals("id")` is
`false` on a Turkish-locale host, and the HTTP-header or enum lookup that
depended on it dies only there. Fix: `toLowerCase(Locale.ROOT)` for any
programmatic string (see [Strings](../phase-1-language-core/06-strings/README.md));
`equalsIgnoreCase` is locale-independent but uses simple per-char folding —
fine for ASCII protocol tokens, not a collation.

## `ResourceBundle` — translations with a fallback chain

```
Messages_de_DE.properties  →  Messages_de.properties  →  Messages.properties
```

`ResourceBundle.getBundle("Messages", locale)` walks candidate locales from
most to least specific. Two behaviors surprise everyone:

1. **The default locale is consulted *before* the base bundle.** Asking for
   French on a German-default server, with no `Messages_fr*`, serves
   *German* (`Messages_de`), not the base file. For predictable fallback
   pass `ResourceBundle.Control.getNoFallbackControl(FORMAT_DEFAULT)` — or
   set the default sensibly and know this exists.
2. **Bundles are cached forever by default** — editing a properties file on
   disk changes nothing in a running JVM.

Since **JDK 9 (JEP 226)** `.properties` bundles are read as **UTF-8** (with
an automatic ISO-8859-1 fallback if the bytes aren't valid UTF-8) — the
`ü` escape era is over. ⚠️ That applies to `PropertyResourceBundle`
only: **`Properties.load(InputStream)` still decodes ISO-8859-1**; use the
`Reader` overload for UTF-8 config files.

Lookup is by exact key — a missing key throws `MissingResourceException` at
*runtime*, which is why teams wrap bundle access behind one accessor that
logs-and-falls-back instead of sprinkling `getString` calls.

## Numbers and currency — the decimal comma is data

Since **JDK 9 (JEP 252)** the locale rules themselves come from Unicode
CLDR, so output can shift between JDK majors as CLDR updates — pin nothing
to exact formatted strings.

```java
NumberFormat de = NumberFormat.getInstance(Locale.GERMANY);
de.format(1234.5);          // grouping dot, decimal comma — "1.234,5" shape
de.parse("1.234");          // ≈ 1234 — the same characters, other meaning
NumberFormat.getCurrencyInstance(Locale.GERMANY).format(9.99);
```

- **Parsing is the dangerous direction**: `parse` succeeds with the wrong
  meaning rather than failing. Numbers arriving from machines
  (`"1234.5"` in a CSV or JSON) are parsed with `Double.parseDouble`/
  `new BigDecimal(String)` — locale-*independent* — never `NumberFormat`.
- `DecimalFormat` (the concrete type behind it) is **not thread-safe**; its
  Javadoc says to create one per thread or synchronize externally. Don't
  cache one in a static and share it.
- Money pairs a locale-formatted *display* with a
  [`BigDecimal` value](../phase-1-language-core/05-floating-point-bigdecimal/README.md)
  and a `Currency` — formatting is the last step, never the stored form.
- `String.format("%,d", n)` and `printf` are locale-sensitive too (grouping
  separator); `String.format(Locale.ROOT, ...)` for logs and protocol text.

## Dates for humans — localized *display only*

Storage and transport stay `Instant`/ISO-8601
([java.time](01-java-time/README.md)); localization is the presentation
edge:

```java
DateTimeFormatter f = DateTimeFormatter
        .ofLocalizedDate(FormatStyle.MEDIUM)   // shape chosen per locale
        .localizedBy(userLocale);              // JDK 10+: locale + chronology
ZonedDateTime.now(userZone).format(f);
```

`ofLocalizedDate/Time/DateTime` pick the culture's ordering (month-day vs
day-month) from CLDR — never hand-build `MM/dd/yyyy` for display, that *is*
the hardcoded-`en_US` assumption. `localizedBy` also switches calendar
systems where the locale implies one; `withLocale` changes only the text.

## Gotchas

**Symptom:** string comparison or `Map` lookup on lowercased keys fails only on one customer's deployment
**Cause:** `toLowerCase()` with no locale on a Turkish/Azerbaijani-default host — `"I"` → `"ı"`
**Fix:** `toLowerCase(Locale.ROOT)` for every programmatic case-map; reserve the no-arg form for text shown to a user

**Symptom:** `NumberFormat.parse` returns a value 1000× too large from European input
**Cause:** `"1.234"` parsed with a grouping-dot locale (or the reverse: `"1,5"` under `en_US`)
**Fix:** machine data → `Double.parseDouble`/`BigDecimal`; human input → `NumberFormat` with the *user's* locale, then range-check

**Symptom:** French users see German text
**Cause:** `ResourceBundle` falls back through the *default* locale before the base bundle
**Fix:** `Control.getNoFallbackControl` (or a fixed, deliberate default locale); test bundle lookup with a locale you have no bundle for

**Symptom:** umlauts/emoji render as `Ã¼`-style mojibake in translations, but only in one loading path
**Cause:** the bundle path uses JDK 9+ UTF-8 `PropertyResourceBundle`, the other calls `Properties.load(InputStream)` which is still ISO-8859-1
**Fix:** load `Properties` via a `Reader` with an explicit charset; keep all `.properties` files UTF-8 ([charsets](03-streams-buffers-charsets.md))

**Symptom:** occasional garbled or wrong-format numbers under load, correct in single-threaded tests
**Cause:** one shared static `DecimalFormat`/`SimpleDateFormat` — both documented non-thread-safe
**Fix:** per-thread instances, or format with `String.format`/`DateTimeFormatter` (immutable) instead

**Symptom:** golden-file tests for formatted dates/numbers break after a JDK upgrade with no code change
**Cause:** CLDR data updated between JDK releases (JEP 252) — formatted output is data, not API
**Fix:** don't assert exact localized strings; assert parsed values, or pin tests to `Locale.ROOT` fixed formats

**Symptom:** `Locale.setDefault` in one test pollutes every later test
**Cause:** the default locale is process-global; category defaults double the surprise
**Fix:** save/restore around the test (or a JUnit extension); in production code, never call `setDefault` outside main

**Symptom:** right translation files on the classpath, `MissingResourceException` anyway in a modular app
**Cause:** named modules encapsulate resources — local bundles resolve only within the module unless a provider or `opens` exposes them
**Fix:** keep bundles in the same module as the lookup code, or expose them via `ResourceBundleProvider`/`opens` deliberately

## Interview questions

**★ Why does `"ID".toLowerCase().equals("id")` return `false` on some machines, and what is the fix?**
The no-arg `toLowerCase` uses the default locale; under Turkish rules `I` lowercases to dotless `ı`. Any locale-blind case-map on protocol strings is a latent bug — use `toLowerCase(Locale.ROOT)` (or `equalsIgnoreCase` for simple ASCII tokens).

**★ Your service runs identically everywhere except one region's hosts, where CSV imports are corrupted ×1000. Diagnose.**
The import parses with `NumberFormat`/`Scanner` under the default FORMAT locale; on those hosts the grouping/decimal separators are swapped, so `1.234` becomes a grouping form. Machine data must be parsed locale-independently (`BigDecimal(String)`), and the host's default locale must never reach a data path.

**★ What are the two default-locale categories and when does each apply?**
`Locale.Category.DISPLAY` selects translations (which `ResourceBundle`, `getDisplayName` language); `FORMAT` selects formatting rules (`NumberFormat`, `String.format`, localized `DateTimeFormatter`). They can be set independently — a UI in English formatting numbers German-style is a legitimate combination.

**★ Why were the `Locale` constructors deprecated, and what replaced them?**
They never validated (ill-formed locales constructed happily) and always allocated fresh objects. JDK 19 added `Locale.of(...)` — validated-enough, cached instances, mechanical 1:1 migration — with `Locale.Builder` for strict BCP 47 validation and `forLanguageTag` for parsing tags.

**★ Walk the `ResourceBundle` lookup for `getBundle("Msg", Locale.of("fr","CA"))` on a `de_DE`-default JVM with only `Msg.properties` and `Msg_de.properties` present.**
Candidates `fr_CA` → `fr` miss; then the *default* locale's chain `de_DE` → `de` runs — `Msg_de` **hits** and is returned. The base file is reached only if the default chain also misses. German for a French request is the documented, surprising outcome.

**★ Where do Java's formatting rules actually come from, and what is the operational consequence?**
Unicode CLDR, bundled with the JDK since 9 (JEP 252) and updated each release. Consequence: formatted output can legitimately change on a JDK upgrade (NBSP vs space, separator tweaks), so exact-string assertions and downstream parsers of localized output are brittle by design.

**★ Why is caching one `NumberFormat` in a static field wrong twice?**
Thread-safety — `DecimalFormat` is documented unsafe for concurrent use; and locale-correctness — one cached instance froze one locale, but display formatting should follow the *request's* user locale. Create per use (cheap) or per thread, keyed by locale.

---

← Prev: [Java serialization](08-java-serialization.md) · Index: [Phase 7 — I/O, time and the everyday stdlib](README.md) · Next → [ProcessBuilder](10-processbuilder.md)
