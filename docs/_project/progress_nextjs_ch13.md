---
name: progress-nextjs-ch13
description: Chapter 13 (testing and developer experience) of the Next.js devbible track — CLOSED 2026-09-04 at 20 of 20 pages; the fork-B split proof, the Turborepo and zod pins it forced, and the six corrections the chapter carries.
metadata:
  type: project
---

# Next.js ch13 · Testing and developer experience

**✅ CLOSED 2026-09-04, session `9348b38e`** (commits `30f5d5d1` salvage, `2f4adee0` fork B,
`3240a1b2` close). Resume cursor: [[cursor-nextjs]]. This file is the record.

## Where it stands — CLOSED

**20 of 20 pages, renumbered gap-free 0–19. 4,557 lines, 336 ★.**

Two waves, both from `devbible-author` forks, both QC'd and committed by the coordinator:

| wave | commit | what landed |
|---|---|---|
| salvage of the `833778c4` fork | `30f5d5d1` | stubs `01`/`02` → `01`+`01b`, `02`+`02b`. **980 lines, 84 ★** |
| fork B, session `9348b38e` | `2f4adee0` | stubs `03`/`04`/`05` → 11 pages. **146 → 2,730 lines, 0 → 189 ★** |

**Split proof (fork B):** before 3 files / 146 lines / **0** ★; after 11 files / **2,730** lines /
**189** ★. Both totals UP, nothing trimmed. All three stubs body-hashed identically to `2f927f9c`
— generated boilerplate, rewritten rather than mined.

Reading order at close: 1–4 runners and Playwright · 5–9 type safety · 10–13 Turborepo ·
14–17 the supplementary pages (`instant()` helper, instant in CI, TypeScript 7, linting) ·
18–19 the milestone. The four supplementary pages sit **before** the milestone deliberately, so
the milestone assembles what precedes it.

`src/data/progress.js` ch13 row: `topics: 20, pages: 20`, `pagesPlanned` dropped.

## 🔴 The footer count — 15 markers, and only a grep finds them

At the close the directory carried **15** bare `{/* FOOTER */}` markers: 11 from fork B and 4
from the salvage. A bare marker is a valid MDX comment with no link to resolve, so **the cap
check, the MDX check and the link check all pass a page with no navigation at all.** This is the
same defect that shipped 1,241 Java pages unwired. Fork B counted its own and reported them,
which is the behaviour to keep asking forks for.

## 🔴 Two pins this chapter forced — [[feedback-library-needs-a-pin]]

- **`turbo` added** to `src/data/pins.js`: `2.10.12`, `tracks: ['nextjs']`,
  `names: ['turborepo','turbo']`. Turborepo is taught across four pages and a monorepo
  reference implementation cannot be built without it, so it clears the library-scope bar.
- **`zod` gained the `nextjs` track.** It listed `['nodejs','expressjs','real-world']` while 18+
  pages under `docs/nextjs/pages` name it and five bold **4.4.3** — invisible to the currency
  scan. Exactly the defect fixed for `real-world` on 2026-09-03, recurring on a new track.
  🔴 **When a track starts teaching a pinned library, the pin's `tracks` array is part of the
  change.** Nothing detects the omission; the scan simply reports nothing.

## Verification notes worth not re-deriving

- **`zod.validate()`** is documented on zod.dev but a T1 probe shows `z.validate` and
  `schema.validate` are both `undefined` on the pinned **4.4.3**. Written as a 4.5 addition
  explicitly absent from the pin, with `safeParse` used throughout.
- **No primary source states a coverage percentage.** Coverage is taught as a *ratchet*
  (`thresholds.autoUpdate`, per-glob floors, `perFile`) and every number is marked illustrative
  of the mechanism rather than a target. The chapter index repeats the warning.
- **`turbo.json`'s `$schema` URL** appears in no example on the configuring-tasks page — dropped
  rather than guessed. The `pipeline` → `tasks` rename is **undated** in the docs, so the pages
  say "`tasks` is the current key" with no version claim.
- ⚠️ **`turborepo.com` now 301s to `turborepo.dev`.** The research bank
  `research_nextjs_ch13_testing_dx.md` cites `.com` paths throughout; the pages cite `.dev` and
  say so on their `> Verified:` lines. **Fix the bank's URLs on the next pass.**
- **`skipLibCheck`** is attributed to "the shape the Next.js docs themselves show", not to
  `create-next-app`, because only the docs' own `tsconfig.json` example evidences it.

## The six corrections the chapter carries

Each is on the page that owns it, with a verbatim source:

1. `next build` no longer lints — **`next lint` was removed in 16**, so an upgraded project
   silently stops linting until ESLint or Biome is wired up directly.
2. `strict: true` is nine checks, and **`noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`
   are not among them** — the two that catch what unit tests were going to catch.
3. `Schema.parse(process.env)` is **the documented non-starter**: *"dynamic lookups will not be
   inlined"*.
4. `transpilePackages` advice is largely retired — **Turbopack transpiles workspace packages
   automatically in 16**.
5. Do not read the build table from a script — 16 removed `size` and `First Load JS`; assert the
   observable property with `instant()` instead.
6. A Server Action unit test **bypasses the whole request path** — CSRF check, body size limit,
   encrypted action ids and closures, serialization, and the router refresh.

## Related

[[cursor-nextjs]] · [[progress-nextjs-ch14]] · [[devbible-locks]] ·
research bank `research_nextjs_ch13_testing_dx.md` (committed in this store as `385d5d8`)
