---
title: "04.3 · Encoding rules"
sidebar_label: "03 · Encoding rules"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`URLSearchParams`](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams), [`encodeURIComponent()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent), [`encodeURI()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURI), [`String.prototype.toWellFormed()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/toWellFormed). Documentation-validated.

**There is no single "URL encoding".** There are several percent-encode sets, they disagree, and
the disagreement is where the bugs are. This chunk is the map.

## The two encoders you actually meet

**`URLSearchParams`** — MDN:

> "`URLSearchParams` objects percent-encode anything in the `application/x-www-form-urlencoded`
> percent-encode set (which contains all code points **except ASCII alphanumeric, `*`, `-`, `.`,
> and `_`**), and encode **U+0020 SPACE as `+`**."

**`encodeURIComponent()`** — MDN:

> Characters it does not escape: "A–Z a–z 0–9 `-` `_` `.` `!` `~` `*` `'` `(` `)`"

Line them up and the differences are small and consequential:

| | `URLSearchParams` | `encodeURIComponent` |
|---|---|---|
| Space | **`+`** | `%20` |
| `!` `~` `'` `(` `)` | `%21` `%7E` `%27` `%28` `%29` | **left alone** |
| `*` `-` `.` `_` | left alone | left alone |
| `&` `=` `?` `#` `/` `+` | escaped | escaped |

🔴 **The space is the one that bites.** `URLSearchParams` produces `q=hello+world`;
`encodeURIComponent` produces `q=hello%20world`. Both are correct — for a query string, both
decode back to a space under form-urlencoded rules. The failure is on the **server** side:

```js
// server-side, decoding a query value the wrong way
decodeURIComponent("hello+world")   // "hello+world"   ← the + survives as a literal plus
```

`decodeURIComponent` implements *URI* rules, where `+` is just a character. Form-urlencoded rules
say `+` means space. A server that runs `decodeURIComponent` over a form-encoded query gets
`"hello+world"` in the database, and the bug shows up as *plus signs appearing in user data* —
usually first noticed in email addresses, where `+` is legitimately common and now indistinguishable
from an encoded space.

**The fix is to decode with the same rules you encoded with.** In JavaScript that means parsing
queries with `URLSearchParams`, not by splitting on `&` and calling `decodeURIComponent`.

## Which one to reach for

**For query parameters: `URLSearchParams`, always.** It handles the encoding, the `&`/`=`
separators, repeated keys and the empty cases correctly, and there is no version of hand-rolled
concatenation that stays right.

```js
// ❌ breaks on & = # + space and every non-ASCII character
const url = `/search?q=${term}&page=${page}`;

// ✅
const url = `/search?${new URLSearchParams({ q: term, page })}`;
```

**For a path segment: `encodeURIComponent`, by hand.** Nothing does this for you:

```js
const id = "a/b";                                  // a real id with a slash in it

new URL(`orders/${id}`, BASE);                     // ❌ …/orders/a/b — two segments, 404
new URL(`orders/${encodeURIComponent(id)}`, BASE); // ✅ …/orders/a%2Fb — one segment
```

🔴 **`URL` will not rescue you here.** It percent-encodes characters that cannot appear in a path
at all, but `/` *can* appear in a path — that is what makes it a path — so a slash inside an id
silently becomes a structural separator. The same applies to `?` and `#`, which truncate the path
at the query and fragment. Anywhere user data is interpolated into a path segment,
`encodeURIComponent` is required.

**For a whole URL: `encodeURI`, almost never.** MDN:

> "Compared to `encodeURI()`, `encodeURIComponent()` escapes a larger set of characters."

> "Compared to `encodeURI()`, this function encodes more characters, **including those that are
> part of the URI syntax**."

`encodeURI` deliberately leaves `/ ? : @ & = + $ #` alone so a complete URL survives — which is
exactly why it is wrong for a *component*. Its narrow legitimate use is tidying a URL you already
trust (escaping stray spaces in a link). If you find yourself reaching for it, the real answer is
usually `new URL()` plus `URLSearchParams`.

**Never `escape()`.** It is deprecated, non-UTF-8, and produces `%uXXXX` sequences nothing else
understands.

## The `+` round trip, in both directions

```js
new URLSearchParams({ q: "a+b" }).toString();   // "q=a%2Bb"     — the plus is escaped
new URLSearchParams("q=a+b").get("q");          // "a b"         — a bare + decodes to space
new URLSearchParams("q=a%2Bb").get("q");        // "a+b"         — the escaped one survives
```

Round-tripping through `URLSearchParams` in both directions is lossless. Mixing encoders is what
loses information — and the loss is silent, because both strings are valid.

⚠️ **This is why "the plus sign in emails breaks signup" is such a common bug.** `a+b@x.test`
encodes as `a%2Bb%40x.test`; if some layer decodes it with URI rules while another encoded with
form rules, the address becomes `a b@x.test`. The corruption happens at a boundary, so neither
side looks wrong on its own.

## Lone surrogates throw

```js
encodeURIComponent("\uD800");   // URIError: malformed URI sequence
```

MDN documents both the failure and the fix:

> A `URIError` is thrown "if one attempts to encode a surrogate which is not part of a high-low
> pair."

> "You can use `String.prototype.toWellFormed()`, which replaces lone surrogates with the Unicode
> replacement character (U+FFFD), to avoid this error."

```js
encodeURIComponent(userInput.toWellFormed());   // ✅ never throws
```

**This is reachable from user input** — a half of an emoji pasted or truncated by a length limit
that counted UTF-16 code units ([Phase 1 · strings and code
units](../../phase-1-values-and-coercion/README.md)). A search box that throws `URIError` on
certain pastes is this bug, and `toWellFormed()` is a one-word fix.

`URLSearchParams` does not throw here — it encodes lone surrogates as U+FFFD itself — which is
another reason to prefer it for query building.

## Decoding throws too

```js
decodeURIComponent("%");         // URIError: URI malformed
decodeURIComponent("%E0%A4%A");  // URIError — truncated sequence
decodeURIComponent("100%");      // URIError — a bare % is not valid input
```

🔴 **`decodeURIComponent` throws on any malformed percent sequence**, and user-supplied strings
are frequently malformed — a pasted URL cut short, a bare `%` from `100% off`. Decoding untrusted
input needs a guard:

```js
function safeDecode(value) {
  try { return decodeURIComponent(value); } catch { return value; }
}
```

Or, better, do not decode by hand at all: `URLSearchParams` and `URL` give you decoded values
without exposing you to the failure.

## Gotchas

**Symptom:** Plus signs appear in stored user data
**Cause:** A form-encoded `+` (meaning space) was decoded with `decodeURIComponent`, which treats
`+` literally.
**Fix:** Parse query strings with `URLSearchParams` on both sides.

**Symptom:** Email addresses lose their `+` tag, or gain a space
**Cause:** The same encoder/decoder mismatch, at a boundary where neither side looks wrong.
**Fix:** Same — one encoding scheme end to end.

**Symptom:** An id containing `/` produces a 404
**Cause:** It was interpolated into a path and became a segment separator.
**Fix:** `encodeURIComponent` around every user value in a path segment. `URL` will not do it.

**Symptom:** Everything after a `#` in a value disappears server-side
**Cause:** An unencoded `#` in a path or query starts the fragment, which is never sent.
**Fix:** `encodeURIComponent`, or `URLSearchParams` for query values.

**Symptom:** A query parameter truncates at `&`
**Cause:** Hand-built query string with an unencoded `&` in a value.
**Fix:** `URLSearchParams`.

**Symptom:** `URIError: malformed URI sequence` from a search box
**Cause:** A lone surrogate — half an emoji from a paste or a truncation.
**Fix:** `encodeURIComponent(input.toWellFormed())`, or build the query with `URLSearchParams`.

**Symptom:** `URIError: URI malformed` when decoding
**Cause:** `decodeURIComponent` on a bare `%` or a truncated escape.
**Fix:** Guard with `try`/`catch`, or avoid manual decoding entirely.

**Symptom:** `encodeURI` leaves `&` and `=` in a value untouched
**Cause:** It deliberately preserves URI syntax characters — MDN: it encodes *fewer* characters
than `encodeURIComponent`, excluding *"those that are part of the URI syntax"*.
**Fix:** `encodeURIComponent` for components; `encodeURI` only for a whole trusted URL.

**Symptom:** Server-side signature over a URL does not match
**Cause:** Two layers encoded the same value with different sets (`%20` vs `+`, `~` vs `%7E`).
**Fix:** Canonicalise — build with one encoder, and `params.sort()` before signing.

## Interview questions

**★ How do `URLSearchParams` and `encodeURIComponent` differ?**
Two different percent-encode sets. `URLSearchParams` uses the `application/x-www-form-urlencoded`
set — everything except ASCII alphanumeric, `*`, `-`, `.` and `_` — and encodes space as **`+`**.
`encodeURIComponent` leaves `! ~ * ' ( )` alone and encodes space as **`%20`**. Both are correct
for a query string; mixing the encoding and decoding sides is what corrupts data.

**★ Why do plus signs appear in user data?**
A form-encoded query where `+` means space was decoded with `decodeURIComponent`, which treats
`+` as a literal character. Emails are where it is noticed, because `+` is legitimate there.
Parse queries with `URLSearchParams`.

**★ An id containing a slash 404s. Why, and what fixes it?**
Interpolated into a path, `/` is a segment separator, and `URL` will not escape it because a
slash is legal in a path. Wrap every user value in a path segment with `encodeURIComponent`.

**★ `encodeURI` or `encodeURIComponent`?**
`encodeURIComponent` for any single component — MDN: `encodeURI` *"encodes fewer characters,
excluding those that are part of the URI syntax"*, which is precisely the set a component must
escape. `encodeURI` is for a whole, already-structured URL, and in practice `new URL()` plus
`URLSearchParams` is better than both.

**★ When does `encodeURIComponent` throw?**
On a lone surrogate — MDN: *"if one attempts to encode a surrogate which is not part of a
high-low pair."* Reachable from a truncated emoji in user input. Fix with
`String.prototype.toWellFormed()`, which *"replaces lone surrogates with the Unicode replacement
character."*

**★ Is `decodeURIComponent` safe on untrusted input?**
No — a bare `%` or a truncated escape throws `URIError`. Guard it, or avoid manual decoding by
using `URL`/`URLSearchParams`, which hand you decoded values.

**Why is hand-building a query string always wrong eventually?**
Because the value will one day contain `&`, `=`, `#`, `+`, a space or a non-ASCII character, and
each of those breaks a different thing — truncation, an extra parameter, a lost fragment, a
mangled space. `URLSearchParams` handles all of them and repeated keys besides.

---

← [02 · URLSearchParams](./02-urlsearchparams.md) · [Topic index](./README.md) ·
Next → [Phase index](../README.md)
