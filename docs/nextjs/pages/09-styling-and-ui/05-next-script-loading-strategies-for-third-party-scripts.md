---
title: "The `strategy` prop does not choose how fast a third-party script loads — it chooses who injects the tag and at what point in the document lifecycle, and the default is the middle option rather than the safe one"
sidebar_label: "05 · next/script strategies"
sidebar_position: 17
description: "The four next/script loading strategies at Next.js 16.3.4 — where each tag is injected, what beforeInteractive does and does not block, the root-layout constraint, the once-per-document rule, and how to pick between them."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 against **Next.js 16.3.4** documentation — [`<Script>` API reference](https://nextjs.org/docs/app/api-reference/components/script) (doc `version: 16.3.4`, `lastUpdated: 2026-08-25`) and [Optimizing third-party scripts](https://nextjs.org/docs/app/guides/scripts) (`lastUpdated: 2026-06-01`). Both URLs resolved.
> Version spine: **Next.js 16.3.4** · React 19.2.8 · Node 20.9 floor. `next` is **not installed in this checkout**, so nothing here is probed — every claim is a quotation from the primary source, and where the documentation is silent this page says so. **No sandbox run**; no timings, no byte counts.

**A third-party script is the one thing on your page you did not write, cannot fix, and cannot make faster. What you *can* decide is when it runs relative to your own code, and `next/script` exists to make that decision explicit instead of accidental. The `strategy` prop reads like a speed dial — earlier is faster, later is slower — and that reading gets people into trouble, because the four values differ in something more consequential than timing: `beforeInteractive` is injected into the HTML by the server, and the other three are injected by the client after your bundle is running. That single distinction decides whether a script can see the document before React does, whether it survives a client-side navigation, whether it can carry an event handler at all, and whether a mistake shows up as a slow page or as a script that never runs. The default is `afterInteractive`, and it is worth saying plainly: the default is not the conservative choice, it is the middle one.**

## The four values, verbatim

The API reference and the guide state the set identically, and the set is closed — there are only four:

> *"The loading strategy of the script. There are four different strategies that can be used:*
> * *`beforeInteractive`: Load before any Next.js code and before any page hydration occurs.*
> * *`afterInteractive`: (**default**) Load early but after some hydration on the page occurs.*
> * *`lazyOnload`: Load during browser idle time.*
> * *`worker`: (experimental) Load in a web worker."*

There is no `"defer"`, no `"idle"`, no `"onDemand"` and no numeric priority. If you have seen one of those in a snippet, it came from a different framework or from a hallucinating assistant.

The complete documented prop surface is equally small:

| Prop | Type | Required |
|---|---|---|
| `src` | String | Required unless an inline script is used |
| `strategy` | String | — |
| `onLoad` | Function | — |
| `onReady` | Function | — |
| `onError` | Function | — |

Everything else you write on a `<Script>` — `id`, `nonce`, `data-*`, `crossOrigin` — is not a documented prop; it is forwarded verbatim to the emitted `<script>` element. That forwarding rule is what makes the component usable under a Content Security Policy, and it is worked in [05c](05c-inline-scripts-attribute-forwarding-and-where-the-tag-belongs.md).

## `beforeInteractive` — the only strategy the server renders

This is the one that behaves differently in kind, not in degree:

> *"Scripts that load with the `beforeInteractive` strategy are injected into the initial HTML from the server, downloaded before any Next.js module, and executed in the order they are placed."*

Three separate guarantees are packed into that sentence, and they are worth separating because people assume a fourth that is not there.

**It is in the HTML the server sends.** The tag exists before any JavaScript of yours runs, so a script that must observe the document in its original state — a bot detector fingerprinting the environment, a consent manager that has to be authoritative before anything else reads a cookie — gets what it needs.

**It is fetched before your first-party code.** Not merely early: ahead of your own modules in the queue.

**Execution order is the order of placement.** Two `beforeInteractive` scripts run in the order you wrote them. This is the only ordering guarantee the documentation gives for any strategy.

And the guarantee people invent and the docs explicitly deny:

> *"Scripts denoted with this strategy are preloaded and fetched before any first-party code, but their execution **does not block page hydration from occurring**."*

So `beforeInteractive` is *not* a synchronous blocking `<script>` in the classic sense. Your page still hydrates. The script wins the race for the network and for execution start; it does not hold React hostage until it finishes. A consent manager that takes 900ms to decide will not prevent the page becoming interactive — which means the "do not render tracked content until consent resolves" logic is still yours to write, and cannot be delegated to the strategy.

### The placement constraint is a hard rule with an undocumented failure mode

> *"Scripts with the `beforeInteractive` strategy must be placed inside a root layout, such as `app/layout.tsx` or `app/[locale]/layout.tsx`, and are designed to load scripts that are needed by the entire site (i.e. the script will load when any page in the application has been loaded server-side)."*

```tsx
// app/layout.tsx — the ONLY correct home for beforeInteractive
import Script from 'next/script'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Script
          src="https://cdn.example-consent.com/cmp.js"
          strategy="beforeInteractive"
        />
      </body>
    </html>
  )
}
```

Note where the tag sits in that tree and then note that it does not matter:

> *"**Good to know**: Scripts with `beforeInteractive` will always be injected inside the `head` of the HTML document regardless of where it's placed in the component."*

So the JSX position is documentation for your colleagues, not an instruction to the framework. Putting it last in `<body>` does not make it late.

⚠️ **What the documentation does not state is what happens when you break the rule.** It says the script *must* be in a root layout; it does not say whether a `beforeInteractive` script in a nested layout throws, warns, or silently degrades to a client-injected tag. Do not assume a build error will catch this for you — treat the placement as a review item, not something CI will find.

### Once per document load, and a locale switch is not a document load

This is the sharpest edge on the page:

> *"**Good to know**: These scripts run once per document load. A client-side navigation does not run them again, including one that only changes a root param, such as `/en` to `/fi`, since the root layout stays the same."*

The example in the docs is chosen deliberately. `/en → /fi` looks like the biggest possible navigation — different locale, different content, arguably a different site — and it is still one document. Any third-party script whose initialisation is per-locale (a chat widget that picks its language at boot, a consent manager with localised copy, an analytics property split by market) will keep whatever it decided on the first page load. If re-initialisation matters, it has to be driven by your code reacting to the route change, not by the script tag being re-rendered.

**Named uses from the docs:** bot detectors, cookie consent managers. That list is short on purpose — the reference closes the section with a sentence worth treating as a rule:

> *"**This strategy should only be used for critical scripts that need to be fetched as soon as possible.**"*

## `afterInteractive` — the default, and where it actually goes

> *"Scripts that use the `afterInteractive` strategy are injected into the HTML client-side and will load after some (or all) hydration occurs on the page. **This is the default strategy** of the Script component and should be used for any script that needs to load as soon as possible but not before any first-party Next.js code."*

Injected *client-side*. The tag is not in the server's HTML; your bundle creates it. Two things follow that catch people out. The script cannot observe the pre-hydration document, because by the time it exists React has already been through it. And a user with JavaScript disabled or a bundle that fails to load gets no script at all — which for an analytics tag is a rounding error and for a consent manager is a compliance incident.

Placement is unrestricted, and unlike `beforeInteractive` it is meaningful:

> *"`afterInteractive` scripts can be placed inside of any page or layout and will only load and execute when that page (or group of pages) is opened in the browser."*

```tsx
// app/(marketing)/layout.tsx — analytics on the public pages only
import Script from 'next/script'

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Script
        src="https://cdn.example-analytics.com/tag.js"
        strategy="afterInteractive"
      />
    </>
  )
}
```

**Named uses from the docs:** tag managers, analytics.

## `lazyOnload` — idle time, after everything else

> *"Scripts that use the `lazyOnload` strategy are injected into the HTML client-side during browser idle time and will load after all resources on the page have been fetched. This strategy should be used for any background or low priority scripts that do not need to load early."*

Two conditions, both of which must be met: all page resources fetched, *and* the browser idle. On a heavy page on a slow connection that can be a long way into the visit, and a user who reads for eight seconds and leaves may never have loaded it at all. That is the correct behaviour for a chat widget and the wrong behaviour for a script whose whole job is to observe the visit.

**Named uses from the docs:** chat support plugins, social media widgets.

## `worker` — experimental, and not for the App Router

> *"**Warning:** The `worker` strategy is not yet stable and does not yet work with the App Router. Use with caution."*

If you are reading this chapter you are writing App Router code, so the short answer is that this strategy is not available to you. The long answer — what it does, why it is `pages/`-only, what the Partytown dependency is, and what to reach for instead — is [05d](05d-the-worker-strategy-partytown-and-what-to-use-instead.md).

## Choosing, in one table

| You need the script to… | Strategy | Because |
|---|---|---|
| Be authoritative before any of your code runs | `beforeInteractive` | Server-injected, fetched ahead of first-party modules |
| Run in a guaranteed order relative to another third-party script | `beforeInteractive` | The only documented ordering guarantee |
| Work with JavaScript-light or bundle-failure paths | `beforeInteractive` | The other three are injected by your bundle |
| Start as early as possible without preceding your own code | `afterInteractive` (default) | Client-injected after some hydration |
| Exist only on some routes | `afterInteractive` or `lazyOnload` in that layout/page | Placement is honoured for both |
| Never compete with content for bandwidth | `lazyOnload` | Idle time, after all resources fetched |
| Be off the main thread | — | `worker` is experimental and App Router-unsupported; see [05d](05d-the-worker-strategy-partytown-and-what-to-use-instead.md) |

The recommendation the guide closes on is a scoping rule rather than a strategy one, and it is the highest-leverage sentence on either page:

> *"**Recommendation**: We recommend only including third-party scripts in specific pages or layouts in order to minimize any unnecessary impact to performance."*

A tag in the root layout is a tag on your login page, your 404, your health-check-rendered marketing page and every route you add next year. A tag in `app/(marketing)/layout.tsx` is a tag on the pages that asked for it.

## Gotchas

**★ Symptom: the consent manager makes its decision after analytics has already fired.** Cause: both `<Script>` tags were left at the default, so both are `afterInteractive` and neither has a defined position relative to the other — the docs give an ordering guarantee only for `beforeInteractive`. Fix: promote the consent manager and place it in the root layout, where its ordering is defined:

```tsx
// app/layout.tsx
<Script src="https://cdn.example-consent.com/cmp.js" strategy="beforeInteractive" />
```

Then leave analytics at the default. The consent script is now fetched ahead of first-party code; the analytics tag is created by first-party code.

**★ Symptom: `beforeInteractive` was adopted to gate rendering on consent, and tracked content still flashes before the decision.** Cause: the strategy controls fetch and execution order, not hydration — *"their execution does not block page hydration from occurring"*. Fix: the gate is application state, not a script tag. Hold the tracked subtree behind the consent value:

```tsx
'use client'
import { useConsent } from '@/lib/consent'

export function TrackedEmbed({ src }: { src: string }) {
  const { marketing } = useConsent()
  if (!marketing) return <div className="embed-placeholder">Enable marketing cookies to view</div>
  return <iframe src={src} title="Embedded content" loading="lazy" />
}
```

**★ Symptom: switching the app from `/en` to `/fi` leaves the chat widget speaking English.** Cause: it loaded with `beforeInteractive`, which *"run[s] once per document load"*, and the docs name this exact navigation — a root param change keeps the same root layout, so there is no second document load. Fix: re-initialise from the route rather than expecting a re-mount:

```tsx
'use client'
import { useEffect } from 'react'
import { useParams } from 'next/navigation'

export function ChatLocaleSync() {
  const { locale } = useParams<{ locale: string }>()
  useEffect(() => {
    window.ExampleChat?.setLocale(locale)
  }, [locale])
  return null
}
```

**★ Symptom: the analytics tag reports far fewer sessions than the server logs show requests.** Cause: `lazyOnload` waits for *all* page resources plus browser idle; short visits end first. Fix: analytics is not a background script — the docs put tag managers and analytics under `afterInteractive` and reserve `lazyOnload` for chat and social widgets. Change the one prop:

```tsx
<Script src="https://cdn.example-analytics.com/tag.js" strategy="afterInteractive" />
```

**★ Symptom: LCP regressed after a tag manager was moved to `beforeInteractive` "to be safe".** Cause: the strategy competes with your own bundle for the network by design, and a tag manager routinely pulls in several further scripts. The reference is explicit that the strategy is *"only … for critical scripts that need to be fetched as soon as possible"*. Fix: return it to the default and, if it must load early, scope it to the routes that need it rather than buying it globally.

**Symptom: a script added to one page's `page.tsx` is loading on every route.** Cause: it was added to the root layout instead, and layout-level scripts follow the layout — the guide states that a script in a layout loads when that route *or any nested route* is accessed. Fix: move the tag into the narrowest file that needs it. Placement is honoured for `afterInteractive` and `lazyOnload`; it is the mechanism, not a hint.

**Symptom: the tag is in the JSX at the bottom of `<body>` and DevTools shows it in `<head>`.** Cause: not a bug — `beforeInteractive` scripts are *"always … injected inside the `head` of the HTML document regardless of where it's placed in the component"*. Fix: none needed. Write the placement where it reads best and stop treating the position as meaningful for this one strategy.

**Symptom: a `beforeInteractive` script sits in a nested layout and behaves inconsistently between environments.** Cause: the documented requirement is a root layout, and this violates it. ⚠️ The docs state the requirement without stating the consequence of breaking it, so the observed behaviour is not something this page will predict for you. Fix: move it to `app/layout.tsx`. If the script genuinely belongs to only part of the site, it is not a `beforeInteractive` script — that strategy is described as being for scripts *"needed by the entire site"*.

**Symptom: a script with `strategy` misspelled loads at an unexpected time and nothing warns.** Cause: only the four documented values exist; ⚠️ the documentation does not state what an unrecognised value does. Fix: do not rely on the runtime to catch it — the value is a union type in TypeScript, so type-check the app and let the compiler be the check:

```bash
tsc --noEmit
```

**Symptom: a `beforeInteractive` script cannot be given an `onLoad` handler.** Cause: two independent documented rules collide — handlers require a Client Component, and `beforeInteractive` requires a root layout. The reference states directly that *"`onLoad` can't be used with `beforeInteractive`"*. Fix: the handler story is its own chunk; see [05b](05b-onload-onready-onerror-and-the-client-component-boundary.md).

## Interview questions

**★ Why is `beforeInteractive` not the safe default?**
Because it is a claim on the network ahead of your own application code, and every script that takes it makes your first-party bundle later. The reference restricts it to *"critical scripts that need to be fetched as soon as possible"* and names only two categories — bot detectors and cookie consent managers. It also carries a constraint the others do not: it must live in a root layout, which means it loads on every route in the application whether that route needs it or not. The default is `afterInteractive` precisely because most third-party scripts are things you want soon, not things you want before yourself.

**★ What exactly does `beforeInteractive` block, and what does it not?**
It does not block hydration — the docs say so in as many words: the scripts are *"preloaded and fetched before any first-party code, but their execution does not block page hydration from occurring"*. What it does is win two orderings: it is fetched ahead of your modules, and multiple `beforeInteractive` scripts execute in the order they are placed. The practical consequence is that you cannot use the strategy to guarantee "nothing renders until this script has decided something". That guarantee has to be built in application state.

**★ Why must `beforeInteractive` scripts live in a root layout?**
Because the strategy's contract is site-wide: the script is injected into the initial server HTML for any page loaded server-side, and it runs once per document. A nested layout is, by definition, not present on every route, so a script placed there could not honour a promise that it precedes all first-party code everywhere. The docs frame it as intent as well as mechanics — the strategy is *"designed to load scripts that are needed by the entire site"*.

**★ A user switches from `/en` to `/fi`. Which of your scripts re-run?**
None of the `beforeInteractive` ones. The docs call this out explicitly: those scripts run once per document load, and a client-side navigation does not repeat them *"including one that only changes a root param, such as `/en` to `/fi`, since the root layout stays the same"*. The client-injected strategies are tied to the page or layout they were placed in, so a navigation that mounts a different layout can create a new tag — but a locale change that keeps the same root layout is a navigation, not a document load, and nothing about the third-party script's own state resets. Anything locale-dependent must be pushed into the script through its own API on a route change.

**★ Where would you put a customer-support chat widget, and why not one step earlier?**
`lazyOnload`, in the layout of the area that offers support — not in the root layout. Chat is explicitly one of the two `lazyOnload` examples in the reference, and the reason is that it competes with nothing the user is currently looking at: it loads during idle time after all page resources are fetched. Putting it one step earlier at `afterInteractive` means the widget's bundle — usually a large one — is fetched alongside the content the user actually came for.

**★ `afterInteractive` is injected client-side. What does that cost you?**
Three things. The script cannot see the document before React hydrates it, so anything that fingerprints or patches the original DOM is out. It depends on your bundle succeeding — a JavaScript error early in hydration takes the third-party script with it, which is fine for analytics and unacceptable for a consent gate. And it is not present in view-source, which makes debugging by reading the HTML impossible and sends people looking for a framework bug that is not there.

**Why does the ordering guarantee only exist for `beforeInteractive`?**
Because it is the only strategy where Next.js writes the tags itself, into one document, in one pass — so "the order they are placed" is a meaningful thing to promise. The client-injected strategies create tags while a page is hydrating or while the browser is idle; their relative timing depends on when each component rendered and when the browser decided it had spare capacity, neither of which the framework controls. If you need script A before script B and both are third-party, that is a `beforeInteractive` requirement, or an `onLoad` chain — not a hope.

**How does `lazyOnload` differ from putting `defer` on a plain `<script>`?**
`defer` is a parser instruction: the browser fetches in parallel and executes after the document is parsed but before `DOMContentLoaded`. `lazyOnload` is much later and conditional — the tag is created by client-side code during *browser idle time*, after all page resources have been fetched. A deferred script is guaranteed to run on every visit; a `lazyOnload` script on a busy page may not run before the user leaves. That is a feature when the script is optional and a defect when it is not.

**Is there any strategy that keeps a third-party script off the main thread today?**
Not on the App Router. `worker` is the strategy for it, and its own documentation says it *"is not yet stable and does not yet work with the App Router"* and can *"only currently be used in the `pages/` directory"*. The realistic App Router answers are to load the script late (`lazyOnload`), to load it on fewer routes, or not to load it — see [05d](05d-the-worker-strategy-partytown-and-what-to-use-instead.md).

---

← [04f · When not to optimize](04f-when-not-to-use-the-optimizer.md) · [Chapter index](01-explanation.md) · Next → [05b · Handlers and the client boundary](05b-onload-onready-onerror-and-the-client-component-boundary.md)
