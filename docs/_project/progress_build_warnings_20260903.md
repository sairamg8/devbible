---
name: progress-build-warnings-20260903
description: How devbible reached its first ZERO-warning deploy on 2026-09-03 — read the GitHub Actions log, not a local yarn build; 277 warnings to 0, and the THREE classes of broken link with their opposite fixes (class 3 added 2026-09-05: quoted upstream docs carry their own hrefs). Read before anyone tries to "fix the build warnings" again.
metadata:
  type: project
---

# Clearing devbible's build warnings from the GitHub log — 2026-09-03

Session `c246d8d8`, Java lock. The user's order was explicit about method:

> *"please fix all build warnings rather than running yarn build in local try to get a log of
> recent deployed build from github"*

## 🔴 How to get the log (this is the reusable part)

```bash
gh run list --limit 5
gh run view <run-id>                       # names the job id
gh run view --job=<job-id> --log > run.log # only when the job is COMPLETE
```

A job still in progress returns *"logs will be available when it is complete"* — the annotation
line (`gh run view <run-id>`) is available sooner and already carries the warning count.

The workflow writes the count itself: `.github/workflows/deploy.yml`'s **Report broken links** step
greps `build.log` for `couldn't be resolved|broken link|broken anchor` into `links.txt` and emits
`::warning::N unresolved link warning(s).`

⚠️ **`shared/scripts/devbible-linkcheck.py` disagrees with the build, and the build is right.**
It reported **345** broken where Docusaurus reported **158 unique pairs**. The extra are false
positives: a *slug-style* link like `../phase-9-api-crud/safe-dynamic-where/` resolves fine as a
route, because Docusaurus strips the `NN-` numeric prefix, but the file-path checker looks for a
directory literally named `safe-dynamic-where`. Use the checker for a fast pre-commit sweep of a
directory you are writing; use the deploy log for the truth.

## The result: 277 → 0

| | Before | After |
|---|---|---|
| unresolved link warnings | **277** | **0** |
| yarn `YN0002` peer warnings | 2 | **0** |
| Node 20 deprecation annotation | 1 | **0** |

✅ **Verified on run `33708242312` (build job `100502132951`): the job has NO annotations at all.**
No `[WARNING] Docusaurus found broken links!`, no `::warning::` emitted, no `YN0002`, no Node 20
line. That is the first zero-warning deploy this repo has had.

It took four pushes, in this order: the 174 de-links → the toolchain fixes → the 4 Java
trailing-slash links → the last one in `docs/README.md`.

⚠️ **`docs/README.md → ./nextjs/pages` had TWO bugs and the first hid the second.** It was a
trailing-slash link from a README (resolves a level too high), *and* `docs/nextjs/pages/` has no
`README.md`, so there is no index route to point at. Appending `README.md` would have produced a
link to a file that does not exist. It is plain bold instead. Re-link it if the Next.js session
ever adds `pages/README.md`.

⚠️ **Concurrency will cancel your verification run.** `deploy.yml` uses `concurrency: pages` with
`cancel-in-progress: false` — that protects a *running* job, but a *pending* one is cancelled when
a newer push queues behind it. With several sessions pushing to this checkout, check the newest
successful run whose SHA is a descendant of your commit rather than the run your own push started:

```bash
git merge-base --is-ancestor <your-sha> <run-head-sha>
```

## 🔴 There are THREE classes of broken link, and they need opposite fixes

**Class 1 — forward references (158 pairs, 174 instances).** Every single one pointed at a chunk
that has not been written yet, left by in-flight authoring in Java phases 12/14 and Python phase 1.
Not one was a typo or a moved file. The fix is AUTHOR-BRIEF rule 5 — **never link a file that does
not exist yet**:

```
[36 · The unknown outcome](07f-the-unknown-outcome.md)
->  **36 · The unknown outcome** *(not written yet)*
```

Applied mechanically across 93 files (156 in `docs/java`, 18 in `docs/python`, including the two
footer-chain `Next →` entries). Commit `74e8d2f7`.

🔴 **The de-link is only half the rule. RE-LINK when the chunk lands.** Done this session for
`01-the-average-that-lied.md → 12-the-checklist.md` the moment chunk 12 existed. This is the half
that gets forgotten and it is what turns a corpus into a set of dead bold phrases.

**Class 2 — trailing-slash directory links (4, all Java).** These targets all EXISTED:

```
[Phase 8 · Gradle](../../phase-8-build-dependencies/04-gradle/)
```

A trailing-slash link is resolved by Docusaurus as a **route**, and a route strips the numeric
prefix — so `.../04-gradle/` resolves to a path that never exists while the real route is
`.../gradle`. The fix is to make it file-relative: append `README.md`. That is exactly what
`shared/scripts/fixlinks.py` produces, and what every other Phase 8 reference in the same
directory already did. Commit `d8b2fdb6`. A sweep of `docs/java` for
`grep -rhoE '\]\((\.\./)+[^)]*/\)'` now returns zero.

## 🔴 Class 3 — a quoted doc brings its own hrefs with it (2026-09-05, 21 links)

Found 2026-09-05, session `ae47a09e`, on *"17 unresolved link warnings … two distinct defect
classes"*. **They were not two classes. They were one**, and seeing that is what makes the fix
mechanical instead of a judgement call per link.

The corpus quotes upstream docs verbatim in `> *"…"*` form, as rule 4 requires. **A verbatim quote
copies the source paragraph's markdown links too** — and those hrefs are written for the page they
came from:

| In the quote | Resolves here as | Actually is |
|---|---|---|
| `](/docs/app/glossary#rsc-payload)` | `devbible/docs/app/…` → 404 | a nextjs.org path |
| `](#setting-headers)` | an anchor on OUR page → 404 | a heading on nextjs.org's `proxy.js` |

🔴 **The bare-anchor half is the one that fools you.** It presents in the build log as a *broken
anchor* — a different warning from a *broken link* — so it reads like "this page names a heading it
does not have," and the tempting fix is to repoint it at a local heading. That is wrong. `#setting-
headers`, `#using-cookies`, `#negative-matching` (all on `proxy.js`),
`#optimistic-checks-with-proxy-optional` (the authentication guide) and `#data-access-layer` (the
Data Security guide) are headings on the **source** page. **The fix for both halves is identical:
make the whole thing absolute.**

```
](/docs/app/glossary#rsc-payload)   ->  ](https://nextjs.org/docs/app/glossary#rsc-payload)
](#setting-headers)                 ->  ](https://nextjs.org/docs/app/api-reference/file-conventions/proxy#setting-headers)
```

**Test for the class:** is the link inside a `> *"…"*` blockquote? Then it is not ours and it is
never local. Detector, and it must exclude the site's own tracks, which legitimately use
site-relative links (`/docs/nodejs/…`, `/docs/postgresql/…`):

```bash
grep -rn '](/docs/app/\|](/docs/pages/\|](/docs/messages/' docs/ --include=*.md
```

⚠️ **`grep 'href="…"'` against `build/` finds nothing even with `--no-minify`** — the HTML ships
attributes UNQUOTED (`href=https://…`). Match `href=[^ >]*` or you will "prove" your own fix failed.

### Verifying the target without a sandbox

`https://nextjs.org/docs/sitemap.md` is a semantic index of every docs path; a wrong path returns a
readable *"Page Not Found"* body that summarises like real content, so **grep the sitemap, do not
eyeball the fetch**. For an anchor, fetch the page as `.md` and match the heading:
`## rewrite()` → `#rewrite`, `### Client-side transitions` → `#client-side-transitions`. All 20
paths and 11 anchors checked this way; none had moved.

🔴 **The corpus already had ~1,400 absolute `nextjs.org/docs/app/…` links** doing this correctly —
78 to `guides/server-actions` alone. These 20 were the stragglers, not a new convention.

**The one genuine intra-site case in the same batch** was Java `17b`: `[the correction above]
(#the-correction)` — `## The correction` is in the *sibling* `17-the-god-service.md`. Fixed to
`17-the-god-service.md#the-correction` (prefix and `.md` kept, rule 5), and the prose changed from
"above" to "in 17", because a link that crosses a page boundary makes the words around it wrong too.

Eight commits, one per file: `5e7d257b` `2a924015` `96c9e3c3` `6fb8af94` `91b837c6` `e6d1b744`
`078ed6dc` `c8d58ebf`. Build after: **0 broken links, 0 broken anchors.**

⚠️ **A worktree has no `node_modules`** — `yarn build` dies on `findPackageLocation` before
compiling anything. `package.json` and `yarn.lock` were byte-identical to the main checkout, so
symlinking its tree was enough (an install would have been a second multi-GB copy). A plain
`yarn build` then OOM-killed (exit 137) on the shared 14 GB box;
`NODE_OPTIONS=--max-old-space-size=6144 DOCUSAURUS_SSG_WORKER_THREAD_COUNT=2 FAST_BUILD=true` with
`--no-minify` passed. **`FAST_BUILD` only drops the search theme — link and anchor checking are
unaffected**, so it is the right build for a link fix. Remove the symlink afterwards.


## The toolchain warnings (commit `a851d733`)

**Two `YN0002` peer warnings** from `yarn install --immutable` — `@docusaurus/theme-common`
(wanted by `@easyops-cn/docusaurus-search-local`) and `@types/react` (wanted by
`@docusaurus/core`). Both were already in the tree transitively, just never declared. Declared as
devDependencies at 3.10.2; adding `theme-common` surfaced a third (`@docusaurus/plugin-content-docs`)
so that was declared too. `yarn.lock` moved by **5 lines** — no resolution churn — and
`yarn install --immutable` still passes.

**The Node 20 annotation.** Bumped to the current majors, which run on Node 24 natively:
`checkout` v4→v7, `setup-node` v4→v7, `configure-pages` v5→v6, `upload-pages-artifact` v3→v5,
`deploy-pages` v4→v5. (`upload-artifact@v4` in the annotation came from inside
`upload-pages-artifact@v3`.)

**What is NOT ours and should not be chased:** the `DEP0040`/`DEP0169` node deprecations come from
inside `setup-node`'s own bundle, and the remaining `YN0086` is `@algolia/autocomplete-*` failing
to meet its own optional peers inside the `theme-search-algolia` subtree.

## The gate was deliberately NOT flipped

`deploy.yml`'s comment invites flipping the broken-link step to `exit 1` once the count is zero.
**Not done, on purpose:** several sessions author this checkout at once, and a gate turns one
in-flight forward reference into a failed deploy for everyone. Offer it to the user as its own
decision, do not do it as a side effect of a cleanup.

Related: [[java-board]], [[progress-java-p12-t08-metrics]], [[devbible-locks]].
