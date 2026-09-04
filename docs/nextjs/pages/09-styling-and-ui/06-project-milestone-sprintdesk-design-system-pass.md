---
title: "Give SprintDesk a design system: one theme defined as CSS custom properties, one font definitions module the whole app imports, and a theme that is correct on the first painted frame rather than after hydration"
sidebar_label: "06 · Milestone: design system pass"
sidebar_position: 6
description: "The chapter 9 project milestone, part one — scope and file shape, the theming pass with CSS custom properties alongside Tailwind v4, the flash-of-wrong-theme fix, and the single font definitions module the one-instance-per-call rule requires."
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-04 against **Next.js 16.3.4** documentation — [Font Module reference](https://nextjs.org/docs/app/api-reference/components/font) (`lastUpdated: 2025-08-06`), [Font Optimization](https://nextjs.org/docs/app/getting-started/fonts) (`lastUpdated: 2026-05-27`) and the [`<Script>` API reference](https://nextjs.org/docs/app/api-reference/components/script) (`lastUpdated: 2026-08-25`). The Tailwind v4 setup is the one established in [01c](01c-tailwind-v4-css-first-config-and-coexisting-with-css-modules.md) against two primary sources.
> Version spine: **Next.js 16.3.4** · React 19.2.8 · Node 20.9 floor. `next` is **not installed in this checkout**; documentation-verified only, **no sandbox run**, no timings and no byte counts.

**Everything in this chapter has been a mechanism in isolation: how CSS is chunked, where a font loader may be called, what `remotePatterns` really is, which strategy a third-party script gets. This milestone is where they stop being separate. SprintDesk gets a theme, a font pipeline, optimised avatars and attachments, and a scripts pass — and the interesting part is not any one of those, it is that three of them collide in a single file. The root layout is where the font `className` goes, where the global stylesheet is imported, and where the only script that may run before hydration lives. Get the ordering wrong there and the symptoms appear everywhere else: a flash of the wrong theme, a font that preloads on routes that never use it, a shift on first paint that no component is responsible for. This page is the scope, the theming pass and the font pipeline; [06b](06b-avatars-attachments-and-the-scripts-pass.md) is images, the third-party scripts and the acceptance criteria.**

## What this milestone adds, and what it does not

The board from [chapter 8](../08-state-management-in-an-rsc-world/07-project-milestone-sprintdesk-board-filters-in-the-url.md) works and looks like an unstyled prototype. This pass makes it presentable without adding a single feature.

| In scope | Out of scope, and where it lands |
|---|---|
| Theme tokens, light and dark, switchable | — |
| One font definitions module, applied at the root | — |
| Avatars and attachment previews through `next/image` | — |
| A third-party scripts pass with explicit strategies | — |
| Uploading an avatar (the write path) | [chapter 10 · forms and Server Actions](../10-forms-authentication-and-security-hardening/01-server-actions-for-mutations-with-useactionstate-and-useopti.md) |
| Who is allowed to see an attachment | [chapter 10 · auth milestone](../10-forms-authentication-and-security-hardening/06-project-milestone-sprintdesk-auth-authjs.md) |
| The CSP that governs the scripts you add here | [chapter 10 · CSP](../10-forms-authentication-and-security-hardening/10-content-security-policy-nonces-and-the-dynamic-rendering-tax.md) |
| Measuring whether any of it helped | [chapter 11 · performance audit](../11-performance-optimization-turbopack/07-project-milestone-sprintdesk-performance-audit.md) |

That fourth row is worth pausing on. This milestone adds third-party scripts and an image host to the application, and both are security surface — the scripts against your CSP, the host against `remotePatterns`. Chapter 10 owns the policy; this chapter owns making sure the mechanism you chose can accept one.

## The file shape

```
app/
├── layout.tsx                  🔴 fonts + globals + the theme init script all land here
├── globals.css                 @import 'tailwindcss' + the token definitions
└── components/
    ├── theme-toggle.tsx        'use client' — writes localStorage, flips the attribute
    ├── avatar.tsx              next/image, fixed size, no priority
    └── attachment-preview.tsx  next/image with sizes, blur placeholder
lib/
└── fonts.ts                    🔴 every font loader call in the application, and nowhere else
```

Four files. Three of them exist because of a rule in this chapter rather than because of a feature.

## The theming pass

Theme tokens are CSS custom properties, defined once in the global stylesheet and switched by an attribute on `<html>`. This is deliberately plain web-platform CSS rather than a framework feature: it works with Tailwind, with CSS Modules, and with the CSS-in-JS registry from [02b](02b-style-registries-and-what-the-client-boundary-actually-costs.md) all at once, because every one of those eventually produces a `color` value that can be a `var()`.

```css
/* app/globals.css */
@import 'tailwindcss';

:root {
  --sd-bg: #ffffff;
  --sd-surface: #f6f7f9;
  --sd-text: #14161a;
  --sd-muted: #5b6270;
  --sd-accent: #2f5bd7;
  --sd-border: #dfe3ea;
}

[data-theme='dark'] {
  --sd-bg: #101317;
  --sd-surface: #171b21;
  --sd-text: #e9ecf1;
  --sd-muted: #98a1b0;
  --sd-accent: #7ea2ff;
  --sd-border: #262c35;
}

body {
  background: var(--sd-bg);
  color: var(--sd-text);
}
```

⚠️ **Tailwind v4 customises its own theme in CSS rather than a JS config, but [01c](01c-tailwind-v4-css-first-config-and-coexisting-with-css-modules.md) explicitly did not verify the `@theme` directive's semantics** — so this milestone uses ordinary custom properties, which are settled web platform, and leaves registering them as Tailwind theme tokens as a decision to make against Tailwind's own reference. Plain `var(--sd-accent)` in a CSS Module or a `style` prop works today regardless of how that question resolves.

There is exactly one global stylesheet and it is imported in the root layout, for the reason [01b](01b-css-import-order-chunking-and-what-css-costs.md) gives: a global stylesheet imported inside a component is loaded at an unpredictable point in the order and never unloaded.

### The flash of the wrong theme, and why it needs `beforeInteractive`

The user's choice lives in `localStorage`, which the server cannot read. So the server renders *something* — and unless you intervene, that something is the default theme, painted, before your client code corrects it. The correction happens after hydration; the flash happens before it.

This is one of the few genuine uses for the strategy that [05](05-next-script-loading-strategies-for-third-party-scripts.md) tells you to be sparing with. The script must run before the first paint, it must be in the root layout, and it takes no handlers:

```tsx
// app/layout.tsx
import Script from 'next/script'
import { sans, mono } from '@/lib/fonts'
import './globals.css'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <body>
        <Script id="sd-theme-init" strategy="beforeInteractive">
          {`(function(){try{var t=localStorage.getItem('sd-theme');if(t==='dark'||t==='light'){document.documentElement.dataset.theme=t}else{document.documentElement.dataset.theme=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}}catch(e){}})()`}
        </Script>
        {children}
      </body>
    </html>
  )
}
```

Four things in that snippet are chapter rules rather than taste, and each has a page behind it:

- **`id` is mandatory** on an inline `<Script>` — the docs require it *"in order for Next.js to track and optimize the script"* ([05c](05c-inline-scripts-attribute-forwarding-and-where-the-tag-belongs.md)).
- **The script body is a constant.** No interpolation of any value, ever, for the injection reason 05c gives.
- **The `try/catch` is not defensive padding.** `localStorage` throws outright in some privacy configurations, and an uncaught throw here happens before anything else on the page.
- **The strategy is injected into `<head>` regardless of where the tag sits** in the JSX, so its position below `<Script>`'s siblings is documentation, not scheduling.

The toggle that writes the value is an ordinary Client Component, and it writes to the same two places the init script reads:

```tsx
// app/components/theme-toggle.tsx
'use client'

import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    setTheme((document.documentElement.dataset.theme as 'light' | 'dark') ?? 'light')
  }, [])

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem('sd-theme', next)
    } catch {}
    setTheme(next)
  }

  return (
    <button type="button" onClick={toggle} aria-pressed={theme === 'dark'}>
      {theme === 'dark' ? 'Light mode' : 'Dark mode'}
    </button>
  )
}
```

The state is initialised in an effect rather than from `localStorage` during render, because the server render has no access to it and reading it during render is the hydration mismatch you just spent a script avoiding.

## The font pipeline

The rule that decides the shape of this part is one sentence from the Font Module reference:

> *"Every time you call the `localFont` or Google font function, that font will be hosted as one instance in your application. Therefore, if you need to use the same font in multiple places, you should load it in one place and import the related font object where you need it. This is done using a font definitions file."*

So: **one module, every loader call in it, nothing else calls a loader.**

```ts
// lib/fonts.ts — the only file in SprintDesk that calls a font loader
import { Inter, JetBrains_Mono } from 'next/font/google'

export const sans = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
})

export const mono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
})
```

Every option there is a decision this chapter argued, and two of them are defaults written out on purpose:

- **`subsets` is required in practice.** Google fonts are automatically subset, and *"[f]ailing to specify any subsets while `preload` is `true` will result in a warning."* `preload` defaults to `true`, so omitting `subsets` is a warning by default.
- **`display: 'swap'` is already the default** — the docs give the option's *"default value of `'swap'`"*. It is written explicitly because the alternative values change the layout-shift behaviour materially and a reader of this file should see that a choice was made.
- **`variable` is what makes the font usable from CSS**, which is what lets a CSS Module and a Tailwind utility reach the same family without either importing the font object.
- **The underscore in `JetBrains_Mono` is the documented convention** — *"Use an underscore (\_) for font names with multiple words."*
- **`adjustFontFallback` is left at its default of `true`**, because that is the automatic-fallback-metrics mechanism that reduces layout shift, and turning it off is the sort of thing that should require a sentence of justification.

Wiring the variables to families happens once, in the global stylesheet:

```css
/* app/globals.css, continued */
:root {
  --sd-font-sans: var(--font-sans), ui-sans-serif, system-ui, sans-serif;
  --sd-font-mono: var(--font-mono), ui-monospace, SFMono-Regular, monospace;
}

body {
  font-family: var(--sd-font-sans);
}

code, pre, .sd-ticket-id {
  font-family: var(--sd-font-mono);
}
```

### Why the loader call sits in `lib/fonts.ts` and the `className` sits on `<html>`

Because those two placements answer two different questions, and conflating them is the most common font mistake in an App Router codebase.

**Where the loader is called** decides preloading scope. The reference is precise about it:

> *"When a font function is called on a page of your site, it is not globally available and preloaded on all routes. Rather, the font is only preloaded on the related routes based on the type of file where it is used"* — a page preloads on that route, a layout on everything it wraps, the root layout on everything.

**Where `font.variable` is applied** decides which elements can use the family. Putting both on the root layout is the right answer for an application font and the wrong answer for a font used by one marketing page, which should be loaded and applied in that route's own subtree so it is not preloaded across the whole application. See [03d](03d-subsetting-preloading-and-where-the-loader-must-be-called.md) for the full scoping rule.

And the recommendation that keeps this section short:

> *"Use multiple fonts conservatively since each new font is an additional resource the client has to download."*

Two families is already a decision that needs defending; SprintDesk takes a sans for the interface and a mono for ticket identifiers and code blocks, and nothing else.

## Gotchas

**★ Symptom: the app flashes white before switching to dark on every full page load.** Cause: the theme is applied by client code that runs after hydration, so the server-rendered default is painted first. Fix: set the attribute before first paint with an inline `beforeInteractive` script in the root layout, as shown above — it is injected into `<head>` and runs before any Next.js module.

**★ Symptom: React logs a hydration mismatch on `<html>` after adding the theme script.** Cause: the script mutates `document.documentElement` before hydration, so the attribute the client sees is not the one the server rendered — which is the entire point of the script. Fix: tell React that this specific element is expected to differ:

```tsx
<html lang="en" suppressHydrationWarning>
```

Use it on that element only. It suppresses a warning about a difference you deliberately created; it is not a general remedy for mismatches.

**★ Symptom: two components render in visibly different weights of the "same" font.** Cause: the loader was called in two files, and *"[e]very time you call the `localFont` or Google font function, that font will be hosted as one instance"* — two calls, two instances, two `@font-face` families. Fix: one definitions module, imported everywhere:

```ts
// anywhere else in the app
import { sans } from '@/lib/fonts'
```

**★ Symptom: a build warning about subsets, and the font arrives later than expected.** Cause: `subsets` was omitted while `preload` was left at its default of `true`; the docs state that combination *"will result in a warning"*. Fix: name the subsets the application actually needs:

```ts
export const sans = Inter({ subsets: ['latin'], variable: '--font-sans' })
```

⚠️ The exact warning text is not published, so do not search for a specific string — search for the option.

**★ Symptom: a marketing-only display font is preloaded on the logged-in board.** Cause: its loader call was added to `lib/fonts.ts`, which the root layout imports, so it preloads on every route the root layout wraps. Fix: a font used by one subtree is loaded in that subtree's layout, not in the shared module. The one-instance rule says *load each font once*; it does not say *load every font in one file*.

**Symptom: `localStorage.getItem` throws and the page renders blank.** Cause: some privacy configurations throw on access rather than returning `null`, and this script runs before anything else. Fix: the `try/catch` in the snippet above is load-bearing. A theme preference is not worth a white screen.

**Symptom: dark mode looks correct but a third-party widget stays light.** Cause: custom properties style your elements; a vendor widget rendering into its own iframe or shadow root does not inherit them. Fix: pass the theme through whatever configuration API the vendor exposes, from the same Client Component that owns the toggle — and accept that some widgets have no dark mode at all, which is a vendor-selection fact worth knowing before launch.

**Symptom: the theme toggle renders "Light mode" for a moment on a dark-themed page.** Cause: the component's state initialises to a literal and is corrected in an effect, so the first client render disagrees with the DOM the script already set. Fix: this is cosmetic and confined to one button, and the alternative — reading `localStorage` during render — reintroduces the mismatch across the whole tree. Render the button's label from the same attribute the script wrote, and accept one frame:

```tsx
useEffect(() => {
  setTheme((document.documentElement.dataset.theme as 'light' | 'dark') ?? 'light')
}, [])
```

## Interview questions

**★ Why does the theme initialiser have to be an inline script rather than a component?**
Because the decision depends on `localStorage`, which only exists in the browser, and it has to be made before the first paint. A component — server or client — is too late: the server has no access to the value, and the client's correction runs after hydration, by which time the wrong theme has already been painted. An inline `beforeInteractive` script is injected into the document head and executes before any framework module, which is the only window in which the answer can be applied invisibly.

**★ Why is a font definitions module a rule rather than a style preference?**
Because each loader call produces its own hosted instance of the font. Calling `Inter()` in three components does not deduplicate into one family; it is three, with three sets of files and three `@font-face` blocks that can render at subtly different metrics. The documentation names the remedy explicitly — load it in one place and import the object where it is needed. The rule is about correctness, and the byte savings are a side effect.

**★ Where you *call* the loader and where you *apply* the className are two different decisions. Explain both.**
The call site decides preloading scope: a font called in a page is preloaded for that route, in a layout for everything the layout wraps, in the root layout for every route. The className decides which elements can use the family. An application font is called and applied at the root because both answers are "everywhere". A font used by one marketing route should be called *in that route's layout* — otherwise every authenticated page preloads a font it will never render.

**★ Why custom properties for theming rather than a Tailwind or CSS-in-JS feature?**
Because SprintDesk has three styling mechanisms in play — Tailwind utilities, CSS Modules and, on the pages that need it, a CSS-in-JS registry — and a custom property is the one currency all three accept. A `var(--sd-accent)` resolves identically in a utility class, a module class and a runtime-injected rule, and switching the whole theme is one attribute on `<html>` rather than a re-render. It also keeps the theme out of the JavaScript bundle entirely.

**★ You have a font that is only used on the marketing site. Where does it go?**
In `app/(marketing)/layout.tsx` — both the loader call and the `variable` className. Putting it in the shared definitions module would preload it on every route in the application, because that module is imported by the root layout. This is the case where "one definitions file" and "load fonts where they are used" appear to conflict, and they do not: the one-instance rule is about not calling the *same* loader twice, not about centralising every font in the application.

**Why is `display: 'swap'` written out when it is already the default?**
Because it is the option that decides what the user sees during the font load, and the four alternatives produce materially different outcomes — from a flash of invisible text to never swapping at all. Writing the default explicitly signals to the next reader that the behaviour was chosen rather than inherited, which is exactly the case where an explicit default earns its line. The same argument does not apply to `preload`, whose default of `true` is what you want almost always.

**What breaks if you delete `suppressHydrationWarning` from `<html>`?**
Nothing functional — you get a console warning about an attribute mismatch on the root element, every full page load, in development. The reason it is acceptable here and nowhere else is that the mismatch is deliberate and confined: a script you wrote set an attribute the server could not know. Applying the same prop further down the tree to silence a mismatch you did not intend hides a real bug, which is why it belongs on this one element and should be reviewed if it appears on another.

---

← [05d · The worker strategy](05d-the-worker-strategy-partytown-and-what-to-use-instead.md) · [Chapter index](01-explanation.md) · Next → [06b · Avatars, attachments and the scripts pass](06b-avatars-attachments-and-the-scripts-pass.md)
