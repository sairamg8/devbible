---
title: "next/font/google and next/font/local are two different loaders with two different option sets, and the word variable means two unrelated things inside the same function call"
sidebar_label: "03b · Google, local and variable"
sidebar_position: 16
description: "The next/font option table read as an API: which keys work with which loader, when weight is required, what a variable font changes, and the three ways to apply the returned object."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against **Next.js 16.3.4** documentation — [Font Module reference](https://nextjs.org/docs/app/api-reference/components/font) (doc `version: 16.3.4`, `lastUpdated: 2025-08-06`) and [Font Optimization](https://nextjs.org/docs/app/getting-started/fonts) (`lastUpdated: 2026-05-27`). Both URLs resolved.
> Version spine: **Next.js 16.3.4** · React 19.2.8 · Node 20.9 floor. `next` is **not installed in this checkout** — the option table below is transcribed from the documentation, not probed. **No sandbox run.**

**The two loaders look interchangeable and are not. `next/font/google` is a named export per family; `next/font/local` is a default export you call with a file path. Five of the eleven documented options are restricted to one loader or the other, and `adjustFontFallback` does not even have the same *type* in the two. On top of that, `variable` is an option name and "variable font" is a font technology, they appear in the same call, and they have nothing to do with each other — which is the single most reliable source of confusion in this API.**

## Two loaders, two shapes

```tsx filename="app/fonts.ts"
import { Inter, Roboto_Mono } from 'next/font/google'
import localFont from 'next/font/local'

// Google: a named export per family, called with options.
export const inter = Inter({ subsets: ['latin'], display: 'swap' })
export const robotoMono = Roboto_Mono({ subsets: ['latin'], display: 'swap' })

// Local: a default export, called with a path resolved relative to THIS file.
export const brand = localFont({
  src: './fonts/Brand-Variable.woff2',
  display: 'swap',
})
```

The naming rule for Google families is a real trap and the docs call it out:

> *"**Good to know**: Use an underscore (\_) for font names with multiple words. E.g. `Roboto Mono` should be imported as `Roboto_Mono`."*

## The option table, and which loader accepts what

Transcribed verbatim from the [Font Module reference](https://nextjs.org/docs/app/api-reference/components/font):

| Key | `font/google` | `font/local` | Type | Required |
|---|---|---|---|---|
| `src` | ✗ | ✓ | String or Array of Objects | Yes |
| `weight` | ✓ | ✓ | String or Array | Required/Optional |
| `style` | ✓ | ✓ | String or Array | – |
| `subsets` | ✓ | ✗ | Array of Strings | – |
| `axes` | ✓ | ✗ | Array of Strings | – |
| `display` | ✓ | ✓ | String | – |
| `preload` | ✓ | ✓ | Boolean | – |
| `fallback` | ✓ | ✓ | Array of Strings | – |
| `adjustFontFallback` | ✓ | ✓ | Boolean or String | – |
| `variable` | ✓ | ✓ | String | – |
| `declarations` | ✗ | ✓ | Array of Objects | – |

Four asymmetries are worth memorising, because they are where copied snippets break:

- **`subsets` and `axes` are Google-only.** Both describe operations on a Google-hosted font file. Your own `.woff2` is already whatever it is.
- **`declarations` is local-only.** It is the escape hatch for writing `@font-face` descriptors by hand: *"An array of font face descriptor key-value pairs that define the generated `@font-face` further"*, documented example `declarations: [{ prop: 'ascent-override', value: '90%' }]`.
- **`adjustFontFallback` changes type across loaders.** Google: a boolean, default `true`. Local: *"The possible values are `'Arial'`, `'Times New Roman'` or `false`. The default is `'Arial'`."* Passing `true` to a local font is not a documented value.
- **The array forms of `weight` and `style` are Google-only.** The reference says so twice: *"An array of weight values if the font is not a variable google font. It applies to `next/font/google` only."* A local family with multiple files uses an array of `src` objects instead.

## `weight`: when it is required and when it is wrong

> *"Required if the font being used is **not** variable."*

> *"for the font `Inter`, the possible values are `'100'`, `'200'`, `'300'`, `'400'`, `'500'`, `'600'`, `'700'`, `'800'`, `'900'` or `'variable'` where `'variable'` is the default"*

Two things follow. First, on a variable Google font you may omit `weight` entirely and you get the variable file — the getting-started guide says so in a comment on its own example: *"If loading a variable font, you don't need to specify the font weight."* Second, `'variable'` is itself listed as a *value* of `weight`, and it is the default — so naming a static weight is an opt-*out* of the variable file rather than a refinement of it. The documentation states the default; the "opting out" phrasing is my reading of that default, not a sentence the docs write.

For a non-variable family you must name the weight, and you may name several:

```tsx filename="app/fonts.ts"
import { Roboto } from 'next/font/google'

// Non-variable family: weight is required. Every extra weight and style
// in these arrays is another file the client downloads.
export const roboto = Roboto({
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
  display: 'swap',
})
```

A variable font can also be given a **range** rather than a list — `weight: '100 900'` is documented as *"A string for the range between `100` and `900` for a variable font"*.

## Variable fonts: what they change, and the naming collision

Next.js recommends them in both places it can:

> *"We recommend using variable fonts for the best performance and flexibility."*

A variable font is one file containing a continuous design space rather than a discrete weight per file. The practical consequences: one request instead of four, every intermediate weight available to CSS rather than only the ones you enumerated, and no `weight` option needed at all.

The cost is controlled by `axes`:

> *"Some variable fonts have extra `axes` that can be included. By default, only the font weight is included to keep the file size down. The possible values of `axes` depend on the specific font."*

So the file you get is already subset **along the axis dimension** — weight only — unless you ask for more. Asking for `axes: ['slnt']` on Inter buys you a slant axis and costs you bytes on every route that preloads the font.

🔴 **`variable` the option is not "variable font".** `variable: '--font-inter'` declares a CSS custom property name. It works identically for a static local font, and omitting it on a variable font changes nothing about the font technology. Two unrelated concepts, one word, one function call:

```tsx filename="app/fonts.ts"
import { Inter } from 'next/font/google'
import localFont from 'next/font/local'

// A variable FONT that does not use the `variable` OPTION:
export const inter = Inter({ subsets: ['latin'] })

// A static local font that DOES use the `variable` option:
export const caption = localFont({
  src: './fonts/Caption-Regular.woff2',
  variable: '--font-caption',
})
```

## Local fonts: `src` and its path rule

> *"The path of the font file as a string or an array of objects (with type `Array<{path: string, weight?: string, style?: string}>`) **relative to the directory where the font loader function is called**."*

That last clause is the whole gotcha: the path is resolved against the *calling file*, not the project root. Move your `fonts.ts` one directory and every `src` breaks.

For a family spread over several files:

```tsx filename="app/fonts.ts"
import localFont from 'next/font/local'

export const roboto = localFont({
  src: [
    { path: './Roboto-Regular.woff2', weight: '400', style: 'normal' },
    { path: './Roboto-Italic.woff2', weight: '400', style: 'italic' },
    { path: './Roboto-Bold.woff2', weight: '700', style: 'normal' },
    { path: './Roboto-BoldItalic.woff2', weight: '700', style: 'italic' },
  ],
  display: 'swap',
})
```

Files may live anywhere: *"Fonts can be stored anywhere in the project, including the `public` folder or co-located inside the `app` folder."*

## Gotchas

**★ Symptom: `Module '"next/font/google"' has no exported member 'Roboto Mono'`-shaped type error, or the import simply does not resolve.** Cause: multi-word Google families are exported with underscores. Fix: `import { Roboto_Mono } from 'next/font/google'`. The same applies to `Source_Sans_3`, `Noto_Sans_JP` and everything else with a space in its Google Fonts name.

**★ Symptom: a copied snippet with `subsets: ['latin']` does nothing on your local font.** Cause: `subsets` is marked ✗ for `next/font/local` in the reference — it describes an operation on Google's hosted file. Your `.woff2` contains exactly the glyphs it was built with. Fix: subset the file yourself with a tool such as `pyftsubset` before committing it, and drop the option. The documentation does not state whether passing `subsets` to `localFont` errors or is ignored, so do not rely on either.

**★ Symptom: you asked for `font-weight: 700` in CSS and got a smeared fake bold.** Cause: on a non-variable family, `weight` is required and enumerates exactly which files are downloaded. If `700` is not in that array, the browser synthesises it. Fix: add it, and accept the extra file — or move to a variable family where the whole range comes in one file.

```tsx filename="app/fonts.ts"
import { Roboto } from 'next/font/google'

export const roboto = Roboto({
  weight: ['400', '700'], // 700 must be listed to exist
  subsets: ['latin'],
  display: 'swap',
})
```

**Symptom: `adjustFontFallback: true` on a local font behaves unexpectedly.** Cause: for `next/font/local` the documented values are `'Arial'`, `'Times New Roman'` or `false` — a boolean `true` is not among them. Fix: name the fallback face explicitly, or omit the option and take the `'Arial'` default.

**Symptom: every `src` path broke after a refactor that moved the fonts file.** Cause: paths are *"relative to the directory where the font loader function is called"*, not to the project root. Fix: co-locate the font files with the definitions file so the two move together, or use a path alias for the definitions module and keep the `.woff2` files beside it.

**Symptom: the variable font is bigger than expected after someone added an axis.** Cause: *"By default, only the font weight is included to keep the file size down."* Adding `axes: ['slnt']` (or any other) adds design-space data to every byte shipped on every route that uses the font. Fix: only request an axis you actually vary in CSS; a slant axis nobody animates is pure weight.

**Symptom: `style: 'oblique'` works on your local font and does nothing on the Google one.** Cause: the reference is explicit that the two loaders accept different value sets — for `next/font/google` *"it can be `normal` or `italic`"*, while for `next/font/local` *"it can take any value but is expected to come from standard font styles"*. Fix: on a Google family, use `'italic'`; if you need a true oblique, self-host the oblique file and use `next/font/local`.

**Symptom: a local font ships far more bytes than the equivalent Google font.** Cause: you committed a `.ttf`. The documentation's own definitions-file example uses `GreatVibes-Regular.ttf`, because it is showing the API rather than optimising delivery — but `.woff2` is a compressed container for the same outlines and is what a browser should be served. Fix: convert once, commit the `.woff2`, and point `src` at it.

```tsx filename="app/fonts.ts"
import localFont from 'next/font/local'

// Ship the compressed container, not the raw TrueType file.
export const greatVibes = localFont({
  src: './fonts/GreatVibes-Regular.woff2',
  display: 'swap',
})
```

## Interview questions

**★ What are the concrete API differences between `next/font/google` and `next/font/local`?**
Import shape first: Google exposes a named export per family (called with underscores for multi-word names), local exposes a default `localFont` function. Then options: `src` is required for local and unavailable for Google; `subsets` and `axes` are Google-only; `declarations` is local-only; the array forms of `weight` and `style` are Google-only; and `adjustFontFallback` is a boolean defaulting to `true` for Google but a string (`'Arial'`, `'Times New Roman'`) or `false` defaulting to `'Arial'` for local. What you *get* differs too: Google downloads and subsets the file for you at build time, local uses exactly the bytes you committed.

**★ Why does Next.js recommend variable fonts, and what does `axes` have to do with it?**
A variable font is one file spanning a continuous design space, so you get every intermediate weight from a single request instead of one file per enumerated weight — that is the "performance and flexibility" the docs cite. `axes` is the cost control: by default only the weight axis is included *"to keep the file size down"*, and any additional axis you name is extra data shipped to every user of that font. So the recommendation is really "one file, one axis, unless you have a reason".

**When is `weight` required, and what does omitting it actually select?**
It is required whenever the font is not variable. For a variable Google font the documented set of `weight` values includes `'variable'` and that is the default, so omitting `weight` selects the variable file. Naming `'400'` instead selects that static instance. For a non-variable family, the array you pass is the complete list of files that will be downloaded, and any weight not in it will be synthesised by the browser.

**What is `declarations` for, and why is it local-only?**
It writes extra `@font-face` descriptors into the generated rule — the documented example is `{ prop: 'ascent-override', value: '90%' }`. It exists because with a local file you may know metrics the loader cannot infer, or you may want to hand-tune the vertical rhythm. It is local-only because for a Google font the pipeline already owns the generated face end to end.

**Why is `subsets` available for Google fonts and not for local ones?**
Because subsetting is an operation performed on the source file, and for a Google font Next.js owns that step — it downloads the family at build time and cuts it down to the character ranges you named. A local font is bytes you committed; whatever glyph coverage it has, it already has. If you need a smaller local file you subset it yourself before it enters the repo, with something like `pyftsubset`, and `next/font/local` simply serves what you gave it.

**A designer hands you four `.woff2` files — regular, italic, bold, bold-italic. How do you load them as one family?**
One `localFont` call with `src` as an array of objects, each with its own `path`, `weight` and `style`. That produces a single hosted instance whose generated `@font-face` rules cover all four combinations, so ordinary CSS — `font-weight: 700`, `font-style: italic` — selects the right file. The array forms of the `weight` and `style` *options* would be wrong here: the reference restricts those to `next/font/google`.

---

← [03 · next/font and layout shift](03-font-optimization-with-next-font-zero-layout-shift.md) · [Chapter index](01-explanation.md) · Next → [03c · applying the font](03c-applying-the-font-classname-style-css-variables-and-tailwind.md)
