---
title: "`index.html` is a shell the build rewrites — no `<script>` or `<link>` tags because the builder injects hashed ones, no `index` key in `angular.json`, and a `<title>` spelled by `utils.classify`"
sidebar_label: "03b · `index.html` is a shell the build rewrites"
sidebar_position: 3.1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** — the `application` schematic's [`common-files/src/index.html.template`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/files/common-files/src/index.html.template) and [`application/index.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/index.ts) in `angular/angular-cli` at tag `v22.1.7`; and angular.dev — [Workspace and project file structure](https://angular.dev/reference/configs/file-structure), quoted verbatim.
> Split out of [03 · The `src` directory](03-the-src-directory.md) on 2026-09-10, on a concept
> boundary. Documentation-validated; **no sandbox run** — every file is read from its `.template`
> source, not captured from a generated project.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**The `index.html` you write is a shell, and the one the browser receives is a different file.** The
builder injects the hashed bundle tags, inlines critical CSS and can rewrite font links; nothing in
the generated `angular.json` even names the source file; and its `<title>` is a PascalCase spelling
of your project name that `package.json` spells in kebab-case.

## There are no `<script>` and no `<link rel="stylesheet">` tags, and that is the point

angular.dev, verbatim, on exactly this:

> *"The CLI automatically adds all JavaScript and CSS files when building your app, so you typically
> don't need to add any `<script>` or `<link>` tags here manually."*

You write the shell; the builder writes the loading. The emitted bundles carry content hashes, so
their filenames are not knowable when you are editing the source — which is the mechanical reason
hand-adding a tag cannot work in the general case.

⚠️ **The built `index.html` is generated, not copied.** Beyond injecting the bundles, the
production build inlines critical CSS into a `<style>` element and can rewrite external font links
at build time. A deploy check that diffs the built file against `src/index.html` will fail on every
build, by design —
[03d · Critical CSS and font inlining](../05-the-build-angular-build/03d-critical-css-and-font-inlining.md)
is the full list of what rewrites it.

If you genuinely need a third-party script that is not part of the module graph, the supported
route is the `scripts` array in `angular.json`, which is a different mechanism from an `import` and
behaves differently —
[10 · `assets`, `styles`, `scripts`](../06-angular-json-anatomy/10-assets-styles-and-scripts.md).

## Nothing in `angular.json` names this file

The generated `build` target sets four options: `browser`, `tsConfig`, `assets` and `styles`. There
is **no `index` key**, yet the build uses `src/index.html`.

```json
"options": {
  "browser": "src/main.ts",
  "tsConfig": "tsconfig.app.json",
  "assets": [{ "glob": "**/*", "input": "public" }],
  "styles": ["src/styles.css"]
}
```

⚠️ [11 · `outputPath`, `index`, `dist`](../06-angular-json-anatomy/11-outputpath-index-and-dist.md)
records that the builder schema declares **no default** for `index` either, and that the fallback to
`src/index.html` is not documented. Treat the path as a convention the builder happens to honour
rather than a guarantee: if you move the file, set `index` explicitly instead of assuming discovery.

## `utils.classify` and `utils.dasherize` — one name, two spellings, two files

The `<title>` comes from `utils.classify(name)`, so `ng new my-app` produces `<title>MyApp</title>`.
The workspace `package.json` written by the *other* schematic uses `utils.dasherize(name)` for its
`"name"` field, producing `"my-app"`. Both are `@angular-devkit/core` string helpers applied to the
same input; one normalises to PascalCase and the other to kebab-case, which is why the two
generated files disagree about how your project is spelled. Neither is authoritative — the `<title>`
in particular is placeholder text that ships to production more often than anyone would like.

## Gotchas

**★ Symptom: you added a `<script src="vendor.js">` to `index.html` and it is neither hashed,
bundled, nor processed.** Cause: hand-written tags are passed through the HTML rewriter untouched;
only the builder's own injected tags carry content hashes. Fix: import the code so it joins the
module graph, or register it as a build-level script in `angular.json` if it genuinely must be a
separate `<script>`:

```json
"options": {
  "scripts": ["node_modules/vendor-lib/dist/vendor.js"]
}
```

**Symptom: a CI job that diffs the deployed `index.html` against `src/index.html` fails on every
build.** Cause: the built file is generated — bundle tags with hashes, inlined critical CSS,
possibly rewritten font links. Fix: assert on the artefact's existence and shape, not on byte
equality with the source:

```bash
test -f dist/my-app/browser/index.html || { echo "browser output missing"; exit 1; }
```

The full list of what rewrites it is
[03d · Critical CSS and font inlining](../05-the-build-angular-build/03d-critical-css-and-font-inlining.md).

**Symptom: the production tab title reads `MyApp`.** Cause: `<title>` is rendered from
`utils.classify(name)` at generation time and is placeholder text like any other. Fix: set it in
`index.html`, or set it per route at runtime:

```html
<title>Acme Invoicing</title>
```

## Interview questions

**★ `index.html` has no script tags. How does the application load at all?**
The builder writes them. angular.dev: *"The CLI automatically adds all JavaScript and CSS files when
building your app, so you typically don't need to add any `<script>` or `<link>` tags here
manually."* The emitted bundles carry content hashes, so their filenames do not exist until the
build runs — which is the mechanical reason you cannot hand-write the tags even if you wanted to.
The built `index.html` is a generated artefact, not your source file with two lines appended.

**Why is the `<title>` PascalCase when the package name is kebab-case?**
Two different string helpers on the same input. `index.html` renders
`<title><%= utils.classify(name) %></title>`, and the workspace `package.json` renders
`"name": "<%= utils.dasherize(name) %>"`. Neither spelling is authoritative — it is a template
author's choice per file, and the `<title>` in particular is placeholder text that regularly reaches
production untouched.

---

← Prev: [03 · The `src` directory](03-the-src-directory.md) · Index: [Topic index](README.md) · Next → [03c · `styles.css` and its extension](03c-styles-css-and-its-extension.md)
