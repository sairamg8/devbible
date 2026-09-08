---
title: "Custom elements, single-spa and server-side composition each move the seam between independently deployed frontends somewhere different — the DOM, an orchestration layer, or off the browser entirely — and the decision table across all six options is the actual thing worth memorising"
sidebar_label: "06b · Composition alternatives + decision"
sidebar_position: 18
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-08 against package facts from **registry.npmjs.org**, fetched 2026-09-08. Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-08 · claims + output provenance · session vite-t18

**Continues [06](06-import-maps-and-the-other-answers.md) — import maps, library-mode
externals and iframes. This page covers the remaining three answers to sharing code across
independently deployed frontends — custom elements as a framework-agnostic DOM seam,
`single-spa` as an orchestration layer sitting above whichever delivery mechanism is
actually chosen, and server-side composition, which moves the assembly off the browser
entirely — then closes with the decision table across all six options from both pages.**

## Runtime web components / custom elements as the composition seam

A remote can ship a custom element instead of a plain component or a federation-exposed
module — `checkout.example.com` builds and serves a script that, on load, registers
`<checkout-flow>` via `customElements.define(...)`, and the shell simply drops that tag into
its markup:

```html
<script type="module" src="https://checkout.example.com/dist/checkout-element.js"></script>
<checkout-flow order-id="1234"></checkout-flow>
```

The framework the remote is written in is invisible to the host at the integration point —
the host doesn't need to know `checkout` is built with React, Vue, or anything else, because
the seam is a DOM element with attributes and events, not a JavaScript import. This is a
narrower promise than federation's `shared` or an import map's version pinning: it says
nothing about dependency deduplication (a React-based custom element still ships its own
React, full stop, unless it's deliberately built to consume a globally shared instance the
way [06](06-import-maps-and-the-other-answers.md)'s library-mode section shows) — its value
is specifically framework-agnostic composition at the markup level, trading dependency
efficiency for the host never needing to share a module graph, a bundler, or even a
language runtime convention with the remote at all.

## `single-spa` — a framework built specifically for this composition problem

**`single-spa`** is a JavaScript microfrontend framework whose entire purpose is
orchestrating multiple, independently deployed frontend applications — routing between them,
mounting and unmounting them, and providing lifecycle hooks (`bootstrap`, `mount`, `unmount`)
each registered application implements. Current published version: **6.0.3**, published
**2024-09-29**.

⚠️ **That date reflects the package's release cadence, not evidence of abandonment.** A
framework whose API surface has settled can legitimately go a long time between releases —
the same caution [05](05-module-federation-on-vite.md)'s sibling migration page applies in
the opposite direction: a long gap since the last publish is a signal to check the project's
own activity (issues, discussions, a maintained changelog) before concluding anything, not a
conclusion on its own. This page does not have primary-source verification of `single-spa`'s
current maintenance status beyond the registry's publish date and does not assert one either
way.

`single-spa` solves a different part of the problem than federation, an import map, or an
iframe do — it's an orchestration layer that sits *above* whichever mechanism actually
delivers each application's code (which can itself be Module Federation, SystemJS, or plain
script tags), handling which app is mounted for a given route and the mount/unmount
lifecycle across navigations. It is named here as a fourth axis of the decision —
orchestration framework versus bare mechanism — rather than covered in depth; a full
treatment is out of this topic's scope.

## Server-side composition — moving the assembly off the browser entirely

Every option covered so far assembles the page inside the browser, at some point after the
shell's own HTML has loaded. The alternative is not to do that at all: **Edge Side Includes
(ESI)**, a reverse-proxy-level template language, or an equivalent CDN-edge composition step,
assembles the final HTML from multiple origins' fragments *before* it ever reaches the
browser — the browser receives one already-composed document, with no client-side awareness
that it came from more than one service.

This trades every runtime concern the sections above wrestle with — `shared` negotiation,
import map ownership, iframe isolation cost — for a different set of constraints entirely:
the composition step needs edge or reverse-proxy infrastructure capable of running it, the
composed fragments are necessarily static or server-rendered at the point of composition
(no client-side interactivity crosses the fragment boundary the way a federated
`React.lazy` boundary does), and the "which build is live" observability problem from
[05d](05d-exposes-sri-and-build-observability.md) moves from a browser-visible concern to an
edge-infrastructure one. Vite's own **Environment API** — covered in the research bank as
formalising `client`/`ssr`/custom environments in Vite 6 — is a plausible place this topic
could connect to server-side composition and SSR fragment assembly, but no source consulted
for this page states that connection. It is therefore a **pointer**, not an argument:
[08 · The Environment API](08-the-environment-api-and-many-build-targets.md) explains the
mechanism on its own terms and is equally explicit that the documentation does not connect it
to Module Federation.

## Decision table — what you're actually trading

| | Build coupling | Runtime coupling | Shared-dep risk | Isolation | Deploy independence |
|---|---|---|---|---|---|
| **Module Federation** | Plugin + `shared` config on both sides | Manifest fetched at load time, negotiated per-load | High — `singleton`/`requiredVersion` mismatches, [05a](05a-shared-dependencies-and-singleton-breakage.md)/[05a2](05a2-shared-dependency-versioning-and-the-optimizedeps-gap.md) | None — same realm, same globals | Highest — remote redeploys independently, host picks it up automatically |
| **Import maps** | None — any stable-URL ES module qualifies | One map, resolved by the browser, no negotiation | Low for the map's own entries (one resolution, no conflict to negotiate) — but no auto-update when a remote changes | None — same realm | Low unless the shell's deploy is wired to update the map on every remote change |
| **Library mode + externals** | Build-time `external`/`globals` config | Runtime global lookup, no negotiation, no mismatch detection | Unmanaged — a version mismatch is a silent runtime bug, nothing checks it | None — same realm, shares globals directly | Moderate — remote redeploys independently, but any peer-dep drift is invisible until it breaks |
| **iframes** | None | A message-passing boundary (`postMessage`), not a module boundary | None — nothing is shared, so nothing can conflict | Full — separate realm, separate DOM, separate globals | Highest — the embedded app deploys with zero coordination |
| **Custom elements** | None — a `<script>` tag and a DOM contract | Attributes/events only, framework-agnostic | Low for the seam itself, but no dependency dedup — each element ships its own runtime | Partial — same DOM realm, but no shared JS module graph by convention | High — the remote redeploys independently; the host only depends on the element's tag/attribute contract |
| **Server-side composition** | None at the browser level; coupling moves to the edge/proxy config | None in the browser — the browser sees one document | N/A — no client-side shared runtime at all | Full, at the HTML level; no client JS realm is shared | High for content; interactivity across the seam is a separate, harder problem |

**The one-line rule of thumb for each:** reach for **Module Federation** when independently
deployed pieces genuinely need to share a live dependency instance (one React tree, one
router) and you're willing to own the `shared` contract; reach for an **import map** when you
want browser-native resolution with no build-time plugin and are willing to own the map as a
single, shell-owned artefact; reach for **library mode with externals** only when you already
control both sides tightly enough to manage the peer-dependency risk out of band, because
nothing in the mechanism itself will catch a mismatch; reach for an **iframe** when isolation
*is* the requirement, not a cost to minimise; reach for **custom elements** when
framework-agnostic composition at the markup level matters more than dependency efficiency;
and reach for **server-side composition** when the pieces don't need to share any client-side
runtime state at all, and the composition can happen once, before the browser ever sees it.

## Gotchas

**Symptom: a `<checkout-flow>` custom element loaded on a page that already has React
mounted appears to load twice as much JavaScript as expected.** Cause: unless the custom
element was deliberately built to consume a shared/global dependency the way
[06](06-import-maps-and-the-other-answers.md)'s library-mode section shows, it ships its own
bundled copy of React (or whatever it's built with) by default — the custom-element seam is
a DOM contract, not a dependency-sharing mechanism, and nothing about registering a tag
implies deduplication. Fix: if dependency size is a concern, either build the element
against externalised globals explicitly (the library-mode pattern, applied to a
custom-element output target) or accept the duplication as the cost of the element's
framework-agnostic seam.

**Symptom: `single-spa`'s last npm publish is read as "check if the project is dead" during
a vendor evaluation.** Cause: conflating publish recency with maintenance status, the same
trap [05](05-module-federation-on-vite.md)'s sibling migration page names for the *opposite*
direction (a recently-published but low-quality package looking more current than an
established one). A settled API surface can legitimately go a long time between releases.
Fix: check the project's actual activity signals — open issues, recent discussion, a
maintained changelog — rather than treating publish date alone as a maintenance verdict in
either direction; this page does not have primary-source verification of `single-spa`'s
current status beyond its registry publish date and states that limitation rather than
guessing past it.

## Interview questions

**What does `single-spa` actually add on top of a mechanism like Module Federation or an
import map, rather than competing with it?**
`single-spa` is an orchestration layer — it handles routing between independently registered
applications and their `bootstrap`/`mount`/`unmount` lifecycle across navigations. It doesn't
itself specify how each application's code is delivered; that delivery mechanism can be
Module Federation, SystemJS, or plain script tags underneath it. The decision the table above
answers is different from the one `single-spa` answers — it's about who coordinates mounting
and routing across multiple independently deployed apps, orthogonal to which mechanism
actually fetches each app's code.

**★ A team decides server-side composition (ESI or an equivalent edge-level assembly) fits
their integration case. What do they give up compared to any browser-side option in this
pair of pages, and what do they gain?**
They give up all client-side interactivity across the composition boundary — a fragment
assembled server-side is either static or server-rendered at the point of composition, with
no equivalent of a federated `React.lazy` boundary or a live-mounted custom element that can
update independently after the page has loaded. What they gain is that the "which build is
live" observability problem and the shared-dependency risk both disappear from the browser
entirely — there's no client-side runtime shared between the pieces at all, because the
browser only ever receives one already-composed document, and any coordination problem
moves to edge/proxy infrastructure instead of into a page's JavaScript realm.

---

← [Import maps and the alternatives](06-import-maps-and-the-other-answers.md) · [Vite overview](../../README.md) · Next → [base and asset URLs](07-base-and-asset-urls-across-origins.md)
