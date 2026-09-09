---
title: "`loader` decides what importing a `.svg` actually gives you — a string, a byte array, a URL, or nothing at all — and it is the one option list where the choice is a caching decision in disguise"
sidebar_label: "10b · `loader`"
sidebar_position: 10.1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** —
> [angular.dev/tools/cli/build-system-migration](https://angular.dev/tools/cli/build-system-migration),
> quoted verbatim, cross-checked against
> [`packages/angular/build/src/builders/application/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/application/schema.json)
> and the `dev-server` schema at tag `v22.1.7`.
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Six loaders, keyed by file extension, and the interesting one is `empty`.** The first five decide
how a non-code file reaches your bundle; `empty` deletes the import entirely, which exists for
libraries that use bundler-specific import syntax the browser has never supported. Choosing between
the others looks like a formatting question and is really a caching one. The companion option that
replaces identifiers at build time is [10 · `define`](10-features-only-this-builder-has.md).

## `loader` — what importing a non-code file gives you

> *"IMPORTANT: This feature is only available with the `application` builder."*

Six loaders, verbatim:

> *"- `text` - inlines the content as a `string` available as the default export*
> *- `binary` - inlines the content as a `Uint8Array` available as the default export*
> *- `file` - emits the file at the application output path and provides the runtime location of the file as the default export*
> *- `dataurl` - inlines the content as a [data URL](https://developer.mozilla.org/docs/Web/HTTP/Basics_of_HTTP/Data_URIs).*
> *- `base64` - inlines the content as a Base64-encoded string.*
> *- `empty` - considers the content to be empty and will not include it in bundles"*

| Loader | You get | Cost |
|---|---|---|
| `text` | a `string` | the content is in your bundle |
| `binary` | a `Uint8Array` | the content is in your bundle |
| `file` | a URL string | an extra request, cacheable separately |
| `dataurl` | a `data:` URL string | inlined, ~33% larger than the bytes |
| `base64` | a Base64 `string` | inlined, ~33% larger |
| `empty` | nothing | the import is erased |

Configured by extension:

```json
{
  "builder": "@angular/build:application",
  "options": {
    "loader": {
      ".svg": "text"
    }
  }
}
```

```ts
import contents from './some-file.svg';

console.log(contents); // <svg>...</svg>
```

And TypeScript needs a module declaration, because nothing in the type system knows what a `.svg`
import produces:

```ts
declare module '*.svg' {
  const content: string;
  export default content;
}
```

**`empty` is the interesting one**, and it exists for a problem you will eventually hit:

> *"The `empty` value, while less common, can be useful for compatibility of third-party libraries
> that may contain bundler-specific import usage that needs to be removed. One case for this is
> side-effect imports (`import 'my.css';`) of CSS files which has no effect in a browser. Instead,
> the project can use `empty` and then the CSS files can be added to the `styles` build option or use
> some other injection method."*

A library that does `import 'my.css'` is relying on a bundler convention, not on anything the
browser or the specification provides. `empty` deletes the import, and you add the stylesheet
through `styles` where it belongs:

```json
{
  "options": {
    "loader": { ".css": "empty" },
    "styles": ["node_modules/some-lib/dist/my.css", "src/styles.css"]
  }
}
```

⚠️ That example is deliberately blunt: setting `".css": "empty"` is global, so it disables *every*
side-effect CSS import in the build, including ones you wanted. Prefer a per-file import attribute
where you can — which is [10b · Import attributes and conditions](10c-import-attributes-and-conditions.md).

## Gotchas

**★ Symptom: `loader` has no effect and the import fails.** Cause: `loader` is *"only available with
the `application` builder"* — a project still on `browser` or `browser-esbuild` does not have it.
Fix: check which builder you are on before configuring it:

```bash
node -p "require('./angular.json').projects['my-app'].targets.build.builder"
```

**★ Symptom: importing a `.svg` works at build time and TypeScript reports the module has no
exported member.** Cause: no ambient module declaration for the extension. Fix: declare it, matching
the loader you configured — `string` for `text`, `Uint8Array` for `binary`:

```ts
declare module '*.svg' {
  const content: string;
  export default content;
}
```

**★ Symptom: setting `".css": "empty"` to silence one library's side-effect import also dropped your
own component styles' imports.** Cause: the `loader` map is keyed by extension and applies to the
whole build. Fix: use a per-file import attribute for the one library, and leave the global map
alone — see [10b](10c-import-attributes-and-conditions.md).

**★ Symptom: a `file` loader import produced a URL that 404s in development but works in a
production build.** Cause: `file` emits the asset and gives you its runtime location; the dev server
serves it from memory and the path is only correct relative to the deployed output. Fix: use the
imported value as the URL rather than constructing the path yourself, and never hardcode the hashed
name:

```ts
import imagePath from './image.webp' with {loader: 'file'};
```

**★ Symptom: a large `.png` imported with `dataurl` grew the bundle by more than the file's own
size.** Cause: Base64 and data-URL encodings are roughly a third larger than the bytes they encode,
and they land in a JavaScript bundle rather than a cacheable asset. Fix: use `file` for anything but
very small assets, so the browser can cache it separately:

```json
{ "options": { "loader": { ".png": "file" } } }
```

## Interview questions

**★ What are the six `loader` values, and how would you choose between `file` and `dataurl`?**
`text` gives a string, `binary` a `Uint8Array`, `file` emits the asset and gives you its runtime
URL, `dataurl` and `base64` inline the content as an encoded string, and `empty` erases the import
entirely. The choice between `file` and `dataurl` is a caching-versus-requests trade: `dataurl`
inlines the bytes into a JavaScript bundle at roughly a third overhead and cannot be cached
independently, so it is right only for very small assets. `file` costs an extra request and lets the
browser cache the asset on its own, which is right for everything else.

**Why does `empty` exist?**
For third-party libraries that use bundler-specific import syntax which has no meaning in a browser
— the canonical case being a side-effect `import 'my.css'`. Erasing the import lets you consume the
library without a bundler that special-cases CSS imports, and you add the stylesheet through the
`styles` build option instead. The caveat is scope: the `loader` map is keyed by extension and
applies to the entire build, so using it to silence one library also erases every other CSS import.

**★ Why does a `loader` import need an ambient module declaration when the build handles it fine?**
Because the two systems are independent. The builder resolves `./some-file.svg` and substitutes
content according to the `loader` map; TypeScript resolves the same specifier against its own module
resolution and finds nothing that declares what a `.svg` exports. Neither knows about the other, so
you supply the bridge with `declare module '*.svg'` — and the declared type has to match the loader
you configured, `string` for `text` and `Uint8Array` for `binary`. A mismatch type-checks cleanly and
fails at run time.

{/* FOOTER */}
