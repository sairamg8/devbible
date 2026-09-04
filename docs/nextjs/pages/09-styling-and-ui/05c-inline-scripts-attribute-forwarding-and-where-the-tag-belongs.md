---
title: "An inline `<Script>` without an `id` is untracked, an undocumented prop is forwarded verbatim to the emitted tag — which is the only reason a nonce works at all — and the file you put the tag in is the file that decides how many routes pay for it"
sidebar_label: "05c · Inline scripts and placement"
sidebar_position: 11
description: "Inline scripts and the mandatory id, dangerouslySetInnerHTML, the attribute-forwarding rule that carries nonce and data-* through to the emitted script tag, and the layout-versus-page placement rule with the once-per-visit de-duplication it implies."
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-04 against **Next.js 16.3.4** documentation — [Optimizing third-party scripts](https://nextjs.org/docs/app/guides/scripts) (doc `version: 16.3.4`, `lastUpdated: 2026-06-01`) and the [`<Script>` API reference](https://nextjs.org/docs/app/api-reference/components/script) (`lastUpdated: 2026-08-25`).
> Version spine: **Next.js 16.3.4** · React 19.2.8 · Node 20.9 floor. `next` is **not installed in this checkout**; documentation-verified only, **no sandbox run**. CSP policy itself belongs to [chapter 10](../10-forms-authentication-and-security-hardening/10-content-security-policy-nonces-and-the-dynamic-rendering-tax.md) — this page covers only the `next/script` mechanism that carries a nonce to the tag.

**Two thirds of what `next/script` does is invisible in its prop table. It accepts a script with no `src` at all, and then quietly requires an `id` you would never think to add. It accepts props it does not document and forwards them untouched to the emitted `<script>` element — which is the entire reason a nonce, a `data-*` attribute or a `crossOrigin` value can reach the tag under a strict CSP. And it treats the file you put the tag in as a scope declaration: a script in `app/layout.tsx` is a script on every route your application will ever have, loaded once and never again, while the same tag in `app/(marketing)/layout.tsx` is a script the logged-in application never pays for. None of those three behaviours produces an error when you get it wrong.**

## Inline scripts, and the `id` that is not optional

> *"Inline scripts, or scripts not loaded from an external file, are also supported by the Script component. They can be written by placing the JavaScript within curly braces"* … *"Or by using the `dangerouslySetInnerHTML` property"*

Both forms are documented and both are used:

```tsx
// Curly-brace form
<Script id="show-banner">
  {`document.getElementById('banner').classList.remove('hidden')`}
</Script>
```

```tsx
// dangerouslySetInnerHTML form
<Script
  id="show-banner"
  dangerouslySetInnerHTML={{
    __html: `document.getElementById('banner').classList.remove('hidden')`,
  }}
/>
```

And the requirement that has no equivalent for external scripts:

> *"**Warning**: An `id` property must be assigned for inline scripts in order for Next.js to track and optimize the script."*

🔴 **`id` is mandatory for inline scripts and only for inline scripts.** An external script is identified by its `src`; an inline one has no natural identity, so tracking — which is what de-duplication across navigations depends on — has nothing to key on without it. ⚠️ The documentation states the requirement without stating the consequence of omitting it; do not assume the script simply fails to run, and do not assume it runs exactly once either.

### Which inline form to use

The curly-brace form is a template literal in JSX and is the better default: it is ordinary React, and it reads as code. Reach for `dangerouslySetInnerHTML` when the payload is assembled rather than authored — most often a JSON-LD block or a configuration object — because you are writing a string anyway and the prop name is a useful piece of self-documentation at the review stage.

🔴 **Neither form escapes anything.** The `dangerouslySetInnerHTML` name is honest, and the curly-brace form is exactly as dangerous while looking safer. Interpolating anything a user controls into either one is script injection, full stop:

```tsx
// 🔴 NEVER — the team name is user input, and it is being written into a script body
<Script id="track">{`analytics.track('team', '${team.name}')`}</Script>
```

The fix is to move the value out of the code and into data the script reads:

```tsx
// The value travels as an attribute; the script body is a constant
<div id="board-root" data-team={team.name} />
<Script id="track">
  {`analytics.track('team', document.getElementById('board-root').dataset.team)`}
</Script>
```

That pattern is the same one chapter 10 arrives at from the other direction — a build-time-hashable script plus request-time data — and it is worth internalising once: **request-time values are data, never generated code.**

## Attribute forwarding: the undocumented props are the useful ones

> *"There are many DOM attributes that can be assigned to a `<script>` element that are not used by the Script component, like `nonce` or custom data attributes. Including any additional attributes will automatically forward it to the final, optimized `<script>` element that is included in the HTML."*

The documented example forwards three:

```tsx
<Script
  src="https://cdn.example.com/script.js"
  id="example-script"
  nonce="XUENAJFW"
  data-test="script"
/>
```

⚠️ **That literal nonce is a documentation placeholder and copying it is a security bug.** A nonce is a per-request secret; a constant one satisfies the policy for an attacker exactly as well as it does for you. In a real application the value comes from wherever your proxy generated it for this request — see [chapter 10 · CSP nonces](../10-forms-authentication-and-security-hardening/10-content-security-policy-nonces-and-the-dynamic-rendering-tax.md), which also explains why taking a nonce at all makes the route dynamic, and [chapter 10 · CSP without nonces](../10-forms-authentication-and-security-hardening/11-csp-without-nonces-static-headers-sri-and-third-party-scripts.md) for the static alternative.

```tsx
import { headers } from 'next/headers'
import Script from 'next/script'

export default async function Layout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get('x-nonce') ?? undefined
  return (
    <>
      {children}
      <Script src="https://cdn.example-analytics.com/tag.js" nonce={nonce} />
    </>
  )
}
```

Useful things the forwarding rule lets you pass, none of which appear in the prop table: `crossOrigin`, `referrerPolicy`, `integrity`, `type` (for `module` or `application/ld+json`), `async`, `defer`, and any `data-*` a vendor's snippet requires — many vendors configure themselves entirely through `data-` attributes on their own script tag.

⚠️ The documentation says forwarded attributes reach *"the final, optimized `<script>` element"*. It does not say what happens if a forwarded attribute conflicts with something the strategy already controls — `async` or `defer` alongside `strategy`, for instance. Nothing settles that, so do not pass loading hints and a strategy at the same time and expect a defined result.

## Where the tag goes decides who pays for it

The guide describes three placements. The distinction between them is scope, and scope is the only performance lever on this page that costs nothing.

**In a page** — the script is fetched when that route is accessed, and nowhere else.

**In a layout** — the script covers the layout's whole subtree:

> *"The third-party script is fetched when the folder route (e.g. `dashboard/page.js`) or any nested route (e.g. `dashboard/settings/page.js`) is accessed by the user. Next.js will ensure the script will **only load once**, even if a user navigates between multiple routes in the same layout."*

**In the root layout** — the script covers everything:

> *"This script will load and execute when *any* route in your application is accessed. Next.js will ensure the script will **only load once**, even if a user navigates between multiple pages."*

```
app/
├── layout.tsx                  🔴 a <Script> here runs on /login, /404, every route you add later
├── (marketing)/
│   └── layout.tsx              ✅ analytics for the public pages only
└── teams/
    └── [team]/
        └── board/
            └── page.tsx        ✅ a board-only widget, on one route
```

The de-duplication guarantee is worth reading as what it is: a promise of **once per visit**, not once per navigation. That is what you want for a tag manager and precisely what you do not want for a widget that needs re-initialising — which is why [05b](05b-onload-onready-onerror-and-the-client-component-boundary.md)'s `onReady` exists, and why "the script only loads once" and "the widget must be re-mounted" are two different problems with two different solutions.

And the recommendation that closes the guide:

> *"**Recommendation**: We recommend only including third-party scripts in specific pages or layouts in order to minimize any unnecessary impact to performance."*

## Gotchas

**★ Symptom: an inline `<Script>` behaves inconsistently and there is no error anywhere.** Cause: no `id`. The docs require one *"in order for Next.js to track and optimize the script"*, and tracking is what the once-per-visit behaviour depends on. Fix: give every inline script a stable, unique id:

```tsx
<Script id="sprintdesk-theme-init">
  {`document.documentElement.dataset.theme = localStorage.getItem('theme') ?? 'system'`}
</Script>
```

**★ Symptom: a penetration test reports script injection through a team name.** Cause: a user-controlled value was interpolated into an inline script body — the curly-brace form and `dangerouslySetInnerHTML` are equally unescaped, and the friendlier syntax of the former hides that. Fix: carry the value as data on an element and read it from a constant script body, as shown above. If it must be JSON, serialize it into a `application/ld+json` or `application/json` block and `JSON.parse` it — a JSON type is not executed:

```tsx
<Script id="board-config" type="application/json">
  {JSON.stringify({ team: team.name })}
</Script>
```

**★ Symptom: CSP blocks the third-party script even though a nonce was passed.** Cause: the nonce was the literal `"XUENAJFW"` from the documentation example, or a constant from an environment variable — either way it is not the value the current response's policy header contains. Fix: read the per-request nonce your proxy generated, as in the layout example above, and accept the dynamic-rendering consequence that chapter 10 documents.

**★ Symptom: analytics is firing on the login page, the 404 and the health check.** Cause: the tag is in the root layout, where the docs say it *"will load and execute when any route in your application is accessed"*. Fix: move it into the layout of the area that wants it. This is one line of diff and it is the largest single performance change most applications can make to their third-party load.

**★ Symptom: a widget initialises on the first board and stays stale when the user opens a different board.** Cause: not a bug — both layout placements guarantee the script *"only load[s] once, even if a user navigates between multiple routes in the same layout"*. Loading once is the intended behaviour; re-initialisation is a separate concern. Fix: keep the script where it is and drive the re-init from `onReady` in a Client Component ([05b](05b-onload-onready-onerror-and-the-client-component-boundary.md)).

**★ Symptom: the same vendor script appears twice in the DOM.** Cause: the tag was added in two files — commonly a layout and one of its pages — during a refactor. ⚠️ The documented guarantee covers navigation within one layout; it does not state what happens when two separate `<Script>` elements name the same `src`. Fix: do not rely on the framework to reconcile it. Keep one tag per vendor, in the highest file that all its consumers share, and grep before adding a second:

```bash
grep -rn "cdn.example-analytics.com" app/
```

**Symptom: a JSON-LD block renders as visible text on the page.** Cause: it was written as a bare `<script type="application/ld+json">` inside JSX without the type reaching the emitted tag, or the content was placed as a child rather than serialized. Fix: use `<Script>` with the forwarded `type` and a serialized payload — and note that [chapter 12](../12-seo-metadata-and-accessibility/01-explanation.md) owns structured data as a subject; this is only the mechanism.

**Symptom: an inline script that reads `localStorage` causes a hydration mismatch or a theme flash.** Cause: it ran after hydration because it was left at the default strategy, so React had already rendered the wrong theme. Fix: a theme-flash preventer is one of the few genuine `beforeInteractive` cases — it must run before the first paint and before hydration:

```tsx
// app/layout.tsx
<Script id="theme-init" strategy="beforeInteractive">
  {`document.documentElement.dataset.theme = localStorage.getItem('theme') ?? 'system'`}
</Script>
```

**Symptom: passing `defer` alongside `strategy="lazyOnload"` produces confusing results.** Cause: you have given the browser a loading hint and the framework a loading strategy for the same tag, and ⚠️ the docs do not define the interaction. Fix: pick one. `strategy` is the framework-level control and the one the rest of this chapter is written about; native `async`/`defer` belong on a hand-written `<script>` you are deliberately keeping outside `next/script`.

**Symptom: a vendor snippet that must be pasted verbatim into `<head>` does not work through `<Script>`.** Cause: most such snippets are inline bootstrappers that expect to execute before the document body — a shape `next/script` supports only through `beforeInteractive`, which comes with the root-layout requirement and no handlers. Fix: use `beforeInteractive` with an `id`, and verify against what the vendor actually needs rather than what its copy-paste box says. If the vendor genuinely requires a raw tag in the document head, that is a case for the root layout's own `<head>` markup, not for this component.

## Interview questions

**★ Why does an inline `<Script>` need an `id` when an external one does not?**
Because the framework tracks scripts to load each one once per visit, and it needs a key to do that with. An external script has a natural one in its `src`; an inline script's body is not a stable identity — it can change on a redeploy, appear identically in two places, or be assembled at render time. The `id` is the identity you supply. The docs state it as a warning rather than an error, which means it is your responsibility rather than the compiler's.

**★ How does a nonce reach the emitted `<script>` tag when `nonce` is not a documented prop?**
Through the attribute-forwarding rule: any DOM attribute the component does not itself use is passed straight through to *"the final, optimized `<script>` element"*. That single sentence is what makes the component compatible with a strict CSP, and it also covers `crossOrigin`, `integrity`, `referrerPolicy`, `type` and every `data-*` a vendor requires. The corollary is that a typo in an attribute name is silently forwarded too — nothing validates the names.

**★ What is wrong with the nonce in the documentation's own example?**
Nothing, as documentation — it is a placeholder. Everything, as code: a nonce is a per-request secret whose entire security value is that an attacker injecting markup cannot predict it. A hardcoded value, or one from an environment variable, is knowable, and a policy trusting it is a policy trusting anything. The real value comes from the proxy that generated it for this response, which is also why nonce-based CSP forces dynamic rendering.

**★ You inherit an app with a tag manager in the root layout. What do you check first?**
Which routes actually need it. A root-layout script loads on every route in the application, including the login page, error pages and any route added later by someone who never saw the decision. Moving it into the layout of the area that uses it is a one-line change with no behavioural risk for those routes, and it is the change the documentation explicitly recommends. After that, check its strategy: a tag manager belongs at `afterInteractive`, and finding it at `beforeInteractive` is common and expensive.

**★ Is the curly-brace inline form safer than `dangerouslySetInnerHTML`?**
No — they are equally unescaped, and the curly-brace form is more dangerous in practice precisely because it does not have an alarming name. Both write their contents into a script body verbatim. Any interpolated value that a user can influence is code execution. The habit that removes the whole class of bug is to keep inline script bodies constant and pass request-time values as `data-` attributes or a JSON block the script reads.

**What does "the script will only load once" actually guarantee?**
Once per document, not once per navigation. Within a layout, navigating between routes that share it does not refetch or re-execute the script; in a root layout, no navigation anywhere in the app does. That is the right behaviour for tag managers and analytics, and it is the reason a widget needing per-mount initialisation cannot be served by the load event alone — the load only happens once, so `onReady`, which also fires on mount, is the hook for that.

**When would you deliberately not use `next/script` at all?**
When the vendor requires a raw tag in a position the component does not offer, when you need native `async`/`defer` semantics precisely and do not want a strategy layered on top, or when the script is first-party and small enough that an ordinary import is simpler and gives you bundling and type checking. `next/script` earns its place for third-party code, where load timing, de-duplication across navigations and attribute forwarding are all things you would otherwise hand-roll.

**How do the inline-script rules on this page connect to CSP?**
Directly and awkwardly. An inline script needs either `'unsafe-inline'`, a nonce, or a hash to be allowed by a strict policy — so every inline `<Script>` you add is a bill that arrives in chapter 10. The forwarding rule pays it with a nonce at the cost of dynamic rendering; the SRI route pays it at build time and keeps pages static, but cannot cover a script whose content is generated per request. Which is the same conclusion as the injection gotcha, reached from the security side: keep script bodies constant and let data vary.

---

← [05b · Script handlers](05b-onload-onready-onerror-and-the-client-component-boundary.md) · [Chapter index](01-explanation.md) · Next → [05d · The worker strategy](05d-the-worker-strategy-partytown-and-what-to-use-instead.md)
