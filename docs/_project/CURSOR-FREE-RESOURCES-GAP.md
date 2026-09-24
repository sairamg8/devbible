---
name: cursor-free-resources-gap
description: START HERE to resume the free-resources gap research (begun 2026-09-14) — standing order, position, the next step by name, the 8 area briefs to re-launch, the synthesis plan and the helpers.
metadata:
  type: project
---

# 🔴 START HERE — free-resources gap research

**Standing order (2026-09-14):** [[devbible-feedback-hub-plus-delta]]. devbible becomes the one
place that gathers the best free resources (w3schools, MDN, official docs, the big free courses)
and **fills their gaps**, instead of re-explaining what they already teach well. PERN + MERN
first, then Java.

**Takes no track lock.** This lane is read-only research. It writes only to this store and to one
Artifact, never to `docs/`, `src/` or `instructions.md`.

## Position — PAUSED 2026-09-14 by the user

> *"Kill everything for now save the session progress"*

8 area agents were launched and stopped before any reported. **No results are banked.** Their
scratch (raw w3schools menus and page text, npm metadata) sat in `/tmp` and is gone. It
regenerates in one command with the helper below, so nothing needs salvaging.

## ▶ NEXT STEP, exactly

1. **Re-run the 8 area briefs below as ONE Workflow.** Ultracode was on, and the user was told
   this is the plan. Stages: fan out the 8 area agents, then **adversarially verify every
   ABSENT / gap claim** (3 skeptics each try to find a free resource that covers it; the claim
   survives if ≥2 fail), then a **completeness critic**, then synthesis. One Workflow at a time
   ([[feedback-one-workflow-at-a-time]]). Save progress the moment it is dispatched.
2. Write **`research_external_resources_gap_20260914.md`** in this folder. The feedback memory
   already links that name. Index it in `INDEX-meta.md`.
3. Build the **study-map Artifact** (plan below) and send the user the link.
4. Put the open decision to the user (below). Answer in chat **briefly** ([[devbible-feedback-answer-simply]]).

## Measured this session (still true on 2026-09-14; re-verify after a month)

- **w3schools has no tutorial (HTTP 404)** for: `docker`, `redis`, `nginx`, `expressjs`,
  `spring`, `systemdesign`, `tailwind`. devbible is the primary source for all of these.
- **w3schools Node.js = 133 pages in 19 sections.** It grew: V8, architecture and the event loop,
  plus pages on Express, middleware, REST API, API auth, security, testing, socket.io,
  websockets, logging, microservices and deployment. Judge their **depth** before calling any
  Node or Express topic ABSENT.
- **w3schools Angular = 50 pages.** Not yet checked whether it is AngularJS (1.x, EOL) or
  modern Angular.
- **Own-bug gap.** pern-taskflow logged 5 real bugs (`../pern-taskflow/gap_*.md`). The StrictMode
  double-refresh that sets off the app's own token-reuse detection is **not** on
  `docs/react/pages/phase-2-components/02-purity/03-strictmode-and-the-compiler.md`. The phrases
  "double refresh" and "competing redirect" have 0 hits in `docs/`. The user said **"No"** to
  folding these in for now, so they are held, not dropped. Offer them again only as part of the
  gap list.
- Earlier context that fits here: [[senior-roadmap-suggestions]] (2026-09-06, the ranked
  senior-path gaps that created the dsa and system-design tracks).

## The 8 area briefs

**Shared preamble (every agent gets it):**
- The goal as stated in the standing order.
- 🔴 READ-ONLY: no repo edits, no commits, no yarn. Scratch goes only in the session scratchpad.
- Never invent a URL or a devbible path. A failed fetch is reported as failed. Anything from
  memory is marked "(unverified)". Quotes from any site stay under 15 words.
- Run `graphify query` before grepping the repo.
- w3schools menus come **only** from `python3 <store>/devbible/tools-free-resources-gap/w3menu.py <dirs…>`.
  WebFetch summarises and truncates the 100+ link menus.
- Report devbible **file paths**. `route.py` converts them to URLs.

**Classes:**
- **EXT-BASICS**: a named free resource teaches it adequately. devbible adds only the delta:
  gotchas, internals, production, interview.
- **MENTION**: free resources only touch it. devbible needs a real explanation.
- **ABSENT**: no major free resource covers it well. devbible must own it.

**Return (6 sections, ≤ ~2,500 words):**
1. Resources surveyed: URL, coverage, depth, freshness problems with evidence.
2. Combined study sequence: stage, free page for basics, then the devbible file(s), then what
   devbible adds.
3. Gaps devbible can fill, ranked, each marked pending-in-syllabus or new, with a suggested home.
4. Pending topics classified: counts, plus ABSENT and MENTION listed by name.
5. Don't trust the external source here: evidence-backed items only.
6. Structural observations.

| # | Area | w3schools dirs | Other free resources to survey | devbible tracks · store file to grep |
|---|---|---|---|---|
| 1 | HTML + CSS + styling (a11y, forms, Sass, Tailwind) | `html css accessibility sass howto` | MDN Learn, web.dev Learn (CSS/HTML/A11y/Forms), fCC Responsive Web Design, Tailwind docs, CSS-Tricks guides | `docs/css` (80, done) · `progress_css_pages.md` · is there ANY HTML/a11y/forms/Tailwind page? |
| 2 | JavaScript + Web APIs (not DSA) | `js jsref` | MDN JS Guide + Web APIs, javascript.info, Eloquent JS, YDKJS, fCC JS, Odin JS | `docs/javascript` · **94 pending** · `progress_javascript_split_4way.md` |
| 3 | TS + React + ecosystem (router, TanStack, RTK, forms/zod, testing, Vite, Storybook, motion, perf, FE auth) | `typescript react` | TS Handbook, react.dev, Full Stack Open 1/2/5/6/7/9, React Router, TanStack Query, RTK, Testing Library, Playwright, Vite | `docs/typescript` (**46 pending**, `progress_typescript_build.md`), react, tanstack-query, redux-toolkit, vite, jest-rtl, playwright, storybook, framer-motion, frontend-architecture, web-vitals-performance, nextjs |
| 4 | Node + Express + API concerns (auth end-to-end, uploads, validation, security, logging, jobs, realtime, testing) | `nodejs` | nodejs.org/learn, expressjs.com guide + best practices, goldbergyoni/nodebestpractices, FSO 3–4, OWASP cheat sheets, fCC Back End, Odin NodeJS | `docs/nodejs`, `docs/expressjs` (both done), `docs/real-world` · `progress_express_master_depth_pass.md` · check jwt/bcrypt/multer/zod/helmet/passport/socket.io/bullmq/pino/supertest coverage |
| 5 | Data: SQL + Postgres + `pg`, Mongo + Mongoose, Redis, ORMs | `sql postgresql mongodb` (+ Node DB pages) | postgresql.org tutorial, neon.com/postgresql, node-postgres.com, use-the-index-luke, SQLBolt, MongoDB University + manual, Mongoose, Prisma, redis.io + Redis University | `docs/postgresql`, `docs/mongodb` (**48 pending**, `progress_mongodb_pages.md`), `docs/redis` (**74, 0 written**, `progress_redis_split_3way.md`), ORM (`CURSOR-A2-TOOLCHAIN.md`) |
| 6 | Shipping + curriculum structure: Git, Docker, Nginx, deploy, CI/CD, secrets, observability, capstone; track-level holes vs roadmap.sh / Odin / FSO / fCC | `git bash aws cybersecurity` | Pro Git, docs.docker.com, nginx.org guide, GitHub Actions, roadmap.sh (full-stack/backend/devops), Odin FSJS path, FSO all parts, fCC | `docs/git` (done), `docs/docker` (**129 pending**, `progress_docker_split_4way.md`), `docs/nginx` (`progress_nginx_build.md`), `docs/real-world` |
| 7 | Java fullstack (modern Java, Maven/Gradle, Spring Boot, JPA/jOOQ/Flyway, Security/OAuth2, testing, + React/Angular), framed for someone arriving from PERN/MERN | `java` | dev.java/learn, MOOC.fi Java, spring.io guides + Boot reference, Baeldung series, roadmap.sh java + spring-boot | `docs/java` (160/232, **72 pending**) · `JAVA-BOARD.md` |
| 8 | Interview layer: DSA (JS + Java), system design at fullstack scale | `dsa` | NeetCode roadmap, VisuAlgo, Tech Interview Handbook, trekhleb/javascript-algorithms, system-design-primer, roadmap.sh SD + DSA | `docs/dsa`, `docs/system-design` · `CURSOR-DSA-SYSTEM-DESIGN.md`, `BRIEF-sd-phase3-caching.md` |

## Synthesis plan — the study-map Artifact

- **Name** "devbible Study Map". **Palette and type roles** from `instructions.md` §8: pine accent
  `#0B6E5B` / `#55C3A3`, amber for gaps, cool neutrals, serif display, mono labels. Both themes.
- **Route:** the PERN route; the MERN route swaps only the data stage; then Java. DSA and system
  design sit alongside. Each step shows the free page for the basics, then the devbible pages,
  then one line on what devbible adds.
- **Other sections:**
  - how to use the two together: free page and its exercise, then devbible gotchas, then answer
    devbible's interview questions cold, then build the step in the storefront
  - the ranked gap list
  - per-track split of pending topics (EXT-BASICS / MENTION / ABSENT counts)
  - the don't-trust list
- **Checkboxes that persist:** declare the `artifact` capability. Use the **files form**
  `publish({"progress.js": …})` for a `progress.js` that the page loads with `<script src>`,
  debounced about 3 s. On `null`, `not_granted` or `capability_disabled`, fall back to
  localStorage and say "saved in this browser only".
- **devbible links:** `route.py`. `trailingSlash: false`; a README serves its directory with no
  trailing slash; tested 200 on the live site.

## 🔴 Open decision — the user's

`instructions.md` §5 says *"Not a summary, not a pointer to the official docs — the actual
explanation."* The new direction says link out for the basics. **Do not edit the brief, and do
not lighten or rewrite written pages**, until the user rules. Recommend changing §5 so it applies
to MENTION and ABSENT topics, and so EXT-BASICS topics link out and add the delta.

## Helpers — `tools-free-resources-gap/`

- `w3menu.py <dir> [<dir>…]` prints a w3schools tutorial's full left menu as `## section` /
  `- title | url` lines. It exits 1 if any tutorial 404s. It matches `id='leftmenuinnerinner'`
  with either quote style (the double-quote-only version found nothing).
- `route.py docs/<path> […]` turns a devbible file path into its live URL. It strips `NN-` per
  segment, applies `slug:` and `id:` front matter, and serves a README at its directory's route.
