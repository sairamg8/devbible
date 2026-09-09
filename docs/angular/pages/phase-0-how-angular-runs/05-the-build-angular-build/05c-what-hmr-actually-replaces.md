---
title: "What Angular's hot module replacement can actually replace at 22.1.7 is described three incompatible ways by three primary sources — this page names all three, refuses to pick one, and gives you the part all three agree on"
sidebar_label: "05c · What HMR actually replaces"
sidebar_position: 5.2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** — angular.dev,
> [Angular CLI builds](https://angular.dev/tools/cli/build-system-migration) (§ *Hot module
> replacement*; source `adev/src/content/tools/cli/build-system-migration.md` at tag `v22.1.5`);
> the `hmr` and `liveReload` entries of
> [`src/builders/dev-server/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/dev-server/schema.json);
> and the `NG_HMR_CSTYLES` / `NG_HMR_TEMPLATES` declarations in
> [`src/utils/environment-options.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/utils/environment-options.ts),
> both at tag `v22.1.7`. Documentation- and source-validated; **no sandbox run**.
> 🔴 **One load-bearing claim on this page is recorded as unresolved** — the precise scope of HMR at
> 22.1.7 — because the three sources above contradict each other and nothing available settles it.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**Hot module replacement is on by default in `ng serve`, requires no configuration, and its exact
scope cannot be stated from the documentation.** Three primary sources — the migration guide, the
`dev-server` builder's own JSON schema, and the build system's internal options file — each describe
a different set of things HMR can replace, and the three cannot all be right. Rather than pick the
one that reads best, this page shows all three, says which claim they *do* agree on, and gives you
the operational rules that follow from the agreed part. That is not a hedge: on a page about
developer-loop behaviour, "these three sources disagree" is a more useful fact than a confident
answer that turns out to describe a different version.

## Source 1 — the migration guide lists three kinds

> *"While general JavaScript-based hot module replacement (HMR) is currently not supported, several
> more specific forms of HMR are available:*
> *- **global stylesheet** (`styles` build option)*
> *- **component stylesheet** (inline and file-based)*
> *- **component template** (inline and file-based)"*
> — [angular.dev · Hot module replacement](https://angular.dev/tools/cli/build-system-migration#hot-module-replacement)

and, in the same section:

> *"The HMR capabilities are automatically enabled and require no code or configuration changes to
> use. Angular provides HMR support for both file-based (`templateUrl`/`styleUrl`/`styleUrls`) and
> inline (`template`/`styles`) component styles and templates."*

That is the broadest of the three claims: stylesheets **and** templates, inline **and** file-based,
with no configuration.

## Source 2 — the builder's schema omits templates

The `dev-server` builder's own option description is narrower, and it is the description a reader
sees if they inspect the schema rather than the guide:

> *"Enable hot module replacement. Defaults to the value of 'liveReload'. Currently, only global and
> component stylesheets are supported."*
> — [`dev-server/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/dev-server/schema.json), `hmr`

Stylesheets only. Templates are not mentioned, and the word *"only"* makes that an exclusion rather
than an omission.

## Source 3 — the internal switches default the other way round

`environment-options.ts` declares two switches, and their defaults are asymmetric in a direction
that matches neither source above:

```ts
/** When `NG_HMR_CSTYLES` is enabled, component styles will be hot-reloaded. */
export const useComponentStyleHmr = parseTristate(process.env['NG_HMR_CSTYLES']) === true;

/** When `NG_HMR_TEMPLATES` is set to `0` or `false`, component templates will not be hot-reloaded. */
export const useComponentTemplateHmr = parseTristate(process.env['NG_HMR_TEMPLATES']) !== false;
```

Read the comparisons, not the names. `=== true` means component-style HMR is **off unless you
switch it on**. `!== false` means template HMR is **on unless you switch it off**. That is the
opposite emphasis to source 2, which names stylesheets and excludes templates, and it does not sit
comfortably with source 1's flat list of three either.

⚠️ **`NG_HMR_CSTYLES` and `NG_HMR_TEMPLATES` are not public API.** They live in an internal `utils/`
file, appear in no schema, and are absent from angular.dev. They are cited here as *evidence about
the disagreement*, not as configuration to adopt — the wider `NG_BUILD_*` / `NG_HMR_*` surface and
that warning in general belong to **11 · Cache, workers and the environment variables**
*(not written yet)*.

## What is not known, stated plainly

🔴 **Which of the three describes runtime behaviour at 22.1.7 was not determined.** The environment
switches may gate an *additional* code path rather than the primary one, in which case all three
statements could be locally true and still read as contradictory. Nothing in the documentation, the
schema or the changelog settles it, and there is no sandbox behind this page to settle it
empirically. **This page does not pick a side, and neither should you when asked.**

## What all three agree on

> 🔴 **General JavaScript-based hot module replacement is not supported.** Editing a component's
> TypeScript — a method, a field, an injected dependency, a signal — does not hot-replace. Templates
> and stylesheets have *some* HMR support, whose exact boundary is version-specific and, at 22.1.7,
> inconsistently documented.

The migration guide states it outright (*"general JavaScript-based hot module replacement (HMR) is
currently not supported"*), and neither of the other two sources claims otherwise. Everything
operational follows from that one sentence:

- **Change logic → expect a full reload.** Component state is lost. If that costs you a long
  click-path to reproduce something, keep the state you need outside the component you are editing
  while you work on it.
- **Change a template or a stylesheet → expect something faster than a reload**, but do not build a
  workflow on top of a specific guarantee about which.
- **Verify your own version.** The cheapest possible check is to edit a stylesheet, then a template,
  then a method, and watch whether the page reloads. That takes a minute and it beats every source
  quoted above for your specific version.

## Turning it off is documented

> *"If preferred, the HMR capabilities can be disabled by setting the `hmr` development server option
> to `false`."*
> — [angular.dev · Hot module replacement](https://angular.dev/tools/cli/build-system-migration#hot-module-replacement)

```json
"serve": {
  "builder": "@angular/build:dev-server",
  "options": {
    "buildTarget": "my-app:build:development",
    "hmr": false
  }
}
```

⚠️ **`hmr` *"Defaults to the value of 'liveReload'"*** — it is not independently defaulted to `true`,
it inherits. One option, two behaviours: switch live reload off and HMR goes with it. The full
nineteen-option dev-server surface, `liveReload` included, is **06 · The dev-server contract**
*(not written yet)*.

## The flash of unstyled content is documented, and expected

> *"HELPFUL: With the development server, you may see a small Flash of Unstyled Content (FOUC) on
> startup as the server initializes. The development server attempts to defer processing of
> stylesheets until first use to improve rebuild times. This will not occur in builds outside the
> development server."*
> — [angular.dev · Hot module replacement](https://angular.dev/tools/cli/build-system-migration#hot-module-replacement)

It belongs on this page because it comes from the same design decision: the dev server treats
stylesheets as something to process lazily and replace cheaply, which buys rebuild speed and costs a
moment at startup. The last sentence is the one to remember before anyone files a bug —
*"this will not occur in builds outside the development server."*

## Gotchas

**★ Symptom: editing a component's `.ts` file full-reloads the page, while editing its template does
not.** Cause: *"general JavaScript-based hot module replacement (HMR) is currently not supported"* —
the one statement all three sources agree on. Templates and stylesheets have narrower, specific
support. Fix: expect it. If the full reload is losing state you need for the thing you are
debugging, take HMR out of the loop entirely so the behaviour is at least consistent:

```json
"serve": {
  "builder": "@angular/build:dev-server",
  "options": { "buildTarget": "my-app:build:development", "hmr": false }
}
```

**★ Symptom: component stylesheets do not hot-replace, even though the migration guide lists
"component stylesheet (inline and file-based)" as supported.** Cause: the sources disagree about the
scope — the `hmr` schema description mentions only stylesheets, the migration guide lists templates
as well, and `environment-options.ts` defaults component-style HMR **off** (`=== true`) while
defaulting template HMR **on** (`!== false`). Which reflects runtime behaviour at 22.1.7 was not
determined. Fix: stop reconciling documentation and make the loop deterministic — turn HMR off and
keep full live reload, which is one behaviour instead of an uncertain mixture:

```json
"serve": {
  "builder": "@angular/build:dev-server",
  "options": { "buildTarget": "my-app:build:development", "hmr": false, "liveReload": true }
}
```

**★ Symptom: a brief flash of unstyled content when the dev server starts, never in production.**
Cause: the dev server *"attempts to defer processing of stylesheets until first use to improve
rebuild times"*. Fix: none needed — it is documented, and the docs state *"this will not occur in
builds outside the development server."* If you want to confirm that for yourself before shipping,
serve a real build instead of trusting the note:

```bash
ng build --configuration production
```

**★ Symptom: HMR stopped working after live reload was turned off.** Cause: the `hmr` option
*"Defaults to the value of 'liveReload'"*, so `liveReload: false` disables HMR too unless `hmr` is
set explicitly. Fix: set both, so the intent lives in `angular.json` rather than in an inherited
default:

```json
"serve": {
  "builder": "@angular/build:dev-server",
  "options": { "buildTarget": "my-app:build:development", "liveReload": false, "hmr": true }
}
```

**Symptom: someone adds `NG_HMR_CSTYLES=1` to the team's `dev` script to "enable" component style
HMR.** Cause: treating an internal debugging switch as configuration. It is declared in
`packages/angular/build/src/utils/environment-options.ts`, appears in no schema and on no
documentation page, and carries no compatibility promise across patch releases. Fix: if the
behaviour matters, express it through the supported option and accept the documented uncertainty
about scope; if you must use the switch to investigate, keep it out of the committed script:

```json
{
  "scripts": {
    "start": "ng serve"
  }
}
```

**Symptom: a style change appears in the browser but a matching component-level behaviour change
does not, and you conclude HMR is broken.** Cause: partial replacement is the design — the reload
that would have picked up the logic change did not happen because a narrower HMR path handled the
stylesheet. Fix: when you have changed both logic and styles, force the reload rather than trusting
the partial path:

```bash
# hard-reload the browser tab, or restart the dev server for a clean state
ng serve
```

## Interview questions

**★ What forms of hot module replacement does Angular's dev server support?**
Three primary sources give three different answers, and the professional answer names that rather
than picking one. The migration guide lists global stylesheets, component stylesheets and component
templates, both inline and file-based, and says the capability is automatic. The `dev-server`
builder's own schema says of `hmr`: *"Currently, only global and component stylesheets are
supported"* — no templates, and *"only"* makes that exclusionary. And `environment-options.ts` has
`NG_HMR_TEMPLATES` defaulting to on (`!== false`) and `NG_HMR_CSTYLES` defaulting to off
(`=== true`), which is the opposite emphasis again. Which one reflects runtime behaviour at 22.1.7
I could not determine; the environment switches may gate an additional path rather than the primary
one. What all three agree on, and is therefore safe to state, is that **general JavaScript-based HMR
is not supported** — change a component's logic and you get a reload.

**★ Why do you see a flash of unstyled content in `ng serve` and never in production?**
Because the dev server defers stylesheet processing. angular.dev's own note says it *"attempts to
defer processing of stylesheets until first use to improve rebuild times"*, and that the flash
*"will not occur in builds outside the development server."* It is a deliberate exchange of a moment
of startup latency for rebuild speed — the right trade for a tool you restart occasionally and
rebuild constantly. Recognising it matters because it looks exactly like a real stylesheet-loading
bug, and teams have chased it as one, all the way to changing how they load CSS in production for a
problem that only ever existed in development.

**★ What does the `hmr` option default to, and why is that worth knowing?**
It *"Defaults to the value of 'liveReload'"*, per its schema description — so it inherits rather than
being independently `true`. The practical consequence is a coupling nobody expects: a team that sets
`liveReload: false` because they want to control reloading manually also loses hot module
replacement, and the configuration change that caused it does not mention HMR anywhere. If you
intend one and not the other, set both explicitly so the intent is visible in the file rather than
implied by a default two options away.

**★ Given the sources disagree, how would you actually determine what HMR does in your project?**
Empirically, in about a minute, and that is the right answer rather than a cop-out. Start the dev
server and make three edits in sequence — a global stylesheet, a component template, and a method on
a component class — watching each time whether the page performs a full reload or updates in place.
That tells you what your exact version does, which is what you needed; every source quoted here
describes *a* version and they cannot all describe 22.1.7. The reason to know the disagreement
anyway is that it tells you not to trust a single quote when someone insists the behaviour must be
different, and it tells you which question to ask upstream if the behaviour looks like a bug.

**Why is the absence of general JavaScript HMR a design fact rather than a missing feature?**
Because replacing arbitrary JavaScript modules at runtime requires the framework to know how to
re-create everything that module produced and re-wire everything that referenced it — component
instances, injected services, subscriptions, router state. Stylesheets are safe because swapping CSS
has no identity to preserve, and templates are tractable because a component's rendering can be
re-run against existing state. Logic is neither. Angular's position is stated plainly in the
migration guide — general JavaScript HMR *"is currently not supported"* — and the word *"currently"*
is the only forward-looking claim available; nothing names a version where that changes, and this
page does not guess one.

{/* FOOTER */}
