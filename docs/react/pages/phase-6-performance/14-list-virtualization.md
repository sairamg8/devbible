---
title: "List virtualization"
sidebar_label: "14 · List virtualization"
sidebar_position: 14
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **react 19.2.8**.
> ⚠️ **React ships no virtualization API and react.dev documents none.** The only
> primary-source statement here is the
> [`useMemo`](https://react.dev/reference/react/useMemo) caveat, which refers to
> virtualized lists as something React *might* support **in the future** — that is
> the citation for "this is library territory, not React".
> Everything else on this page is reasoning from how the DOM and browsers work, and
> is marked as such rather than dressed up as documentation.
> No sandbox script backs this page.

**The point where every technique in topics 02–13 stops helping, because the cost
is no longer rendering — it is 10,000 DOM nodes existing.**

## Why memoization stops working

Memoization skips **re-rendering**. It does nothing about:

- constructing 10,000 elements on the **first** render
  (`useMemo` *"won't make the first render faster"*, [topic 03](03-usememo.md));
- the browser creating and laying out 10,000 DOM nodes;
- the memory they occupy;
- the layout and paint cost of a tree that large.

So a perfectly memoized list of 10,000 rows still has a slow first paint, high
memory, and janky scrolling. **Every row being `memo`'d is beside the point when the
problem is that all 10,000 exist.**

That is the signal: if the profile shows the *mount* is slow rather than updates,
and the row count is in the thousands, no amount of topics 02–13 will fix it.

## What virtualization does

Render only the rows in (or near) the viewport, and fake the rest with sized spacer
elements so the scrollbar behaves as if everything were there. Scrolling swaps which
rows exist.

**React does not provide this.** The `useMemo` reference is explicit that it is
hypothetical future work:

> in the future, React may add more features that take advantage of throwing away
> the cache — for example, **if React adds built-in support for virtualized lists in
> the future**, it would make sense to throw away the cache for items that scroll out
> of the virtualized table viewport.

So this is a library decision (TanStack Virtual, react-window, react-virtuoso and
others), and which one is a moving target this page deliberately does not pick.

## 🔴 What it costs you

The part most write-ups omit. Un-rendered rows are **not in the DOM**, and a
surprising amount of the web platform assumes the DOM is complete. These follow
directly from that fact:

**Find-in-page breaks.** `Ctrl`/`⌘`+`F` searches the DOM. Rows that are not rendered
cannot be found. For a long list of text this is a real capability the user silently
loses, and there is no way to restore it — the browser's find has no hook for it.

**Accessibility gets harder.** A screen reader announces list position from the DOM.
Virtualized rows need explicit `aria-setsize` and `aria-posinset` (and correct roles)
or the user is told the list has 20 items when it has 10,000. Good libraries help;
none of them do it for you by default.

**Scroll restoration becomes your problem.** Returning to a list at the right offset
depends on the content having a known height. With variable-height rows measured on
render, restoring position mid-list is genuinely difficult, and this is the most
common source of virtualization bugs in real applications.

**Variable heights are the hard case.** Fixed-height rows are easy. Rows that size
to their content must be measured after render, which means an initial guess and a
correction — visible as shifting content, and interacting badly with scroll
restoration.

**Printing and "select all" see only what is rendered.** So does anything that walks
the DOM, including some test tooling and browser extensions.

**Anchors and deep links to a row need explicit support**, because the target may not
exist yet when the browser tries to scroll to it.

## Try these first

Virtualization is a large, permanent complexity increase. In order of preference:

1. **Do not show 10,000 rows.** Pagination, or an infinite list with a sensible cap,
   is often the honest answer — a user cannot meaningfully use 10,000 rows at once,
   and this keeps find-in-page, accessibility and scroll restoration working.
2. **Filter or search server-side**, so the client receives tens of rows rather than
   thousands.
3. **Simplify the row.** A row with six nested components and a chart costs far more
   than one with three elements. Halving row cost can move the practical ceiling
   from 2,000 to 5,000.
4. **CSS `content-visibility: auto`** lets the browser skip rendering work for
   off-screen elements while keeping them in the DOM — so find-in-page and
   accessibility survive. ⚠️ This is a CSS platform feature, not React; check
   current browser support before relying on it, and note it does not reduce the
   node count or memory.
5. **Then virtualize**, if the list genuinely must be long and interactive.

## If you do virtualize

- **Keys still come from your data**, not the index
  ([Phase 3 · 14](../phase-3-state/14-state-in-lists.md)). Virtualization makes rows
  mount and unmount constantly, so index keys corrupt row state aggressively rather
  than occasionally.
- **`memo` the row component.** This is one of the cases where it clearly earns its
  place: rows re-render often with the same props, and there are many of them
  ([topic 02](02-memo.md)).
- **Keep row state out of the row** where possible. An unmounted row loses its state,
  and in a virtualized list "unmounted" means "scrolled past".
- **Test with a screen reader and with find-in-page.** Both are things you have
  removed by default and must deliberately restore or accept.

## Gotchas

**Symptom:** every row is memoized and the list is still slow.
**Cause:** the cost is the number of DOM nodes, not re-rendering.
**Fix:** reduce the count — pagination, server-side filtering, or virtualization.

**Symptom:** users report that `Ctrl+F` no longer finds things.
**Cause:** un-rendered rows are not in the DOM.
**Fix:** there is no fix while virtualizing. Decide whether that trade is acceptable
before adopting it — for a document-like list it usually is not.

**Symptom:** a screen reader announces the wrong list length.
**Cause:** only the rendered window is in the DOM.
**Fix:** `aria-setsize` and `aria-posinset` on rows with the true totals.

**Symptom:** returning to a list lands at the wrong scroll position.
**Cause:** variable row heights, so the total height was estimated and corrected.
**Fix:** fixed heights if possible; otherwise persist a measured offset and accept
imperfection.

**Symptom:** row state is lost while scrolling.
**Cause:** scrolled-away rows unmount.
**Fix:** hold that state above the list, keyed by item id.

**Symptom:** virtualization was added to a 200-row list.
**Cause:** reaching for it by reputation rather than measurement.
**Fix:** 200 rows is not the problem. Profile first
([topic 05](05-measure-before-you-optimise.md)).

## Interview questions

**★ Why does memoization stop helping at large list sizes?**
Because memoization skips re-rendering, and at that scale the cost is not
re-rendering — it is constructing thousands of elements on the first render, and the
browser creating, laying out and holding thousands of DOM nodes. `useMemo`
explicitly does not make the first render faster. A perfectly memoized 10,000-row
list still has a slow mount, high memory and janky scrolling.

**★ What does virtualization cost you?**
Everything that assumes the DOM is complete. Find-in-page cannot find un-rendered
rows and there is no way to restore it. Screen readers report the wrong list size
unless you supply `aria-setsize` and `aria-posinset`. Scroll restoration becomes hard
with variable row heights, which is the most common source of bugs. Printing, select
all, and anything that walks the DOM see only the rendered window.

**★ What would you try before virtualizing?**
Not showing 10,000 rows — pagination or a capped infinite list, which keeps
find-in-page and accessibility working. Filtering server-side so the client receives
tens of rows. Simplifying the row, since halving its cost moves the practical
ceiling substantially. And `content-visibility: auto`, which lets the browser skip
off-screen rendering work while keeping the nodes in the DOM — though it does not
reduce node count or memory.

**Does React provide virtualization?**
No. The only mention in the documentation is the `useMemo` caveat speculating that
**if** React adds built-in support for virtualized lists in future, it would make
sense to discard cached values for items scrolled out of view. Today it is library
territory.

**What changes about keys in a virtualized list?**
Nothing about the rule, but a lot about the consequences. Keys must still come from
your data, and index keys become far more damaging: virtualized rows mount and
unmount constantly as you scroll, so state attached to a position rather than an item
gets corrupted aggressively rather than in rare reorder cases.

---

← Prev: [Moving state down and lifting content up](13-moving-state-down.md) · Index: [Phase 6](README.md) · Next → [Expensive initial mount](15-expensive-initial-mount.md)
