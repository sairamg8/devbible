---
name: progress-nextjs-ch10
description: Record of the Next.js chapter 10 close (forms, authentication, security hardening) — 46 pages from 6 stubs with four parallel forks, seven library pins including bcrypt, and the cross-fork overlap that was kept rather than cut.
metadata:
  type: project
---

# Next.js ch10 · Forms, authentication and security hardening — CLOSED 2026-09-05

**Session `989fb824`, `fc4ff758`. 46 files · 10,804 lines · 631 ★ · positions 0–45 gap-free.**
From **6 written pages + 6 stubs + 1 generated index**. Second chapter closed by this session.

| topic | pages | lines | ★ |
|---|---:|---:|---:|
| 01 · Server Actions as an untrusted entry point | 5 | 1,269 | 35 |
| 02 · boundary validation (from an **empty-bodied** stub) | 5 | 1,238 | 45 |
| 03 · authentication patterns | 9 | 2,280 | 149 |
| 04 · `proxy.ts` as a coarse filter | 4 | 936 | 51 |
| 05 · RSC serialization hardening | 3 | 682 | 39 |
| 06 · SprintDesk auth milestone | 13 | 2,818 | 204 |

Whole-chapter QC: 0 over cap · 0 duplicate positions · 0 gaps · 0 dangling · **0 bare
`{/* FOOTER */}` · 0 half footers** · 0 MDX hazards with raw-tag detection ON.

## 🔴 The chapter's spine, in one documented sentence

> *"By default, when a Server Action is created and exported, it is reachable via a direct POST
> request, not just through your application's UI."*

Everything else follows: *"Render-time gating … is not a security boundary"*, the DAL as the place
the check lives, and *"The majority of security checks should be performed as close as possible to
your data source."*

🔴 **The highest-value find, and it is new to this corpus** — from the `proxy.js` reference
(`lastUpdated: 2026-08-25`):

> *"Server Functions are not separate routes in this chain. They are handled as POST requests to
> the route where they are used, so a Proxy matcher that excludes a path will also skip Server
> Function calls on that path. A matcher change or a refactor that moves a Server Function to a
> different route can silently remove Proxy coverage."*

🔴 **A layout is not a boundary**: *"Route segments and parallel route slots are rendered by the
router, so a layout that hides or swaps them does not stop them from running or from appearing in
the RSC Payload."* The SPA habit of returning `null` from a layout is documented **not recommended**.

## Seven pins — this closes the corpus's oldest pin gap

**`bcrypt` 6.0.0 finally pinned.** It had been taught across **32 pages with no pin at all**; tracks
were set from an actual grep of what teaches it (`nextjs, nodejs, javascript, expressjs,
real-world`), not guessed. ⚠️ **helmet (23 pages), multer (14) and passport (12) are still unpinned.**

🔴 **`next-auth` is `policy: 'major', cycle: '5'`, deliberately, and the distinction is
load-bearing:** npm `latest` resolves to **4.24.15** while the chapter teaches **5.0.0-beta.32**.
A `latest` policy would have reported these nine pages stale forever and then been ignored when
they actually went stale. **When a track adopts a library that is pre-stable, the pin's *policy* is
part of the change, not just its version.**

Also added: `react-hook-form` 7.87.0 · `jose` 6.2.11 · `@clerk/nextjs` 7.9.1 ·
`@supabase/supabase-js` 2.115.0 · `prisma` 7.10.0.
⚠️ **Handed to the currency lane: the zod pin has drifted** — corpus 4.4.3, npm latest 4.5.4.

## The cross-fork overlap was KEPT, not cut — and why

Three forks reached the same boundary from different directions and all three said so in their
reports. **Read before deciding**, and the decision was to keep all three with reciprocal links:

| pages | angle |
|---|---|
| `01c` `01d` `01e` | the **action surface** — what an endpoint accepts and returns |
| `03h` `03i` | **authorization** — who the caller is |
| `05b` `05c` | **serialization** — what the render exposes |

🔴 **Fork A deliberately did NOT link the others**, because their filenames could still change
mid-write and a dangling link breaks the build for every session in a shared checkout. That was the
right call and it is the pattern to repeat: **forks leave the cross-links to the coordinator, who
adds them once names are settled.** The coordinator added `01`→`03b`/`03h`/`05c` and
`01e`→`03i`/`04d` under a `## Where this is also covered` heading.

## A real bug found in the docs' own snippet, fixed beyond this chapter

The Next.js optimistic-proxy example uses `protectedRoutes.includes(path)` — **exact string
equality**, so `['/dashboard']` does **not** protect `/dashboard/billing`. It had been copied into
**ch02's closed page `07b`**; fixed there with prefix matching anchored on a `/` (so
`/dashboard-public` is not swept in) plus a note. 🔴 **A defect in a snippet propagates wherever the
snippet was copied — grep the corpus for the code, not for the topic.**

## Process notes worth reusing

🔴 **Position numbers are not filename prefixes.** Fork C began naming siblings `140-…`, `141-…`
from its `sidebar_position` range. A `140-` prefix sorts as **topic 140** and would have landed
those pages at the end of the chapter, after the CVE record — and every mechanical check passes it,
because it is a valid filename with a valid position. Caught mid-flight by messaging the live fork;
it renamed to `04b`/`04c` and repointed hrefs **and visible link text**. **Say "`<topic><letter>-`"
explicitly in the brief.**

🔴 **A fork found and fixed two raw control bytes** that a `Write` had put inside a regex in its own
pages. Nothing in the QC gate looks for `[\x00-\x1f]`; it is now in this session's checker.

**CVE discipline held.** Page 14 owns the corpus CVE record; forks were forbidden from stating any
identifier, severity or range not from it or a fetched advisory. `cve.org` returned an empty JS
shell, so fork C used the GitHub Advisory API and said so on its `> Verified:` line, and wrote
*"the advisory does not state the exploitation technique … and this page does not reconstruct one."*

Banks: [[research-nextjs-ch10-actions-and-validation]] ·
[[research-nextjs-ch10-proxy-and-rsc-serialization]].

## Found, not fixed

- `_category_.json` still `generated-index` with a `"10. Label"` label — track-wide convention,
  same as ch07 and ch08; fixing one chapter alone would diverge it.
- The **Auth.js → Better Auth** repositioning is observable (site banner, footer, a migration nav
  entry) but its maintenance implications are **not stated**, so no page characterises it.
- Claims deliberately left uncertain: whether closure encryption is authenticated against
  tampering · `Host` vs `X-Forwarded-Host` precedence · whether a thrown action message is redacted
  when you catch it yourself · Client Router Cache state after a sign-out redirect · magic-link
  token single-use semantics · `cache()` semantics outside a render.
