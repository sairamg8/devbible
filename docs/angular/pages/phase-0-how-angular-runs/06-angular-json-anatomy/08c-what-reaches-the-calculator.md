---
title: "Only `.js` and `.css` output ever reaches a budget calculator, and server bundles are excluded outright — so `all` cannot see the four megabytes of images in `public/`, whatever “the size of the entire application” suggests"
sidebar_label: "08c · What reaches the calculator"
sidebar_position: 8.2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** — the filtering and the component-style
> handling quoted verbatim from
> [`packages/angular/build/src/tools/esbuild/budget-stats.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/tools/esbuild/budget-stats.ts),
> cross-read against
> [`packages/angular/build/src/utils/bundle-calculator.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/utils/bundle-calculator.ts),
> both at tag `v22.1.7`; the type descriptions quoted from
> [angular.dev/tools/cli/build](https://angular.dev/tools/cli/build#configuring-size-budgets).
> ⚠️ Where the source and the published description differ, this page states both and does not
> reconcile them.
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Before any calculator runs, the builder decides which output files it is allowed to see — and the
decision is two `continue` statements wide.** Everything downstream, including the two budget types
the documentation describes in the broadest possible terms, is constrained by them. This page is
that filter, and the second, stranger fact it produces: component-style budgets are measured on
your **source** file, not on an output bundle. The calculators themselves are
[08b](08b-what-each-type-sums.md).

## The two guards

The stats object handed to the calculators is built by `generateBudgetStats`, which walks the
build's output files. Two guards sit at the top of that loop, and they are the whole of the
filtering:

```ts
if (!file.endsWith('.js') && !file.endsWith('.css')) {
  continue;
}
```

```ts
// Exclude server bundles
if (type === BuildOutputFileType.ServerApplication || type === BuildOutputFileType.ServerRoot) {
  continue;
}
```

Both are inside `for (const { path: file, size, type } of outputFiles)`; the remainder of the loop
body pushes the surviving file onto the asset list the calculators receive.

🔴 **So only `.js` and `.css` output ever becomes a budgeted asset, and server output never does.**
Images, fonts, `index.html`, the web app manifest, `favicon.ico` and everything else copied from
`public/` are invisible to every budget type.

## What that does to `all` and `any`

The documentation describes those two types in the broadest terms available:

> *"| `all` | The size of the entire application. |"*

> *"| `any` | The size of any file. |"*

Under the `application` builder at 22.1.7 neither is literally true. `all` sums the surviving `.js`
and `.css` assets minus `.map` files and component styles; `any` applies its threshold to each of
those same assets. Neither can include an image, a font or the HTML document, because the guard
above discarded them before the calculator existed.

⚠️ **This page states the discrepancy and does not resolve it.** No test, changelog entry or
documentation page was found confirming that the narrower behaviour is intended rather than a gap.
What is certain is the code path: `budget-stats.ts` at `v22.1.7` filters on those two extensions,
and the calculators can only work with what it gives them.

The practical reading: **budgets are a JavaScript-and-CSS guard.** If a four-megabyte hero image
lands in `public/`, no budget type will notice, and a size check that needs to cover static assets
has to live outside `angular.json`.

## Server output is excluded, and that is deliberate

The second guard names two output types explicitly and carries its own comment,
`// Exclude server bundles`. The consequence for a server-rendered application is worth stating
plainly: **your `initial` budget measures the browser bundle only.** A server bundle that doubles
in size crosses no threshold, which is correct — nobody downloads it — but it does mean a budget
cannot be used to watch server-side growth.

## `anyComponentStyle` measures your source file

Component styles are added to the stats from a different place entirely, and the comment in the
source is candid about why:

```ts
// Add component styles from metafile
// TODO: Provide this information directly from the AOT compiler
for (const [file, entry] of Object.entries(metafile.outputs)) {
  if (!file.endsWith('.css')) { continue; }
  // 'ng-component' is set by the angular plugin's component stylesheet bundler
  const componentStyle: boolean = (entry as any)['ng-component'];
  if (!componentStyle) { continue; }

  stats.assets.push({
    // Component styles use the input file
    name: Object.keys(entry.inputs)[0],
    size: entry.bytes,
    componentStyle,
  });
}
```

Three facts fall out of it:

1. **The `name` is the input path**, taken from `Object.keys(entry.inputs)[0]`. That is why an
   `anyComponentStyle` failure names `src/app/reports/reports.scss` and not a hashed output file.
2. **The `size` is the output size** — `entry.bytes` from the metafile — so a 2 kB SCSS source that
   compiles to 9 kB of CSS is measured at the compiled size against a name that reads like the
   source.
3. **Identification is by an esbuild metafile flag**, `ng-component`, set by the Angular plugin's
   component-stylesheet bundler. Nothing about the file's location or extension marks it; a
   stylesheet listed in `options.styles` is a global stylesheet and is not flagged.

## Gotchas

**★ Symptom: an `all` budget passes even though `public/` contains four megabytes of images.**
Cause: only `.js` and `.css` output reaches the calculators, so images are never counted. Fix:
budgets cannot do this — check static asset weight in CI outside `angular.json`, and keep the
budget for what it can see:

```json
{ "budgets": [{ "type": "all", "maximumError": "2MB" }] }
```

**★ Symptom: an `anyComponentStyle` failure names a `.scss` file that is only two kilobytes.**
Cause: the name comes from the metafile's input path while the size comes from the compiled output
bytes — a small source can expand considerably. Fix: nothing is wrong; measure the compiled size
before setting the threshold rather than reading the source file's size:

```json
{ "type": "anyComponentStyle", "maximumWarning": "4kB", "maximumError": "8kB" }
```

**★ Symptom: an SSR application's `initial` budget is unaffected by a server bundle that doubled.**
Cause: `generateBudgetStats` skips `ServerApplication` and `ServerRoot` output outright. Fix:
expected and correct — no user downloads the server bundle. Watch it with a separate check if it
matters operationally:

```json
{ "budgets": [{ "type": "initial", "maximumError": "1MB" }] }
```

**★ Symptom: a global stylesheet listed in `options.styles` never triggers `anyComponentStyle`.**
Cause: the type keys off the `ng-component` metafile flag set by the component-stylesheet bundler,
not off the file being CSS. A global stylesheet is not a component style. Fix: budget it as part of
`all`, or as `any` if you want a per-file threshold on it:

```json
{ "budgets": [{ "type": "any", "maximumError": "150kb" }] }
```

**★ Symptom: `index.html` grew substantially and no budget noticed.** Cause: the extension guard
admits only `.js` and `.css`. Fix: budgets cannot see it; if the size of the document matters — for
example because critical CSS is being inlined into it — measure it outside the build:

```json
{ "budgets": [{ "type": "all", "maximumError": "2MB" }] }
```

**Symptom: a font subsetting change makes no difference to any budget.** Cause: fonts are not
`.js` or `.css` output. Fix: expected. The `.css` that *references* the font is counted; the font
file is not:

```json
{ "budgets": [{ "type": "allScript", "maximumError": "1.5MB" }] }
```

**Symptom: someone quotes *"the size of the entire application"* to argue a budget should have
caught an asset regression.** Cause: the published description is broader than the implementation
at 22.1.7. Fix: cite the filter rather than arguing about the sentence — and set expectations that
budgets are a JavaScript-and-CSS guard:

```json
{ "budgets": [{ "type": "allScript", "maximumError": "1.5MB" }, { "type": "any", "maximumError": "300kb" }] }
```

**Symptom: two component stylesheets with the same filename produce confusing failures.** Cause:
the reported name is the input path from the metafile, so it is the full path rather than a bare
filename — but a build log that truncates paths can make two look identical. Fix: read the full
path in the message; the entry identifies the exact source file:

```json
{ "type": "anyComponentStyle", "maximumError": "8kB" }
```

## Interview questions

**★ Does an `all` budget cover images and fonts?**
No. Before any calculator runs, `generateBudgetStats` discards every output file whose path does not
end in `.js` or `.css`, and separately discards server output. So `all` and `any` cover scripts and
stylesheets only — images, fonts and `index.html` are invisible to every budget type. That is
narrower than the published descriptions, which say *"the size of the entire application"* and
*"the size of any file"*, and no source was found confirming the narrower behaviour is intended
rather than a gap. The safe framing is that budgets are a JavaScript-and-CSS guard.

**★ Why does an `anyComponentStyle` failure name a `.scss` file rather than a bundle?**
Because component styles are added to the stats from the esbuild metafile, and the code takes the
name from the *input* — `Object.keys(entry.inputs)[0]` — while taking the size from the compiled
output, `entry.bytes`. The comment in the source says so directly: *"Component styles use the input
file."* It is a deliberate usability choice: a hashed output filename would tell you nothing about
which component to go and fix. The consequence to remember is that the name and the number come
from different sides of the compilation, so a small SCSS file can legitimately report a large size.

**★ How does the builder know which stylesheets are component styles?**
By a flag on the esbuild metafile entry, `ng-component`, set by the Angular plugin's component
stylesheet bundler. Nothing about the file's location, extension or naming is involved. That is why
a global stylesheet listed in `options.styles` is never subject to an `anyComponentStyle` budget
however you organise your files — the classification is made by the tool that compiled it, not by
convention.

**Why is server output excluded from budgets?**
Because a budget is a proxy for what a user downloads, and nobody downloads the server bundle. The
guard names the two server output types explicitly and carries the comment
`// Exclude server bundles`. It is the right default, and it has one consequence worth planning
around: if server bundle size matters operationally — cold-start time on a serverless platform, for
example — no budget type will watch it for you.

**A colleague says a budget should have caught a large image being committed. What do you tell
them?**
That budgets never see it. The filter admits only `.js` and `.css` output, so an image in `public/`
is copied to the output directory without ever becoming a budgeted asset. Then point at the useful
version of what they want: a check on the size of the output directory, or on the repository, run
in CI alongside the build. It is worth being precise about the boundary rather than leaving the
team believing the guard is broader than it is.

**Why is the component-style size taken from the metafile rather than from the output files?**
Because the association between a compiled CSS output and the component it came from only exists in
the metafile, which records the inputs each output was produced from. The source even carries a
`TODO` about getting the information directly from the AOT compiler instead. Reading the metafile is
what makes it possible to report a per-component failure with a name a developer can act on, which
is the entire point of the `anyComponentStyle` type.

{/* FOOTER */}
