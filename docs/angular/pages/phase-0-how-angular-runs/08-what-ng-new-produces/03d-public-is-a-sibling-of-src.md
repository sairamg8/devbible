---
title: "`public/` is a sibling of `src/`, not a folder inside it — copied as-is to the output root, never fingerprinted, and silently ignored if you use the old `src/assets/`"
sidebar_label: "03d · `public/` is a sibling of `src/`"
sidebar_position: 3.3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** — the `application` schematic's [`common-files/public/favicon.ico.template`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/files/common-files/public/favicon.ico.template) in `angular/angular-cli` at tag `v22.1.7`; and angular.dev — [Workspace and project file structure](https://angular.dev/reference/configs/file-structure), quoted verbatim.
> Split out of [03 · The `src` directory](03-the-src-directory.md) on 2026-09-10, on a concept
> boundary. Documentation-validated; **no sandbox run** — every file is read from its `.template`
> source, not captured from a generated project.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**In a v22 workspace static assets live in `public/`, a sibling of `src/` — not in the `src/assets/`
every older tutorial names.** Its files are copied as-is to the output root, so the folder name never
appears in a URL and nothing in it is content-hashed.

## `public/` is a sibling of `src/`, not a folder inside it

The only template is `common-files/public/favicon.ico.template` — a binary file, so its contents are
not reproduced here. angular.dev, verbatim:

> *"Contains image and other asset files to be served as static files by the dev server and copied
> as-is when you build your application."*

🔴 **The path in the schematic is `common-files/public/`, alongside `common-files/src/`.** Angular
16 and earlier put assets in `src/assets/`; v22 puts them in a root-level `public/`. Every tutorial
written before the change tells you to drop files into `src/assets/`, and in a v22 workspace that
directory is not referenced by anything at all — the files are simply not copied and there is no
error to notice.

Two consequences follow from *"copied as-is"*:

- **`index.html` references the icon as `href="favicon.ico"`, not `href="public/favicon.ico"`.** The
  contents of `public/` land at the output root, so the folder name never appears in a URL. The
  mapping is the default `assets` entry in `angular.json`,
  `{ "glob": "**/*", "input": "public" }` —
  [10 · `assets`, `styles`, `scripts`](../06-angular-json-anatomy/10-assets-styles-and-scripts.md)
  owns the option.
- **Nothing in `public/` is fingerprinted.** `outputHashing` applies to the bundles the build emits,
  not to files it copies, so a changed `public/logo.svg` keeps its URL and can be served from a
  cache indefinitely. That is a cache-busting problem you solve yourself, and the same page above
  covers it.

## Gotchas

**★ Symptom: you created `src/assets/`, put images in it, and nothing is served.** Cause: v22 copies
`public/`, not `src/assets/` — the default `assets` entry names `public` as its input and no rule
mentions `src/assets` at all. Fix: move the files, and keep the reference relative to the output
root:

```html
<img src="logo.svg" alt="Logo">
```

with the file at `public/logo.svg`.

**Symptom: a changed image in `public/` is still stale for returning users after a deploy.** Cause:
files copied through `assets` are not fingerprinted, so the URL is identical before and after.
Fix: version the filename yourself, or move the asset into the module graph so the build hashes it:

```ts
import logoUrl from './logo.svg';
```

## Interview questions

**Where do static assets go in a v22 workspace, and why do older tutorials get it wrong?**
`public/`, which is a **sibling** of `src/`, not a folder inside it. Angular 16 and earlier used
`src/assets/`. In a v22 workspace `src/assets/` is referenced by nothing, so files placed there are
silently not copied — no warning, no error, just a 404 at runtime. The default `assets` entry is
`{ "glob": "**/*", "input": "public" }`, and because those files are copied as-is they are also not
content-hashed.

**Why does moving a file out of `public/` and into `src/` sometimes fix a caching problem?**
Because it changes which mechanism handles the file. Anything under `public/` is copied verbatim by
the `assets` rule and keeps its filename forever, so a deploy cannot invalidate a cached copy.
Anything reached through the module graph is processed by the build and participates in
`outputHashing`, so a change produces a new URL. Neither is universally right — copied assets are
addressable by a stable URL, which is exactly what you want for `favicon.ico` and exactly what you
do not want for a logo you intend to update.

---

← Prev: [03c · `styles.css` and its extension](03c-styles-css-and-its-extension.md) · Index: [Topic index](README.md) · Next → [03e · `main.ts` and the load-bearing `.catch`](03e-main-ts-and-the-load-bearing-catch.md)
