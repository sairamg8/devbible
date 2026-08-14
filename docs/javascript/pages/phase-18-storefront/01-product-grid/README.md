---
title: "01 · The product grid"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`URLSearchParams`](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams), [`History.pushState()`](https://developer.mozilla.org/en-US/docs/Web/API/History/pushState), [`popstate` event](https://developer.mozilla.org/en-US/docs/Web/API/Window/popstate_event), [`AbortController`](https://developer.mozilla.org/en-US/docs/Web/API/AbortController), [`srcset`](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/img#srcset), [`aria-live`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-live). Documentation-validated; **no timings**.

**Filter state belongs in the URL.** Every symptom of getting that wrong is user-visible — an
unshareable filtered view, a back button that leaves the page, a refresh that resets everything —
and every benefit of getting it right comes free from the platform.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The URL as the single source of truth](./01-url-as-state.md)** | 🔴 **The test for what is URL state** — would a user bookmark, share, or reach it with back?; reading and writing with `getAll`/`append` for **repeatable filters**, and 🔴 **omitting defaults** so two URLs never describe one view; `pushState` vs `replaceState` as the decision that makes the back button usable, with ⚠️ **the search box that turns back into a backspace**; 🔴 **the one-directional flow** — actions write the URL, rendering reads it, never both; offset vs cursor pagination as a **UI-driven** choice; and the details that get missed — resetting the page, validating everything, keeping secrets out |
| 2 | **[Rendering and the request](./02-rendering-and-the-request.md)** | The render as a pure function of the URL, and 🔴 **the two independent guards against out-of-order responses** — abort *and* compare the key, because aborting is a request to stop rather than a guarantee; superseded requests staying **silent** while timeouts do not; 🔴 **four states, not two** — and why a skeleton on every filter change is the common UX bug; `aria-live` and focus on pagination; the four image attributes and their four distinct jobs, including ⚠️ **lazy-loading the hero hurting LCP**; and prefetching the next page rather than preloading all of them |

## The three sentences to keep

1. **The URL is the state.** Actions write it; rendering reads it; never both from one handler.
2. **Abort the previous request *and* check the response's key** — out-of-order responses paint the
   wrong filters with nothing looking wrong.
3. **Refining is not first-load.** Dim the existing results instead of flashing a skeleton.

## Phase gate

You are done with this topic when you can put a full filter/sort/page state in the URL with
repeatable filters and no default noise, choose `push` versus `replace` per action and justify it,
and name both fixes for the out-of-order response.

## Where this connects

- [Phase 11 · 04 · `URL` and `URLSearchParams`](../../phase-11-network-storage/04-url-and-searchparams/README.md) — the API this is built on
- [Phase 11 · 03 · 05 · Timeouts and cancellation](../../phase-11-network-storage/03-fetch-wrapper/05-timeouts-and-cancellation.md) — `AbortSignal.any`, and telling abort from timeout
- [02 · Search with autocomplete](../02-search-autocomplete/README.md) — the same race, in its sharpest form
- [03 · A resilient API client](../03-resilient-api-client/README.md) — the client this grid calls

---

Start → [01 · The URL as the single source of truth](./01-url-as-state.md)
