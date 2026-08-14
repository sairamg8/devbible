---
title: "02.1 · The three bugs every search box ships with"
sidebar_label: "01 · The three bugs"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`AbortController`](https://developer.mozilla.org/en-US/docs/Web/API/AbortController), [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal), [`setTimeout()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/setTimeout), [`Element: input` event](https://developer.mozilla.org/en-US/docs/Web/API/Element/input_event). Documentation-validated; **no timings**.

**A search box is four lines of code and three bugs**, and the three are so consistent that the
syllabus names them. Each is invisible on a fast local connection and obvious to a real user.

## The naive version

```js
input.addEventListener("input", async (e) => {
  const results = await api.get(`search?q=${e.target.value}`);
  renderResults(results);
});
```

It has all three: **a request per keystroke**, **no cancellation**, and **no ordering guarantee**.

## Bug 1 — a request per keystroke

Typing "shoes" fires five requests. On a fast connection it looks fine; on a real one it is five
round trips competing for bandwidth, and server-side it is five times the load for one search.

**Debounce it** ([Phase 17 · 03](../../phase-17-machine-coding/03-debounce-throttle/README.md)):

```js
const search = debounce((term) => run(term), 250);
input.addEventListener("input", (e) => search(e.target.value));
```

🔴 **Debounce, not throttle.** You want the search that happens *after* typing stops, not one every
250 ms during it. Throttling a search box means searching for "sh" and "shoe" on the way to
"shoes".

⚠️ **250–300 ms is the usual range.** Below about 150 ms it barely batches; above 500 ms it feels
laggy. And the debounced function must be **created once** — recreated per render it debounces
nothing, which is the trap from that topic.

**Do not search on every input at all if the term is too short.** Two characters usually match
everything, so the request is pure cost:

```js
if (term.trim().length < 2) { clearResults(); return; }
```

## Bug 2 — the in-flight request is not cancelled

Debouncing reduces requests; it does not stop the one already running. The user types "shoes",
pauses, then adds " red" — request one is still open, and it will return results for "shoes".

```js
let controller = null;

async function run(term) {
  controller?.abort();                                  // 🔴 supersede
  controller = new AbortController();

  try {
    const results = await api.get(`search?q=${encodeURIComponent(term)}`, {
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]),
    });
    renderResults(results);
  } catch (err) {
    if (err.name === "AbortError") return;              // 🔴 silent — we cancelled it
    if (err.name === "TimeoutError") return showSlowMessage();
    showError(err);
  }
}
```

🔴 **`AbortError` must be silent.** It is the app working correctly. An error toast on every
superseded search is the second-most-visible version of this bug, and it comes from treating every
rejection as a failure
([Phase 11 · 03 · 05](../../phase-11-network-storage/03-fetch-wrapper/05-timeouts-and-cancellation.md)).

⚠️ **And `encodeURIComponent` on the term** — a search for `a&b` or `100%` breaks the query string
otherwise, and `100%` specifically makes the server's `decodeURIComponent` throw
([Phase 11 · 04 · 03](../../phase-11-network-storage/04-url-and-searchparams/03-encoding-rules.md)).

## Bug 3 — out-of-order responses

**This is the one that survives the first two fixes**, because aborting is a request to stop, not a
guarantee that nothing arrives. A response already in flight can complete after the abort.

```js
let latestRequestId = 0;

async function run(term) {
  const requestId = ++latestRequestId;                  // 🔴 claim a sequence number
  …
  const results = await api.get(…);
  if (requestId !== latestRequestId) return;            // 🔴 stale — discard
  renderResults(results);
}
```

**A counter is enough, and it is more robust than comparing the term** — because the user can type
"shoes", delete back to "shoe", and type "s" again, producing the same term twice with different
requests in flight.

🔴 **All three fixes are needed and they do different jobs:** the debounce reduces how many requests
exist, the abort stops the work, and the sequence check protects the render. Removing any one
leaves a visible bug.

## Putting it together

```js
function createSearch({ minLength = 2, wait = 250 } = {}) {
  let controller = null;
  let latest = 0;

  const run = async (term) => {
    const id = ++latest;
    controller?.abort();
    controller = new AbortController();

    try {
      const results = await api.get(`search?q=${encodeURIComponent(term)}`, {
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]),
      });
      if (id !== latest) return;
      renderResults(term, results);
    } catch (err) {
      if (err.name === "AbortError" || id !== latest) return;
      showError(err);
    }
  };

  const debounced = debounce(run, wait);

  return function onInput(term) {
    const q = term.trim();
    if (q.length < minLength) {
      debounced.cancel();                                // 🔴 cancel pending work too
      controller?.abort();
      clearResults();
      return;
    }
    debounced(q);
  };
}
```

⚠️ **`debounced.cancel()` when the input is cleared** — otherwise a pending search fires after the
user has emptied the box, and results appear under an empty input. It is a small thing and it looks
like a ghost.

## Gotchas

**Symptom:** One request per keystroke
**Cause:** No debounce.
**Fix:** Debounce at 250–300 ms — and debounce, not throttle.

**Symptom:** Debouncing does nothing
**Cause:** The debounced function is recreated on every render.
**Fix:** Create it once.

**Symptom:** Results for an earlier term appear
**Cause:** No cancellation, or cancellation without a sequence check.
**Fix:** Both — abort, and discard responses that are not the latest.

**Symptom:** An error toast on every fast edit
**Cause:** `AbortError` treated as a failure.
**Fix:** Check `err.name` and return silently.

**Symptom:** Searching `a&b` returns nothing; `100%` errors server-side
**Cause:** The term was not encoded.
**Fix:** `encodeURIComponent`, or build the query with `URLSearchParams`.

**Symptom:** Results appear after the box is cleared
**Cause:** A pending debounced call was never cancelled.
**Fix:** `cancel()` and abort when clearing.

**Symptom:** Two-character searches hammer the API
**Cause:** No minimum length.
**Fix:** A `minLength` guard that also clears the results.

**Symptom:** The same term produces a stale render
**Cause:** Staleness detected by comparing the term rather than a request id — the user can produce
the same term twice.
**Fix:** A monotonic counter.

## Interview questions

**★ Name the three bugs every search box ships with.**
A request per keystroke, no cancellation of the in-flight request, and no protection against
out-of-order responses. **All three need separate fixes** — debounce, `AbortController`, and a
sequence check — because each does a different job.

**★ Why is the sequence check still needed after aborting?**
Because `abort()` is a request to stop, not a guarantee that nothing arrives — a response already
in flight can complete. The abort saves the work; the sequence check protects the render.

**★ Why a request id rather than comparing the search term?**
Because the same term can be in flight twice — type "shoes", backspace to "shoe", retype "s". A
monotonic counter is unambiguous.

**★ Debounce or throttle a search box?**
Debounce. You want the search after typing stops; throttling searches for "sh" and "shoe" on the
way to "shoes". 250–300 ms is the usual window.

**★ What happens when the user clears the input?**
A pending debounced call can still fire and paint results under an empty box. Cancel the debounce
**and** abort the in-flight request when the term drops below the minimum length.

**★ Why must an `AbortError` be silent?**
It means the application cancelled the request on purpose. Showing it turns correct behaviour into
an error toast on every fast edit — which is why `AbortError` and `TimeoutError` must be
distinguished by `err.name`.

**What is the cheapest of the three fixes?**
The minimum-length guard — two characters usually match everything, so those requests are pure
cost, and it is one line.

---

[Topic index](./README.md) · Next → [02 · The dropdown](./02-the-dropdown.md)
