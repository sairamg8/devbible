---
title: "Dates and delivery windows"
sidebar_label: "02 · Dates and delivery windows"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against MDN —
> [`Intl.DateTimeFormat.prototype.formatRange()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/formatRange),
> [`Intl.DateTimeFormat()` constructor](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat),
> [`Intl.RelativeTimeFormat`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/RelativeTimeFormat).
> The storage side — `timestamptz`, and why the instant is the thing stored —
> is [chapter 1·07](../../phase-1-database/07-money-and-time.md) and is not
> repeated here.

## The problem

The database stores instants. The user reads *"arrives Tue 19 – Thu 21 Aug"*.
Between those two facts sit three decisions the app has to make on purpose:
**which timezone**, **which locale**, and **whose clock decides "today"**.

Getting them wrong produces the bug class where an order placed at 11pm shows
as tomorrow, or a delivery window collapses into a single day for half the
customers.

## Always pass `timeZone`. Never rely on the default.

`Intl.DateTimeFormat` defaults to the runtime's timezone. On a browser that is
the user's machine; on the Node server rendering the same page it is whatever
`TZ` says, which in a container is almost always UTC. **The same instant then
formats two different ways in the same request**, which is the SSR mismatch in
[chunk 3](03-where-it-breaks.md).

So the app's rule is that `timeZone` is a required argument, not an option:

```js
// src/lib/datetime.js
const cache = new Map();

function dtf(locale, options) {
  const key = `${locale}|${JSON.stringify(options)}`;
  let f = cache.get(key);
  if (!f) { f = new Intl.DateTimeFormat(locale, options); cache.set(key, f); }
  return f;
}

/** timeZone is REQUIRED — see the rule above. */
export function formatDate(instant, {locale, timeZone, ...opts}) {
  if (!timeZone) throw new TypeError('formatDate: timeZone is required');
  return dtf(locale, {timeZone, ...opts}).format(new Date(instant));
}
```

**Which timezone is the right one is a product question, not a technical one.**
For a delivery window it is the *shipping address's* zone, because that is
where the parcel arrives — not the browser's, which may be a laptop in another
country. For an order history it is the user's own zone, because they are
recalling when they did something. The spec fixes both, and the module takes
the argument rather than guessing.

## `formatRange` is the delivery window

A window is two instants, and formatting them separately produces
*"Tue 19 Aug 2026 – Thu 21 Aug 2026"* where a human writes *"19 – 21 Aug"*.
`formatRange` does that collapsing for you, per locale:

```js
export function formatWindow(startInstant, endInstant, {locale, timeZone}) {
  return dtf(locale, {timeZone, day: 'numeric', month: 'short', weekday: 'short'})
    .formatRange(new Date(startInstant), new Date(endInstant));
}
```

MDN's example of the collapsing, with `year`/`month: 'short'`/`day`:

```js
fmt.formatRange(date1, date3); // 'Jan 10 – 20, 1906'
```

🔴 **And the trap in the same sentence of the docs:** *"If start and end dates
are equivalent at the precision of the output, only a single date is
returned."* A same-day window renders as one date — `'Jan 10, 1906'`, no dash.

That is usually what you want, and it is a defect when the UI has already
written *"Arrives between"* in static text beside it, because the sentence
becomes "Arrives between Tue 19 Aug". **Decide the label from the data, not
from the layout:**

```jsx
const sameDay = start === end ||
  dtf(locale, {timeZone, dateStyle: 'short'}).format(new Date(start)) ===
  dtf(locale, {timeZone, dateStyle: 'short'}).format(new Date(end));

<p>{sameDay ? 'Arrives' : 'Arrives between'} {formatWindow(start, end, opts)}</p>
```

⚠️ **`formatRange` throws a `TypeError` on a `Temporal.ZonedDateTime`.** MDN is
explicit: convert to `Temporal.PlainDateTime`, or use
`Temporal.ZonedDateTime.prototype.toLocaleString()`. This app passes `Date`
objects built from the API's ISO strings, so it does not hit this — but any
future move to Temporal does, and it fails at the formatter rather than at the
type.

## `RelativeTimeFormat` for order history, and its one rule

*"Ordered 2 days ago"* is `Intl.RelativeTimeFormat`, and the part people get
wrong is that **it formats a number you compute — it does not compute it.**

```js
const rtf = new Intl.RelativeTimeFormat(locale, {numeric: 'auto'});
rtf.format(-2, 'day');   // "2 days ago"
rtf.format(-1, 'day');   // "yesterday"  <- because numeric: 'auto'
```

`numeric: 'auto'` is what turns `-1 day` into *"yesterday"* rather than *"1 day
ago"*, and it is the setting a storefront wants. The default, `'always'`, keeps
the number.

🔴 **Choosing the unit is where the bugs are.** Deriving "days ago" by dividing
a millisecond difference by 86,400,000 is wrong across a daylight-saving
boundary, where a local day is 23 or 25 hours. It is also wrong about what
"yesterday" means: an order at 00:30 today and one at 23:30 yesterday are an
hour apart and belong to different days. **Compare calendar days in the target
timezone**, not elapsed milliseconds:

```js
/** Whole calendar days between two instants, as seen in `timeZone`. */
function calendarDaysBetween(a, b, timeZone) {
  const key = (d) => dtf('en-CA', {timeZone, dateStyle: 'short'}).format(d); // YYYY-MM-DD
  return Math.round((Date.parse(key(new Date(b))) - Date.parse(key(new Date(a)))) / 86400000);
}
```

`en-CA` is used deliberately: it yields an ISO-shaped `YYYY-MM-DD`, so the two
midnight-anchored dates can be subtracted safely. The division is applied to
two *midnights*, never to two arbitrary instants, which is what makes it
DST-proof.

## Gotchas

**Symptom:** An order placed at 11pm shows as the next day
**Cause:** Formatting in UTC while the user is behind it
**Fix:** Pass the user's `timeZone`; never format an instant without one

**Symptom:** The delivery window lost its dash and reads "Arrives between 19 Aug"
**Cause:** `formatRange` collapsed a same-day range, per its documented behaviour
**Fix:** Derive the label from whether the days are equal, as above

**Symptom:** "1 days ago"
**Cause:** `numeric` left at its `'always'` default
**Fix:** `numeric: 'auto'` — it also gives "yesterday", "today", "tomorrow"

**Symptom:** "0 days ago" for an order two hours old that crossed midnight
**Cause:** Elapsed-milliseconds arithmetic instead of calendar-day comparison
**Fix:** Compare formatted dates in the target zone

**Symptom:** Relative times are off by one for a week each spring and autumn
**Cause:** A `/ 86400000` across a DST transition, where the local day is not
24 hours
**Fix:** Anchor to midnights before subtracting

**Symptom:** `Invalid Date` in the formatter
**Cause:** A `timestamptz` arrived as a string and was passed straight in
**Fix:** `new Date(instant)` at the module edge; and reject `NaN` there rather
than rendering it

**Symptom:** A hardcoded IANA zone works locally and fails in production
**Cause:** `TZ` differs, and the code depended on the default
**Fix:** The `throw` in `formatDate` — a required argument that is missing
should fail loudly at the first call, not silently render UTC

**Symptom:** Two customers in the same city see different windows
**Cause:** The window was formatted in the *browser's* zone rather than the
shipping address's
**Fix:** Zone follows the meaning of the timestamp, not the viewer

## Interview questions

1. **★ Why must `timeZone` be passed explicitly rather than left to default?**
   Because the default is the runtime's zone, and the same code runs in two
   runtimes: a container that is almost certainly UTC, and a browser that is
   the user's. Leaving it implicit means the server and the client format the
   same instant differently, which is both a visible wrong date and a hydration
   mismatch.
2. **★ A delivery window renders without its dash. Is that a bug?** Not in the
   formatter — `formatRange` is documented to return a single date when the two
   are equivalent at the output's precision, and that is usually the desired
   output. It becomes a bug when surrounding static text assumes a range, so
   the label has to be derived from the data rather than hardcoded.
3. **Why is `(b - a) / 86400000` the wrong way to get "days ago"?** Two
   reasons. It measures elapsed time rather than calendar days, so 23:30
   yesterday and 00:30 today read as zero days apart when the user calls them
   different days. And a local day is not always 24 hours — across a DST
   transition it is 23 or 25 — so the arithmetic drifts by one.
4. **How do you compare calendar days correctly?** Format both instants to a
   date-only string *in the target timezone*, then compare those. The zone
   conversion is the step that matters; once both are midnight-anchored dates,
   subtraction is safe.
5. **What does `numeric: 'auto'` change, and why does a storefront want it?**
   It lets the formatter substitute idiomatic words for small offsets —
   "yesterday" instead of "1 day ago". Storefronts want it because the
   numeric form reads like machine output for exactly the recent orders users
   look at most.
6. **Which timezone should a delivery window use — the user's or the shipping
   address's?** The shipping address's, because the window describes when a
   parcel arrives somewhere. The user's own zone is right for their order
   history, which describes when *they* did something. The two differ whenever
   someone orders while travelling, and the distinction is a product decision
   the module surfaces as a parameter.
7. **What happens if you pass a `Temporal.ZonedDateTime` to `formatRange`?** It
   throws a `TypeError`. MDN directs you to `toLocaleString()` on the
   `ZonedDateTime` itself, or to convert to `Temporal.PlainDateTime` first.
8. **Why cache `DateTimeFormat` instances keyed on the options?** Same reason
   as the money formatter: the options change the output, so a key that ignores
   them hands a caller a formatter configured for a different surface. Here it
   matters more, because `timeZone` is one of those options — a collision would
   render the wrong zone, not just the wrong style.

---

← Prev: [The money formatter](01-the-money-formatter.md) ·
Next → [Where it breaks](03-where-it-breaks.md)
