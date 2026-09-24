---
name: progress-nextjs-ch7-boundary-hierarchy
description: Next.js ch7 2026-09-04 — the error.js component-hierarchy rule relocated from ch17 into ch7, 10b split into 10c + 10d, and an S1 correction to page 10's reset/retry claim. Open on ch7, error boundaries, global-error, or "which file catches a layout error".
metadata:
  type: project
---

# Next.js chapter 7 — the boundary hierarchy, 2026-09-04 (session `bf92d5b6`)

Child of [[progress-nextjs-import]]. **That file's ch17 START HERE still stands** — this
session did not touch ch17 and did not move the track cursor.

## What this session did

| | |
|---|---|
| **Task** | A user-supplied brief: the `error.js` component-hierarchy rule was stated nowhere in ch7 |
| **Result** | `10b` (at exactly 300 lines) split into **`10c`** + **`10d`** — **300 → 776 lines, 10 → 21 ★** |
| **Also** | An S1 correction to page `10`, found while sourcing the new pages |
| **Commits** | `47dba6a1` split · `afa0497d` page-10 fix · `eac907ae` board row |
| **ch7 now** | 16 files, **8 with `> Verified:`** — `progress.js` row 14/6/14 → **16/8/16** |

## The rule that was missing, verbatim

From the [`error.js` reference](https://nextjs.org/docs/app/api-reference/file-conventions/error)
(page metadata: **version 16.3.4, lastUpdated 2026-07-10**):

> *"In the component hierarchy, `error.js` wraps `loading.js`, `not-found.js`, `page.js`, and
> nested `layout.js` files in a React error boundary. It does not wrap the `layout.js` or
> `template.js` above it in the same segment. To handle errors in the root layout, use
> `global-error.js`."*

🔴 **The corpus's old wording (ch17) was incomplete in two ways** and the brief was right to
flag both: it **omitted `template.js`**, and it did not say that `error.js` **does** wrap
**nested** `layout.js` files — only the same-segment layout above it is excluded. "Error
boundaries don't catch layouts" is the wrong summary and was the one in circulation.

## Decisions and why

- **Split, not extend.** `10b` was at exactly 300. Its footer line was rewritten in place to
  carry both Previous and Next on one line, so `10b` stayed at 300 rather than gaining a line
  and breaching the cap. Byte-unchanged otherwise.
- **Two new files, not one.** The first draft was a single `10c` at **351 lines**. The concept
  boundary was already in the argument — *where a boundary sits* (hierarchy) versus *what
  `global-error` does not inherit* (isolation) — so it became `10c` + `10d` rather than a trim.
  The cap hook caught the 351 and the split was made on that boundary.
- **`sidebar_position` shifted, filenames untouched.** Position 12 was taken by
  `11-auth-interrupts-…`, so 11/11b/12/12b moved **12–15 → 14–17** and 10c/10d took 12/13.
  Only frontmatter changed, so **no inbound link in the corpus moved**.
- **ch17 left alone deliberately** — see the open item below.

## 🔴 The S1 found in passing: page 10 contradicted the primary source

`10-custom-error-boundaries-with-catcherror.md` asserted *"Destructuring `reset` today gives
you `undefined`"* and called `retry` a **rename**. The reference documents `reset` as a live
prop:

> *"In most cases, you should use `retry()` instead. However, if you have a specific reason to
> clear the error state and re-render the error boundary's children without re-fetching the
> contents, you can use the `reset()` function."*

**The real failure mode is worse than the one the page taught.** A boundary copied from
pre-16.3 material does not give a dead button — it gives a **working button that re-renders the
same failed server output**, because `reset()` does not refetch. Corrected in four places
(description, red callout, gotcha, interview answer) and stamped `> Validated:` under the
intact `> Verified:` line, scoped to the prop claims only.

**The lesson worth keeping:** the page's claim was *directionally* right (use `retry`) and
factually wrong about the mechanism, which is exactly the shape a mechanical check cannot see.
It had shipped in a page whose own `> Verified:` line named the right source.

## Other facts banked from the same fetch — do not re-fetch

- **`global-error` inherits nothing.** Verbatim: *"`global-error` and the built-in 500 page
  render their own document and do not include your global styles, so an app-level theme toggle
  (a class or `data-theme` attribute) won't reach them. The default UI follows the OS color
  scheme."* The **built-in 500 page is inside that rule too**, so even an app with no
  `global-error.js` has an unthemeable crash path.
- Global error UI must define its own `<html>`/`<body>` tags **"global styles, fonts, or other
  dependencies"** — the fonts/styles half is the part usually dropped.
- **No `metadata`/`generateMetadata` in `global-error.jsx`** (it is a Client Component) — use
  React's `<title>` component instead.
- **Version History:** `v16.3.0` `retry` stable · `v16.2.0` `unstable_retry` added · **`v15.2.0`
  also display `global-error` in development** · `v13.1.0` `global-error` introduced ·
  `v13.0.0` `error` introduced. 🔴 The 15.2.0 row explains why global error pages ship
  unlooked-at: before it, local testing showed the dev overlay and never your own UI.
- Props are `error` (with `digest`) and `retry`; a Server Component error's `message` is
  replaced by a generic one in production, matched to server logs via `error.digest`.

## Open items — found, NOT fixed

1. 🔴 **ch17's `01-explanation.md` was never rewritten.** The brief said it had become a chapter
   index with a one-line pointer left behind; **on disk it is still the 143-line off-topic
   page**, and its `### Error Boundary Hierarchy: error.tsx vs global-error.tsx` section still
   states the rule in the weaker form. Not touched because **a sibling session was live in
   ch17** during this session (two files modified with a 2-minute-old mtime, reverted minutes
   later). Whoever does that rewrite should point at
   `07-…/10c-where-boundaries-sit-in-the-hierarchy.md`, not restate the rule.
2. **Eight ch7 pages carry no tier badge and no `> Verified:` line** — `01-explanation.md` and
   `01`–`07`, the imported stubs. They also all teach the pre-16.3 `reset` prop in their code
   samples. That is the chapter's remaining authoring work.
3. **ch7 `sidebar_position` has pre-existing gaps at 8 and 9** (0–7, then 10–17). Harmless to
   rendering; left as found rather than renumbering a chapter this session does not own.
4. ⚠️ **`progress_nextjs_import.md` is 1,175 lines — 4× the 300-line memory cap.** That is why
   this record is a child file. It is a genuine candidate for the split the cap rule prescribes.

## Traps confirmed this session

- **A bare `awk 'END{}'` with no file argument hangs on stdin** and burned a 2-minute tool
  timeout mid-QC. Guard every QC one-liner with an explicit file list.
- **`git diff --stat` showing changes that vanish a minute later** is a sibling session mid-write
  in a shared checkout, not corruption. Re-check before concluding anything about salvage.

---

**Resume:** nothing owed in ch7 beyond open item 2. The track cursor in
[[progress-nextjs-import]] is unchanged and still points at ch17.
