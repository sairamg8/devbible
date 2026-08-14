---
title: "01.1 · The URL as the single source of truth"
sidebar_label: "01 · URL as state"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`URLSearchParams`](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams), [`History.pushState()`](https://developer.mozilla.org/en-US/docs/Web/API/History/pushState), [`History.replaceState()`](https://developer.mozilla.org/en-US/docs/Web/API/History/replaceState), [`popstate` event](https://developer.mozilla.org/en-US/docs/Web/API/Window/popstate_event), [`Location`](https://developer.mozilla.org/en-US/docs/Web/API/Location). Documentation-validated; **no timings**.

**Filter state belongs in the URL, not in a component.** Every symptom of getting this wrong is a
user-visible bug: a filtered view that cannot be shared, a back button that leaves the page,
a refresh that resets everything, and a "copy link" that sends someone the unfiltered list.

## The rule

🔴 **If a user would expect to bookmark it, share it, or reach it with the back button, it is URL
state.** That covers filters, sort order, page number, search terms and an open detail panel.
Everything else — a hover state, an unsaved form draft, whether a dropdown is open — is component
state.

```
/products?category=shoes&size=42&sort=price-asc&page=3
```

Three properties fall out of that one line, and none of them need code:

- **Shareable** — the link reproduces the exact view.
- **Restorable** — refresh, and the state is still there.
- **Navigable** — back and forward move through filter changes, because that is what the history
  API is.

## Reading and writing

```js
function readState() {
  const params = new URLSearchParams(location.search);
  return {
    category: params.get("category") ?? null,
    sizes: params.getAll("size").map(Number),          // 🔴 getAll — repeatable
    sort: params.get("sort") ?? "relevance",
    page: Number(params.get("page") ?? 1),
  };
}

function writeState(next, { replace = false } = {}) {
  const params = new URLSearchParams();
  if (next.category) params.set("category", next.category);
  for (const size of next.sizes) params.append("size", String(size));   // 🔴 append
  if (next.sort !== "relevance") params.set("sort", next.sort);         // omit defaults
  if (next.page > 1) params.set("page", String(next.page));

  const url = `${location.pathname}${params.size ? `?${params}` : ""}`;
  history[replace ? "replaceState" : "pushState"]({}, "", url);
}
```

Four decisions in that code, and each is a real one:

- 🔴 **`getAll`/`append` for multi-select filters.** A size filter is repeatable —
  `?size=41&size=42` — and `get`/`set` silently keep only one. Encoding them as `size=41,42`
  instead works but re-introduces the separator-collision problem
  ([Phase 11 · 04 · 02](../../phase-11-network-storage/04-url-and-searchparams/02-urlsearchparams.md)).
- 🔴 **Omit defaults.** `?sort=relevance&page=1` is noise, and worse, it means two URLs describe the
  same view — which breaks caching, analytics and any "is this the default view?" check. **Build
  the params from scratch each time** rather than mutating the existing ones, or removed filters
  linger.
- **Read with a fallback, always.** The URL is user-editable input:
  `?page=abc` must not produce `NaN`.
- **`pushState` versus `replaceState`** — the next section.

## `pushState` or `replaceState`

🔴 **This is the decision that makes the back button usable or infuriating**, and the rule is
about how the user perceives the action:

| Action | Use | Why |
|---|---|---|
| Applying a filter | **`pushState`** | back should undo it |
| Changing the page | **`pushState`** | back should return to the previous page |
| Typing in a search box | **`replaceState`** | otherwise back steps through every keystroke |
| Sorting | `pushState` | it is a deliberate action |
| Restoring scroll or a transient panel | **`replaceState`** | not a navigation |

⚠️ **A search input with `pushState` per keystroke is the classic failure.** Ten characters typed
means ten history entries, and the back button becomes a slow backspace. Replace while typing, and
push once the search is committed.

**Neither triggers a page load, and neither fires `popstate`** — that event fires only for
*user-initiated* navigation, which is exactly the split you want:

```js
window.addEventListener("popstate", () => {
  render(readState());                 // the user pressed back/forward
});
```

🔴 **So the flow is one-directional: an action writes to the URL, and rendering reads from the
URL.** Never update both a component's state and the URL from the same handler — that is two
sources of truth and they will diverge. Write the URL; let the read path do the rest.

## Pagination

```
?page=3&perPage=24
```

**Offset pagination is what a URL wants** — a page number is meaningful, linkable and lets a user
jump. Its costs are real and worth naming:

- ⚠️ **Rows shift.** If an item is inserted while the user is on page 1, page 2 begins with an item
  they already saw. On a fast-changing list this is visible.
- ⚠️ **Deep offsets are expensive server-side** — the database still walks the skipped rows.

**Cursor pagination** (`?after=<opaque>`) is stable and cheap and **cannot express "page 5"**, so
it suits infinite scroll rather than a numbered grid. 🔴 **The choice follows the UI, not the other
way round** — a numbered pager needs offsets; an infinite feed wants cursors.

## The details that get missed

⚠️ **Reset the page when a filter changes.** Applying a filter while on page 7 of a result set that
now has two pages shows an empty grid. `page` is derived from the filters, so any filter change
resets it to 1.

⚠️ **Validate everything on read.** `?page=-1`, `?page=99999`, `?sort=drop-table` all arrive.
Clamp the page to the available range and check the sort key against an allowlist — a sort key
interpolated into a query is an injection vector on the server side.

⚠️ **Do not put secrets or ids the user should not enumerate in the URL.** It is in history, in
the referrer header, and in server logs.

## Gotchas

**Symptom:** A shared link shows the unfiltered list
**Cause:** Filter state lives in a component.
**Fix:** The URL is the source of truth.

**Symptom:** The back button leaves the page instead of undoing a filter
**Cause:** Filters changed without `pushState`.
**Fix:** Push on deliberate actions.

**Symptom:** The back button steps through every keystroke
**Cause:** `pushState` on each input event.
**Fix:** `replaceState` while typing; push once on commit.

**Symptom:** Only one value of a multi-select filter survives
**Cause:** `set` instead of `append`, or `get` instead of `getAll`.
**Fix:** The repeatable-key API.

**Symptom:** Removed filters stay in the URL
**Cause:** The existing params were mutated rather than rebuilt.
**Fix:** Build a fresh `URLSearchParams` from the state each time.

**Symptom:** Two URLs render the same view
**Cause:** Defaults are written explicitly.
**Fix:** Omit them.

**Symptom:** Applying a filter shows an empty grid
**Cause:** The page number was kept.
**Fix:** Reset to page 1 whenever the filters change.

**Symptom:** `?page=abc` breaks the grid
**Cause:** Unvalidated URL input.
**Fix:** Parse with a fallback and clamp to range.

**Symptom:** Page 2 repeats an item from page 1
**Cause:** Offset pagination over a list that changed.
**Fix:** Expected — cursors if stability matters more than page numbers.

## Interview questions

**★ Where should a product grid's filter state live, and why?**
In the URL. It makes the view shareable, restorable across a refresh, and navigable with the back
button — three user-visible behaviours you would otherwise have to build. The test is: would a
user expect to bookmark or share it?

**★ `pushState` or `replaceState` for a search box?**
`replaceState` while typing — otherwise ten characters means ten history entries and back becomes a
backspace — and `pushState` once the search is committed. The rule is whether the user would
consider the action a navigation.

**★ How do you represent a multi-select filter?**
Repeated keys — `?size=41&size=42` — with `append` and `getAll`. `set`/`get` silently keep one.
Comma-joining works but reintroduces separator collisions.

**★ Why omit default values from the URL?**
Because two URLs would then describe the same view, which breaks caching, analytics and
"is this the default?" checks. Build the params fresh from state each render rather than mutating,
so removed filters actually disappear.

**★ What must you do when a filter changes?**
Reset the page to 1 — page is derived from the filter set, and keeping it shows an empty grid when
the new result set is shorter.

**★ Offset or cursor pagination?**
Follow the UI. A numbered pager needs offsets and accepts that rows shift when the list changes and
that deep offsets are expensive. An infinite feed wants cursors, which are stable and cheap and
cannot express "page 5".

**What must you validate when reading the URL?**
Everything — it is user-editable. Parse numbers with a fallback, clamp the page to the available
range, and check the sort key against an allowlist, because it typically reaches a database query.

---

[Topic index](./README.md) · Next → [02 · Rendering and the request](./02-rendering-and-the-request.md)
