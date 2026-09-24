---
name: angular-phase-0-lane-brief
description: The verbatim shared brief handed to every Angular Phase 0 lane — repo path, the measured v22.1.4 version spine, sources, cap and chunking rules, MDX hazards, footer convention, pre-flight checks. Hand this to a devbible-author agent unchanged. Paired with [[angular-phase-0-lane-dispatch]].
metadata:
  type: project
---

> 🔴 **Copied out of the session scratchpad 2026-08-31**, when the six lanes were killed at the
> 80% usage line. The scratchpad does not survive a session; this does. **Hand this file to a
> `devbible-author` agent verbatim** — do not rewrite it from memory, the version spine below
> was measured and must not be re-derived.

# Angular Phase 0 — shared brief for every lane

## 🔴 CORRECTION 2026-09-06 — READ THIS BEFORE THE TABLE BELOW; IT OVERRIDES IT

The version spine further down was measured **2026-08-31 and has since moved**. Re-measured
2026-09-06 from `registry.npmjs.org` dist-tags and `gh api repos/angular/angular/releases` by
the Lane C author, who verified every claim below against source at tag `v22.1.5`:

| | 2026-08-31 said | 🔴 Actually, 2026-09-06 |
|---|---|---|
| `@angular/core` latest | 22.1.4 | **22.1.5** (released 2026-09-03) |
| `next` | 22.2.0-next.4 | **22.2.0-next.5** |
| `@angular/cli`, `@angular/build`, `@angular/ssr` | 22.1.6 | **22.1.7** |
| `@angular/material` / `@angular/cdk` | 22.1.4 | **22.1.5** |

LTS lines are unchanged: v21 → 21.2.22, v20 → 20.3.30, v19 out of support at 19.2.25.

🔴 **Reading Angular source: `raw.githubusercontent.com` 404s.** Repo tags carry a `v` prefix.
Use `gh api repos/angular/angular/contents/<path>?ref=v22.1.5 -q .content | base64 -d`.

### Four facts the brief below gets WRONG or understates

1. 🔴 **Zoneless is the DEFAULT in v22 — not merely "stable".** `internalCreateApplication`
   prepends `provideZonelessChangeDetectionInternal()` before your providers, and the v22
   `ng new` `app.config.ts` contains no zoneless call at all. The zoneless guide, verbatim:
   > *"Zoneless is the default in Angular v21+ so you do not need to do anything to enable it."*

2. 🔴 **`NullInjectorError: No provider for X!` NO LONGER EXISTS in v20+.** Do not teach that
   string. `packages/core/src/di/null_injector.ts` now throws ``No provider found for `X`.``
   with `error.name = 'ɵNotFound'`; `formatRuntimeError` prefixes `NG0201: `. **angular.dev's
   own DI troubleshooting guide still shows the OLD string — docs and source disagree, and the
   source is right.** This is a live trap: the dispatch spec for topic 03 asks for the old
   string by name.

3. **Deprecated in v22, so never teach as the modern path:** `withFetch` (*"not required
   anymore, `FetchBackend` is the default"*; `withXhr()` is the opt-out) · `withJsonpSupport`
   (22.1, XSS) · `withIncrementalHydration` (on by default with `provideClientHydration`;
   opt out with `withNoIncrementalHydration()`; intent to remove v24) · `provideAnimationsAsync`
   (since v20.2, use `animate.enter`/`animate.leave`; intent to remove v23) ·
   `HttpClientModule` / `HttpClientXsrfModule` / `HttpClientJsonpModule`.
   ⚠️ The dispatch spec for topic 03 names `withFetch` and `withIncrementalHydration` as
   features to teach. It is out of date on both — teach them as deprecated.

4. `provideCheckNoChangesConfig` is **developer preview**, not stable.

5. ⚠️ **The topic-01 dispatch line "Svelte also compiles, React does not" needs nuance.**
   **Vue compiles templates too** (*"Vue templates are compiled into render functions"*, and
   Vue calls its approach a *"Compiler-Informed Virtual DOM"*), and React ships an optional
   React Compiler. Write the comparison accurately rather than repeating the dispatch line.

6. 🔴 **Arrow functions in templates are a live doc/implementation contradiction — do not
   pick a side silently.** angular.dev's expression-syntax guide lists them as unsupported;
   the v21.2.0 CHANGELOG says *"support arrow functions in expressions"*; `@angular/core`
   22.1.5 ships `ɵɵarrowFunction`; and `parser.ts` rejects only the block-bodied form
   (*"Multi-line arrow functions are not supported…"*). Document all three and flag the
   disagreement. Same pattern as the `NullInjectorError` trap above: **when angular.dev and
   the source disagree, the source is right, and say so on the page.**

8. 🔴 **The topic-02 dispatch says "(v14 introduced, v19 flipped the default, v20+ removed
   the boilerplate)". The v20 half is WRONG — v19 removed it.** Verified: v20.0.0 changed
   **nothing** about `standalone` (it deprecated `@angular/platform-browser-dynamic` and
   `ngIf`/`ngFor`/`ngSwitch`). v19.0.0's own CHANGELOG carries the breaking change verbatim —
   *"Angular directives, components and pipes are now standalone by default."* — with the
   `explicit-standalone-flag` migration. Also: `@developerPreview` is on the `standalone`
   field in the v14.3.0 typings and **gone** in v15.2.10, which is the real evidence for
   "stable in v15"; no changelog sentence announces it, so do not claim one.

   **The mechanism, and the best single fact in that topic** — `@angular/compiler-cli` reads
   the default from the *resolved* `@angular/core` version, not its own:
   ```js
   this.implicitStandaloneValue =
     this.angularCoreVersion === null ||
     coreVersionSupportsFeature(this.angularCoreVersion, ">= 19.0.0");
   ```
   which is why a v18-pinned library in a monorepo still compiles non-standalone.

9. ⚠️ **`angular.dev/tools/cli/aot-compiler` is STALE** — it still describes the ViewEngine
   collector, `.metadata.json` and `StaticReflector`, yet sits under the v22 nav. Its
   *constraints* still hold; its *phase descriptions* do not describe Ivy. Likewise the Ivy
   design docs in `packages/compiler/design/` are Ivy-era drafts: cite their architecture
   claims, never their artefacts (`ngcc`, `.metadata.json`).

Complete v22 `provide*` list in `@angular/core`, from `goldens/public-api/core/index.api.md`
at `v22.1.5`: `provideAppInitializer`, `provideBrowserGlobalErrorListeners`,
`provideCheckNoChangesConfig`, `provideEnvironmentInitializer`, `provideExperimentalWebMcpTools`,
`provideIdleServiceWith`, `provideNgReflectAttributes`, `providePlatformInitializer`,
`provideStabilityDebugging`, `provideZoneChangeDetection`, `provideZonelessChangeDetection`.

**Verified error strings** (read from source, safe to quote): `NG0207` invalid
`EnvironmentProviders` in a component · `NG0408` both zone and zoneless provided · `NG0914`
Zone.js present in zoneless mode · `NG0907` component not marked standalone · the
`provideHttpClient` contradiction throws for `withXsrfConfiguration`+`withNoXsrfProtection` and
`withRequestsMadeViaParent`+`withFetch`/`withXhr`.

**Order-dependence, verified in source:** `R3Injector.processProvider` ends in a `Map.set`, so
**last non-multi provider wins**; `forEachSingleProvider` flattens depth-first in source order.
`mergeApplicationConfig` is `Object.assign(prev, curr, {providers: [...prev, ...curr]})` — a
**concat**, so the server config appends and therefore overrides. `provideRouter` registers
`ROUTES` as `multi: true`, so two calls **append** route tables rather than replace.
`provideHttpClient` pushes `xsrfInterceptorFn` before any feature providers, so XSRF always
runs first; `withInterceptors` array order **is** execution order.

---


## 🔴 Where you work — READ THIS, IT IS NOT THE PATH IN YOUR AGENT DEFINITION

**Repo: `/mnt/Storage/Backup/Knowledge/devbible`, branch `main`** — the shared checkout, as
your agent definition says. (The 2026-08-31 run used a worktree at `…/devbible-angular` on
branch `angular-phase-0`; that worktree was merged and **deleted** the same day. Do not go
looking for it. If a future run is put in a worktree again, change this line to name it.)

Your directory is:
`/mnt/Storage/Backup/Knowledge/devbible/docs/angular/pages/phase-0-how-angular-runs/<your-topic>/`

Six lanes are running in parallel, one per pair of topics. **Touch only your own topic
directories.** Every shared file is already written and is the coordinator's:
`docs/angular/pages/README.md`, `phase-0-how-angular-runs/README.md`, every
`_category_.json` (already created for you — do not rewrite them),
`src/data/progress.js`, `sidebars.js`. Do not `git add`, `git commit`, `yarn build` or
`yarn start`.

## The version spine — measured 2026-08-31, do NOT re-derive, do NOT trust your training data

Angular's current major is **22**, not 17, not 19, not 20. If you find yourself writing
about `NgModule`-based bootstrapping or `@angular/platform-browser-dynamic` as the normal
path, you have drifted into an old mental model.

| | |
|---|---|
| Current major | **22**, released **3 Jun 2026**. `latest` = **22.1.4** (27 Aug 2026). `next` = 22.2.0-next.4 |
| LTS lines | v21 → `21.2.22` (LTS to ~May 2027) · v20 → `20.3.30` (LTS ends ~Nov 2026) |
| Out of support | **v19** — final patch `19.2.25`, 2 Jun 2026 |
| Cadence | majors every 6 months (May/June + November); **6 months active + 12 months LTS**. v23 due ~Nov 2026 |
| CLI | `@angular/cli` 22.1.6 · `@angular/build` 22.1.6 |
| Node engines | `^22.22.3 \|\| ^24.15.0 \|\| >=26.0.0` |
| **TypeScript** | **`>=6.0 <6.1`** — hard peer pin. Angular 22 does **not** run on TS 5.x |
| RxJS | peer `^6.5.3 \|\| ^7.4.0`; latest rxjs 7.8.2. **No rxjs 8 support** |
| zone.js | peer `~0.15.0 \|\| ~0.16.0`, and **optional** — a zoneless app has none |
| Test runner | **`vitest@^4.0.8`** is the `@angular/build` peer. `karma@^6.4.0` still a peer, end of life |
| SSR / UI / state | `@angular/ssr` 22.1.6 · `@angular/material` + `@angular/cdk` 22.1.4 · `@ngrx/store` and `@ngrx/signals` 22.0.0 · `@analogjs/platform` 2.7.1 |
| Still published | `@angular/animations`, `@angular/platform-browser-dynamic` — both 22.1.4 |

v22 API facts confirmed in the published 22.1.4 `.d.ts` export lists:

- `signal` `computed` `effect` `linkedSignal` `untracked` `resource` `resourceFromSnapshots`
  and **`debounced`** (new in v22).
- `input` `output` `model` `viewChild` `viewChildren` `contentChild` `contentChildren`;
  `inputBinding` / `outputBinding` / `twoWayBinding` for `createComponent`.
- **`afterRender` was renamed `afterEveryRender`.** `afterNextRender` and
  `afterRenderEffect` are unchanged.
- **`provideZonelessChangeDetection` is stable**, not experimental.
- **`@angular/forms/signals` is a real published entry point** (plus `./signals/compat`).
- `httpResource` and `HttpResourceRef` live in `@angular/common/http`.
- New and easy to miss: `injectAsync`, the **`@Service`** decorator, `onIdle` /
  `IdleService` / `provideIdleServiceWith`, `provideBrowserGlobalErrorListeners`.
- 🔴 **Experimental — always label, never teach as shippable:**
  `declareExperimentalWebMcpTool` / `provideExperimentalWebMcpTools`,
  `provideExperimentalWebMcpForms`, and the router's
  `withExperimentalPlatformNavigation` / `withExperimentalAutoCleanupInjectors`.

## Sources

Verify against **angular.dev** (the current docs site — `angular.io` is retired), the
Angular GitHub release notes and `CHANGELOG.md`, the RFC/design docs in
`angular/angular` discussions, and published package metadata. Not blogs. Fetch them —
do not write the `> Verified:` line from memory. Quote load-bearing sentences verbatim as
`> *"…"*`.

🔴 **Never invent output.** There is no sandbox. TypeScript, HTML template, JSON and
shell-command source is fine; the *output* of running it is not — no terminal transcripts,
no bundle-size numbers you did not read in a document, no compiled-output listings you did
not verify. Where you show generated code (instruction calls, `ɵɵ` factories), say plainly
that it is illustrative of the shape rather than a byte-exact dump, or cite where you read
it.

## What every topic must contain

1. **Real, complete, runnable code** — realistic names, no `...` elisions. Anything not
   runnable is labelled `// pseudo-code`.
2. **Gotchas and pitfalls**, written **symptom → cause → fix**, leading with the symptom.
   As many as the topic actually has. Show the fix — never write "the fix is X" without X.
3. **Interview questions with answers**, 3–8 per file, "why" and "what happens if" over
   "what is". Mark frequently-asked ones with `★`.

## Layout, cap and chunking

- **300 lines per file is a hard FILE-SIZE cap and never a content budget.** Write it all,
  then split on a **concept boundary**. A Master topic running to 12–18 chunks is the
  expected outcome here, not an overrun. Never trim, merge or drop to fit.
- Your topic directory already exists with its `_category_.json`. Write:
  - `README.md` — the topic index: frontmatter, tier badge, `> Verified:` line, a bold
    thesis paragraph, a **chunk table** listing every chunk with a one-line "covers",
    "The one question this topic exists to answer", "Where this connects", "Phase gate
    contribution", then the footer.
  - `01-….md`, `02-….md`, … the chunks. Each repeats the tier badge and `> Verified:`
    line so a chunk opened directly still states its provenance.
- Frontmatter on every file:
  ```
  ---
  title: "…"
  sidebar_label: "NN · …"
  sidebar_position: N
  ---
  ```
  `sidebar_position` sequential from 1, no gaps, no reuse. The topic `README.md` uses
  `sidebar_label: "Overview"` and `sidebar_position: 0`.
- Tier badge, immediately under the frontmatter, on its own line — one of:
  `<span className="db-tier t-master">Master</span>` ·
  `<span className="db-tier t-understand">Understand</span>` ·
  `<span className="db-tier t-know">Know</span>`
- If a topic genuinely fits in one file under 300 lines, it may stay a single `README.md`
  in its directory with no chunks — but only if that is honestly all the topic has.

## Links and footers

Every link ends in `.md` and **keeps every numeric prefix**.
- Same topic: `[03](03-instruction-calls.md)`
- Another topic's index: `../02-standalone-by-default/README.md`
- The phase index: `../README.md`
- ⛔ Never link a bare directory slug.

🔴 **Write REAL footers — do not emit `{/* FOOTER */}`.** Your dispatch names the exact
prev and next for your topic's boundaries. Every file ends with one line:

```
---

← Prev: [Label](path.md) · Index: [Topic index](README.md) · Next → [Label](path.md)
```

The topic `README.md`'s prev/next are the neighbouring **topics**; the first chunk's prev
is its own `README.md`; the last chunk's next is the next topic's `README.md`.

## MDX hazards — these pass a local read and abort the production build

1. A bare `<!-- … -->` in prose → use `{/* … */}`.
2. An inline code span left **open** at end of line whose next line starts with `{` →
   reflow so no line begins with a brace.
3. A bare `<Something` in prose — `<app-root>`, `Signal<T>`, `Observable<User>` → **always
   backtick** them. This is the one that bites hardest in Angular writing: selectors and
   generics are everywhere.
4. `{` and `}` in prose outside a code fence are JSX expression delimiters — backtick
   anything containing them, including `{{ interpolation }}` and `@if {}` blocks.

## Before you report

```bash
cd /mnt/Storage/Backup/Knowledge/devbible/docs/angular/pages/phase-0-how-angular-runs
wc -l <your-topic>/*.md | sort -rn | head        # nothing over 300 except the total line
grep -rn '<!--' <your-topic>/                    # must be empty
grep -c '^\*\*★\|★' <your-topic>/*.md            # questions are actually there
```

Then report: files written, total lines, chunk count per topic, the sources you verified
against, and anything you could not confirm. Do not commit — the coordinator commits.
