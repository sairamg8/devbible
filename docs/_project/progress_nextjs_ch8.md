---
name: progress-nextjs-ch8
description: Record of the Next.js chapter 08 close (state management in an RSC world) — 57 pages from 7 stubs in one session with four parallel author forks, the four-fork pattern's measured limits, and the findings worth spending in ch10, ch15 and ch18.
metadata:
  type: project
---

# Next.js ch08 · State management in an RSC world — CLOSED 2026-09-05

**Session `989fb824`. 57 files, 13,373 lines, 704 ★, positions 0–56 gap-free.**
From **2 written pages + 7 stubs + 1 generated index** to a closed chapter in one session.
Six of the seven stubs were byte-identical generated boilerplate (`8b8a0880`, 104 lines each,
every copy carrying the *whole chapter's* outline); the seventh was 27 lines.

Per-topic commits: `03cac2cb` (01, 5pp) · `ddb06f81` (02, 5pp) · `b7d212d9` (05, 6pp) ·
`aa0eb250` (06, 7pp) · topic 07 (12pp) · topic 03 (12pp) · `04101078` (04, 7pp) ·
`1d8259a0` (the close). `progress.js` n:8 is now `topics: 57, pages: 57`.

| topic | pages | lines | ★ |
|---|---:|---:|---:|
| 01 · the fundamental split | 5 | 1,254 | 60 |
| 02 · when RSC data flow is enough | 5 | 1,070 | 53 |
| 03 · URL as state | 12 | 2,995 | 158 |
| 04 · client state tools compared | 7 | 1,718 | 99 |
| 05 · TanStack / RTK Query | 6 | 1,479 | 51 |
| 06 · useOptimistic / useActionState | 7 | 1,587 | 68 |
| 07 · SprintDesk milestone | 12 | 2,744 | 179 |

## 🔴 The four-fork pattern, and what it actually cost

Coordinator + **four** `devbible-author` forks, one per topic group, **disjoint files and disjoint
`sidebar_position` ranges** (A 1–2/100–119 · B 3–4/120–139 · C 5–6/140–159 · D 7/160–179).
**Zero position collisions, zero file collisions, zero bare `{/* FOOTER */}` markers** — all three
forks that reported were explicitly told the marker is not an acceptable hand-off, and all three
wired their own two-way footers instead. That is the first chapter in this track where the
coordinator had **no** footer markers to resolve.

**Twenty-two splits across the chapter, every one proven UP.** The largest: topic 03 split eight
times (`03` 359L→`03`+`03b`, then six more down the chain); topic 07 three times; topic 04 twice;
topic 06 four times. Nothing was trimmed to fit.

🔴 **What the pattern does NOT prevent, and it fired again: half-footers at the fork seams.**
`02e` (fork A's last page) had no `Next →` and `07` (fork D's first) had no `←`, because at write
time the neighbouring fork's files did not exist. **A one-directional footer is a valid link, so
the cap, MDX, link and `{/* FOOTER */}` checks all pass it.** The close must explicitly diff each
seam. Detection that works:

```python
tail = '\n'.join(open(f).read().strip().split('\n')[-2:])
if not ('←' in tail and 'Next →' in tail): flag(f)   # interior pages only
```

🔴 **Forward references cost nothing when the brief names the exact filename.** Seventeen
`*(not written yet)*` plain-bold placeholders were left across five files; every target existed by
close, and a keyword→filename map repointed all 17 mechanically in one pass. Contrast ch14, where
three such placeholders survived the close undetected because nothing greps them.

⚠️ **A naive link checker flags computed method access inside a code fence.** `router[mode](href,
{ scroll: false })` reads as a markdown link to a regex. I called it a defect before checking the
fence — **look at the line before reporting it**.

## Findings to spend elsewhere, not re-derive

🔴 **`/docs/app/guides/interactive-apps` (`lastUpdated: 2026-08-25`) is a guide this track had
never used** and it is the best source in the docs for the `useActionState` + `useOptimistic`
patterns. It carries the post-`await` transition trap, the `key`-increment form reset, and the
pending-list split. **ch10 (forms and auth) should start there.**

🔴 **`revalidateTag` under a stale-while-revalidate profile ships no re-render in the action
response.** Confirmed again from primary source; it is the root cause of every "my optimistic
update snapped back" symptom and belongs in ch10's mutation pages.

🔴 **`revalidateTag` silently no-ops above 256 characters** — *"A tag that exceeds the limit is
never assigned to cached data, so revalidating it does nothing."* Any page teaching composite tag
keys should say so.

🔴 **react.dev renamed `useActionState`'s first parameter to `reducerAction`** and now documents
`(previousState, formData)` as the `<form action>` case specifically. Any corpus page teaching the
old parameter name is drifting.

🔴 **Reading published `.d.ts` from a CDN is a legitimate T1 probe** when the package is not
installed locally. It settled a question that would otherwise have been hedged: TanStack's docs on
`main` show `queryClient.query()` / `environmentManager.isServer()`, which read as unreleased v6
API — the published 5.102.8 declarations prove both already ship.

⚠️ **`useSearchParams` works in dev and fails in prod** — *"In development, routes are rendered
on-demand, so `useSearchParams` doesn't suspend and things may appear to work without `Suspense`."*

## Pins added this session (Job 2 of the topic skill)

`zustand` **5.0.15** (nextjs, react) · `jotai` **2.20.3** (nextjs, react) · `nuqs` **2.10.1**
(nextjs) — all three were taught with **no pin at all**. `@tanstack/react-query` **5.102.8** and
`@reduxjs/toolkit` **2.12.0** had `pin: null` and no `nextjs` track; both now have both.
Bank: [[research-nextjs-ch8-state-management]].

## Found, not fixed

- **`_category_.json` still uses `generated-index`** rather than pointing at `01-explanation.md`,
  so the chapter's real overview is not the sidebar's category link. **ch07 is identical**, so this
  is a track-wide convention, not a ch08 defect — fixing one chapter alone would diverge it. Goes
  on the same owed list as the `"N. Label"` labels.
- **SprintDesk path drift inside this chapter:** `10-refresh.md` uses `app/[tenant]/board/…`
  while ch07's milestone and all twelve ch08 milestone pages use
  `app/(dashboard)/boards/[boardId]/…`. One editing pass, not touched here.
- Forks wrote scratch drafts as **dotfiles inside `docs/`** (`.draft.md`, `.draft2.md`). Docusaurus
  ignores them and they were cleaned up, but the session scratchpad is the right place.
- The session scratchpad is **shared across forks**, not per-fork; each fork saw the others' fetch
  dumps. Harmless here, but a fork should not assume a file there is its own.
