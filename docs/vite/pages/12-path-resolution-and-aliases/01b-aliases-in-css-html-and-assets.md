---
title: "resolve.alias reaches into CSS @import and url() because Vite's own CSS pipeline rewrites them through the same resolver, but a raw HTML attribute is a string the browser reads directly and no alias will ever touch it"
sidebar_label: "01b · Aliases in CSS, HTML & assets"
sidebar_position: 3
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-08 against the Vite documentation — [Features](https://vite.dev/guide/features), [Static Asset Handling](https://vite.dev/guide/assets), [Shared Options](https://vite.dev/config/shared-options). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-08 · claims + output provenance · session 82249172

# ⚡ Aliases in CSS, HTML & assets

**Whether `resolve.alias` applies to a given specifier depends entirely on which pipeline reads that specifier, not on what the specifier looks like.** A CSS `@import` and a CSS `url()` are both parsed and rewritten by Vite's own CSS transform, which explicitly consults the alias table before resolving. An HTML `<script type="module" src>` or `<link href>` is processed as an entry point Vite crawls and rewrites. A raw `<img src="@/logo.png">` sitting in an HTML file is neither — it is markup the browser parses and requests exactly as written, so an alias defined for JS/CSS module resolution has nothing to rewrite.

## CSS `@import` and `url()` — the alias table is consulted directly

Vite ships PostCSS-based `@import` inlining, and the documentation states plainly that the alias table applies to it:

> *"Vite is pre-configured to support CSS `@import` inlining via `postcss-import`. Vite aliases are also respected for CSS `@import`."* — [Features](https://vite.dev/guide/features)

```css
/* src/styles/theme.css */
@import '@/styles/tokens.css'; /* '@' resolves via the SAME resolve.alias table used for JS */
```

The two CSS preprocessors Vite treats specially get the identical courtesy, with one exception:

> *"Vite improves `@import` resolving for Sass and Less so that Vite aliases are also respected."* … *"@import aliases and URL rebasing are also supported for Sass and Less files."* — [Features](https://vite.dev/guide/features)

> *"`@import` alias and url rebasing are not supported for Stylus due to its API constraints."* — [Features](https://vite.dev/guide/features)

`url()` gets its own, separate guarantee that has nothing to do with aliasing directly but matters for the same reason people reach for aliases — it removes "relative to what?" ambiguity for a moved file:

> *"In addition, all CSS `url()` references, even if the imported files are in different directories, are always automatically rebased to ensure correctness."* — [Features](https://vite.dev/guide/features)

```css
/* src/components/Card.module.css */
.background {
  background-image: url('@/assets/hero.jpg'); /* alias resolved, same table as JS */
}
```

There is a documented gap in the rebasing guarantee, and it is worth knowing before debugging a background-image that "should" have rebased and didn't:

> *"Rebasing `url()` references that start with a variable or an interpolation is not supported due to its API constraints."* — [Features](https://vite.dev/guide/features)

```scss
// src/styles/_theme.scss
$icon-dir: '@/assets/icons';
.icon {
  // ❌ NOT rebased/aliased — the url() value starts with a Sass variable, which the
  // rebasing/alias machinery explicitly does not support
  background: url($icon-dir + '/star.svg');
}
```

## Where the alias table is silent: raw HTML attributes

Vite's own framing of HTML is as an entry point it crawls and transforms — but only specific elements are named as going through that pipeline:

> *"Assets referenced by HTML elements such as `<script type="module" src>` and `<link href>` are processed and bundled as part of the app."* — [Features](https://vite.dev/guide/features)

`<script type="module" src="@/main.ts">` and `<link rel="stylesheet" href="@/theme.css">` are inside that named set — Vite's HTML processing rewrites those specifiers, including alias substitution, because they are treated as entry points into the module graph. An `<img src>`, an inline `style="background-image: url(...)"`, or any other bare HTML attribute is not named in that guarantee, and the documentation does not state that aliases apply there. Treat it as unconfirmed rather than assuming either way, and prefer the pattern that is documented instead:

```html
<!-- index.html -->
<!-- ✅ documented: goes through Vite's HTML asset processing, alias applies -->
<script type="module" src="/src/main.ts"></script>
<link rel="stylesheet" href="/src/theme.css" />

<!-- ❌ do not rely on an alias resolving here — not named in the documented set,
     and the browser would request this path literally if it were never rewritten -->
<img src="@/logo.png" alt="logo" />

<!-- ✅ CORRECT alternative for a raw HTML attribute: import the asset from a
     module and let the resolved URL be interpolated, OR use a root-absolute
     public-directory path, which IS a documented, stable convention -->
<img src="/logo.png" alt="logo" />
```

The public directory is the documented, guaranteed-stable mechanism for exactly this case — a path that needs to be a literal, unprocessed string, including inside raw HTML markup:

> *"you should always reference `public` assets using root absolute path — for example, `public/icon.png` should be referenced in source code as `/icon.png`."* — [Static Asset Handling](https://vite.dev/guide/assets)

A `public/`-relative root path is not an alias and does not go through `resolve.alias` at all — it is a separate, simpler convention that exists precisely for the surfaces (raw HTML, some JS string concatenation) where alias resolution does not reach.

## Getting an alias-resolved asset into raw HTML anyway — resolve it from JS first

If the actual requirement is "this HTML attribute must point at a file under an aliased directory," the documented path is to resolve it as a module import and let Vite compute the final URL, rather than to hope the alias fires inside the markup:

```typescript
// src/main.ts
import logoUrl from '@/assets/logo.png'; // '@' resolves via resolve.alias — this IS a JS import
document.querySelector<HTMLImageElement>('#logo')!.src = logoUrl;
```

```html
<!-- index.html -->
<img id="logo" alt="logo" />
<script type="module" src="/src/main.ts"></script>
```

This works precisely because the alias is doing what it is documented to do — resolving a module specifier in JS — and the HTML never needed to contain an aliased path at all.

## Glob imports accept an alias path as one of three specifier shapes

`import.meta.glob` treats an alias-prefixed pattern as a first-class specifier form, on equal footing with relative and root-absolute patterns — this is a separate, explicitly documented acceptance of alias syntax outside plain `import`/`require`:

> *"The glob patterns are treated like import specifiers: they must be either relative (start with `./`) or absolute (start with `/`, resolved relative to project root) or an alias path (see [`resolve.alias` option](https://vite.dev/config/shared-options#resolve-alias))."* — [Features](https://vite.dev/guide/features)

```typescript
// src/pages/index.ts — '@/pages/**/*.tsx' is a legal glob pattern because '@' is a
// registered resolve.alias entry, exactly like a normal import specifier would be
const pages = import.meta.glob('@/pages/**/*.tsx');
```

## Gotchas

**★ Symptom: an alias resolves correctly in a `.ts`/`.tsx` import but the exact same alias string in an `<img src="@/logo.png">` in `index.html` produces a literal, broken request for a path called `@/logo.png`.** Cause: raw HTML attributes are not named in the documented set of HTML elements Vite processes (`<script type="module" src>`, `<link href>`) — the browser requests the attribute value exactly as written, with no alias substitution. Fix: either import the asset from a JS module and assign the resolved URL to the attribute at runtime, or reference it via the `public/` directory's root-absolute convention (`/logo.png`), which is documented to work as a literal path.

**★ Symptom: a Sass `background: url($icon-dir + '/star.svg')` never gets rebased or alias-resolved, even though a sibling rule with a literal string does.** Cause: documented exception — *"Rebasing `url()` references that start with a variable or an interpolation is not supported due to its API constraints."* Fix: inline the literal path in the `url()` call, or move the aliasing to the JS side (import the asset and interpolate the resolved URL into the stylesheet via a CSS custom property or CSS-in-JS).

**★ Symptom: `@import '@/theme.styl'` in a Stylus file resolves to nothing, while the identical pattern works in a sibling `.scss` file.** Cause: documented, explicit exclusion — *"`@import` alias and url rebasing are not supported for Stylus due to its API constraints."* Fix: use a real relative path in Stylus `@import` statements, or move the shared file's authoring format to Sass/Less if alias support in imports is required.

**★ Symptom: `import.meta.glob('@ui/components/**')` throws or matches nothing, and swapping it for a relative pattern fixes it immediately.** Cause: the glob pattern is only treated as an alias path if `@ui` is a registered `resolve.alias` entry at all — the acceptance of alias syntax in glob patterns is real and documented, but it still requires the alias to exist; a typo'd or unregistered prefix simply fails to match as a legal specifier. Fix: confirm the exact alias key in `resolve.alias`, including case, before assuming glob's alias support is broken.

## Interview questions

**★ Why does `@import '@/tokens.css'` work in a stylesheet but `<img src="@/logo.png">` does not work in the HTML file that loads that same stylesheet?**
Because the two are handled by different Vite subsystems, and only one of them is documented to consult `resolve.alias`. The CSS `@import` is parsed and rewritten by Vite's own CSS transform, which the documentation states explicitly respects Vite aliases. The HTML file's asset processing is documented to apply to specific elements — `<script type="module" src>` and `<link href>` — that are treated as entry points into the module graph; a bare `<img src>` attribute is not named in that set, so nothing rewrites it, and the browser requests exactly the literal string that was written.

**★ Given that `public/icon.png` must be referenced as `/icon.png`, is that a `resolve.alias` entry?**
No — it is a separate, simpler convention specific to the `public/` directory, documented on its own terms ("root absolute path"), and it does not pass through `resolve.alias` at all. It exists precisely because some contexts (raw HTML attributes, string concatenation in JS that never becomes a static `import`) cannot rely on module-resolution-time alias substitution; a root-absolute public path is resolved at request time by the dev server and copied verbatim at build time, independent of the alias table entirely.

**★ A Sass file uses a variable to build up a `url()` path for a background image, and the resulting path is never rebased when the file that imports it moves to a different directory. Is this a resolve.alias bug?**
No — it is a documented API limitation of the CSS preprocessor integration, not of aliasing: "Rebasing `url()` references that start with a variable or an interpolation is not supported due to its API constraints." The fix has nothing to do with `resolve.alias` configuration; it requires either writing the `url()` value as a literal string (so rebasing can apply) or resolving the asset from JS and injecting the final URL, sidestepping the CSS preprocessor's rebasing step entirely.

---

← [01a · tsconfig paths vs resolve.alias](01a-tsconfig-paths-and-vite-alias.md) · [Vite overview](../../README.md) · Next → [01c · resolve.extensions](01c-resolve-extensions.md)
