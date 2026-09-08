---
title: "Declaring three Environment API entries gives a repo three deployable artefacts from one dependency graph, not microservices — and no primary source connects it to Module Federation"
sidebar_label: "08b · Many deployables, not microservices"
sidebar_position: 22
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-09-08 against the Vite documentation — [Environment API](https://vite.dev/guide/api-environment.md). Documentation-validated; **no sandbox run, no timings**. Target: **Vite 8.2.2 · Node.js 20.19+ / 22.12+**.
> Validated: 2026-09-08 · claims + output provenance · session vite-t18

**[08 · The Environment API](08-the-environment-api-and-many-build-targets.md) covers the
mechanism — the `environments` config, the `EnvironmentOptions` interface, the dev/build
asymmetry, the stability warning. This chunk answers the question the mechanism raises in a
microservices topic specifically: what does "several build targets from one config" actually
buy a team that thinks of itself as running several services, how does it compare to the
other "one repo, several things" answer this topic already gives, and — because it is tempting
to reach for and the sources do not support it — whether it has anything to do with Module
Federation. It does not, and this page says so in one sentence rather than leaving the reader
to guess.**

## Why this belongs in a microservices topic — the honest version

It does not give you microservices. It gives you **one repository, one dependency graph, one
plugin pipeline, emitting several deployment artefacts** — which is a different and smaller
claim, and worth being precise about because the two get conflated.

Contrast it with
[04 · One repo, many Vite apps](04-one-repo-many-vite-apps.md), the other "one repo, several
things" answer this topic already covers in depth. That page's shape is **separate Vite
configs, separate module graphs, separate builds, sharing nothing at runtime but a workspace
lockfile and a design-system package pulled in at build time.** Each app there is independently
deployable *because* it shares nothing once bundled — one team can ship `orders-ui` without
touching `payments-ui`'s build at all. Environments are the opposite trade: **one config, one
plugin pipeline, one module graph** (per environment, but built together), sharing far more,
in exchange for outputs that are guaranteed to agree with each other — the same version of the
same shared code went into the browser bundle, the SSR bundle and the edge bundle in the same
build.

The choosing rule follows from that trade directly:

- **Separate deploy schedules, separate teams, separate failure domains** → separate apps
  ([04](04-one-repo-many-vite-apps.md)). You want *less* coupling between the outputs, not
  more.
- **One application, several runtimes, and it matters that they agree** (the edge middleware
  must not personalise a page differently than the SSR render that follows it; a shared
  utility module must behave identically in both) → environments. You want the guarantee that
  comes from one dependency graph, and you are willing to accept one build failing the whole
  `vite build` if any configured environment fails.

Neither answer is "microservices" in the service-mesh sense. Both are Vite's honest, partial
answer to "we ship more than one thing from here."

## SSR composition and the fan-out problem

[01a · The BFF and the browser fan-out](01a-the-bff-and-the-browser-fan-out.md) covers the
cost a browser pays calling several backend services directly — a DNS lookup, a TLS handshake
and a CORS preflight per origin — and argues for collapsing that fan-out behind one BFF origin.
An `ssr` (or `server`, or whatever it is named) environment changes *where* that composition
happens without changing the argument: a server environment can call several backend services
itself, assemble a page from their responses, and hand the browser one already-composed
response over one origin — the fan-out still happens, it happens server-to-server instead of
browser-to-server, which is exactly the shape a BFF is. The Environment API does not add new
capability to do that composition; it is ordinary server-side code running inside the `ssr`
environment's Node process, using whatever HTTP client you already reach for. What the
Environment API changes is only that this composition code now shares a config, a plugin
pipeline and a resolve graph with the browser bundle, rather than living in a hand-rolled
second build.

## The one sentence this page exists to state

🔴 **Whether the Environment API can host a Module Federation remote as its own environment is
not documented anywhere in the sources verified for this topic — no source connects the two
mechanisms, and this page deliberately does not connect them either.** They address different
problems at different layers: the Environment API is about build **targets** for one
application's own code (browser, Node, edge — same source, compiled differently); Module
Federation is about **remotes** — independently built and independently deployed bundles
loaded into a host application at runtime, covered in
[05 · Module Federation on Vite](05-module-federation-on-vite.md). If your actual requirement
is remote-loaded micro-frontends, that page — and its plugin, `@module-federation/vite` — is
the mechanism, not a fourth entry in an `environments` map.

## Gotchas

**★ Treating "we declared three environments" as "we built a microservices architecture."**
Cause: conflating dependency-graph unification with deployment independence. Three
environments in one `environments` map still come from one `vite build`, one plugin pipeline
and one module graph per build — a plugin bug or a bad dependency bump affects every
environment in the same build. If the actual requirement is independently deployable,
independently versioned artefacts that can fail without taking each other down, that is
[04 · One repo, many Vite apps](04-one-repo-many-vite-apps.md), not this.

**★ Expecting a server environment to hand you inter-service tooling — service discovery,
retries, a circuit breaker — that the Environment API never claimed to provide.** Cause:
"server environment" sounds like infrastructure; it is a build-target config entry. Composing
a page from several backend calls inside an `ssr` environment is ordinary application code you
write yourself, exactly as it would be in any Node server — see the fan-out section above. Fix:
reach for the same tooling you would in any Node backend (an HTTP client with retry/timeout
policy, a circuit-breaker library) rather than looking for it in Vite's config surface.

**★ Assuming the Environment API and Module Federation compose, because both answer "several
targets from one repo."** Cause: they solve different problems at different layers, and the
similarity in framing ("several things from one repo") invites the conflation. No source in
this topic connects the two mechanisms. Fix: pick the one your actual problem is — build
targets for your own code use environments; independently deployed remotes loaded at runtime
use [05 · Module Federation on Vite](05-module-federation-on-vite.md) — and do not architect
around an integration that is not documented to exist.

## Interview questions

**★ What is the practical difference between "many Vite apps in one repo" and "many
environments in one Vite config," and how do you choose?** Separate apps share nothing at
runtime — separate configs, separate module graphs, separate builds — which is exactly what
you want when the outputs need independent deploy schedules and independent failure domains.
Environments share a config, a plugin pipeline and a resolve graph, which is what you want
when several runtimes belong to *one* application and it matters that they agree — the same
version of shared code compiled into the browser bundle and the server bundle in the same
build. Neither is "more advanced" than the other; they trade coupling for guarantees in
opposite directions.

**★ Does declaring an `edge` environment give you Module Federation, or a substitute for it?**
No, and the two should not be conflated. The Environment API addresses build **targets** for
one application's own code — same source, compiled for different runtimes. Module Federation
addresses **remotes** — independently built and independently deployed bundles loaded into a
host application at runtime. No primary source connects the two; whether a federation remote
could itself be modelled as an environment is not documented anywhere checked for this topic,
and the correct answer to "we need remote-loaded micro-frontends" is
[05 · Module Federation on Vite](05-module-federation-on-vite.md), not a fourth entry in an
`environments` map.

**★ How does a server environment change the browser-fan-out argument from `01a`, if at all?**
It does not change the argument, it changes *where the composition code lives*. `01a` argues
for collapsing several backend calls behind one BFF origin so the browser pays one DNS lookup,
one TLS handshake and no cross-origin preflight instead of several. A server environment that
composes a page from multiple services before responding to the browser **is** a BFF running
inside Vite's own SSR process — the fan-out still happens, just server-to-server, which is
strictly cheaper than browser-to-server. The Environment API contributes nothing new to that
composition logic; it only means the composing code now shares config and a module graph with
the rest of the app instead of living in a separately built server.

---

← [The Environment API](08-the-environment-api-and-many-build-targets.md) · [Vite overview](../../README.md) · Next → [When not to split](09-when-not-to-split-the-frontend.md)
