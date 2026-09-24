---
name: devbible-javascript-concepts-phase18
description: Load-bearing claims and sources for JavaScript phase 18 — the applied storefront
metadata:
  type: reference
---

*Child of [[devbible-javascript-concepts]]. Open when working on phase 18, or on any applied
front-end question.*

Provenance: **documentation-validated** against MDN. 🔴 **No timings, no console blocks.**
Phase 18 has **7 Master topics**; ✅ **all done** (commit `60c30d9`) — and they were **the last
Master topics in the whole corpus**. 08–18 deferred.

## Topic 01 · The product grid
- 🔴 **The test for URL state**: would a user bookmark, share, or reach it with back? → filters,
  sort, page, search, an open panel. Not hover, drafts, dropdown-open.
- `getAll`/`append` for repeatable filters; 🔴 **omit defaults** (two URLs describing one view
  breaks caching/analytics); **rebuild the params from state** or removed filters linger.
- `pushState` on deliberate actions, `replaceState` while typing — ⚠️ **push-per-keystroke turns
  back into a backspace**. `popstate` fires only for user navigation.
- 🔴 **One-directional flow**: actions write the URL, rendering reads it. Never both from one
  handler.
- Offset vs cursor is **UI-driven**: numbered pager needs offsets (rows shift, deep offsets cost);
  infinite feed wants cursors (cannot express "page 5").
- 🔴 **Two independent guards on responses**: abort **and** compare the key — aborting is a request
  to stop, not a guarantee nothing arrives.
- 🔴 **Four states, not two** — first load / refining / empty / error. **A skeleton on every filter
  change is the common UX bug**; dim the old results instead. Empty must be actionable.
- `aria-live="polite"` + focus to the grid heading on pagination. `width`/`height` reserve space
  (biggest layout-shift source); ⚠️ **`loading="lazy"` on the hero hurts LCP**.

## Topic 02 · Search with autocomplete
- 🔴 **Three bugs, three separate fixes**: request-per-keystroke → debounce (not throttle,
  250–300 ms, created once, min length); in-flight request → `AbortController`; **out-of-order
  responses → a monotonic request id**, which survives both other fixes.
- ⚠️ **Request id, not term comparison** — the same term can be in flight twice (type/backspace/
  retype).
- `AbortError` **silent**; `encodeURIComponent` the term; ⚠️ **cancel the pending debounce when the
  box is cleared** or results appear under an empty input.
- Keyboard: 🔴 **`Tab` must NOT commit**; `preventDefault` on arrows; `Escape` closes then clears.
- 🔴 **Highlight is not focus** — focus stays in the input, `aria-activedescendant` carries the
  highlight. `autocomplete="off"` or the browser's list covers yours.
- 🔴 **`blur` fires before `click`** → the classic "clicking a suggestion does nothing". Correct fix
  is `preventDefault` on the option's **`mousedown`**; `focusout` + `relatedTarget` second;
  ⚠️ a `setTimeout` is the common hack and works by racing.
- ⚠️ **Highlighting via `replace` + `innerHTML` is doubly wrong** — XSS sink AND regex
  metacharacters. Build nodes with `textContent`.
- `scrollIntoView({block:"nearest"})`. Bound and expire the result cache.

## Topic 03 · A resilient API client
- 🔴 **Layer order with a reason for each**: dedupe → retry → auth → timeout → fetch. Dedupe
  outermost (callers share retries); retry above auth (refreshed token is used); **timeout
  innermost — a timeout around the retries aborts mid-backoff and looks like a flaky API.**
- **Single-flight dedupe**: `Map` of key→promise, cleared in **`finally`**; 🔴 **`GET`/`HEAD` only**
  (deduping a POST merges two orders); 🔴 **all callers share one resolved object** → freeze or
  copy.
- ⚠️ **The key must include method + URL + credentials mode + auth headers** — a URL-only key
  serves one user's cart to another after a login switch.
- 🔴 **Dedupe is NOT a cache** (in-flight vs completed; no staleness vs invalidation). A TTL means
  you built a cache.
- **Four failure classes** + cancellation (not an outcome). 🔴 **The `unknown` class must exist** so
  a parser `TypeError` is not retried forever.
- `Error.cause` or the diagnosis is destroyed. ⚠️ **`Retry-After` HTTP-date parsed with `Number()`
  → `NaN` → `setTimeout(NaN)` fires immediately.** ⚠️ **`navigator.onLine` is trustworthy only when
  `false`.**
- 🔴 **Report status/endpoint/request-id/class only** — never bodies, headers or query strings
  (tokens, addresses, payment details; the tracker is a third party). Do not report cancellations.
- 🔴 **Per-region error boundaries** — one failed widget must not blank the page; "render nothing"
  is legitimate for a non-essential widget.

## Topic 04 · The cart as a state machine
- 🔴 **Total computed, never stored** (a second source of truth drifts). Store the minimum that
  cannot be derived.
- ⚠️ **Array beats `Map` here** — against the usual reflex — because n is small, order matters, and
  **`JSON.stringify(new Map())` is `"{}"` silently**.
- Transitions: 🔴 **`add` increments** (not push — the duplicate-line bug users see first);
  **`setQty(0)` removes**; **unknown SKU is a no-op, not a throw** (it may be gone in another tab);
  `clear` keeping the coupon is a decision to make explicitly. `Array.prototype.with` (ES2023).
- Pure `derive` → the badge cannot disagree with the page. ⚠️ **`itemCount`: units or lines?** Name
  it.
- `Object.freeze` is **shallow**, and a frozen assignment **fails silently in sloppy mode** /
  throws in strict (modules). Freeze in dev only.
- Store: 🔴 **reference equality to skip no-op notifications** (why no-ops return the same object);
  **copy the listener set before iterating**; **`subscribe` returns its unsubscribe**.
- Persistence: 🔴 **schema version in the key/payload + migrate**, or an old cart crashes a new
  release for every returning user. `QuotaExceededError`, **access itself can throw** in private
  mode, corrupt JSON → all degrade, never crash. Validate on load (user-editable). Debounce saves.
- 🔴 **`storage` fires in OTHER tabs** (opposite of most guesses) and **for every key** → filter
  `e.key`. `BroadcastChannel` better; both need loop protection.
- 🔴 **Client cart is a draft**: merge on login (summing per SKU), server price wins, clamp to
  stock — and **surface every change**. "Last write wins" is not a cart strategy.

## Topic 05 · Money, quantities and rounding
- 🔴 **`Math.round(1.005 * 100)` is `100`, not `101`** — the bug in every hand-rolled currency
  helper. ⚠️ **`Number.EPSILON` is a RELATIVE bound** and not the fix.
- **Integer minor units + a currency code**; exact to 2⁵³−1 (~£90 trillion in pence). 🔴 **Not every
  currency has 2 decimals** (JPY has 0) — the exponent belongs with the currency.
- Three re-entry points for floats: 🔴 **`parseFloat(x)*100` = `1298.9999999999998`**, locale
  decimal separators (`"12,99"`), and **JSON numbers**. Split on the point and build the integer.
- `Intl.NumberFormat` is the only correct formatter (symbol position, separators, decimals,
  negative style); **create it once**; 🔴 **the `/100` happens only here**.
- `BigInt` is a whole-pipeline decision (cannot mix with `Number`, throws on `JSON.stringify`).
- 🔴 **`Math.round` is half toward +∞, not half-away-from-zero** — `-2.5 → -2`, `2.5 → 3`, so
  refunds and charges round asymmetrically. Banker's rounding is what many systems specify.
- 🔴 **Order of tax and discount changes the total** (£2 on a £100 order) and is a **legal**
  question. One stated rule, one function.
- **Round once at the end**, except per rate group. 🔴 **Splitting must distribute the remainder** —
  `split(1000,3) = [334,334,332]`; same problem as proportional discounts. Assert the sum.
- 🔴 **The client never decides the price** — send inputs, not conclusions; and **client and server
  must round identically** or the shown total differs from the charged one.

## Topic 06 · Optimistic updates with rollback
- 🔴 **Snapshot BEFORE applying** — capturing it in the `catch` restores the wrong thing.
- 🔴 **Reconcile with the server's response**, not the optimistic value — the subtle bug is a UI
  that looks right and disagrees with the database (server clamps stock, changes price,
  normalises).
- ⚠️ **A whole-state restore discards concurrent work** → scope the rollback to what the action
  changed. This is where the pattern gets hard for document editors.
- Concurrency: last-write-wins / queue-per-entity / **debounce the send** (usually right for a
  stepper). 🔴 **Send the resulting state, not a delta** — `setQty(5)` is idempotent,
  `increment()` is not.
- ⚠️ **Do not disable the control** while in flight (defeats the point). 🔴 **Never revert
  silently** — say what failed and what it reverted to, in a live region.
- 🔴 **Do not be optimistic when being wrong is expensive**: orders, payments, anything with a
  confirmation email, anything unpredictable (server-assigned id or price).

## Topic 07 · Idempotency from the client
- 🔴 **Five causes of a double order; a disabled button touches ONE.** Double-click, refresh,
  **client retry after timeout**, lower-layer retry (proxy/service worker), two tabs.
- 🔴 **"A timeout means you stopped listening, not that the server did nothing."** The client cannot
  distinguish "never arrived" from "arrived and answered late" — so a retry is either unsafe or the
  endpoint is idempotent. No third option.
- Key rules: 🔴 **once per logical operation, outside the retry loop**; 🔴 **must survive a reload**
  (`sessionStorage` keyed by a fingerprint of cart+address+total); **a new key when the operation
  genuinely changes** (a corrected address), or a stored failure returns forever.
- ⚠️ **`crypto.randomUUID()` needs a secure context**; the `Math.random` fallback can collide,
  which for an idempotency key means two orders sharing one — a fallback, not a design.
- Disabling the button is a **courtesy**, and 🔴 **re-enable in `finally`** or a failure locks the
  user out permanently. Show progress, or the user refreshes (cause 2).
- 🔴 **Deduplication is the server's job** — the client owes a stable key. **An endpoint that
  ignores the header gives no protection, and against it the client must not retry at all.**
- Not knowing: ask with a safe `GET`, else **show the uncertainty**. A silent retry is how someone
  is charged twice.
