---
name: devbible-react-part-a-phase11
description: React Part A — Phase 11 COMPLETE 17/17, merged to main; what each topic argues, the traps found, and what is deliberately left unasserted
metadata:
  type: project
---

:::danger CONSOLIDATED 2026-08-15 — THE WORKTREE IN THIS FILE NO LONGER EXISTS
Every devbible worktree and branch was **merged into `main` and DELETED** on 2026-08-15
(*"commit every uncommitted branch to main and delete everything"*). **All the content
described below is on `main`** at `/run/media/sairam/Storage/Backup/Knowledge/devbible`
— nothing was lost, every branch was verified at 0 unique commits first. Ignore any
"worktree", "branch", "not merged" or "merge at the phase close" instruction below and
**work on `main`**. `main` builds 0 warnings / 0 broken links, so a break there is yours.
Full record: `progress_worktree_consolidation_20260815.md`.
:::

# ✅ REACT PART A — Phase 11 is COMPLETE (17/17). Nothing is queued.

**Session `bfcb390b`, 2026-08-14** (continues `688ea14a`). Started when the user said
*"pick react js part a"* — which selects **Part A** of the React A/B split, not a JavaScript
lane. Read [[devbible-react-split-parts-ab]] for the ownership rules and
[[devbible-react-phase7]] for everything before Phase 11.

> **Keep this file's name stable.** Repoint its contents as topics close.

🔴 **Standing order, 2026-08-14, given as the user went to bed:** *"complete the assigned
task … make sure to upto date UI and since other sessions are running build errors may occur
so focus only on your language … do not forgot to save memories every 2-3 files … take
recomended action to finish the job."* **Run topics 10–17 and the phase close without
stopping to ask.**

## Scope

**Phase 11 topics 08 through 17, then close the phase.** Directory:
`docs/react/pages/phase-11-ssr-hydration/`. Topics 08–10 were written on **`main`** in the
shared checkout `/run/media/sairam/Storage/Backup/Knowledge/devbible`; from **topic 11 onward
the writing happens in the worktree** and is merged into `main` after every topic.

⛔ **Never touch `docs/react/pages/phase-14-correctness/`** — that is Part B, live in
session `05921047` as of 2026-08-14 and already writing (1/14 when last seen).

## Live state

| | |
|---|---|
| Topics **complete** | ✅ **17 of 17 — DONE** |
| Leaf files in the phase | **24** (30 files incl. indexes), **5,495 lines, 0 over 300** |
| 🔴 **What is next** | **Nothing. Part A's scope was Phase 11 topics 08–17 + the phase close, and it is finished.** Do not start Part B (Phase 14) — session `05921047` owns it. React phases 12 and 13 are **dropped** from scope, so React is phases 0–11 + 14 |
| Build at the close | ✅ **exit 0, 0 MDX errors, and 0 warnings in `phase-11-ssr-hydration`.** The 55 react warnings are all in `phase-14-correctness` (Part B, mid-write); javascript (4) and typescript (14) are other sessions' |
| 🔴 **Where the writing happens** | **worktree `/run/media/sairam/Storage/Backup/Knowledge/devbible-react-p11`, branch `react-p11-part-a`** — see below |
| Commits | `f8899f5` topic 09 · `3d9668c` topic 10 · `0d90db7` the MDX fix · then in the worktree, each merged into `main` straight after: topic 11 `460d055`, topic 12, topic 13 (merge `2be4f4a7`) |
| Build | ✅ **exit 0** after the MDX fix; 7 remaining React warnings are forward links to topics 12–17, which clear as they are written |

## 🔴 The worktree, and why merging every topic

**2026-08-14, mid-session:** *"Can you write now onwards all your explanations in complete new
worktree ?"* So from topic 11 onward:

- Worktree **`/run/media/sairam/Storage/Backup/Knowledge/devbible-react-p11`**, branch
  **`react-p11-part-a`**, created from `main` at `0d90db7`.
- `node_modules` is a **symlink** to the main checkout's — no `yarn install` needed.
- 🔴 **Merge into `main` after every topic** (`git merge --no-ff react-p11-part-a`). This is the
  React lesson from `react-phase-7`: an unmerged worktree is worse than none, and merging small
  keeps conflicts with the other live sessions to nothing. Merging also keeps the boards the
  user reads actually live.
- Build there with
  `DOCUSAURUS_GENERATED_FILES_DIR_NAME=.docusaurus-react-p11 yarn build --out-dir build-react-p11`.

## 🔴🔴 The `</content>` trap — cost a failed build, check for it after every Write

Five files shipped with a literal `</content>` line appended at the end. MDX parsed it as a
closing JSX tag with no open tag — *"Unexpected closing slash `/` in tag, expected an open tag
first"* — and the **client bundle failed, so `yarn build` exited 1 and produced nothing.**
The error's reported position is the **last line of the file**, which makes it look like a
footer problem.

**After every file written, run:** `grep -rn '</content>' docs/react/` — it must be empty.
Fixed in `0d90db7`.

The Part A claim rows in **both** boards (`docs/react/pages/README.md` line 14 and the React
row in `docs/README.md`) were repointed from `688ea14a` to this session.

## ✅ Topic 09 · Partial pre-rendering — DONE, three chunks + index

`09-partial-prerendering/` — 205 + 217 + 256 leaf lines, plus a 62-line README index.

| Chunk | Covers |
|---|---|
| `01-the-idea-and-the-four-apis.md` | the build→request lifecycle, where `postponedState` is stored, the 2×2 grid (finish-for-a-request vs finish-into-more-static-output), what each returns, where the `nonce` restriction resolves, and the line between React's API and a framework's "PPR" |
| `02-calling-them.md` | the two shared arguments and why **the tree is passed again**, `resume`'s shell contract and `allReady`, `resumeToPipeableStream`'s `pipe`/`abort` with `onShellReady`/`onShellError`, *"or use the prelude"* as a recovery path plain SSR lacks, `resumeAndPrerender` as `prerender` with a head start |
| `03-the-caveats.md` | the **re-render rule** as the performance model, bootstrap options and `identifierPrefix` belonging to the build, the `nonce`-versus-scripts fork under a CSP, `resumeAndPrerender`'s two caveats, and the three react.dev contradictions left **stated as unresolved** |

**All 7 inbound links were repointed** when the topic became a directory — the phase
`README.md` row, `01-csr-ssr-ssg-streaming-rsc.md:112`, `08-prerendering/README.md` (×2),
`08-prerendering/01-the-static-apis.md` (×1) and
`08-prerendering/03-aborting-errors-caveats.md` (×3, footer included). Verified by re-grep:
zero `09-partial-prerendering.md` left anywhere in `docs/`.

⚠️ **`03-the-caveats.md`'s footer links forward to `../10-document-metadata.md`, which does
not exist yet.** That is the known mid-phase forward-link warning, not a rule-1 slug bug — the
phase `README.md` already carries the same forward links for topics 10–17. It resolves as each
topic is written, and the phase-close build is what proves it.

### The `resume` caveats, recorded verbatim — never re-fetch these

The four on **`resume`** and **`resumeToPipeableStream`** (identical on both):

- *"does not accept options for `bootstrapScripts`, `bootstrapScriptContent`, or
  `bootstrapModules`. Instead, you need to pass these options to the `prerender` call that
  generates the `postponedState`. You can also inject bootstrap content into the writable
  stream manually."*
- *"does not accept `identifierPrefix` since the prefix needs to be the same in both
  `prerender` and `resume`."*
- *"Since `nonce` cannot be provided to prerender, you should only provide `nonce` to
  `resume` **if you're not providing scripts to prerender**."*
- 🔴 **the load-bearing one:** *"`resume` **re-renders from the root** until it finds a
  component that was not fully pre-rendered. **Only fully prerendered Components (the
  Component and its children finished prerendering) are skipped entirely.**"* — this is what
  makes boundary placement decide how much work a resume actually saves, and it is the spine
  of chunk 03.

**`resumeAndPrerender`** caveats: `nonce` *"is not available when prerendering"* (same wording
and same reason as `prerender`), and the Web-Streams dependency — Node uses
`resumeAndPrerenderToNodeStream`.

⚠️ **Documentation defects found and stated in place as unresolved — do not "fix" them into
confident claims:**
- `resumeAndPrerender`'s signature line writes `{ prelude, postpone }` while its Returns
  section documents **`postponed`**. Flagged in chunk 01, restated in chunk 03.
- `resume`'s page says *"For Node.js, use `resumeToNodeStream`"* — a name that appears
  nowhere else — and **links it to `renderToPipeableStream`**. `resumeToPipeableStream`'s
  page says Web-Stream runtimes *"should use `resume`"* and **links it to
  `renderToReadableStream`**. Both cross-links are wrong on react.dev. The real Node API is
  `resumeToPipeableStream`. Chunk 03 says so; it does not assert `resumeToNodeStream` exists.
- `resumeToPipeableStream`'s example **imports `resume` and calls `resumeToPipeableStream`**,
  and calls it **without `await`** though the signature line has one. Flagged in chunk 02 as
  unresolved — do not decide whether it is awaitable.

## ✅ Topic 10 · Document metadata — DONE, two chunks + index

`10-document-metadata/` — 204 + 257 leaf lines, plus a 59-line README.

| Chunk | Covers |
|---|---|
| `01-hoisting.md` | what React 19 changed, *"React will always place the DOM element … regardless of where in the React tree it is rendered"*, **the four exceptions** (title in `<svg>`, `itemProp` on any of the three, `rel="stylesheet"` without `precedence`, `<link>` with `onLoad`/`onError`), why it is an SSR feature, and the streaming question left open |
| `02-the-three-tags.md` | `<title>`'s text-only children + the interpolation trap, *"the behavior of browsers and search engines is undefined"* with two titles, `<meta>`'s exactly-one-of `name`/`httpEquiv`/`charset`/`itemProp`, `<link>` de-dup **by `href` only** and its two caveats (prop changes ignored; may outlive unmount), and where a metadata library still has a job |

3 inbound links repointed (phase README row, `09/03` footer, `08/02` line 70).

⬜ **Stated as unresolved, deliberately:** what happens to metadata rendered inside a Suspense
boundary that resolves after `<head>` has flushed. The references only say metadata *"work[s]
with"* streaming SSR. Do not answer it without a primary source.

## ✅ Topic 11 · Resource preloading — DONE, two chunks + index

`11-resource-preloading/` — 248 + 217 leaf lines, plus a 58-line README. **First topic written
in the worktree.**

| Chunk | Covers |
|---|---|
| `01-the-six-apis.md` | the ladder `prefetchDNS` → `preconnect` → `preload` → `preinit` plus `preloadModule`/`preinitModule`, the two axes, **no benefit on your own origin**, *"compared with `preconnect`, `prefetchDNS` may be better if you are speculatively connecting to a large number of domains"*, the preload/preinit fork, `precedence` (`reset`/`low`/`medium`/`high`) required with stylesheets, and why all six return nothing |
| `02-calling-them.md` | 🔴 the caveat **all six repeat** — browser anywhere, server **only during a render or an async context originating from one**, *"Any other calls will be ignored"* — why, render-time vs event-handler intent, de-dup by `href` with the **responsive-image exception** (`href` + `imageSrcSet` + `imageSizes`), and `<link>`-versus-function |

⬜ **Left open, deliberately:** whether a rendered `<link rel="preload">` de-duplicates against
a matching `preload()` call. The rules are stated only in terms of calls.

⚠️ **Contrast worth keeping:** `preinit` enumerates four `precedence` values; `<link>`'s
`precedence` prop is documented only as *"a string"*. Topic 15 owns that; do not flatten them.

### Topic 08 · Prerendering — DONE, chunked into three

`08-prerendering/` — 185 + 242 + 239 leaf lines, plus a 55-line README index.

| Chunk | Covers |
|---|---|
| `01-the-static-apis.md` | the five-renderer grid, Node-vs-Web split, async signature, `prelude`/`postponed`, "waits for all data" and what data counts |
| `02-calling-them.md` | whole-document requirement, doctype + bootstrap injection, piping vs string-building, the full options table, `bootstrapScripts` as the ship-React-or-not switch |
| `03-aborting-errors-caveats.md` | `signal`, abort as a **partial success**, fallback-state output, handover to `resume`, `onError`, why `nonce` is unavailable |

⚠️ **It was written as two chunks first and chunk 01 came out at 310 lines.** Split again on
a second concept boundary rather than trimming — rule 1. Watch for this: a chunk that covers
"what it is *and* how you call it" is two chunks.

## Sources fetched so far (do not re-fetch)

- **`prerender`** — full options list, returns (`prelude` Web Stream + `postponed`), the
  single `nonce` caveat, "When should I use", the aborting section, and the explicit *"does
  not support streaming more content as it loads"*.
- **`prerenderToNodeStream`** — the same, plus all four Usage sections (pipe to response,
  read to string with `'data'`/`'end'`/`'error'`, waiting for all data, aborting) and the
  whole-document + `hydrateRoot(document, …)` pairing.
- **`resume`, `resumeToPipeableStream`, `resumeAndPrerender`** — full signatures, arguments,
  options, returns and **every caveat** (recorded verbatim above).
  ⬜ `resumeAndPrerenderToNodeStream` was **not** fetched; it is referenced only as the Node
  counterpart and nothing written so far depends on its own reference.

**Still to fetch, in topic order:** `renderToStaticMarkup` (14) · `<link>` `precedence` and
`<style>` (15) · `<script>` (16) · `createPortal` (17). Everything for topics 08–13 is fetched
and recorded.

## ✅ Topics 14–17 — DONE (Know tier), and the phase close

- **14 · `renderToStaticMarkup`** (173) — *"cannot be hydrated"* as a **property, not a
  limitation**; the two named uses (email, static page generation); the three-way table against
  `renderToString` and `prerender`; the **limited-Suspense bail-out** that silently puts a
  spinner in an email; and works-in-the-browser-but-do-not.
- **15 · Stylesheets and `precedence`** (224) — 🔴 **`precedence` is an order of first
  discovery, not an enum** (*"values it discovers first are 'lower'"*); one bucket shared by
  `<link>`, inline `<style>` and `preinit`; **the component rendering a stylesheet `<link>`
  suspends while it loads**, inline `<style>` does not; and `<style>`'s silent third caveat —
  *"React will drop all extraneous props when using the `precedence` prop"* (a `nonce` vanishes
  under a strict CSP). ⚠️ **Flagged, not reconciled:** `preinit` enumerates four precedence
  values while `<link>` documents it only as a discovery-ordered string.
- **16 · `<script async>`** (171) — the entry condition is `src` **and** `async={true}`,
  because *"the async prop must be true to allow scripts to be safely moved"*: a classic
  script's position **is** its semantics; an async one has already renounced ordering. Dedupe by
  `src`; `onLoad`/`onError` fork you out of hoisting. React's parenthetical that a leftover
  script element *"has no effect"* is about the **element**, not the script's side effects.
- **17 · Portals and SSR** (197) — 🔴 **reasoned from the parameter contract, because
  `createPortal`'s reference never mentions server rendering at all** (the inherited negative
  finding, re-confirmed 2026-08-14). *"The node must already exist"* + no DOM on the server ⇒
  portal content is client-only. The **mount-guard pattern** and why it uses an effect rather
  than `typeof document` — the first client render must still match the server's HTML. Events
  propagate up the **React** tree. The *"Rendering React components into non-React server
  markup"* usage section is **not** about SSR and is the section a search lands on.

**Phase close** — the phase `README.md` carries a **Coverage** block matching Phase 10's shape:
17 topics, 24 leaf pages, 5,495 lines, 0 over 300, the five chunked topics with what each split
on, the **171–242** spread for the twelve single-file ones, and the five places a page declines
to answer.

## ✅ Topics 12 and 13 — DONE

**12 · `flushSync`** — one file, 239 lines. All four caveats read as one argument (*you asked
React to stop scheduling, so the scheduling guarantees are off*), the Pitfall quoted in full
(*"use `flushSync` as a last resort"*), and the criterion for the legitimate case instead of a
list of browser APIs — ⬜ **the reference names none, so the page names none.**

**13 · Root error options** — `13-root-error-options/`, 221 + 202 leaf lines + a 53-line README.
Chunk 01 is the client partition (`onCaughtError` / `onUncaughtError` / `onRecoverableError`,
`errorInfo.componentStack`, *"some recoverable errors may include the original error cause as
`error.cause`"*, and that they do **not** replace boundaries). Chunk 02 is the server's single
`onError`, built on the **shell-versus-outside-the-shell** line — *"the `onError` callback will
fire, but you will still get `onShellReady` instead of `onShellError`"*, so **`onError` firing
does not mean the request failed** — plus the *"before the shell is emitted"* status-code
deadline and the same bug surfacing twice.

⬜ **Two things deliberately not asserted in topic 13** — do not "fix" them later without a
source: that hydration mismatches are delivered to `onRecoverableError` (the reference implies
it and never states it), and that any id or digest correlates the server callback with the
client ones.

⚠️ **Two NEGATIVE findings inherited from earlier sessions — do not "fix" them:** react.dev
does not document selective hydration's scheduling policy, and **`createPortal`'s reference
says nothing about SSR at all**, so topic 17's premise must be reasoned from what *is*
documented rather than asserted.

### Facts worth not re-deriving

- **An abort resolves, it does not reject.** React's own example comments *"the prelude will
  contain all the HTML that was prerendered before the controller aborted."* Unfinished
  boundaries appear **in the fallback state**. The rejection path is a real render failure.
- **`postponed` is `null` on success**, opaque and JSON-serializeable otherwise.
- **The resume partners differ by stream type:** `prerender` → `resume` /
  `resumeAndPrerender`; `prerenderToNodeStream` → `resumeToPipeableStream` /
  `resumeAndPrerenderToNodeStream`.
- **`nonce` is deliberately absent** from both static APIs — *"inappropriate and insecure"*
  to bake a per-request value into shared output.
- **`bootstrapScripts` omitted = no React on the client at all**, documented and supported.
- React does **not** give a default or recommended prerender timeout; the 10s in the docs is
  illustrative.

## Shared board files — the collision rules

Part B writes these too. Re-read immediately before editing, and edit only your half.

| File | Rule |
|---|---|
| `src/data/progress.js` | 🔴 **anchor on the row's `slug`**, never on `topics:`/`pages:` numbers — a numeric anchor once silently edited JavaScript's phase 9 row |
| `docs/react/pages/README.md` | own the phase-11 row in both the claim box and the phase table (lines 14, 36, 87 as of `f8899f5`) |
| `docs/README.md` | **one shared React row** — Part B rewrote it mid-session once and reverted Part A's count. Re-read, fix only the Part A clause. The React **page total** on the technology row covers both parts; it was re-counted to **227** at `f8899f5` (`find docs/react/pages -name '*.md'` minus the 41 `README.md` indexes) |

**Never `git add -A`.** Stage explicit paths only.

## The rules this work runs under

- **300 lines is a file-size rule, never a content budget** — write the depth first, then
  split on a concept boundary. [[devbible-never-compress-to-fit-cap]]
- **Links end in `.md` and keep every numeric prefix.** When a topic becomes a directory,
  `grep -rn "NN-topic.md"` **before** creating it and repoint every hit — bodies as well as
  footers.
- **No sandboxes, no console blocks.** Name the sources in each page's `> Verified:` line.
- **Update the UI after every topic; commit memory every 2–3 files** (per file here).
- `git commit -F -` with a quoted heredoc — backticks in `-m` get command-substituted away.
- **Other sessions' build warnings are theirs.** Tally by language; React must be 0.

Related: [[devbible-react-split-parts-ab]] · [[devbible-react-phase7]] ·
[[devbible-react-syllabus]] · [[devbible-feedback-ui-progress-and-build-cadence]]
</content>
