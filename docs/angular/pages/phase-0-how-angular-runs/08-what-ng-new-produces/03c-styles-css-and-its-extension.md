---
title: "`src/styles.css` is one comment line whose name and extension are a CLI option — and `--style=tailwind` quietly renders `.css`"
sidebar_label: "03c · `styles.css` and its extension"
sidebar_position: 3.2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** — the `application` schematic's [`common-files/src/styles.__style__.template`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/files/common-files/src/styles.__style__.template) and [`application/index.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/schematics/angular/application/index.ts) in `angular/angular-cli` at tag `v22.1.7`; and angular.dev — [Workspace and project file structure](https://angular.dev/reference/configs/file-structure), quoted verbatim.
> Split out of [03 · The `src` directory](03-the-src-directory.md) on 2026-09-10, on a concept
> boundary. Documentation-validated; **no sandbox run** — every file is read from its `.template`
> source, not captured from a generated project.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**`src/styles.css` is a one-line comment, and both its name and its extension come from a CLI
option.** `--style` picks the extension and writes the matching `styles` entry in `angular.json`,
`--style=tailwind` is rewritten to `css` before any template renders, and "global" stops at a
component's view encapsulation.

## `src/styles.css` is one line, and its extension is an option

The template is a single comment:

```css
/* You can add global styles to this file, and also import other style files */
```

angular.dev, verbatim:

> *"Global CSS styles applied to the entire application."*

The `__style__` in the filename `styles.__style__.template` is substituted from the `style` option,
whose default is `"css"`. `--style=scss` yields `src/styles.scss`, and the `styles` array in
`angular.json` is built from the same option — the schematic writes
`` `${sourceRoot}/styles.${options.style}` ``, so the file and the reference to it can never
disagree at generation time. They disagree the moment you rename the file by hand.

The full enum is `["css", "scss", "sass", "less", "tailwind"]`, and the last of those is not like
the others. From `application/index.ts` at `v22.1.7`, verbatim:

```ts
const isTailwind = options.style === Style.Tailwind;
if (isTailwind) {
  options.style = Style.Css;
}
```

So `--style=tailwind` produces `.css` files, because the option is rewritten to `Css` before the
templates are rendered, and something else must then supply the Tailwind wiring. ⚠️ **What that
something else is was not verified.** `tailwindcss` and `@tailwindcss/postcss` appear in the CLI's
`latest-versions` list, which is consistent with dependencies being added, but the code path that
adds them was not read. State the reassignment, name the option, and go no further than that.

⚠️ **`styles.css` being "global" does not mean it reaches inside components.** Styles declared on a
component are scoped by view encapsulation, and a global rule will not cross that boundary. That
mechanism belongs to **Phase 1 — Components and templates** *(not written yet)*; the file itself has
nothing to do with it.

## Gotchas

**Symptom: you renamed `src/styles.css` to `styles.scss` and global styles stopped applying.**
Cause: `angular.json`'s `styles` array names the file by path; the rename left the array pointing at
a file that no longer exists. Fix: update the array in the same change:

```json
"styles": ["src/styles.scss"]
```

**Symptom: a rule in `styles.css` has no effect on markup inside a component.** Cause: view
encapsulation scopes component styles, and a global rule does not cross that boundary. This is not a
property of the file. Fix: put the rule where it applies — on the component — or use an
encapsulation-aware selector; **Phase 1 — Components and templates** *(not written yet)* owns the
mechanism.

## Interview questions

**What does `--style=tailwind` actually generate?**
It generates `.css` files, not something Tailwind-specific, because `application/index.ts` rewrites
the option before rendering any template:
`const isTailwind = options.style === Style.Tailwind;` followed by `options.style = Style.Css;`. The
option therefore selects a *pipeline*, not a file extension. What the schematic does beyond that
reassignment was not verified for this page and should not be asserted; `tailwindcss` and
`@tailwindcss/postcss` appear in the CLI's version list, which is consistent with dependencies being
installed, but the code path was not read.

---

← Prev: [03b · `index.html` is a shell the build rewrites](03b-index-html-is-a-shell-the-build-rewrites.md) · Index: [Topic index](README.md) · Next → [03d · `public/` is a sibling of `src/`](03d-public-is-a-sibling-of-src.md)
