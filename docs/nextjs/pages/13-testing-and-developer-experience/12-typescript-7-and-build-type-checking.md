---
sidebar_position: 12
title: "next build already shells out to your project's tsc rather than loading the TypeScript compiler API, so adopting TypeScript 7 is a dependency bump — and the flag people reach for is an opt-out that breaks the build on TS 7"
sidebar_label: "12 · TypeScript 7 and build type checking"
description: "Why next build uses the project-local tsc CLI by default in 16.3, what you lose when it does, why experimental.useTypeScriptCli: false exits the build on TypeScript 7, and the wider file set the CLI checker covers."
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-03 against [`useTypeScriptCli`](https://nextjs.org/docs/app/api-reference/config/next-config-js/useTypeScriptCli), [TypeScript configuration](https://nextjs.org/docs/app/api-reference/config/typescript), the [Next.js 16.3 release blog](https://nextjs.org/blog/next-16-3) and the [version 16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16).
> Target: **Next.js 16.3.4** · project TypeScript floor **5.1.0** · TypeScript 7 released July 2026.

**TypeScript 7 is a native port of the compiler that Microsoft describes as ten times faster, and it does not ship the JavaScript compiler API that build tools have historically loaded in-process. Next.js dealt with that by inverting its own default: `next build` now runs your project-local `tsc` binary rather than loading the API, so adopting TypeScript 7 is a `package.json` change and nothing else. The two things that catch teams out are the direction of the config flag — `experimental.useTypeScriptCli` is an opt-*out*, and setting it to `false` on TypeScript 7 makes `next build` exit — and the fact that a CLI checker type-checks your whole `tsconfig` project, including test files that the old in-process checker never looked at.**

## The state of play in 16.3

By default, `next build` runs the project-local `tsc` command rather than loading the TypeScript JavaScript compiler API. The docs give both reasons for that choice in one sentence: it supports TypeScript 6, and it enables TypeScript 7 while that version's JavaScript API is unavailable.

Because the CLI is the default, the reference is explicit that no additional configuration is required to get it. The only configuration in this area moves you the other way — setting `experimental.useTypeScriptCli` to `false` is what asks Next.js to use the JavaScript compiler API instead.

Adoption is therefore one command:

```bash
pnpm add -D typescript@^7
```

```bash
npm install -D typescript@^7
```

The release blog frames the payoff in a single line: TypeScript 7, released the month before 16.3, is a 10x faster native port of TypeScript with much faster type checking.

That figure is Microsoft's for the compiler itself, not a Next.js benchmark of your build. What Next.js claims is narrower — that `next build` *can* use TypeScript 7 for type checking — and the share of your build that is type checking decides how much of the compiler's speedup you actually see.

## The floor did not move

Next.js 16's minimum is still TypeScript **5.1.0**. The upgrade guide's requirements table lists TypeScript 5+ with the minimum version now at `5.1.0`, and nothing in 16.3 changed that.

So TypeScript 7 is a per-project choice, not a framework requirement. The CLI checker is what makes both ends of that range work through one code path.

## What changes when the CLI does the checking

Four behaviours, from the reference, each with a practical consequence.

**Next.js still does its own preparation.** The reference is specific about what survives the switch: Next.js continues to generate `next-env.d.ts` and the route types, and to apply its recommended `tsconfig` settings, before it runs the checker at all.

So `PageProps`, `LayoutProps` and `RouteContext` are still generated before `tsc` runs; the CLI checker does not bypass typegen.

**Diagnostics come straight from `tsc`.** TypeScript's diagnostics are printed directly from the compiler, and the reference names what is dropped in the process: Next.js-specific code frames and error rewriting are not applied.

This is the real ergonomic cost. Errors about a page's props or a route handler's context arrive as plain TypeScript diagnostics rather than the framework-annotated messages that explained *why* a page's signature has to look a particular way.

**The checked file set is wider than it used to be.** What gets checked is the complete project selected by the configured `tsconfig` file — and the reference calls out two categories people do not expect: test files, and `.next/dev/types` where that is included.

A monorepo or an app whose `tsconfig.json` includes `**/*.ts` now type-checks its Playwright specs, its Jest helpers and its mocks as part of `next build`. Nothing is wrong with that — it is arguably what you wanted all along — but it can turn a previously-green build red on code the build never used to look at.

**`--debug-build-paths` no longer narrows it.** The reference says the option does not limit that file set, and that combining it with the CLI checker produces a warning.

## The two escape hatches, and what each one skips

`typescript.tsconfigPath` selects which project `tsc` is handed:

```ts title="next.config.ts"
import type { NextConfig } from 'next'

const isProd = process.env.NODE_ENV === 'production'

const nextConfig: NextConfig = {
  typescript: {
    tsconfigPath: isProd ? 'tsconfig.build.json' : 'tsconfig.json',
  },
}

export default nextConfig
```

```json title="tsconfig.build.json"
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "useUnknownInCatchVariables": false
  }
}
```

This is the honest tool for the "the build checks shared dependencies that do not meet our standards" problem, and for staged migrations to stricter settings: the editor stays strict via `tsconfig.json` while the production build uses the relaxed project.

`typescript.ignoreBuildErrors` skips type checking entirely, and the reference is careful to say that the CLI checker is included in what gets skipped:

```ts title="next.config.ts"
const nextConfig: NextConfig = {
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
}
```

The docs' own warning about that option is unusually direct: if you disable type checking, be sure you are running type checks somewhere else in your build or deploy process, because otherwise this can be very dangerous.

The narrower version of that advice is worth adopting regardless: run `tsc --noEmit` as its own CI step so type errors have a named, fast-failing job rather than hiding inside the build.

## Type generation is a build step, not a package

`next-env.d.ts` and the route-aware helpers are generated by `next dev`, `next build` or `next typegen`. A CI job that type-checks before any of those has run will fail on missing globals.

`next-env.d.ts` is also explicitly not yours to keep. The docs state that the file is managed by Next.js, that its contents are an implementation detail which may change over time, and that it should be added to `.gitignore`. If your project already tracks it, the instruction is to remove it from Git — and never to edit it by hand.

For the typed-routes and `typedEnv` side of this, see [03 · Type safety as testing](03-type-safety-as-testing-strict-ts-config-typed-routes-zod-con.md).

## Gotchas

**★ `experimental.useTypeScriptCli` is an opt-out, not the switch that turns TypeScript 7 on.**
The CLI checker is already the default in 16.3. Nothing needs enabling to use TypeScript 7 — you install it and `next build` picks up the project-local binary. Adding `useTypeScriptCli: true` to a config is harmless and misleading; the value that changes behaviour is `false`.

**★ `useTypeScriptCli: false` while on TypeScript 7 makes the build exit.**
The reference states the outcome without hedging: *"If you opt out while using TypeScript 7, `next build` exits because the TypeScript JavaScript compiler API is unavailable."* TypeScript 7 does not currently provide that API, so there is nothing for Next.js to load. The realistic path into this is a config that predates the upgrade, or someone opting out to get the friendlier Next.js error formatting back without noticing the dependency bump landed in the same release train.

**★ Turning on the CLI checker turns on type-checking for your test files.**
The checker covers the complete project selected by your `tsconfig`, including test files and `.next/dev/types` where included. If your specs were previously only checked by an editor or a separate `tsc` run with different settings, `next build` may now fail on them. That is a legitimate finding, but it arrives as a build failure in whatever pull request happens to be next, which is a bad moment to discover it. Run `tsc --noEmit` over the same project before you upgrade.

**★ You lose Next.js code frames and route-specific error rewriting.**
Diagnostics are printed straight from `tsc`. Errors on page props, layout props and route handler context no longer get the framework's explanatory rewriting, so a mis-typed `params` prop reads as a raw structural mismatch. Knowing the route-aware helpers exist — `PageProps<'/blog/[slug]'>` and friends — matters more once the error messages stop pointing at them.

**★ `--debug-build-paths` will not narrow the type check, and warns when you try.**
People reach for it precisely when a build is slow or failing broadly. It limits build paths, not the type-check file set, and combining it with the CLI checker produces a warning. Use `typescript.tsconfigPath` with a narrower project if you genuinely need a smaller check.

**★ `ignoreBuildErrors` disables the CLI checker too, and hides the problem completely.**
It is not "check but do not fail" — it skips the step, and the docs say the CLI checker is included in that. A repository that sets it and has no separate `tsc --noEmit` job has no type checking in CI at all, while still looking like it does because the build is green. If you set it, add the standalone check in the same commit.

**★ Only `tsconfig.json` is watched in development.**
The reference spells out the limit and the workaround together: in development only `tsconfig.json` is watched for changes, so if you point `typescript.tsconfigPath` at a differently-named file you have to restart the dev server for edits to it to apply. Editing `tsconfig.build.json` and seeing nothing change is not a caching bug.

**★ A fresh clone that runs `tsc` before `next typegen` fails on generated globals.**
`next-env.d.ts`, `PageProps`, `LayoutProps` and `RouteContext` are produced by `next dev`, `next build` or `next typegen`. Put `next typegen` immediately before the type-check step in CI. And do not commit `next-env.d.ts` — it is managed by Next.js, its contents are an implementation detail, and it should be gitignored.

**★ Treating "10× faster" as a prediction about your build time.**
The figure describes the native compiler port, not the end-to-end `next build`. Type checking is one stage among bundling, prerendering and output generation. In 16.3 the build also gained Turbopack filesystem caching for repeat builds, which is a different lever entirely — do not attribute one to the other when reading a CI timing chart.

## Interview questions

**★ What does `next build` do about type checking in Next.js 16.3, and why did that change?**
It runs the project-local `tsc` CLI rather than loading the TypeScript JavaScript compiler API. The reason is TypeScript 7: the native port does not currently expose that API, so a tool that wants to support both TypeScript 6 and 7 has to shell out to the binary. The effect is that adopting TypeScript 7 is purely a dependency bump.

**★ Which direction does `experimental.useTypeScriptCli` go, and what happens if you set it wrong on TypeScript 7?**
It is an opt-out. The CLI checker is the default; setting the flag to `false` makes Next.js use the JavaScript compiler API instead. On TypeScript 7 that API is unavailable, so `next build` exits. There is no configuration required to *use* TypeScript 7 — only a configuration that breaks it.

**★ What do you lose by having `tsc` do the checking?**
Next.js-specific code frames and error rewriting. Diagnostics are printed directly from the compiler, so errors about routes, pages, layouts and route handlers arrive as plain structural type errors rather than framework-annotated explanations. You also check a wider file set — the complete project selected by your `tsconfig`, test files included — and `--debug-build-paths` will not narrow it.

**★ Your build starts failing on a Playwright spec after upgrading. What is the most likely explanation?**
The CLI checker checks the complete project your `tsconfig` selects, which usually includes test files, whereas the previous in-process check did not. The errors were always there; nothing was looking. Either fix them, or point the build at a narrower project with `typescript.tsconfigPath` while keeping the editor on the strict `tsconfig.json`.

**★ When is `typescript.tsconfigPath` the right tool, and when is `ignoreBuildErrors`?**
`tsconfigPath` is right when a specific set of checks cannot pass for a structural reason — monorepo dependencies that assume `any` in catch clauses, or a staged migration to stricter options — because it relaxes exactly what you name while the editor stays strict. `ignoreBuildErrors` is right almost never: it skips the type-checking step entirely, CLI checker included, and only makes sense alongside a separate `tsc --noEmit` job that actually gates the deploy.

**★ Did the minimum supported TypeScript version change in 16?**
Yes, but not to 7. The floor is 5.1.0, raised as part of the 16.0 requirements alongside Node.js 20.9. TypeScript 7 is an optional per-project upgrade that the CLI checker makes possible; the framework still supports the whole range.

**★ CI type-checks a fresh clone and cannot find `PageProps`. What is missing?**
The type generation step. `next-env.d.ts` and the route-aware helpers are generated during `next dev`, `next build` or `next typegen`, so a job that runs `tsc` on a clean checkout has nothing to resolve them against. Run `next typegen` first. The same reasoning is why `next-env.d.ts` should be gitignored rather than committed — it is generated output that Next.js manages.

{/* FOOTER */}
