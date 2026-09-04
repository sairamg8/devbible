---
title: "The loader returns three ways to apply a font and they are not interchangeable: className owns typography in the component, style hands you the resolved family string, and the CSS variable is the only one a stylesheet can reach"
sidebar_label: "03c · Applying the font"
sidebar_position: 17
description: "className, style and the variable option — what each returns, how Tailwind v4 and v3 consume the CSS variable, and why the font definitions file is a documented requirement rather than a convention."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against **Next.js 16.3.4** documentation — [Font Module reference](https://nextjs.org/docs/app/api-reference/components/font) (doc `version: 16.3.4`, `lastUpdated: 2025-08-06`). URL resolved.
> Version spine: **Next.js 16.3.4** · React 19.2.8 · Node 20.9 floor. `next` is **not installed in this checkout** — nothing here is probed. **No sandbox run.**

**The font loader hands back an object, and which member you reach for decides who owns your typography. `className` puts it in the component. `style` gives you the resolved family name as a value, fallbacks included, for the cases where a string is what you need. The `variable` option is the only route that lets an external stylesheet — CSS Modules, a token layer, Tailwind's theme — do the deciding. Underneath all three sits a rule people read as a style preference and is not: one call to the loader is one hosted instance of the font, so the definitions file is load-bearing.**

## Applying the result: three ways, and when each is right

The loader returns an object with three useful members.

**`className`** — *"Returns a read-only CSS `className` for the loaded font to be passed to an HTML element."* The default choice.

```tsx filename="app/page.tsx"
import { inter } from './fonts'

export default function Page() {
  return <p className={inter.className}>Hello, Next.js!</p>
}
```

**`style`** — *"Returns a read-only CSS `style` object … including `style.fontFamily` to access the font family name and fallback fonts."* Use it when you need the family name as a value, for example to feed a canvas or an inline style that also sets other properties.

```tsx filename="app/page.tsx"
import { inter } from './fonts'

export default function Page() {
  return <p style={{ ...inter.style, letterSpacing: '0.01em' }}>Hello</p>
}
```

**CSS variables** — set the `variable` option, put `font.variable` on an ancestor's `className`, and reference the custom property from a stylesheet. This is the only one of the three that lets an external stylesheet (or Tailwind) own the typography.

```tsx filename="app/layout.tsx"
import { Inter, Roboto_Mono } from 'next/font/google'
import './global.css'

const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' })
const robotoMono = Roboto_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-roboto-mono',
})

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${robotoMono.variable}`}>
      <body>{children}</body>
    </html>
  )
}
```

```css filename="app/global.css"
html {
  font-family: var(--font-inter);
}

h1 {
  font-family: var(--font-roboto-mono);
}
```

Tailwind v4 wires the same variables through `@theme inline`:

```css filename="global.css"
@import 'tailwindcss';

@theme inline {
  --font-sans: var(--font-inter);
  --font-mono: var(--font-roboto-mono);
}
```

and Tailwind v3 through the config file:

```js filename="tailwind.config.js"
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './app/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)'],
        mono: ['var(--font-roboto-mono)'],
      },
    },
  },
  plugins: [],
}
```

Both routes are covered further in [01 · CSS Modules, global stylesheets and Tailwind](01-css-modules-global-stylesheets-utility-first-tailwind-config.md).

## One call, one hosted instance

> *"Every time you call the `localFont` or Google font function, that font will be hosted as one instance in your application. Therefore, if you need to use the same font in multiple places, you should load it in one place and import the related font object where you need it. This is done using a font definitions file."*

This is why `app/fonts.ts` (or `styles/fonts.ts`) is the documented pattern rather than a matter of taste. Two files each calling `Inter({ subsets: ['latin'] })` produce two instances of the same family.

```ts filename="styles/fonts.ts"
import { Inter, Lora, Source_Sans_3 } from 'next/font/google'
import localFont from 'next/font/local'

const inter = Inter()
const lora = Lora()
const sourceSans400 = Source_Sans_3({ weight: '400' })
const sourceSans700 = Source_Sans_3({ weight: '700' })
const greatVibes = localFont({ src: './GreatVibes-Regular.ttf' })

export { inter, lora, sourceSans400, sourceSans700, greatVibes }
```

Note that two weights of one non-variable family are two calls and therefore two instances — that is the documented pattern, not a mistake. And note the recommendation attached to all of this:

> *"**Recommendation**: Use multiple fonts conservatively since each new font is an additional resource the client has to download."*


## Gotchas

**★ Symptom: the CSS variable resolves to nothing and text renders in the browser default.** Cause: you set `variable: '--font-inter'` but never put `inter.variable` on the element or an ancestor of the element that reads it. A CSS custom property is inherited down from where it is declared and is invisible everywhere else. Fix: put it on `<html>` or `<body>` in the root layout — the docs note either is acceptable, *"depending on your preference, styling needs or project requirements"*.

```tsx filename="app/layout.tsx"
import { inter } from './fonts'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // The custom property is declared here, so every descendant can read it.
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  )
}
```

**★ Symptom: the modal is in the wrong typeface, the rest of the page is fine.** Cause: `font.variable` was applied to a layout wrapper rather than to `<html>`, and the modal renders through a portal into a node outside that wrapper. Custom-property inheritance follows the DOM tree, not the React tree, so the portal's subtree never sees `--font-inter`. Fix: declare the variable on `<html>` in the root layout, which is an ancestor of every portal target inside `<body>`.

**★ Symptom: two components render the "same" font and the build ships two font files.** Cause: two separate loader calls, and *"every time you call the `localFont` or Google font function, that font will be hosted as one instance in your application."* The unit is the call site, not the family. Fix: the definitions-file pattern — one call, exported, imported wherever it is needed.

**Symptom: someone "consolidated" `sourceSans400` and `sourceSans700` into one call and bold disappeared.** Cause: for a non-variable family, two weights genuinely are two calls in the documented pattern, or one call with `weight: ['400','700']`. Collapsing to a single call with a single weight drops the other file. Fix: either enumerate both weights in one call's `weight` array, or keep the two calls — both are documented; what is not documented is one call with one weight serving two.

**Symptom: you spread `inter.style` and lost the font.** Cause: `style` is a full style object *including* `fontFamily`. If another `fontFamily` appears after the spread in the same object literal, it wins and the font is gone. Fix: spread first and set only unrelated properties afterwards.

```tsx filename="app/page.tsx"
import { inter } from './fonts'

export default function Page() {
  // Spread first; never set fontFamily after it.
  return <p style={{ ...inter.style, letterSpacing: '0.01em' }}>Hello</p>
}
```

**Symptom: the Tailwind theme slot is empty even though the variable is set on `<html>`.** Cause: the reference gives two different wirings keyed to the Tailwind major — `@theme inline` in a CSS file, and a separate section headed "Tailwind CSS v3" for `theme.extend.fontFamily` in `tailwind.config.js`. Using the v3 shape on a v4 install, or the reverse, wires nothing. Fix: match the wiring to your installed Tailwind major; see [01 · CSS Modules, global stylesheets and Tailwind](01-css-modules-global-stylesheets-utility-first-tailwind-config.md).

**Symptom: `className` and the CSS-variable method were both applied and the wrong one wins.** Cause: they are two independent mechanisms setting `font-family` on two different elements. The nearer declaration in the cascade wins for a given subtree — which is exactly how the documented "Inter globally, `Roboto Mono` on every `h1`" example is meant to work, and exactly what makes an accidental duplicate confusing. Fix: pick one mechanism per project and use the other only deliberately, for a scoped exception.

## Interview questions

**★ `variable: '--font-inter'` — is that about variable fonts?**
No, and this is the collision worth naming out loud. The `variable` *option* declares a CSS custom property name so an external stylesheet or Tailwind can reference the family. It applies identically to a static local `.woff2`. A *variable font* is a font-file technology — one file spanning a continuous design space. You can use either without the other; the only relationship is that they appear in the same function call.

**★ `className`, `style`, or the CSS variable — how do you choose?**
`className` when a React element owns its own typography; it is the shortest path and the default. `style` when you need the resolved family string as a value — an inline style that also sets something else, or handing `style.fontFamily` to a canvas or chart library, since the docs note it includes the family name *and* the fallback fonts. The CSS variable when the typography belongs to a stylesheet rather than to a component: CSS Modules, a design-token layer, or Tailwind's `--font-sans` and `--font-mono` theme slots.

**★ Why does the documentation push a font definitions file rather than importing the loader where you need it?**
Because *"every time you call the `localFont` or Google font function, that font will be hosted as one instance in your application."* Call sites, not families, are the unit that gets hosted. Two components each calling `Inter(...)` produce two instances of Inter, and the client downloads both. Loading once in `app/fonts.ts` and exporting the object makes the instance count equal to the family count. It also gives you one place to change `display`, `subsets` or `preload` for the whole app.

**Why must `font.variable` sit on an ancestor of the styled element rather than anywhere convenient?**
Because it is a CSS custom property declaration, and custom properties inherit down the DOM. Declaring `--font-inter` on a `<main>` makes it visible to `<main>` and its descendants and to nothing else. That is fine until something renders outside that subtree — a portal-mounted dialog, a toast container appended to `<body>` — at which point the variable is undefined and `font-family: var(--font-inter)` falls back to whatever comes next. Declaring it on `<html>` avoids the whole class of problem.

**What is actually inside the `style` object, and why does that matter?**
The reference says it is a read-only CSS style object *"including `style.fontFamily` to access the font family name and fallback fonts"* — so the family string is not just the web font, it is the web font followed by the generated fallback stack. That is why it is the right thing to hand to a library that renders text outside the DOM, such as a canvas: you get the same resolution order the CSS would have used, rather than a bare family name that would render in the browser default if the font were not ready.

**Your designer wants `h1` in a display face and everything else in the body face. Which mechanism, and why?**
Either works, and the reference documents both. With `className` you apply `bodyFont.className` on `<html>` and `displayFont.className` on each `h1` — explicit, but every `h1` in the codebase has to remember. With the CSS variable method you put both `.variable` classes on `<html>` and write two rules in a stylesheet, so the mapping lives in one place and new `h1` elements get it for free. For a design system, the variable route; for a one-off page, the class.

---

← [03b · Google, local and variable](03b-the-loader-api-google-local-and-variable-fonts.md) · [Chapter index](01-explanation.md) · Next → [03d · subsetting and preload scope](03d-subsetting-preloading-and-where-the-loader-must-be-called.md)
