---
title: "Sourcemaps, transpilation target and minification are the three build-time costs you can actually configure, and on Vite 8 all three changed engine — with a default browser floor that moved without anyone editing a config"
sidebar_label: "01h · Sourcemaps, target and minifiers"
sidebar_position: 10
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-07 against the Vite documentation — [Build Options](https://vite.dev/config/build-options) (`build.sourcemap`, `build.target`, `build.cssTarget`, `build.minify`, `build.cssMinify`, `build.terserOptions`), [Migration from v7](https://vite.dev/guide/migration). Documentation-validated; **no sandbox run, no timings, no benchmarks**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-07 · claims + output provenance · session 84f95c0c

# ⚡ Sourcemaps, Target and Minifiers

**These are the three places in `vite build` where you are choosing how much work to do, rather than what to emit.** A sourcemap is a second artefact that has to be threaded through every transform. A lower `build.target` means more syntax lowering on every file. Minification is a whole additional pass over the output. Vite 8 changed the engine behind two of them and moved the default browser floor for the third — and that last change is the dangerous one, because it happens with no config edit and no error.

## 1. Under-The-Hood Mechanics

### `build.sourcemap` — off by default, and three different modes

> **Type:** `boolean | 'inline' | 'hidden'` · **Default:** `false`
> *"Generate production source maps. If `true`, a separate sourcemap file will be created. If `'inline'`, the sourcemap will be appended to the resulting output file as a data URI. `'hidden'` works like `true` except that the corresponding sourcemap comments in the bundled files are suppressed."* — [Build Options](https://vite.dev/config/build-options)

| Value | `.map` file emitted | `//# sourceMappingURL` comment | Typical use |
|---|---|---|---|
| `false` *(default)* | no | no | you do not need production stack traces |
| `true` | yes | yes | public sourcemaps — anyone can fetch them |
| `'hidden'` | yes | **no** | upload the map to an error tracker; do not publish it |
| `'inline'` | no — embedded as a data URI | n/a | ⚠️ inflates the shipped bundle itself |

The cost is structural: a sourcemap is a mapping from every output position back to a source position, so it must be produced and merged through every transform stage that touched the file. Turning it on adds work proportional to how much source there is, and `'inline'` additionally makes the *shipped* file bigger, because the map travels inside it.

### `build.target` — a moving default

> **Default:** `'baseline-widely-available'`
> *"The default value is a Vite special value, `'baseline-widely-available'`, which targets the minimum browser versions compatible with [Baseline](https://web-platform-dx.github.io/baseline/) Widely Available as of a date fixed for each major release ([2026-01-01 for this major](https://web-platform-dx.github.io/supported-browsers/?widelyAvailableOnDate=2026-01-01)). Specifically, it is `['chrome111', 'edge111', 'firefox114', 'safari16.4', 'ios16.4']`."*

🔴 **That resolution moved in Vite 8.** The migration guide's *"Default Browser Target Change"* section lists it:

> *"The default browser values of `build.target` and `'baseline-widely-available'` are updated to newer browser versions:"* — *"Chrome 107 → 111 · Edge 107 → 111 · Firefox 104 → 114 · Safari 16.0 → 16.4"*

> *"These browser versions align with [Baseline Widely Available](https://web-platform-dx.github.io/baseline/) feature sets as of 2026-01-01. In other words, they were all released about two and a half years ago."*

A named default that tracks an external, dated definition is convenient until the definition moves under a codebase that promised otherwise. If you have a real browser-support commitment, pin explicit versions.

The other documented values and constraints:

> *"Another special value is `'esnext'` - which assumes native dynamic imports support and will only perform minimal transpiling."*

> *"The transform is performed with Oxc Transformer and the value should be a valid [Oxc Transformer target option](https://oxc.rs/docs/guide/usage/transformer/lowering#target). Custom targets can either be an ES version (e.g. `es2015`), a browser with version (e.g. `chrome58`), or an array of multiple target strings."*

> *"Note the build will output a warning if the code contains features that cannot be safely transpiled by Oxc."*

and a v8 behaviour change worth knowing:

> *"Passing the same browser with multiple versions of it to `build.target` option now errors: esbuild selects the latest version of it, which was probably not what you intended."* — [Migration from v7](https://vite.dev/guide/migration)

### `build.cssTarget` — a separate floor for CSS

> **Default:** the same as `build.target`
> *"This option allows users to set a different browser target for CSS minification from the one used for JavaScript transpilation."*
> *"It should only be used when you are targeting a non-mainstream browser. One example is Android WeChat WebView, which supports most modern JavaScript features but not the `#RGBA` hexadecimal color notation in CSS. In this case, you need to set `build.cssTarget` to `chrome61` to prevent vite from transforming `rgba()` colors into `#RGBA` hexadecimal notations."*

### `build.minify` — Oxc on v8

> **Type:** `boolean | 'oxc' | 'terser' | 'esbuild'` · **Default:** *"`'oxc'` for client build, `false` for SSR build"*
> *"The default is [Oxc Minifier](https://oxc.rs/docs/guide/usage/minifier) which is 30 ~ 90x faster than terser and only 0.5 ~ 2% worse compression."*

⚠️ Those ratios are the documentation's own claim, quoted with its link to the [minification-benchmarks](https://github.com/privatenumber/minification-benchmarks) repository. Nothing here was measured.

> *"`build.minify: 'esbuild'` is deprecated and will be removed in the future."*
> *"Note the `build.minify` option does not minify whitespaces when using the `'es'` format in lib mode, as it removes pure annotations and breaks tree-shaking."*
> *"esbuild or Terser must be installed when it is set to `'esbuild'` or `'terser'` respectively."*

The v8 migration moves the fine-grained knobs:

> *"If you were using the `esbuild.minify*` options to control minification behavior, you can now use `build.rolldownOptions.output.minify` instead. If you were using the `esbuild.drop` option, you can now use [`build.rolldownOptions.output.minify.compress.drop*` options](https://oxc.rs/docs/guide/usage/minifier/dead-code-elimination)."*

> *"Property mangling and its related options (`mangleProps`, `reserveProps`, `mangleQuoted`, `mangleCache`) are not supported by Oxc."*

🔴 And the sentence that decides what you do when minified code misbehaves:

> *"esbuild and Oxc Minifier make slightly different assumptions about source code. In case you suspect the minifier is causing breakage in your code, you can compare these assumptions here:"* — linking [esbuild's](https://esbuild.github.io/api/#minify-considerations) and [Oxc's](https://github.com/oxc-project/oxc/blob/main/crates/oxc_minifier/docs/ASSUMPTIONS.md) assumption documents.

### `build.cssMinify` and Terser's worker pool

> `build.cssMinify` — **Default:** *"`'lightningcss'`, but `false` if `build.minify` is disabled for client build"*. The migration guide adds: *"Lightning CSS supports better syntax lowering and your CSS bundle size might increase slightly."*

> `build.terserOptions` — *"you can also pass a `maxWorkers: number` option to specify the max number of workers to spawn. Defaults to the number of CPUs minus 1."*

That default matters in CI: a container reporting the host's CPU count while being limited to fewer cores will spawn a worker pool it cannot run, which is a common source of contention on shared runners.

---

## 2. Real-World Engineering Scenario

**Scenario**: a production sourcemap that shipped the whole codebase to the public.

The team wanted readable stack traces in their error tracker and set `build.sourcemap: true`. That emits the `.map` files *and* the `//# sourceMappingURL` comment, so every visitor's devtools could fetch and reconstruct the original TypeScript — including internal comments and file structure.

`'hidden'` is the documented mode for exactly this: it *"works like `true` except that the corresponding sourcemap comments in the bundled files are suppressed."* The `.map` files are still produced, so the error tracker's upload step can take them, and the deployment step excludes them from the published assets. The distinction is small in config and large in consequence, and it is the reason `true` and `'hidden'` should never be treated as interchangeable.

---

## 3. Production-Grade Code Example

```typescript
// vite.config.ts (Vite 8) — the three cost knobs, set deliberately.
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // 🔴 Explicit, so a default that tracks an external Baseline date cannot move
    // your browser floor between majors. These ARE the v8 defaults, written out.
    target: ['chrome111', 'edge111', 'firefox114', 'safari16.4', 'ios16.4'],

    // Emit .map files but NOT the sourceMappingURL comment. The error tracker's
    // upload step consumes them; the deploy step must exclude them from the bundle.
    sourcemap: 'hidden',

    // Default on v8. Named explicitly so a reader knows which minifier's
    // assumptions apply when minified output misbehaves.
    minify: 'oxc',
  },
});
```

```bash
# The deploy half of the 'hidden' arrangement — upload, then delete before publish.
# Without the delete, 'hidden' only hides the comment, not the files.
sentry-cli sourcemaps upload ./dist/assets
find ./dist -name '*.map' -delete
```

```typescript
// vite.config.ts — a build that must run on an old embedded WebView.
export default defineConfig({
  build: {
    target: 'es2020',
    // JS is fine on this target; the CSS minifier is what needs holding back,
    // per the docs' Android WeChat WebView example.
    cssTarget: 'chrome61',
  },
});
```

```typescript
// vite.config.ts — keeping Terser, and bounding its worker pool in a container.
export default defineConfig({
  build: {
    minify: 'terser', // requires `terser` installed as a devDependency
    terserOptions: {
      // Default is "the number of CPUs minus 1", which is the HOST's count in
      // most containers. Pin it to the cgroup limit the runner actually gives you.
      maxWorkers: Number(process.env.CI_CPU_LIMIT ?? 2),
    },
  },
});
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: `'inline'` sourcemaps in anything you ship

```typescript
// ❌ The map is appended "to the resulting output file as a data URI" — it is now
// part of the JavaScript every visitor downloads and the engine must skip past.
sourcemap: 'inline',

// ✅ Separate file, comment suppressed, uploaded out of band.
sourcemap: 'hidden',
```
`'inline'` is a development and debugging convenience, not a production mode.

### ⚠️ Pitfall 2: relying on `'baseline-widely-available'` while promising a browser floor

The name is stable and the resolution is not. Between Vite 7 and 8 it moved four browsers forward, silently, for every project that had not pinned. If your support matrix is a commitment to someone, write the versions.

### ⚠️ Pitfall 3: debugging minified output without knowing which minifier ran

Vite 8 defaults to Oxc, and the migration guide is explicit that Oxc and esbuild *"make slightly different assumptions about source code."* Before debugging a suspected minifier bug, establish what `build.minify` resolves to and read that minifier's assumptions document — the guide links both.

### ⚠️ Pitfall 4: setting Terser options while Oxc is the minifier

Terser-shaped options are read only when Terser is the selected minifier. On v8 the default is `'oxc'`, so a `terserOptions` block in an unmodified config is inert, and nothing warns.

---

## Gotchas

**★ Symptom: your original TypeScript is browsable in a stranger's devtools.** Cause: `sourcemap: true` emits both the `.map` file and the `//# sourceMappingURL` comment that points at it. Fix: `sourcemap: 'hidden'`, plus a deploy step that removes the maps after uploading them.
```bash
sentry-cli sourcemaps upload ./dist/assets && find ./dist -name '*.map' -delete
```

**★ Symptom: `'hidden'` was set and the maps are still public.** Cause: `'hidden'` only suppresses the comment — the files are still written to `outDir`. Anyone who guesses `app-abc123.js.map` can fetch it. Fix: delete or exclude the `.map` files from the published artefact; the comment suppression is a discovery barrier, not access control.

**★ Symptom: shipped bundles got noticeably larger after enabling sourcemaps.** Cause: `'inline'` — *"the sourcemap will be appended to the resulting output file as a data URI"*, so the map is inside the JavaScript the browser downloads. Fix: use `true` or `'hidden'`, which emit a separate file the browser only fetches when devtools ask for it.

**★ Symptom: the app breaks on an older browser after a Vite 8 upgrade with no config change.** Cause: `build.target` defaults to `'baseline-widely-available'`, and its resolution moved — Chrome 107 → 111, Edge 107 → 111, Firefox 104 → 114, Safari 16.0 → 16.4. Fix: pin explicit versions.
```typescript
build: { target: ['chrome111', 'edge111', 'firefox114', 'safari16.4', 'ios16.4'] },
```
Write the numbers you actually support, not the ones that happen to be today's default.

**★ Symptom: the build errors on a `build.target` array that worked on Vite 7.** Cause: *"Passing the same browser with multiple versions of it to `build.target` option now errors"* — previously the newest was silently selected. Fix: remove the duplicate browser and keep the version you meant. This is a case where the new error is better than the old behaviour.

**★ Symptom: a build warning about features that cannot be safely transpiled.** Cause: documented — *"the build will output a warning if the code contains features that cannot be safely transpiled by Oxc."* Fix: raise `build.target` so the feature does not need lowering, or stop using the feature. Do not silence the warning: it means the emitted code may not run on the target you asked for.

**★ Symptom: `rgba()` colours render wrong in an old embedded WebView.** Cause: the CSS minifier lowered them to `#RGBA` hex notation, which that engine does not support, because `build.cssTarget` inherits `build.target` and JavaScript support does not imply CSS support. Fix: `cssTarget: 'chrome61'` — the docs' own example for Android WeChat WebView.

**★ Symptom: Terser options in the config have no effect.** Cause: `build.minify` defaults to `'oxc'` on Vite 8, and Terser-shaped options are only read when Terser is selected. Fix: check what `build.minify` resolves to before debugging its options; set `minify: 'terser'` and install `terser` if you genuinely want it.

**★ Symptom: `minify: 'esbuild'` works but a deprecation notice appears, or the build fails because esbuild is missing.** Cause: two facts at once — the value is deprecated and *"will be removed in the future"*, and *"`esbuild` is no longer directly used by Vite and is now an optional dependency"*, so it must be a `devDependency`. Fix: install `esbuild`, or migrate to `'oxc'`. The second is the direction of travel.

**★ Symptom: `mangleProps` has no equivalent after moving off esbuild.** Cause: *"Property mangling and its related options … are not supported by Oxc."* Fix: there is no drop-in replacement; the migration guide points at the tracking issue. If property mangling is load-bearing for your bundle size, `minify: 'terser'` is the remaining supported path — and it is a real trade, since Terser is the slower minifier by the docs' own account.

**★ Symptom: an ES-format library build is not whitespace-minified.** Cause: documented and deliberate — *"the `build.minify` option does not minify whitespaces when using the `'es'` format in lib mode, as it removes pure annotations and breaks tree-shaking."* Fix: leave it. A library's consumer minifies; stripping pure annotations to save bytes in your published artefact costs every consumer their tree-shaking.

**★ Symptom: the SSR bundle is enormous and unminified.** Cause: `build.minify` defaults to *"`false` for SSR build"*. Fix: usually nothing — minifying server code buys no transfer saving and costs readable stack traces. Set it only if a deployment target charges by bundle size.

**★ Symptom: `vite build` saturates a CI runner and slows everything else down.** Cause: `terserOptions.maxWorkers` *"Defaults to the number of CPUs minus 1"*, and inside a container that count is usually the host's, not the cgroup limit. Fix: set `maxWorkers` explicitly to the cores the runner actually grants.

**★ Symptom: the CSS bundle grew slightly after upgrading to Vite 8.** Cause: *"Lightning CSS supports better syntax lowering and your CSS bundle size might increase slightly."* Fix: expected, and it is a trade for correctness on the target browsers. If the size matters more than the lowering, `build.cssMinify: 'esbuild'` is the documented switch back — and it requires `esbuild` as a `devDependency`.

## Interview questions

**★ What is the difference between `sourcemap: true` and `sourcemap: 'hidden'`, and why does it matter more than it looks?**
Both emit `.map` files. `true` also writes the `//# sourceMappingURL` comment into the bundle, which is what makes a browser's devtools fetch the map automatically — so anyone visiting the site can read your original sources. `'hidden'` suppresses that comment while still producing the files, which is exactly the arrangement an error tracker needs: upload the maps at deploy time, then delete them from the published assets. The trap is that `'hidden'` is not access control. The files are still written to `outDir`, so if the deploy step publishes the whole directory, the maps are fetchable by anyone who guesses the filename — the comment was only ever a discovery aid.

**★ Why is `'baseline-widely-available'` a risky default for a team with a browser-support commitment?**
Because it is a name bound to an external, dated definition rather than to a fixed set of versions, and that binding is re-evaluated per major release. The Vite 8 upgrade moved it forward — Chrome and Edge from 107 to 111, Firefox from 104 to 114, Safari from 16.0 to 16.4 — with no config change on any project's side and no error. Code that previously got lowered for Chrome 107 no longer is, and the failure appears on a user's device, not in CI. The default is a good one for a project that simply wants "recent browsers"; it is the wrong one for a project that has told a customer which browsers it supports, and the fix is one line: write the versions out.

**★ Vite 8 changed minifier. What is the practical consequence when minified code misbehaves?**
That the assumptions changed with it. The migration guide says plainly that esbuild and the Oxc Minifier *"make slightly different assumptions about source code"* and links both projects' assumption documents. Minifiers are only safe to the extent that your code does not rely on behaviour they assume away — property access patterns that defeat mangling, code that depends on function `name`, reliance on a `toString` of a function body. So the correct debugging move is not to bisect your source: it is to establish which minifier is running, read that minifier's assumptions, and check whether your code violates one. Disabling minification to confirm the diagnosis is cheap and should come first.

**★ Why does `build.cssTarget` exist separately from `build.target`?**
Because JavaScript support and CSS support in a browser engine are not the same set. The docs give a concrete case: an embedded WebView that handles modern JavaScript fine but does not understand `#RGBA` hexadecimal colour notation, so the CSS minifier's perfectly valid lowering of `rgba()` produces something that engine cannot render. Setting `cssTarget` to an older browser holds the CSS minifier back without forcing every JavaScript file through unnecessary lowering. The documentation is clear that this is a narrow tool — *"It should only be used when you are targeting a non-mainstream browser"* — and that its default of "same as `build.target`" is right for everyone else.

**★ The SSR build defaults to no minification. Is that a bug?**
No, it is the correct default and the reasoning is worth being able to state. Minification pays for itself when bytes cross a network to a client that must parse them; a server bundle is read from local disk by a process you control, so the transfer saving is zero. What you give up by minifying it is real: readable stack traces in production incidents, and the ability to reason about a deployed artefact. So the default is `'oxc'` for the client build and `false` for SSR. The only cases for overriding it are deployment targets that price or limit by bundle size — some edge and serverless platforms do — and there the trade should be made knowingly.

---

← [01g · Preloading and cache granularity](01g-preloading-and-cache-granularity.md) · [Vite overview](../../README.md) · Next → [Path Resolution & Aliases](../12-path-resolution-and-aliases/01-resolve-options.md)
