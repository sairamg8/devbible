---
title: "01 · Validate at the boundary"
sidebar_label: "01 · Validate at the boundary"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [`JSON.parse()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse), [`Response.json()`](https://developer.mozilla.org/en-US/docs/Web/API/Response/json), [`fetch()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/fetch), [`URLSearchParams`](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams), [`Window.localStorage`](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage), [`Window: message` event](https://developer.mozilla.org/en-US/docs/Web/API/Window/message_event), [`Number.isFinite()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/isFinite). Documentation-validated; **no timings, no console blocks**.

🔴 **A boundary is any point where data enters your program from somewhere you do not control.**
Everything inside the boundary should be able to assume its data is well-formed; everything
crossing it should be checked exactly once, right there.

The failure this prevents is specific and expensive: a malformed value crosses unchecked, is
stored, passed, rendered and persisted, and finally throws in a component ten calls away that has
nothing to do with the cause.

## The boundaries, and what people forget about each

| Boundary | The assumption that turns out to be false |
|---|---|
| **A network response** | that it matches the shape the docs promise, on every deploy |
| **User input** | that a number field yields a number |
| **URL / query parameters** | that they were produced by your own links |
| **`localStorage` / `sessionStorage`** | that the value was written by *this version* of the code |
| **`postMessage` / worker messages** | that the sender is who you think, sending what you expect |
| **Environment variables and config** | that a required one is set, and is a number when you need a number |
| **A third-party SDK's callback** | that its argument shape is stable across versions |

⚠️ **Storage is the one most often missed.** Values written by a previous release survive
upgrades: a key that used to hold a string now holds an object, a shape you removed is still on
thousands of machines. **Version your stored data, and treat a mismatch as absent.**

```js
const RAW = localStorage.getItem('prefs');
const prefs = parsePrefs(RAW) ?? DEFAULT_PREFS;   // ✅ unreadable, wrong shape, wrong version → default
```

## Parse, do not merely check

The weak form validates and then carries on with the original loose value:

```js
if (typeof data.total === 'number') { … }   // ⚠️ proves nothing downstream
```

The strong form **produces a new value whose shape is guaranteed**, so nothing after it has to
re-check:

```js
function toOrder(raw) {
  if (typeof raw?.id !== 'string') throw new ValidationError('order.id must be a string', { field: 'id' });
  const total = Number(raw.total);
  if (!Number.isFinite(total)) throw new ValidationError('order.total must be a number', { field: 'total' });
  return { id: raw.id, total, createdAt: new Date(raw.createdAt) };   // ✅ a known shape
}
```

🔴 **The value that comes out of the boundary is the one the rest of the program uses.** That is
the difference between "we validated it somewhere" and "it cannot be wrong here" — and in
TypeScript it is also what makes the type honest rather than an assertion.

**A schema library does this for you** and is usually the right call once there is more than a
handful of shapes; the discipline is the same either way — the parse produces the value.

## Validate once, at the edge

```js
// ❌ defensive checks scattered through the call tree
function total(order) {
  if (!order || !Array.isArray(order.items)) return 0;   // who could have called this wrongly?
  …
}
```

Internal functions checking their own arguments is a smell: it says nobody knows where data is
validated, so everybody checks a little. The cost is noise, dead branches nothing tests, and
**bugs hidden by defaults** — the `return 0` above turns a broken order into a free one.

**Inside the boundary, let it throw.** A `TypeError` from a genuinely impossible state is
information; a silent `0` is a corrupted invoice.

⚠️ **The exception is a public API.** A library's exported functions *are* a boundary, and
validating their arguments with a clear error is exactly right — the caller is not you.

## `fetch` needs both checks

```js
const res = await fetch(url, { signal });
if (!res.ok) throw new HttpError(`GET ${url} failed`, { code: 'HTTP', status: res.status });
const raw = await res.json();          // ⚠️ throws on an empty body or HTML error page
return toOrder(raw);                   // ✅ then parse the shape
```

Three separate failures live in three lines, and each needs its own answer:

- **`fetch` rejects only on a network failure**, so `res.ok` must be checked explicitly — the
  point already made in
  [Phase 7 · 15 · What is safe to retry](../../phase-7-async/15-timeouts-retries-backoff/01-what-is-safe-to-retry.md).
- **`res.json()` throws on a body that is not JSON** — including the HTML error page a proxy
  returns, which is the classic "Unexpected token `<`".
- **A well-formed JSON body can still be the wrong shape.** Parsing is a separate step from
  decoding.

## Fail fast, or degrade — decide per boundary

| Data | If it is invalid |
|---|---|
| The order being displayed | 🔴 **fail** — show an error; a wrong total is worse than no total |
| A required config value at start-up | 🔴 **fail immediately**, loudly, before serving anything |
| An optional user preference | ✅ **degrade** to the default, and log |
| One row in a list of five hundred | ✅ **skip it**, count it, and report the count |
| An analytics payload | ✅ drop it silently; it must never break the page |

🔴 **The choice is about what the user loses, not about how the code reads.** Degrading is right
when a default is genuinely as good; it is wrong the moment the default could be mistaken for
real data. A missing avatar falls back to a placeholder; a missing price does not fall back to
zero.

**Config is the one that should be strict.** Reading environment values at start-up and throwing
on anything missing or malformed converts an outage at 3 a.m. into a failed deploy at 3 p.m.

## Never trust a message you did not send

```js
window.addEventListener('message', (event) => {
  if (event.origin !== 'https://payments.example.com') return;   // 🔴 check origin FIRST
  const data = parsePaymentMessage(event.data);                  // then parse the shape
  …
});
```

Any page that can reach your window can post to it. **Check `origin` before looking at the data
at all**, then parse it like any other untrusted input. The same applies to a `storage` event, a
custom protocol handler and anything arriving over a socket.

## Gotchas

**Symptom: "Unexpected token `<` in JSON at position 0".**
Cause — the response was an HTML error page; `res.ok` was never checked.
Fix — check `res.ok`, then parse; treat a non-JSON body as a failed request.

**Symptom: a stale `localStorage` value crashes the app after a release.**
Cause — data written by an earlier version with a different shape.
Fix — version stored data and treat any mismatch as absent.

**Symptom: an invoice total of `0` instead of an error.**
Cause — a defensive default deep in the call tree swallowed a malformed order.
Fix — validate at the boundary; let impossible states throw inside it.

**Symptom: the same shape is checked in six places and still gets through.**
Cause — scattered defensive checks instead of one parse at the edge.
Fix — one boundary function that returns a known shape.

**Symptom: a missing environment variable surfaces as a runtime error hours later.**
Cause — config read lazily and never validated.
Fix — validate all config at start-up and fail the boot.

**Symptom: a `message` handler acts on data from an unexpected page.**
Cause — `event.origin` was not checked, or was checked after using the data.
Fix — check the origin first, then parse.

**Symptom: one bad row breaks a whole list.**
Cause — fail-fast applied where degrading was correct.
Fix — skip and count invalid rows; report the count.

## Interview questions

**★ Where should validation live?**
At the boundaries — network responses, user input, URL parameters, storage, messages, config —
once each. Inside the boundary, code should be able to assume its data is well formed.

**★ What is the difference between validating and parsing?**
Validating checks and hands back the same loose value; parsing produces a new value with a known
shape, so nothing downstream has to check again. Parse.

**★ Why are defensive checks inside internal functions a smell?**
They signal that nobody knows where data is validated, and their fallbacks hide bugs — a `return
0` turns a malformed order into a free one.

**★ What does `fetch` require beyond awaiting the response?**
An explicit `res.ok` check — it rejects only on network failure — then a guarded parse, because
the body may not be JSON, and then a shape check, because valid JSON can still be the wrong shape.

**★ When should you degrade instead of failing?**
When the fallback is genuinely as good: an optional preference, a placeholder avatar, an analytics
drop. Never when the default could be mistaken for real data, such as a price.

**★ What must a `message` listener do first?**
Check `event.origin` before touching `event.data`. Any page that can reach your window can post to
it.

**Why validate config at start-up?**
So a missing value fails the deploy instead of failing a request in the middle of the night.

---

[Topic index](./README.md) · [02 · Results versus exceptions](./02-results-versus-exceptions.md) →
