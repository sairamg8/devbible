---
name: devbible-docusaurus-faster-and-build-memory
description: Why devbible builds crawled at 16% — swap thrashing, not CPU — and that @docusaurus/faster was installed but never enabled; the option is `faster`, NOT `experimental_faster`, in 3.10.2.
metadata:
  type: project
---

# devbible builds: `faster` was never on, and the machine was swapping

Found 2026-09-05, diagnosing a `yarn search:index` that sat near 16% on the server
compile "forever" while the client reached 100%.

## 1. The stall was MEMORY, not the bundler

The machine has **14 GB RAM and 8 cores**. At the time: 13 GB used, **20 GB of 27 GB swap
in use**, ~1 GB available, swapping ~200 MB/s. Three Docusaurus processes were live at
once — two builds in the main checkout plus a `docusaurus start --port 3100` in the
`.claude/worktrees/ui-redesign` worktree, 2.8–3.0 GB each.

`ensure-search-index.mjs` asks for an **8 GB heap** (`--max-old-space-size=8192`). With
1 GB of real RAM every allocation is a disk write. Client compile finishes because it
completes before memory runs out; the server compile does not.

🔴 **This is exactly what hard rule 12 (the build/dev-server registry) exists to prevent.**
The worktree dev server is the one that gets forgotten — it is in a different directory, so
it does not look like it belongs to this checkout. Check with:

```bash
ps -eo pid,rss,etime,args --sort=-rss | grep -i docusaurus | grep -v grep
free -h        # want `available` ~9-10 Gi before starting, not 1 Gi
```

With the competitors killed, SSG ran at **~62 pages/sec** and all 6,761 pages generated in
about two minutes.

## 2. `@docusaurus/faster` was a dependency but never switched on

`@docusaurus/faster@3.10.2` had been in `package.json` since setup, and no faster flag
appeared anywhere in `docusaurus.config.js`. So 6,797 markdown files compiled through
**webpack + Babel** while the Rust toolchain sat unused in `node_modules`.

Now `future: {v4: true, faster: true}` — nine flags: swcJsLoader, swcJsMinimizer,
swcHtmlMinimizer, lightningCssMinimizer, mdxCrossCompilerCache, rspackBundler,
rspackPersistentCache, ssgWorkerThreads, gitEagerVcs.

⚠️ **The key is `faster`, NOT `experimental_faster`.** Docusaurus 3.10.2 renamed it and
**throws at config load** on the old name. That failure presents as a *crashed build* —
nothing is written, no generated files, no partial output — so it is easy to misread as a
bundler incompatibility. It is not; it is a one-word config error.

**Verify a config change without starting a build** (there is a standing order against
local `yarn build`, and a build takes ~15 minutes here):

```bash
node -e "require('./node_modules/@docusaurus/core/lib/server/config.js')
  .loadSiteConfig({siteDir:process.cwd()})
  .then(r=>console.log('OK', JSON.stringify(r.siteConfig.future.faster)))
  .catch(e=>{console.log('FAILED:', e.message); process.exit(1)})"
```

## 3. 🔴 The SSG tuning in package.json had been doing NOTHING

`ssgExecutor.js:139` spawns SSG workers **only when `faster.ssgWorkerThreads` is on**. So
`DOCUSAURUS_SSG_WORKER_THREAD_COUNT=4` and
`DOCUSAURUS_SSG_WORKER_THREAD_RECYCLER_MAX_MEMORY` — set in `yarn build` and in
`scripts/ensure-search-index.mjs`, under a comment claiming the two are kept "in step" —
were read by nothing at all until `faster` was enabled. The comment was true about intent
and false about effect for as long as it existed.

`ssgWorkerThreads` requires `v4.removeLegacyPostBuildHeadAttribute`, which `v4: true`
already sets (`configValidation.js:81`).

## 4. What the index actually costs now

The 2026-08-17 snapshot covered 2,895 pages and never included **java, nextjs, python or
angular** — 3,315 markdown files with no search index at all. First build to include them:

| track | index size |
|---|---|
| java | **110 MB** |
| nextjs | 45 MB |
| python | 21 MB |
| angular | 308 KB |

⚠️ **`search-index-docs-java.json` at 110 MB is over GitHub's 100 MB per-file hard block.**
It does not bite on the current deploy path — `deploy.yml` uploads a Pages artifact and
`static/search-index*.json` is gitignored, never committed — but the vestigial
`yarn deploy` (`docusaurus deploy`, which commits to gh-pages) would now fail on it. This
is the same wall the 2026-08-17 per-technology split was built to avoid, re-emerging
*inside one technology*. Splitting java below the technology level is the eventual fix.

Related: [[devbible-search-scoping-decision]] · [[session-build-devserver-registry]]
