---
name: progress-nextjs-ch12
description: Chapter 12 (SEO, metadata, accessibility) of the Next.js devbible track — CLOSED 2026-09-04 at 59 of 59 pages; the four fork-A split proofs, the htmlLimitedBots list settled from source, the generateSitemaps docs bug, and seven claims written as unasserted.
metadata:
  type: project
---

# Next.js ch12 · SEO, metadata and accessibility

**✅ CLOSED 2026-09-04, session `9348b38e`** (commits `f6c8e047` salvage, `c953bb49` fork A,
`38b26eab` close). Resume cursor: [[cursor-nextjs]]. This file is the record.

## Where it stands — CLOSED

**59 of 59 pages, renumbered gap-free 0–58. 13,818 lines, 521 ★.** The largest chapter in the
track.

| wave | commit | what landed |
|---|---|---|
| salvage of the `833778c4` fork | `f6c8e047` | stub `01` → `01` + `01b`–`01f`. **1,484 lines, 70 ★** |
| fork A, session `9348b38e` | `c953bb49` | stubs `02`–`06` → 24 pages. **287 → 5,378 lines, 0 → 367 ★** |

Reading order at close: metadata 1–7 · social and structured data 8–13 · crawlers and i18n
14–17 · **accessibility 18–24** · auditing and the milestone 25–30 · the 28-page Progressive Web
Apps series 31–58. The ch16 shape: milestone after the material it assembles, large
supplementary block last.

`src/data/progress.js` ch12 row: `topics: 59, pages: 59`. The planned 35 became 59 because six
topics split on concept boundaries — **accessibility alone went from zero pages to seven.**

## 🔴 Four splits, each proven UP

| Split | Before | After |
|---|---|---|
| `02` → `02` + `02b` | 302 L / 16 ★ | 439 L / 24 ★ |
| `04` → `04` + `04b` | 321 L / 20 ★ | 461 L / 30 ★ |
| `04e` → `04e` + `04f` | 337 L / 20 ★ | 383 L / 26 ★ |
| `06` → `06` + `06b` | 377 L / 0 ★ | 482 L / 29 ★ (+ `06c` fresh, 224 L / 15 ★) |

`02c`–`02f`, `04c`, `04d` and `04g` are planned concept-boundary chunks, not overflow.

## 🔴 Two findings from primary source, not inference

**1 · The default `htmlLimitedBots` list is SETTLED.** The research bank's §11.4 had it as an
open question. Read from framework source at tag **`v16.3.4`** (identical at `canary`): the list
contains `facebookexternalhit`, `Twitterbot`, `Slackbot`, `Discordbot`, `LinkedInBot`,
`WhatsApp` — **and `Chrome-Lighthouse`.** The consequence is worth carrying: **a Lighthouse run
can never reproduce a streaming-metadata problem**, because Lighthouse always receives blocking
metadata. Anyone debugging a broken unfurl with Lighthouse is looking at the one client
guaranteed not to show it.

**2 · A documentation bug in the `generateSitemaps` reference.** Its own example does
`const start = id * 50000` after `const id = await props.id`, while 16.0's version history says
`id` is *"a promise that resolves to a `string`"*. **The documented example does not typecheck.**
Written up in `03c` with `Number(await props.id)` as the fix.

## Seven claims written as explicitly unasserted, never guessed

1. **X/Twitter card behaviour** — `docs.x.com` returns **404** on the documented Cards path.
   Nothing is asserted about X's rendering, cache duration or Card Validator; `02b`'s
   `> Verified:` line carries the exclusion and `02f` has a *"what is not asserted here"* section.
2. **Whether `eslint-config-next@16.3` still bundles `eslint-plugin-jsx-a11y`** — the
   architecture page (dated `2024-11-06`) says yes, the current ESLint reference does not list
   it, and `next` is not installed to probe. `04` and `04g` call it unresolved and pivot to what
   *is* settled: `next lint` was removed in 16 and `next build` no longer lints, so nothing runs
   those rules regardless.
3. **Whether the Next.js route announcer moves focus** — the docs describe announcement only.
   Treated as the application's responsibility, with the caution that moving focus on every
   navigation can cut the announcer off.
4. **`next/root-params` inside `sitemap.ts`** — root params are unsupported in Route Handlers and
   metadata files *are* Route Handlers, but no page states the combination. `03d` flags the
   inference, asserts no failure mode, and gives the safe design (enumerate locales explicitly).
5. **Google's canonicalization strength** — not fetched; `05b` asserts only the sourced
   `noindex`-needs-a-crawlable-page rule.
6. **A bare `site` key beside `siteId`** — the reference shows only `siteId`/`creatorId`.
7. **`serialize-javascript`'s escape set** — initially enumerated, then corrected to "its own
   documentation's business".

⚠️ **A mid-write correction worth the space:** the JSON-LD escape had been mangled to a bare `<`
in three places in `02c` **and in the research bank**. All now read `<`, matching the doc's
verbatim `JSON.stringify(jsonLd).replace(/</g, '\\u003c')`. A wrong escape in a bank propagates
to every page written from it.

## 🔴 The placeholder chain, and why it worked

The salvage created four `*(not written yet)*` placeholders because the recovered prose named
three files that did not exist. The exact filenames were handed to fork A in its brief; it wrote
them under those names; the close repointed all four to live links. **That is the pattern for a
forward reference into unwritten work** — a plain-bold placeholder keeps the build green, and the
filename in the brief is what makes the repoint mechanical instead of archaeological.

30 bare `{/* FOOTER */}` markers were resolved at the close (24 fork A, 6 salvage).

## Research bank

`research_nextjs_ch12_seo_metadata_a11y.md` — 317 → **649 lines**, committed to this store as
`380d6d0`. It had **never been committed** by the previous fork; it was untracked on disk and
would have died with the checkout.

## Related

[[cursor-nextjs]] · [[progress-nextjs-ch13]] · [[progress-nextjs-ch14]] · [[devbible-locks]]
