---
name: progress-nextjs-ch9-script
description: devbible Next.js chapter 9 — the next/script topic (05, 05b, 05c, 05d) authored 2026-09-04, plus the chapter-close checklist that remains.
metadata:
  type: project
---

# Next.js ch9 · `next/script` — authored and committed

**2026-09-04, commit `e945eea4`.** The 43-line untouched stub
`docs/nextjs/pages/09-styling-and-ui/05-next-script-loading-strategies-for-third-party-scripts.md`
became **four chunks, 913 lines, 0 → 39 ★**, every claim off
[[research-nextjs-ch9-font-and-script]] — **no fetches of the Next.js docs were needed
or made.** The bank was spent, not re-derived.

| File | Lines | ★ | Owns |
|---|---:|---:|---|
| `05-…-strategies-for-third-party-scripts.md` (pos 5) | 256 | 11 | the four strategies, injection point, ordering, root-layout rule, once-per-document |
| `05b-onload-onready-onerror-and-the-client-component-boundary.md` (pos 10) | 300 | 9 | the three handlers, the Client Component rule, the `beforeInteractive` contradiction |
| `05c-inline-scripts-attribute-forwarding-and-where-the-tag-belongs.md` (pos 11) | 207 | 11 | inline `id`, injection safety, attribute forwarding / nonce, layout-vs-page scope |
| `05d-the-worker-strategy-partytown-and-what-to-use-instead.md` (pos 12) | 150 | 8 | `worker`, Partytown, version history, App Router alternatives |

## 🔴 What was written as explicitly uncertain, and must stay that way

- **The `beforeInteractive` + handler contradiction is stated, not resolved.** `onLoad` is
  forbidden with `beforeInteractive`; the docs suggest `onReady` instead; `onReady` needs a
  Client Component; `beforeInteractive` needs a root layout. The three sentences sit on one
  page and never meet. 05b gives the pattern that depends on none of it (no handlers on the
  `beforeInteractive` tag; a separate Client Component waits for the global). **Do not
  resolve this from memory.**
- **Breaking the root-layout placement rule has no documented consequence** — the docs say
  *must*, never what happens otherwise.
- **An unrecognised `strategy` value** has no documented behaviour.
- **Two `<Script>` tags naming the same `src`** — the once-per-visit guarantee covers
  navigation within a layout, not duplicate tags.
- **A forwarded `async`/`defer` alongside `strategy`** — interaction undefined.
- 🔴 **Partytown's own documentation could not be reached.** Three URLs attempted
  (`partytown.qwik.dev/how-does-it-work/`, without the slash, and
  `partytown.builder.io/how-does-it-work`) — two HTTP 404, one `ECONNREFUSED`. The
  mechanism by which worker-hosted code reaches the DOM is therefore **not stated on the
  page**, deliberately. If a later session wants it, that is a fresh fetch, not a recall.

## Facts worth reusing

- **`next/script`'s version history stops at `v13.0.0`** — no entry newer. The surface has
  not moved across the App Router's whole life, which is evidence *against* `worker`
  arriving.
- The docs' own nonce example is the literal `nonce="XUENAJFW"` — a placeholder that is a
  security bug if copied. 05c says so.
- **`id` is mandatory for inline scripts only**; external ones are keyed by `src`.
- The scope Next.js names today is **`@qwik.dev/partytown`**.

## Scope boundaries honoured

**ch10 owns CSP and SRI** (`10-…nonces…md`, `11-csp-without-nonces…md`) — 05c links out for
policy and covers only the forwarding mechanism. **ch12 owns structured data** — 05c links
out rather than teaching JSON-LD. **ch3 owns the RSC serialization boundary** — 05b links to
`03-composition-patterns-server-to-client-boundaries.md` for why a function prop cannot cross.

## Found, not fixed

- The cross-track link flagged in the previous wind-down,
  `../../../web-vitals-performance/pages/06-cls-optimization/01-preventing-cls.md`,
  **resolves on disk** — it was not a defect.

See [[progress-nextjs-ch9]] for the chapter-level record and [[devbible-locks]] for the cursor.
