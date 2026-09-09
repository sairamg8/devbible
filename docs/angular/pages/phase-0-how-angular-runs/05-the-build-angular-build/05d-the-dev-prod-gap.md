---
title: "Once you accept that `ng serve` and `ng build` run the same builder, \"works in serve, breaks in build\" stops being mysterious and becomes a three-line list of option differences"
sidebar_label: "05d · The dev/prod gap"
sidebar_position: 5.3
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-09 against **Angular CLI 22.1.7** — angular.dev,
> [Angular CLI builds](https://angular.dev/tools/cli/build-system-migration) (§ *Vite as a
> development server*, source `adev/src/content/tools/cli/build-system-migration.md` at tag
> `v22.1.5`); the source of
> [`src/builders/dev-server/builder.ts`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/dev-server/builder.ts)
> and [`src/builders/dev-server/schema.json`](https://github.com/angular/angular-cli/blob/v22.1.7/packages/angular/build/src/builders/dev-server/schema.json)
> at tag `v22.1.7`; and the `dependencies` of the published manifest at
> [registry.npmjs.org/@angular/build/22.1.7](https://registry.npmjs.org/@angular/build/22.1.7).
> Documentation- and source-validated; **no sandbox run** — no dev server was started and no
> output is reproduced here.
> Version spine: **Angular 22.1.5** (`latest`) · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**The dev/prod gap is not a difference of build systems; it is a difference of options on one build
system.** That reframing is worth more than any individual fact on this page, because it turns an
open-ended "why does production behave differently" into reading a configuration object that is
three lines long in a generated project. The claim it rests on — that Vite serves output the same
builder produced — is [05 · Vite is only the dev server](05-vite-is-only-the-dev-server.md).

## What this means for the dev/prod gap

Once you accept that both sides run the same builder, "works in `ng serve`, breaks in `ng build`"
stops being mysterious and becomes a list of *option* differences. The generated `development`
configuration is short, and every line of it matters:

```json
"development": {
  "optimization": false,
  "extractLicenses": false,
  "sourceMap": true
}
```

`optimization: false` alone accounts for most of the gap. It turns off minification and mangling,
and — less obviously — it disables the Rolldown chunk optimizer entirely, because that pass is gated
on `optimization.scripts`; see
[04b · What the second pass is worth](04b-what-the-second-pass-is-worth.md). So the chunk graph you
inspect in development was produced by esbuild alone, while the one you deploy was produced by
esbuild and then re-bundled.

🔴 **The useful reframing: `ng serve` is not a preview of production, it is a different
configuration of the same build.** To reduce the gap, build the configuration you ship and serve the
result with any static server, rather than expecting the dev server to behave like one:

```bash
ng build --configuration production
```

## Gotchas

**★ Symptom: you look in `dist/` while `ng serve` is running and find stale files, or none.** Cause:
the dev server *"generate[s] a development build of the application in memory"* — nothing is written
to the output directory. Whatever is in `dist/` is left over from the last real build. Fix: to
inspect what is being served, use the browser's network panel; to inspect files, run a build:

```bash
ng build --configuration development
```

**★ Symptom: a bundle-size or chunk-count observation from `ng serve` does not match production at
all.** Cause: the development configuration sets `optimization: false`, which disables minification
*and* the Rolldown chunk optimizer, so both the contents and the boundaries of every chunk differ.
Fix: never size anything from the dev server; build what you ship:

```bash
ng build --configuration production
```

**★ Symptom: something that worked all week in `ng serve` fails the moment it is built for
production.** Cause: almost always `optimization: false` in the generated `development`
configuration — minification, mangling and the Rolldown chunk pass are all off while you develop and
all on when you ship. Fix: build the configuration you actually deploy before you believe a feature
is finished:

```bash
ng build --configuration production
```

**★ Symptom: a team adds `optimization: true` to the `development` configuration to close the gap,
and the dev server becomes unusably slow.** Cause: optimization is off in development for a reason —
it is the expensive part. Fix: leave the configuration alone and close the gap by *building* rather
than by making development production-like; a production build served statically costs one command
and no daily slowdown.

## Interview questions

**Why is "it works in `ng serve`" weak evidence that something works?**
Because the dev server builds a *different configuration* of the same application. The generated
`development` configuration sets `optimization: false`, `extractLicenses: false` and
`sourceMap: true`; the first of those disables minification and mangling and also skips the Rolldown
chunk optimization pass, which is gated on `optimization.scripts`. So code that survives development
may break under mangling, and a chunk layout observed in development is not the one you ship. The
useful mental model is that `ng serve` and `ng build` are the same builder with different options,
which turns "why is production different" into a diff of two configuration objects rather than a
comparison of two tools.

**★ What single option accounts for most of the dev/prod difference, and what does it switch off?**
`optimization`, which the generated `development` configuration sets to `false`. It disables
minification and mangling, and — less obviously — the Rolldown chunk optimizer, because that second
pass is gated on `optimization.scripts`. So the chunk graph you inspect during development was
produced by esbuild alone, while the one you deploy was produced by esbuild and then re-bundled.
That is why chunk counts and bundle sizes observed from `ng serve` do not transfer, and why the only
reliable way to check either is to build the configuration you ship.

---

← Prev: [What HMR actually replaces](05c-what-hmr-actually-replaces.md) · Index: [Topic index](README.md) · Next → [The dev-server contract](06-the-dev-server-contract.md)
