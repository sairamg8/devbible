---
title: "Module Federation is one answer to sharing code across independent deploys, and it is the heaviest one — import maps, library-mode externals and iframes each trade away a different piece of what federation buys, and knowing which piece you actually need is the whole decision"
sidebar_label: "06 · Import maps and the alternatives"
sidebar_position: 17
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-08 against [Vite — Building for Production](https://vite.dev/guide/build.md) (library mode, `rolldownOptions.external`) and package facts from **registry.npmjs.org**, fetched 2026-09-08. Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-08 · claims + output provenance · session vite-t18

**[05](05-module-federation-on-vite.md) through [05d](05d-exposes-sri-and-build-observability.md)
covered Module Federation in full — the mechanism, `shared`, a worked example, and the
version-skew consequences of running it in production. It is not the only way to compose
independently deployed frontend pieces, and it is the heaviest of the options that exist: it
buys runtime dependency negotiation and lazy cross-origin code loading at the cost of a
build-time plugin, a `shared` contract to get right, and every gotcha the last four pages
cataloged. This page and [06b](06b-composition-alternatives-and-the-decision.md) cover five
lighter answers, each giving up a different piece of what federation buys — an import map
gives up automatic version negotiation, an iframe gives up shared context entirely, a
custom element gives up dependency deduplication, server-side composition gives up runtime
flexibility. None of them is "better"; each is correct for a specific shape of the actual
problem, and picking one without naming which piece you're trading away is how a team ends
up fighting the tool they chose. This page covers the two build-time-adjacent answers —
import maps and library-mode externals — plus the one option with a real isolation
boundary, iframes; [06b](06b-composition-alternatives-and-the-decision.md) covers custom
elements, `single-spa`, server-side composition and the full decision table.**

## Import maps — the browser-native version of `remotes`, with no negotiation behind it

An import map is a native browser mechanism, not a Vite feature or a bundler plugin — a
`<script type="importmap">` block that tells the browser what URL to fetch for a *bare*
module specifier:

```html
<!-- served by the shell app, in its own index.html -->
<script type="importmap">
{
  "imports": {
    "react": "https://esm.sh/react@18.2.0",
    "react-dom": "https://esm.sh/react-dom@18.2.0",
    "checkout": "https://checkout.example.com/dist/checkout.js"
  }
}
</script>
<script type="module">
  import Checkout from "checkout";
  // "checkout" resolved against the import map above — the browser does this,
  // not Vite, not a bundler, not a runtime negotiation layer.
</script>
```

Any module anywhere in the page that writes `import Checkout from "checkout"` — whether
it's the shell's own first-party code or another remote's code — resolves that bare
specifier against the *one* map the page declared. That is the mechanism in full: no plugin,
no build-time federation config, no runtime library shipped to the browser to do the
resolving. The browser's own module loader does it, the same way it resolves any other ESM
import.

This is a genuinely different model from federation, not a lighter version of the same one:

- **No build-time coupling at all.** `checkout`'s build doesn't need a federation plugin,
  doesn't need to emit a `remoteEntry.js` manifest, doesn't need `build.target: 'chrome89'`
  for federation's top-level-await requirement — it just needs to produce a URL-addressable
  ES module. Any plain Vite build with a stable output URL qualifies.
- **No `shared` negotiation.** There's no `singleton`/`requiredVersion`/`strictVersion`
  machinery deciding which of two declared React versions wins — there's exactly one entry
  for `"react"` in the map, and every module on the page that imports `"react"` gets that
  URL. Version conflicts don't get negotiated at runtime because there's only ever one
  resolution to begin with; a conflict has to be resolved by whoever edits the map, before
  the page loads.
- **One map, one owner, one deploy.** Because there's exactly one `<script type="importmap">`
  per page, whoever renders the shell's HTML owns the map — updating which URL `"checkout"`
  points at is a shell-side change, not something `checkout`'s own deploy can push on its
  own the way a federation remote's redeploy is picked up automatically on next load. This
  is the real cost: an import map buys the resolution simplicity of "there's only one
  answer" by giving up federation's independent-redeploy property for anything not already
  in the map, unless the shell's own deploy pipeline is wired to update the map whenever a
  remote changes.

## `build.rolldownOptions.external` and library mode — externalise, don't federate

A remote can also be built as an ordinary library and consumed as a plain script, with peer
dependencies externalised rather than bundled. The bank's own [build documentation](https://vite.dev/guide/build.md)
gives the exact shape:

```js
// checkout/vite.config.js — built as a UMD library, not a federation remote
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(import.meta.dirname, 'src/checkout.ts'),
      name: 'Checkout',
      fileName: 'checkout',
    },
    rolldownOptions: {
      external: ['react', 'react-dom'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
      },
    },
  },
});
```

`external: ['react', 'react-dom']` tells the build not to bundle those packages at all — the
output assumes they're already present at runtime, addressed through `output.globals`'
mapping to whatever global name the consumer's page already exposes them under (`window.React`,
typically, if `react` is loaded as a UMD script itself). `checkout`'s own `dist/checkout.umd.cjs`
is then just a `<script>` tag the shell includes directly:

```html
<script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
<script src="https://checkout.example.com/dist/checkout.umd.cjs"></script>
<script>
  const el = document.getElementById('checkout-root');
  window.Checkout.mount(el); // whatever API checkout.ts's library entry exposes
</script>
```

This is not merely "federation without the plugin" — it's a fundamentally simpler contract
with a fundamentally weaker guarantee. There's no version negotiation whatsoever: whoever
supplies `React` as a global at runtime supplies it for every externalised consumer on the
page, and if `checkout`'s library was built and tested against React 18 while the page
happens to be running React 19's UMD build, nothing catches that at build time or at load
time — it's a plain runtime type mismatch, discovered the way any untyped runtime mismatch
is discovered. Federation's `shared` block exists specifically to make that negotiation
explicit and (with `strictVersion`) loud; externalising peer deps through library mode
removes the negotiation, it doesn't solve it.

## iframes — the option everyone dismisses, and the only one with a real isolation boundary

An iframe is the one alternative on this page that doesn't try to share a JavaScript
runtime, a module graph, or a `react` instance at all:

```html
<!-- shell's page -->
<iframe
  src="https://checkout.example.com/embed"
  title="Checkout"
  style="width: 100%; height: 600px; border: none;"
></iframe>
```

`checkout` is now an entirely separate document, with its own JavaScript execution context,
its own DOM, its own `window`, loaded and rendered by the browser as a genuinely separate
page. No `shared` singleton problem exists because there is no shared anything — two React
instances, two copies of every dependency, running in two isolated realms, is not a
misconfiguration here, it's the whole point.

What that isolation costs, specifically:

- **Routing** — the host's router and the iframe's internal navigation are two separate
  systems; keeping a URL bar in sync with what's showing inside an iframe requires explicit
  `postMessage` plumbing on both sides, there's no shared history API across the boundary.
- **Focus and accessibility** — tab order, focus trapping and screen-reader context don't
  cross an iframe boundary automatically; a modal or form spanning the iframe edge needs
  deliberate work to behave like one coherent page rather than two.
- **Sizing** — an iframe has no native way to size itself to its content; a checkout flow
  whose height changes as it progresses needs to `postMessage` its own height to the parent,
  which then resizes the `<iframe>` element — there's no CSS-only fix for this across origins.
- **Auth** — cookies and any session state don't automatically flow into a cross-origin
  iframe the way they would for same-origin script inclusion; third-party cookie
  restrictions in modern browsers can block this path entirely depending on the two origins'
  relationship, and working around it typically means passing a token explicitly rather than
  relying on ambient cookie auth.

Given all of that, an iframe is not a fallback choice made when nothing else fits — it's the
*correct* choice specifically when the isolation is the requirement rather than the cost. A
third-party payment widget, a differently-secured internal tool embedded for convenience, or
any surface where you deliberately do **not** want the embedded content sharing your page's
JavaScript realm (because you don't control what it does in that realm, or you don't want a
bug in it to be able to touch your own page's DOM or globals) is exactly the case an iframe
solves and none of the other options in this pair of pages can.

## Gotchas

**★ Symptom: a page using an import map for `"checkout"` keeps serving an old version of
`checkout` after `checkout`'s own team deploys a new build.** Cause: unlike a federation
`remoteEntry.js`, there is no automatic discovery step for an import map — the map is a
static block of URLs that only changes when whoever owns the shell's HTML edits it and
redeploys. `checkout` redeploying to the same URL its map entry already points at *does*
pick up the new content (subject to ordinary HTTP caching on that URL), but a version bump
that changes the URL itself needs the shell to update the map. Fix: either keep `checkout`'s
import-map URL stable across versions and rely on the caching split from
[05c](05c-version-skew-and-the-remote-manifest.md) applied to that URL, or accept that a
versioned URL requires a coordinated shell-side map update — there is no third option the
mechanism provides for free.

**★ Symptom: a library-mode remote, externalising `react` as a global, works in one
integration and throws a hooks-related error in another.** Cause: `external`/`output.globals`
externalisation has no version negotiation of any kind — it assumes whatever `window.React`
resolves to at runtime is compatible with what the library was built and tested against, and
nothing checks that assumption. A page supplying a different React major as the global
breaks the library silently until something inside it calls a hook or API that changed
between majors. Fix: pin the exact React version the library was built against in whatever
loads the global script, and treat this as a manual, out-of-band version contract — the same
kind of risk `shared`'s `requiredVersion` makes visible for federation, unmanaged here.

**Symptom: a checkout flow embedded via iframe loses focus when a screen-reader user tabs
into it, or a modal that should trap focus across the whole page doesn't.** Cause: focus
management, tab order and accessibility tree context don't cross an iframe boundary
automatically — the two documents are genuinely separate accessibility contexts. Fix: this
is not a bug to patch, it's the isolation an iframe provides doing exactly what it's
supposed to; if seamless focus/accessibility integration across the boundary is a
requirement, an iframe is very likely the wrong mechanism for this particular integration,
not a component to be configured differently.

## Interview questions

**★ An import map and Module Federation both let a host resolve a bare specifier to code
that lives on another origin. What's the actual mechanism difference, and what does it cost
an import map?**
An import map is resolved by the browser's native module loader against one static
`<imports>` block declared once per page — there's no negotiation step, no manifest fetched
at runtime, and no version-conflict resolution because there's only ever one URL registered
per specifier. Federation resolves a specifier by fetching a remote's `remoteEntry.js`
manifest at the moment it's needed, and that manifest can change independently on the
remote's own schedule with the host picking it up automatically on next load. The cost an
import map pays for its simplicity is exactly that automatic pickup: updating which version
of `checkout` is live is a shell-owned edit to the map, not something `checkout`'s own
deploy can push through on its own.

**★ Why does externalising `react` through `build.rolldownOptions.external` in library mode
not give you the same safety `shared`'s `requiredVersion` gives federation, even though both
are "sharing one instance of React across independently built code"?**
Because externalising a dependency only removes it from the bundle — it says nothing about
what version the consumer is expected to supply, and nothing checks that expectation at
build time, load time, or runtime. `shared`'s `requiredVersion` and `strictVersion` are
federation's explicit negotiation and failure mechanism for exactly this scenario; library
mode's externals have no equivalent, so a version mismatch between what the library was
built against and what the host actually supplies as the global is a silent bug discovered
the way any untyped runtime mismatch is discovered — usually by a user hitting it first.

**★ Given that an iframe is the option most teams reflexively rule out, when is it actually
the right choice over Module Federation or a custom element?**
When isolation is the actual requirement rather than an unwanted side effect — a
third-party surface you don't control the behaviour of, or a differently-secured internal
tool you deliberately don't want sharing your page's JavaScript realm, globals, or DOM. Every
other option covered on this page and [06b](06b-composition-alternatives-and-the-decision.md)
assumes host and remote *should* share something — a module graph, a dependency instance, at
minimum the same page's DOM and JavaScript context. An iframe is the only one that gives up
all of that on purpose, and for a payment widget or any surface where a bug in the embedded
code being unable to touch your own page matters more than integration convenience, that
isolation is the feature, not the limitation.

---

← [exposes, SRI and observability](05d-exposes-sri-and-build-observability.md) · [Vite overview](../../README.md) · Next → [Composition alternatives + decision](06b-composition-alternatives-and-the-decision.md)
