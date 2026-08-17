---
title: "Where it breaks"
sidebar_label: "03 · Where it breaks"
sidebar_position: 3
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against MDN —
> [`Intl.DateTimeFormat.resolvedOptions()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/resolvedOptions),
> [`Intl.NumberFormat()` constructor](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/NumberFormat)
> (`localeMatcher`). Locale negotiation as a concept is
> [JavaScript 12·20](../../../../javascript/pages/phase-12-browser-platform/20-i18n-in-the-browser/01-locale-and-negotiation.md);
> this chapter is where that concept meets this app's rendering.

## The failure everyone hits: the server and the browser disagree

The two previous chunks each ended at the same place — the formatter's output
depends on **locale** and **timezone**, and the server and the browser do not
have the same ones. The price renders `$19.99` on the server and `19,99 €` in
the browser, React re-renders, and the user sees a flicker or a console
mismatch warning.

**It is not a formatting bug. It is a state bug**: locale and timezone are
inputs to rendering, and inputs must be identical on both sides or the render
is not deterministic.

So they are resolved **once, on the server, per request**, and travel with the
page like any other data:

```js
// server: resolve once, from the request, and freeze it
const i18n = {
  locale: negotiateLocale(req),                    // see below
  timeZone: user.timeZone ?? addressTimeZone ?? 'UTC',
  currency: cart.currency,
};
// -> serialised into the page, read by a React context on both sides
```

⚠️ **The client must not "improve" on it.** A component that falls back to
`navigator.language` when the context is missing reintroduces the mismatch on
exactly the pages where the context failed to load. Missing i18n context is an
error to fix, not a case to paper over — the same argument the
[error contract](../../phase-3-express-api/09-the-error-contract.md) makes about
guessing.

## Negotiating the locale, and why `resolvedOptions()` is the check

`Accept-Language` is a ranked list of what the browser will accept. The app
supports a fixed set. Negotiation is picking the best overlap — and the part
that gets skipped is **verifying the pick actually happened**:

```js
const SUPPORTED = ['en-US', 'en-GB', 'de-DE', 'ja-JP'];

function negotiateLocale(req) {
  const wanted = parseAcceptLanguage(req.headers['accept-language']); // ranked
  return Intl.NumberFormat.supportedLocalesOf(wanted).find((l) => SUPPORTED.includes(l))
      ?? SUPPORTED[0];
}
```

🔴 **Asking for a locale is not getting it.** `new Intl.NumberFormat('de-AT')`
does not fail if the runtime has no Austrian data — it falls back, and
`resolvedOptions().locale` tells you what you actually got. If the app logs
prices as German and the runtime silently served `en-US`, every price on the
page is formatted with the wrong separators and nothing threw.

```js
const got = new Intl.NumberFormat(locale, {style: 'currency', currency})
  .resolvedOptions().locale;
if (got !== locale) log.warn({wanted: locale, got}, 'locale fell back');
```

⚠️ **This bites hardest in Node**, where the ICU data set is a build-time
choice. A `small-icu` build carries English only, so every non-English locale
falls back to English while the browser renders it correctly — a mismatch that
appears only in production and only for non-English users.

## The client never decides the price

The formatting module makes a number readable. It does not make it **true**.

Everything here runs on values the server computed:
the [checkout endpoint](../../phase-3-express-api/07-the-checkout-endpoint.md)
owns totals, tax and discounts, and the client renders what it is given. The
temptation is small and specific — recomputing a subtotal on the client so the
cart updates instantly without a round trip — and it is how the displayed total
and the charged total drift apart.

The rounding argument behind that rule is
[JavaScript 18·05 chunk 2](../../../../javascript/pages/phase-18-storefront/05-money-and-rounding/02-rounding-and-order.md):
the order of rounding changes the answer, so two implementations that both look
correct disagree by a penny. This app has one implementation, on the server.

## Gotchas

**Symptom:** React hydration warning on any page showing a price or a date
**Cause:** Server and client resolved different locale or timezone
**Fix:** Resolve once per request, pass down, never re-derive on the client

**Symptom:** Prices are correct in the browser and wrong in server-rendered HTML
**Cause:** A `small-icu` Node build with no data for the locale
**Fix:** `full-icu` (or `NODE_ICU_DATA`); assert `resolvedOptions().locale`
matches at boot and fail the healthcheck if it does not

**Symptom:** A locale works in development and falls back in production
**Cause:** Different ICU data between the local runtime and the container image
**Fix:** Same check, run at startup rather than per render — see the
[health and metrics service](../../phase-2-node-services/09-health-and-metrics.md)

**Symptom:** Everything renders in English for users who asked for German
**Cause:** `Accept-Language` parsed as a plain string, ignoring the `q=` ranking
**Fix:** Parse the ranked list; `supportedLocalesOf` filters, it does not rank

**Symptom:** Dates are right for logged-in users and UTC for guests
**Cause:** The timezone came from the user record with no fallback chain
**Fix:** An explicit chain — user preference, then shipping address, then a
documented default — decided in one place

**Symptom:** The cart total flickers to a different value after load
**Cause:** The client recomputed the subtotal before the server response landed
**Fix:** Render the server's total or render a skeleton; never a locally
computed stand-in

**Symptom:** Currency changes mid-session and old prices keep the old symbol
**Cause:** Formatters cached without currency in the key, or a stale context
**Fix:** Currency is in the cache key (chunk 1) and in the i18n context, so a
change invalidates both

**Symptom:** A price is right but the `<time>` element's `datetime` attribute is
localised
**Cause:** The machine-readable attribute was filled from formatted output
**Fix:** `datetime` takes the ISO instant; the formatted string is the child
text. Two different consumers, two different values

## Interview questions

1. **★ Why does formatting money cause a hydration mismatch, and what is the
   actual fix?** Because the formatter's output depends on locale and timezone,
   which differ between the server runtime and the browser. The fix is not in
   the formatter: it is to treat locale and timezone as request state, resolve
   them once on the server, and pass them to the client so both renders take
   identical inputs.
2. **★ Why is a client-side fallback to `navigator.language` a bad idea?**
   Because it only fires when the passed-down value is missing, which is
   exactly the case where the server already rendered something else. The
   fallback guarantees a mismatch on the broken path while hiding the breakage.
3. **You asked for `de-DE` and prices render with English separators. What
   happened and how would you have caught it?** The runtime had no data for
   that locale and silently fell back. `resolvedOptions().locale` reports what
   was actually resolved, so comparing it against what was requested catches it
   — ideally once at startup rather than per render.
4. **Why is this more likely on the server than in the browser?** Node's ICU
   data is a build option. A `small-icu` build ships English only, so every
   other locale falls back — while the browser, which carries full data,
   renders correctly. The bug is therefore invisible in client-side development
   and appears only in server-rendered output.
5. **Where does the boundary sit between formatting and calculating?** The
   server calculates every monetary value; the client formats. Formatting is a
   pure function of a value the client did not derive. The moment the client
   computes a total to render, there are two implementations of the same rules
   and they will disagree.
6. **Why can't the client recompute a subtotal "just for responsiveness"?**
   Because rounding order changes the result, so a client implementation that
   looks correct can differ from the server's by a penny — and the number the
   user sees is not the number they are charged. Render the server's value or
   render a skeleton.
7. **`supportedLocalesOf` returned a list. Are you done negotiating?** No. It
   filters to what the runtime supports but does not rank by the user's
   preference — the `q=` ordering from `Accept-Language` has to be preserved
   and applied, and then intersected with the app's supported set.
8. **What belongs in a `<time>` element's `datetime` attribute?** The machine
   ISO instant, never the localised string. The attribute and the text serve
   different consumers, and filling the attribute from formatted output breaks
   every parser that reads it.
9. **Why resolve timezone through an explicit chain rather than a default
   argument?** Because the correct source differs by meaning — the shipping
   address for a delivery window, the user's own zone for their history — and a
   default hides which one was used. An explicit chain, decided in one place,
   makes the choice reviewable.

---

← Prev: [Dates and delivery windows](02-dates-and-delivery-windows.md) ·
[Overview](README.md)
