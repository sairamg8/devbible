---
name: devbible-search-chunk-b
description: devbible chunk B — local offline search via @easyops-cn/docusaurus-search-local. Measured baseline vs search build, config decisions, and the traps found.
metadata:
  type: project
---

# devbible · chunk B — local offline search

**Session `f49e21d6`, 2026-08-17.** Brief:
[project_react_patterns_and_search_split.md](project_react_patterns_and_search_split.md)
(chunk B section). Chunk A — the React patterns hub — is a **different session** and owns
`docs/react/`; this chunk never touches anything under `docs/`.

**Scope, and it held:** `docusaurus.config.js`, `package.json`, `yarn.lock`. Nothing else.

---

## What was decided, and why

| Question | Answer |
|---|---|
| Which search | `@easyops-cn/docusaurus-search-local` **0.55.3** — no Algolia, no API key, no crawler, no external service |
| Registered as | a **theme**, not a plugin — it swizzles the navbar search box in |
| Where the index is built | the **postBuild hook**, so it exists only after `yarn build` |

### The config that landed

Registered in a new `themes:` array in `docusaurus.config.js`, after `presets`:

- `hashed: true` — content-hashed index filename, so a rebuilt index is never served
  from cache next to freshly rebuilt pages.
- `docsRouteBasePath: '/docs'` — ⚠️ **spelled out deliberately.** The site's preset uses
  `routeBasePath: '/docs'`, and the plugin's default happens to be the same string. Left
  implicit, the two drift apart silently, and **a mismatch indexes nothing rather than
  failing loudly**.
- `indexBlog: false` — the preset sets `blog: false`. The plugin's default is `true`, so
  leaving it would make it look for a `/blog` route that does not exist.
- `indexPages: false` — `src/pages` is the homepage language picker, navigation rather
  than reference material.
- `explicitSearchResultPath: true` + `highlightSearchTermsOnTargetPage: true` — these two
  earn their keep **because of this corpus specifically**: ~2,900 pages across 15+
  technologies where the same headings (*Gotchas*, *Interview questions*) recur in
  hundreds of places. The path disambiguates otherwise identical hits.
- `language: ['en']`.

---

## 🔴 Findings that are worth not re-deriving

**1. `require.resolve` DOES work in this ESM config.** `docusaurus.config.js` uses
`import`/`export default` and `package.json` has no `"type": "module"`, so it is fair to
expect `require` to be undefined. It is not — Docusaurus 3 loads the config through
**jiti**, which injects `require`. Verified by the build loading the config and reaching
client bundling. Do not "fix" this into a bare string on the assumption it is broken.

**2. `open-ask-ai` is an OPTIONAL peer dependency of 0.55.x.** It shows up in
`peerDependencies` and looks like the plugin is dragging an AI service in. It is not —
`peerDependenciesMeta.open-ask-ai.optional === true`, and nothing installs it. **0.54.1
and earlier do not list it at all**, so there is no reason to pin backwards to avoid it.

**3. `@docusaurus/faster` is INSTALLED BUT NOT ENABLED.** The brief flagged a possible
conflict with faster mode (rspack/SWC). There is none to have: `package.json` has
`@docusaurus/faster@3.10.2`, but `docusaurus.config.js` has only `future: {v4: true}` and
**no `experimental_faster` key anywhere**. The dependency is dead weight in this repo
today. ⚠️ **Not touched** — enabling or removing it is a separate decision that affects
every session's build, and nobody asked for it.

**4. Yarn warns `doesn't provide @docusaurus/theme-common`.** Expected and harmless:
`theme-common` is a transitive dep of `preset-classic`, not a direct one, and the plugin
declares it as a peer. It resolves fine from the hoisted `node_modules`.

**5. Install cost is real: +1,226 packages, +302 MiB.** Mostly `@node-rs/jieba` (the
Chinese tokenizer, which ships prebuilt native binaries for every platform) and swc.
`language: ['en']` does not stop jieba being *installed*, only from being *used*.

---

## Measurements — both builds actually run, isolated, row claimed

Isolated per hard rule 12: `DOCUSAURUS_GENERATED_FILES_DIR_NAME=.docusaurus-search`,
separate `--out-dir`. The registry row in
[shared/session_build_devserver_registry.md](../shared/session_build_devserver_registry.md)
was claimed **and committed** before the first build.

| | Baseline (no search) | With search |
|---|---|---|
| Wall time | **201.43 s** | *(see below)* |
| Peak RSS | **6.59 GB** (6,913,440 KB) | *(see below)* |
| Output size | **206 MB** | *(see below)* |
| HTML pages | **2,886** | — |
| Result | `[SUCCESS]` | — |

> ⚠️ **This table is filled in from `/usr/bin/time` output, never estimated.** If a cell
> is missing, the run did not happen — do not reconstruct it (global rule 3).

### Pre-existing broken links — NOT mine, do not fix

The baseline build reported **4 broken links, all in `docs/real-world/`**, which belongs
to session `08ab5390`:

```
/devbible/docs/real-world/pages/phase-4-react-ui/usedebounce-and-search
  -> ../../../react/pages/phase-7-custom-hooks/06-designing-a-hooks-api.md
/devbible/docs/real-world/pages/phase-2-node-services/outbox-relay-and-email
  -> ../../phase-0-the-app/02-architecture-and-data-model.md
```

They are in the **baseline**, so search did not cause them. Left alone per the
one-language rule.

---

## 🔴 Rule-12 violation found on the machine, 2026-08-17

The registry said 🟢 **nothing running**. `ps` said otherwise: **an unclaimed
`yarn start` dev server**, PID 14165, started 06:14, holding **3.38 GB RSS**. Whoever
started it never claimed the row.

Combined with this session's 6.59 GB build peak, the machine sat at **391 MB free of
15 GB**. This is exactly the exhaustion rule 12 exists to prevent, and it only did not
bite because 35 GB of swap absorbed it.

⚠️ **Left running — it is not this session's process to kill.** Reported to the user
instead.

---

## 🔴 The index was too big, and the fix is a per-technology split

**Measured, not estimated: one whole-site index is 94.7 MB (99,336,447 bytes), 24.5 MB
gzipped**, built from 22.9 MB of source markdown across 2,909 files — a ~4.1× expansion,
which is normal for lunr (it stores positions and content for previews).

Two separate problems, and the second is a hard deadline:

1. Every visitor downloads 24.5 MB before their first result.
2. 🔴 **`package.json` has `"deploy": "docusaurus deploy"`, which COMMITS the built site
   to a `gh-pages` branch — and GitHub hard-blocks any file over 100 MB.** At 94.7 MB
   that is **95% of the ceiling**, on a corpus several sessions grow every day.

**User's decision (2026-08-17): split per technology.**

```js
searchContextByPaths: searchContexts,        // ['docs/babel', 'docs/react', ...]
useAllContextsWithNoSearchContext: false,    // ⚠️ MUST stay false — see below
```

The context list is **derived from `fs.readdirSync('docs')` at config load**, not
hard-coded, so a technology added by any session gets its own index without anyone
editing the config.

### ⚠️ `useAllContextsWithNoSearchContext` must stay FALSE, and the reason is in the source

From `dist/server/server/utils/postBuildFactory.js`:

```js
if (matchedPaths.length > 0 && !useAllContextsWithNoSearchContext) {
    continue;                      // skip the root push
}
rootAllDocs[docIndex].push(doc);   // otherwise the doc goes in the ROOT index too
```

Turning it ON adds **every** document to the root index **as well as** its context index.
The root index becomes the full 94.7 MB again — **back over the GitHub limit** — with
total output roughly doubled. It defeats the entire split.

🔴 **The cost, stated honestly:** there is **no single search spanning all technologies at
once**. The search box gets a **context switcher** instead. An earlier note promising
root-level cross-technology search was wrong and is corrected here.

### Path format — the plugin's own rule

Contexts are matched against the route with `baseUrl` stripped:
`uri === path || uri.startsWith(path + '/')`. With `baseUrl: '/devbible/'` a route
`/devbible/docs/react/pages/x` gives `uri = docs/react/pages/x`, so the context string is
**`docs/react`** — no baseUrl, no leading slash.

---

## Search under `yarn start` — the user asked for it, and it works

**Instruction, 2026-08-17:** *"when i start the server search should also work
automatically rather i need to start another server for it"*.

The plugin indexes in **postBuild** by parsing generated HTML with cheerio, so the dev
server has no index and shows a search box that finds nothing. That is documented
behaviour, not a fault.

**The fix:** the client fetches `<baseUrl>search-index{context}.json`, and Docusaurus
serves `static/` at `<baseUrl>` in dev exactly as in a build. An index generated once and
copied into `static/` is served at the URL the client already requests.

🔴 **This only works because `hashed: true` puts the hash in the QUERY STRING and leaves
the filename alone.** Confirmed in `generate.js`:

```js
let searchIndexFilename = "search-index{dir}.json";
if (indexHash) {
  if (config.hashed === "filename") searchIndexFilename = `search-index{dir}-${indexHash}.json`;
  else searchIndexQuery = `?_=${indexHash}`;
}
```

`hashed: "filename"` would orphan the static copy on every rebuild. The query string is
ignored when serving a static file, so a stale hash costs nothing.

**Wiring, all in `package.json` + one script:**

| Script | What it does |
|---|---|
| `yarn start` | runs `scripts/ensure-search-index.mjs`, then the dev server. **Instant** if an index exists; generates one automatically the first time. |
| `yarn search:index` | `--force` regenerate (~4 min full build) |
| `yarn start:no-search` | the old plain `docusaurus start`, kept as an escape hatch |

**Freshness is a deliberate trade** (user chose it): the static copy is a snapshot, so
pages written after it was generated are not findable until `yarn search:index` is re-run.
The alternative was a ~4 minute build before every single `yarn start`.

⚠️ **`static/search-index*.json` is gitignored** — it is build output, and committing a
94.7 MB file would break the `gh-pages` push outright. The `.gitignore` edit is the one
change outside the brief's stated three-file scope; it is required by the dev-search
instruction and is flagged rather than slipped in.

---

## ✅ Title search — verified, it was already working

**Instruction:** *"Make sure i can able to seatch with titles"*.

The index has a dedicated **titles context: 2,890 page titles**, and exact matches rank
first. Verified by running real lunr queries against the built index:

| Query | Top title hit |
|---|---|
| `inner join` | **INNER JOIN** — `/docs/postgresql/pages/phase-5-joins/inner-join` |
| `render props` | **Render props and function-as-children** — `/docs/react/pages/phase-2-components/render-props` |
| `hydration` | **Hydration mismatches** — `/docs/react/pages/phase-11-ssr-hydration/hydration-mismatches` |
| `token bucket` | **15.1 · The token bucket** — `/docs/javascript/pages/phase-17-machine-coding/rate-limiter/the-token-bucket` |

⚠️ **A zero-hit result in the HEADINGS index is not a bug.** `useEffect` returns 0 there
while returning 252 in content and 1 in titles — because the headings genuinely read
*"Effect ordering"*, *"An effect has its own lifecycle"*. Do not chase it.

---

## ✅ Final measured result — three builds, all run, all isolated

| | Baseline (no search) | One whole-site index | **Split per technology (shipped)** |
|---|---|---|---|
| Wall time | 201.43 s | 249.37 s | **256.73 s** |
| Peak RSS | 6.59 GB | 7.95 GB | **8.02 GB** |
| Index files | — | 1 | **26** |
| Largest single file | — | **94.7 MB** (95% of GitHub's 100 MB limit) | **25 MB** (25%) |
| A React reader downloads | — | 94.7 MB / 24.5 MB gzip | **12 MB / 3.0 MB gzip** |
| Root index | — | — | **256 KB** |

Search costs **+55 s (+27%)** on build time over the baseline. Broken links were **4
before and 4 after** — all pre-existing in `docs/real-world/`.

Largest indexes: javascript 25 MB · postgresql 13 MB · react 12 MB · docker 9.4 MB ·
nodejs 8.4 MB · expressjs 5.8 MB · typescript 4.9 MB. Everything else under 4 MB.

**Verified three ways, no claim rests on a guess:**
1. Full isolated build → `[SUCCESS]`.
2. Real lunr queries against the generated index (titles, headings and content all
   return correct hits at correct URLs).
3. A dev server on port 3999 returning **HTTP 200** for both
   `/devbible/search-index.json` (258,249 bytes) and
   `/devbible/search-index-docs-react.json` (12,516,894 bytes) — proving the
   `yarn start` path works, not just that the files exist.

## Files this chunk owns — final

`docusaurus.config.js` · `package.json` · `yarn.lock` · `.gitignore` ·
`scripts/ensure-search-index.mjs`. Two commits: `1894fa9b` (plugin + config) and
`27186028` (split + dev-server search).

⚠️ **`.gitignore` and `scripts/` are outside the brief's stated three-file scope.** Both
are required by the *"search must work when I start the server"* instruction, and both are
flagged rather than slipped in. Nothing under `docs/` was touched.

⚠️ **Chunk A was mid-write in the SHARED git index while this landed** — 18 staged renames
under `docs/react/pages/patterns/` (`01-headless-components` → `06-headless-components`,
etc.), staged by the other session. **Committed with an explicit pathspec
(`git commit -- <my paths>`) so their staged work was neither committed nor reset.** This
is the shared-checkout hazard rule 10 warns about, and a plain `git commit` would have
swept their in-progress rename into this commit.

---

## 🔴🔴 MDX TRAP that broke the GitHub Pages deploy — every session needs this

**2026-08-17.** `main` was pushed (70 commits, many from other sessions) and the **Deploy
to GitHub Pages workflow FAILED at the Build step** — 12 MDX compilation errors, **all in
`docs/react/pages/patterns/`** (chunk A's). **Zero were search-related.**

**The cause, reproduced minimally rather than guessed:**

```js
compile('**Bold.** `return\n{ isOpen: true }` — rest.')  // FAIL: Could not parse expression with acorn
compile('**Bold.** `return { isOpen: true }` — rest.')   // OK
```

🔴 **An inline code span that WRAPS ACROSS A LINE BREAK, where the continuation line
begins with `{`, breaks the MDX build.** MDX's expression scanner treats that `{` as the
start of a JSX expression before the code span is resolved. CommonMark says the span is
legal; MDX disagrees, and MDX is what builds the site.

The offending text in
`docs/react/pages/patterns/08-state-reducer/01-the-problem-and-the-shape.md`:

```markdown
**A caller who returns a partial object destroys the rest of the state.** `return
{ isOpen: true }` — without spreading `changes` — leaves `selectedItem`
```

**The fix is to keep the code span on one line** (or reflow so no continuation line starts
with `{`). ⚠️ **It is invisible to a link check and to `wc -l`** — only a real build or an
MDX compile catches it, which is exactly the class of defect hard rule 12 makes expensive
to find.

⚠️ **Left unfixed — and this is the corrected position.** `docs/react/pages/patterns/`
belongs to **chunk A**, and rule 11 says a build failure you did not cause is another
session's to fix.

🔴 **What actually happened, recorded because the mistake is instructive.** The user said
*"fix the 12 files and push again"*, I began reflowing the two remaining files, and the
user stopped me mid-edit — *"Wait"* ×3, then **"The react patterns are chunk a"**. Both
edits were **reverted** (`git checkout --`, after diffing to confirm the changes were only
mine and none of chunk A's uncommitted work would be lost). `docs/react/` now has nothing
of this session in it.

**The lesson: an instruction to fix another chunk's files does not dissolve the chunk
boundary.** The one-language rule was right the first time, and the correct move was to
report the diagnosis and let chunk A apply it — which is what happened in the end.

**By the numbers, unattended:** the original **12 failures dropped to 2 on their own**
because chunk A fixed ten of them in commits made after the push. A third instance flagged
by the Real World session (`ab508775`),
`docs/storybook/pages/phase-3-decorators/03-providers-in-decorators.md`, **now compiles
clean** — also fixed by someone else. The two `08-state-reducer` chunks were still failing
at the time of writing.

### 🔴 The cheap check — use THIS version, the naive one lies

No build required. **Two footguns, both verified here after the Real World session
(`ab508775`) hit them; the earlier snippet in this file had the first one and was a
false-alarm generator.**

```js
import {compile} from '@mdx-js/mdx';
import fs from 'node:fs';

const src = fs
  .readFileSync(file, 'utf8')
  .replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');   // 1. STRIP FRONTMATTER FIRST

try {
  await compile(src);                                 // 2. MUST be awaited IN the try
} catch (e) {
  console.log('FAIL', file, e.message);
}
```

**1. Strip the YAML frontmatter, or you get false positives on good pages.** MDX has no
frontmatter support without `remark-frontmatter`, so `---` opens a **setext heading** and
the title becomes MDX content. Any JSX-looking tag in a title then reads as an unclosed
element. Verified:

```
FAIL  raw (frontmatter kept) -> Expected a closing tag for `<Suspense>` (2:24-2:34)
                                before the end of `setextHeading`
OK    frontmatter stripped
```

It hit **four** perfectly good React pages whose titles contain `<script>`, `<Suspense>`,
`<Activity>` and `<ViewTransition>`. Docusaurus strips frontmatter before MDX; the check
must too.

**2. `compile()` is async — `await` it INSIDE the try/catch.** Without that the rejection
escapes, the sweep prints "all clean", and *then* dies on an unhandled rejection. It
reports the opposite of the truth.

**3. ⚠️ A hit in another session's tree may be transient.** Sweeping a shared checkout
catches files mid-rewrite — two were caught that way. **Re-run before trusting a hit you
do not own**, and check `git show HEAD:<file>` rather than the working tree.

### ✅ Resolution

**2026-08-17: chunk A fixed both `08-state-reducer` chunks (`8d423d39`), and a whole-corpus
sweep of 2,919 pages compiles clean** — verified independently by `ab508775` and
spot-checked here at HEAD. The Storybook instance was fixed by someone else. **Nothing
MDX-breaking remains in `docs/`, so the Pages deploy should go green on the next push.**

Related: [[devbible-parallel-sessions]] · [[shared-machine-environment]]
