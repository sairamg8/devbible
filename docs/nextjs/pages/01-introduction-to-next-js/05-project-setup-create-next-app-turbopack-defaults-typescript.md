---
title: "The recommended defaults are not the same list as the customise prompts — React Compiler is offered in one and absent from the other — and in Next.js 16 `next build` stopped running your linter entirely"
sidebar_label: "05 · Project setup"
sidebar_position: 6
description: "create-next-app and every prompt it asks, Turbopack as the default bundler, the ESLint-or-Biome choice, the AGENTS.md scaffold, what next build stopped doing in 16, TypeScript 7 adoption, and the manual install for when you need to know what the CLI did."
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-04 for **Next.js 16.3.4** against the [installation docs](https://nextjs.org/docs/app/getting-started/installation) (page header `version: 16.3.4`, `lastUpdated` 2026-07-21) and the [16.3 release post](https://nextjs.org/blog/next-16-3) (`publishedAt` August 3rd 2026).
> Target: **Next.js 16.3.4**, App Router, Node >= 20.9, TypeScript >= 5.1.0. Documentation-verified; **no sandbox run**.
> Validated: 2026-09-05 · claims + version spine re-checked against the Next.js 16.3.4 docs · session d2e9b9fe

**Scaffolding is the part of a framework people skim, and it is where several of Next.js 16's behaviour changes are hiding. Two of them will cost you time if you learned this tooling on an earlier major: `next build` no longer runs your linter, so a CI pipeline that relied on the build to catch lint errors has silently stopped checking them, and the linter itself is now a choice between two tools rather than a given. This page is what the CLI actually does, prompt by prompt, and what each answer commits you to.**

## The fast path

```bash
npx create-next-app@latest my-app --yes
cd my-app
npm run dev
```

`--yes` *"skips prompts using saved preferences or defaults"*. The default setup enables **TypeScript, Tailwind CSS, ESLint, App Router, and Turbopack**, with import alias `@/*`, and includes **`AGENTS.md`** (with a `CLAUDE.md` that references it).

⚠️ **`--yes` uses *saved preferences* before defaults.** On a machine where you have previously customised a project, `--yes` reproduces those choices rather than the documented default list. If you are writing setup instructions for a team, do not assume `--yes` gives everyone the same project.

## Every prompt, and what it commits you to

The first prompt is a fork rather than a question:

```txt
What is your project named? my-app
Would you like to use the recommended Next.js defaults?
    Yes, use recommended defaults - TypeScript, ESLint, Tailwind CSS, App Router, AGENTS.md
    No, reuse previous settings
    No, customize settings - Choose your own preferences
```

Choose `customize settings` and you get the full list:

```txt
Would you like to use TypeScript? No / Yes
Which linter would you like to use? ESLint / Biome / None
Would you like to use React Compiler? No / Yes
Would you like to use Tailwind CSS? No / Yes
Would you like your code inside a `src/` directory? No / Yes
Would you like to use App Router? (recommended) No / Yes
Would you like to customize the import alias (`@/*` by default)? No / Yes
What import alias would you like configured? @/*
Would you like to include AGENTS.md to guide coding agents to write up-to-date Next.js code? No / Yes
```

🔴 **Compare the two lists carefully. `Would you like to use React Compiler?` appears in the customise prompts and is absent from the recommended-defaults line.** The recommended path leaves the React Compiler **off**. That is easy to miss and it matters, because the compiler is the feature that retires hand-written `useMemo` and `useCallback` — see [07 · Key framework shifts](07-key-framework-shifts-stable-react-compiler-support.md). If you want it, take the customise path or enable it later in config.

### The choices worth thinking about

| Prompt | Consider |
|---|---|
| **Linter: ESLint / Biome / None** | ESLint for rule coverage and ecosystem plugins; Biome for speed and formatting in one tool. Not a trivial swap later — the configs and rule sets do not map one-to-one |
| **`src/` directory** | Cosmetic, but it changes `baseUrl` and every path in `tsconfig.json`. Decide once; converting later touches every import |
| **Import alias `@/*`** | Keep the default unless you have a reason. It is what every tutorial, codemod and AI agent assumes |
| **AGENTS.md** | Yes, if anyone will use a coding agent here. It is how agents get version-matched docs rather than training data |
| **App Router** | Yes. This is the `(recommended)` one, and the Pages Router gets no new features |

## 🔴 `next build` no longer runs the linter

Stated plainly in the docs: *"Starting with Next.js 16, `next build` no longer runs the linter automatically."*

**This is a silent change in the dangerous direction.** Nothing errors. A CI pipeline whose only lint enforcement was `next build` still goes green, and lint violations accumulate from the day you upgrade with nobody noticing. Add the linter to CI explicitly:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "lint:fix": "eslint --fix"
  }
}
```

Or with Biome:

```json
{
  "scripts": {
    "lint": "biome check",
    "format": "biome format --write"
  }
}
```

Projects coming from the old `next lint` flow have a codemod:

```bash
npx @next/codemod@canary next-lint-to-eslint-cli .
```

If you use ESLint, create an explicit config — `eslint.config.mjs` is recommended. Both the legacy `.eslintrc.*` and the newer flat-config formats are supported.

## Turbopack is the default bundler

*"Turbopack is now the default bundler."* `next dev` starts the development server using it, and `next build` uses it too. The opt-out is per command:

```bash
next dev --webpack
next build --webpack
```

Two 16.3 improvements arrive with no configuration: **dev memory use dropped by up to 90%** (disk caching plus memory eviction, both now on by default) and **`next build` gained the disk cache**, with Vercel reporting up to 5.5× faster repeat builds on CI for some projects. ⚠️ Those are Vercel's figures on their own applications — treat them as evidence the feature is real, not as a prediction for your repo.

## TypeScript

The floor is **`v5.1.0`**. Next.js ships built-in support: rename a file to `.ts`/`.tsx`, run `next dev`, and it installs what it needs and writes a `tsconfig.json`.

**TypeScript 7** — *"a 10x faster native port"* — can do the type checking during `next build`. Adoption is just a dependency bump:

```bash
pnpm add -D typescript@^7
```

⚠️ **`experimental.useTypeScriptCli` is not the switch that turns TS 7 on.** The name invites the opposite reading, and the reference contradicts it in three sentences: *"By default, `next build` runs the project-local `tsc` command instead of loading the TypeScript JavaScript compiler API. This supports TypeScript 6 and enables TypeScript 7 while its JavaScript API is unavailable."* · *"The CLI checker is enabled by default. To use the TypeScript JavaScript compiler API instead, set `experimental.useTypeScriptCli` to `false`."* · *"If you opt out while using TypeScript 7, `next build` exits because the TypeScript JavaScript compiler API is unavailable."* So adopting TS 7 is installing it; the flag is an **opt-out**, and setting it to `false` is what breaks the build.

There is also a custom TypeScript plugin. In VS Code: command palette → *TypeScript: Select TypeScript Version* → *Use Workspace Version*.

## Absolute imports

Built-in support for `paths` and `baseUrl`:

```json
{
  "compilerOptions": {
    "baseUrl": "src/",
    "paths": {
      "@/styles/*": ["styles/*"],
      "@/components/*": ["components/*"]
    }
  }
}
```

Each entry in `paths` is relative to `baseUrl`, which is the detail people get wrong when converting an existing project.

## A setup step that is not optional in practice

The App Router names files by convention, so an editor fills with tabs all called `page.tsx`. The docs recommend custom labels, and for VS Code 1.88+ or Cursor:

```json
{
  "workbench.editor.customLabels.patterns": {
    "**/app/**/page.tsx": "${dirname(1)}/${dirname} - page.tsx",
    "**/app/**/layout.tsx": "${dirname(1)}/${dirname} - layout.tsx",
    "**/app/**/route.ts": "${dirname(1)}/${dirname} - route.ts"
  }
}
```

Labelling **two folders deep** is deliberate: with one level, every dynamic route collapses to the same `[id]` label. JetBrains IDEs do this automatically.

## The manual install, and why it is worth reading

Knowing what the CLI did makes debugging a broken project far easier:

```bash
npm i next@latest react@latest react-dom@latest
```

Then `app/layout.tsx` and `app/page.tsx` — see [06 · Hello World](06-hello-world-with-the-app-directory.md). Optionally a `public/` folder for static assets, referenced from the base URL (`public/profile.png` → `/profile.png`).

🔴 **The React dependency is not what it appears to be.** *"The `App Router` uses React canary releases built-in, which include all the stable React 19 changes … but you should still declare react and react-dom in package.json for tooling and ecosystem compatibility."* You install React, and on the App Router you are not choosing its version.

## Keeping the project current

```bash
npx next upgrade
```

Beyond the dependency, this updates the docs bundled at `node_modules/next/dist/docs/`. Combined with the `AGENTS.md` block `next dev` maintains, that is how coding agents read documentation matching your installed version — the mechanism that replaced Vercel's earlier documentation Skills.

## Gotchas

**★ Symptom: lint errors stop appearing in CI after upgrading to 16, and nobody changed the lint config.** Cause: `next build` no longer runs the linter automatically. The build still passes, so nothing signals the loss. Fix: add an explicit `lint` script and a CI step. Audit this the day you upgrade — violations accumulate invisibly from that commit onward.

**★ Symptom: two developers run `create-next-app --yes` and get different projects.** Cause: `--yes` uses *saved preferences* before falling back to defaults, so a machine with previous customisations reproduces those. Fix: never document `--yes` as producing a specific setup for a team; pass explicit flags or check the generated config into the instructions.

**★ Symptom: you took the recommended defaults expecting the React Compiler and it is not enabled.** Cause: `Would you like to use React Compiler?` exists only in the customise prompts; the recommended-defaults line is TypeScript, ESLint, Tailwind, App Router and AGENTS.md. Fix: take the customise path, or set `reactCompiler: true` in config afterwards.

**★ Symptom: `next build` exits complaining about TypeScript 7.** Cause: `experimental.useTypeScriptCli` set to `false`. The flag is an opt-**out**; the name reads like an opt-in, which is exactly how it gets set wrongly. Fix: remove the flag. Adopting TS 7 is installing `typescript@^7` — there is no switch to turn on.

**★ Symptom: every editor tab says `page.tsx` and you keep editing the wrong file.** Cause: file-convention routing plus default editor labels. Fix: the custom-labels config above, labelled two folders deep — one level leaves every dynamic route showing `[id]`. Not cosmetic; it is a real source of wrong-file edits in a large App Router codebase.

**★ Symptom: switching from ESLint to Biome mid-project turns into a week.** Cause: treating the prompt as a reversible preference. The two have different rule sets, config formats and plugin ecosystems, and they do not map one-to-one. Fix: decide at scaffold time based on whether you need ESLint's plugin coverage or Biome's speed-and-formatting combination.

**★ Symptom: absolute imports resolve in the editor and fail at build.** Cause: `paths` entries are relative to `baseUrl`, and a converted project often has one set and not the other, or `src/` added later without updating `baseUrl`. Fix: set both together and remember the `src/` prompt is not cosmetic — it changes every path in `tsconfig.json`.

**Symptom: you pin `react` to fix a rendering bug and nothing changes on App Router routes.** Cause: the App Router bundles React canary; your declaration exists for tooling and ecosystem compatibility. Fix: track the Next.js version instead. On the Pages Router the pin does work, so a mixed codebase answers this two ways.

**Symptom: an AI agent writes code against APIs your version does not have.** Cause: no `AGENTS.md`, or a stale install, so the agent is working from training data rather than the bundled version-matched docs. Fix: include `AGENTS.md` at scaffold time and run `next upgrade` — the docs travel inside the package, so they are only current if the package is.

**Symptom: dev server memory use is far lower than a colleague's on the same app.** Cause: 16.3 enabled Turbopack disk caching and memory eviction by default, with reported reductions up to 90%. Fix: not a bug — check whether the other machine is on an older minor, or opting out with `--webpack`.

## Interview questions

**★ What changed about linting in Next.js 16, and why is it dangerous?**
`next build` no longer runs the linter automatically. It is dangerous because it fails silently in the permissive direction: a CI pipeline whose only lint enforcement was the build keeps going green while violations accumulate from the upgrade commit onward. Nothing errors and no test fails, so the loss is invisible until someone notices the codebase drifted. The fix is an explicit `lint` script plus a CI step, and there is a codemod — `npx @next/codemod@canary next-lint-to-eslint-cli .` — for projects coming off the old `next lint` flow.

**★ Does taking the recommended defaults give you the React Compiler?**
No, and this is a genuine trap. The recommended-defaults line is TypeScript, ESLint, Tailwind CSS, App Router and AGENTS.md. `Would you like to use React Compiler?` appears only in the customise prompt list. So the path most people take leaves the compiler off — which matters, because that is the feature that removes the need for hand-written `useMemo` and `useCallback`. You either take the customise path or set `reactCompiler: true` in config later.

**★ How do you adopt TypeScript 7 for type checking, and what is `experimental.useTypeScriptCli`?**
You install it: `pnpm add -D typescript@^7`. `next build` already runs your project-local `tsc`, so bumping the dependency is the whole adoption — the release describes TS 7 as a 10× faster native port. The flag is the trap: `useTypeScriptCli` reads like the switch that enables this, and it is actually an opt-**out**. Setting it to `false` makes the build exit on TS 7. The floor for TypeScript generally is 5.1.0.

**Why is the `src/` directory prompt not a cosmetic choice?**
Because it changes `baseUrl` and therefore every entry in `tsconfig.json` `paths`, which are resolved relative to `baseUrl`. Converting later means touching import configuration across the project, and the failure mode is confusing — absolute imports resolve in the editor, which reads `tsconfig.json` one way, and fail at build. It is the kind of decision that is free at scaffold time and expensive in month six.

**What does `--yes` actually do, and why shouldn't you put it in team setup instructions?**
It skips the prompts *using saved preferences or defaults* — saved preferences first. So on a machine where someone previously customised a project, `--yes` reproduces those choices rather than the documented default list, and two developers following the same instruction get different projects. For team documentation, pass explicit flags or commit the generated configuration, rather than relying on a command whose output depends on local state.

**What is `AGENTS.md` for and how does it stay accurate?**
It points coding agents at documentation matching the installed version rather than their training data. The mechanism is that `next upgrade` updates docs bundled inside the package at `node_modules/next/dist/docs/`, and `next dev` maintains an `AGENTS.md` block pointing at them. That is why Vercel retired its earlier documentation Skills — the docs now travel with the install. The catch is that it is only as current as the package, so a project that never upgrades gives agents confidently stale guidance about its own codebase.

**You install `react` and `react-dom` — do you control the React version?**
On the App Router, effectively no. It uses React canary releases built-in, including all stable React 19 changes plus features being validated in frameworks, and the docs are explicit that you declare the packages for tooling and ecosystem compatibility rather than version selection. The Next.js version is what moves React underneath you. The Pages Router does use the version from `package.json`, so in a codebase mid-migration the same dependency governs one half and not the other.

---

← Prev [04 · Versioning and the LTS model](04-versioning-and-lts-model-what-stable-canary-and-preview-mean.md) · [Index](01-explanation.md) · Next → [06 · Hello World with the app directory](06-hello-world-with-the-app-directory.md)
