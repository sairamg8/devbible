---
title: "Four options describe the loop between saving a file and seeing the change, and one of them takes its default from another — turning off live reload silently turns off hot module replacement too"
sidebar_label: "06c · The rebuild loop"
sidebar_position: 6.2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** — option descriptions and defaults quoted from
> [`packages/angular/build/src/builders/dev-server/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/dev-server/schema.json)
> at tag `v22.1.7`, with the `watch`, `poll` and `verbose` defaults cross-checked against
> [`packages/angular/build/src/builders/application/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/application/schema.json)
> at the same tag, and against angular.dev —
> [tools/cli/build-system-migration](https://angular.dev/tools/cli/build-system-migration).
> 🔴 **One claim on this page is explicitly unresolved**: the exact scope of `hmr` at 22.1.7, where
> the schema and the migration guide disagree. Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**The dev server's four loop options are not independent, and the one that surprises people is the
one with no default of its own.** `hmr`'s schema says it *"Defaults to the value of 'liveReload'"* —
so a team that disables page reloading because it loses scroll position also disables hot module
replacement, and reports HMR as broken by an unrelated change. Underneath that, `watch` decides
whether anything rebuilds at all and `poll` decides how a change is noticed, and both are declared
separately on the `application` builder with *different defaults*, so a value set on the build
target never reaches the dev server.

## The loop nests, and the nesting is the point

| Option | Default | What it governs |
|---|---|---|
| `watch` | `true` | whether a change triggers a rebuild at all |
| `poll` | — | how a change is *noticed*: timer instead of filesystem notification |
| `liveReload` | `true` | whether the page reloads once the rebuild finishes |
| `hmr` | the value of `liveReload` | whether some changes are applied without a reload |

Read top to bottom, each one is only reachable if the one above it is on. `watch: false` makes the
other three irrelevant; `liveReload: false` makes `hmr` default to off. The fifth option that
changes how long a rebuild takes — `prebundle` — controls dependency processing rather than the
loop, and is covered with the rest of the surface in [06d](06d-the-three-that-fail-silently.md).

**`watch`** — *"Rebuild on change."* Default `true` on the dev server. 🔴 **The `application`
builder declares the same option with the default `false`**, which is why `ng build` produces one
artefact and stops while `ng serve` never does. The two builders are not sharing a setting; they are
each declaring their own with the default that suits them.

**`poll`** — *"Enable and define the file watching poll time period in milliseconds."* It replaces
change notification with a timer. It exists because change events do not always reach the process;
the schema does not enumerate the cases it is for. The cost is a fixed one: the tree is re-stat-ed
once per period whether anything changed or not, and the number you choose is also the worst-case
delay before a change is seen.

**`liveReload`** — *"Whether to reload the page on change, using live-reload."* This is the full
page reload after a rebuild finishes, not the rebuild itself. Turning it off does not stop rebuilds;
it stops you seeing them.

**`hmr`** — *"Enable hot module replacement. Defaults to the value of 'liveReload'. Currently, only
global and component stylesheets are supported."*

🔴 **That defaulting relationship is the trap.** There is no independent default. If you want "never
reload the page, but do hot-swap what you can", both keys must be written:

```json
"serve": {
  "builder": "@angular/build:dev-server",
  "options": {
    "liveReload": false,
    "hmr": true
  },
  "configurations": {
    "development": { "buildTarget": "my-app:build:development" }
  },
  "defaultConfiguration": "development"
}
```

## What `hmr` covers — an unresolved disagreement, stated as one

Three primary sources describe the scope of HMR at this version and they do not agree, so this page
does not pick a side.

The `hmr` option's own schema description at `v22.1.7` says *"Currently, only global and component
stylesheets are supported."* The build-system migration guide says something wider:

> *"While general JavaScript-based hot module replacement (HMR) is currently not supported, several
> more specific forms of HMR are available:*
> *- **global stylesheet** (`styles` build option)*
> *- **component stylesheet** (inline and file-based)*
> *- **component template** (inline and file-based)"*
> — [angular.dev/tools/cli/build-system-migration](https://angular.dev/tools/cli/build-system-migration)

The schema lists stylesheets only; the guide adds templates. **The precise scope at 22.1.7 was not
confirmed**, and there is a third source — the builder's environment-variable module, which gates
template and component-style hot reloading behind separate switches with opposite defaults — that
does not obviously agree with either. Those switches, and that third reading, belong to
[05 · Vite is only the dev server](05-vite-is-only-the-dev-server.md).

What every source does agree on is the sentence you can act on:

> *"general JavaScript-based hot module replacement (HMR) is currently not supported"*

So **editing a component's class body reloads the page**, and that is documented behaviour rather
than a broken setup. If a colleague says their component logic hot-swaps, they are either on a
different toolchain or watching a page reload and calling it HMR.

## Gotchas

**★ Symptom: HMR stopped working after someone set `liveReload: false`.** Cause: `hmr` has no
independent default — its schema says it *"Defaults to the value of 'liveReload'"*, so disabling one
disables both. Fix: write both keys rather than letting one be inferred:

```json
"serve": {
  "builder": "@angular/build:dev-server",
  "options": {
    "liveReload": false,
    "hmr": true
  }
}
```

**★ Symptom: editing a component's TypeScript class full-reloads the page, while editing its
template or styles does not.** Cause: *"general JavaScript-based hot module replacement (HMR) is
currently not supported"* — only the narrower forms are. Fix: nothing to fix; this is documented
behaviour. If the reload is destroying state you need while you work, suppress it deliberately and
accept stale code until you reload by hand:

```json
"serve": {
  "builder": "@angular/build:dev-server",
  "options": { "liveReload": false, "hmr": true }
}
```

**★ Symptom: `ng build` produces one build and exits, while `ng serve` on the same project rebuilds
forever.** Cause: `watch` is declared on both builders with different defaults — `true` on the dev
server, `false` on the `application` builder. Fix: ask the build for a watch loop explicitly when
you want one:

```bash
ng build --watch
```

**★ Symptom: `ng serve` never rebuilds on a mounted, shared or virtualised filesystem.** Cause:
change notifications are not reaching the process, so the watcher never fires. Rebuilds are not
slow — they never start. Fix: replace notification with polling, and accept the CPU cost of a
periodic re-stat:

```json
"serve": {
  "builder": "@angular/build:dev-server",
  "options": { "poll": 2000 }
}
```

**Symptom: you set `poll` on the `build` target and `ng serve` still does not notice changes.**
Cause: `poll` is declared independently on both schemas, exactly like `watch` and `define`; a value
on the build target does not reach the dev server. Fix: set it on the target the running command
executes:

```json
"serve": {
  "builder": "@angular/build:dev-server",
  "options": { "poll": 2000 }
}
```

**Symptom: with `poll` set to a large value, saves take that long to show up.** Cause: the poll
period is also the worst-case detection delay — nothing is watching between ticks. Fix: treat the
number as a latency budget, not a throttle, and lower it until the delay is tolerable rather than
raising it to reduce CPU.

**Symptom: the browser shows stale content but the terminal clearly rebuilt.** Cause: `liveReload`
is off, so nothing told the page. The rebuild happened; the delivery did not. Fix: re-enable it, or
reload by hand and know that you are choosing to:

```json
"serve": {
  "builder": "@angular/build:dev-server",
  "options": { "liveReload": true }
}
```

## Interview questions

**★ What does the `hmr` option default to, and what does it actually cover?**
It defaults to the value of `liveReload`, which is `true` — so hot module replacement is on unless
you turned live reload off, and turning live reload off silently turns HMR off with it. What it
covers is less settled than it looks: the option's own schema description at 22.1.7 says *"only
global and component stylesheets are supported"*, while the build-system migration guide also lists
component templates, and the builder's environment-variable module gates the two behind separate
switches. Those statements disagree, and which describes runtime behaviour at
this version. The part every source agrees on is that general JavaScript HMR is not supported, so a
change to a component class reloads the page.

**★ Someone reports that HMR broke and the only recent change was to live reload. What happened?**
Exactly what the schema says would happen. `hmr` declares no default of its own — it inherits
`liveReload`'s. A change from `"liveReload": true` to `false`, made to stop the page jumping on
every save, also switched off hot module replacement, and because nothing errors the two changes
look unrelated. The fix is to state both keys explicitly, which is a good habit for any option whose
default is defined as another option's value: once you override the parent, the inheritance is
invisible in the file.

**★ `watch` defaults to `true` on `ng serve` and `false` on `ng build`. Is that inconsistent?**
No — they are two separate declarations of the same option name on two separate builders, each with
the default that suits its job. A dev server that did not watch would be pointless; a build that
watched by default would never return control to a CI script. The lesson generalises past `watch`:
several option names appear on both schemas (`poll`, `verbose` and `define` among them), and in
every case they are independent declarations. A value set on one target is never inherited by the
other.

**★ When would you reach for `poll`, and what does it cost?**
When the rebuild loop is not broken but the *notification* is — the process is not receiving change
events, so nothing ever triggers a rebuild. That happens on filesystems where events do not cross a
boundary. Polling trades a fixed CPU cost per period for a guarantee that a change is noticed within
that period, and the period is also your worst-case latency, so a large value to save CPU directly
buys a slower feedback loop. Reaching for `poll` is worth treating as a signal as well as a fix: a
filesystem that does not deliver events will be affecting other tooling too.

**Why is `liveReload` a separate option from `watch` at all?**
Because they answer different questions and you sometimes want one without the other. `watch`
decides whether the builder does work when a file changes; `liveReload` decides whether the browser
is told about the result. Keeping them separate makes two useful states expressible: rebuild but do
not disturb the page (`watch: true`, `liveReload: false`), which is what you want when a reload
would destroy state you are inspecting; and serve a fixed build with no watcher at all
(`watch: false`), which is what you want when the watcher itself is the problem. Collapsing them
into one flag would remove both. The cost of the separation is the `hmr` inheritance described
above — the one place where the two options are not actually independent.

---

← Prev: [The serve-to-build coupling](06b-the-serve-to-build-coupling.md) · Index: [Topic index](README.md) · Next → [The three that fail silently](06d-the-three-that-fail-silently.md)
