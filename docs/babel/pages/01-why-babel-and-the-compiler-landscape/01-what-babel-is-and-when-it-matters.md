---
title: "Why Babel & the Compiler Landscape (2026)"
sidebar_label: "Why Babel & the Compiler Landscape (2026)"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-09-06 against the Babel documentation at babeljs.io for **Babel 8.0.1** — npm
> `latest` for `@babel/core`, read from `npm view @babel/core dist-tags` on 2026-09-06 —
> [Plugins](https://babeljs.io/docs/plugins),
> [Babel 8 breaking changes](https://babeljs.io/docs/v8-migration),
> [@babel/preset-react](https://babeljs.io/docs/babel-preset-react). Package descriptions and
> defaults marked *probed* come from the Babel 7.29.7 packages installed in this checkout.
> Documentation-validated, **no sandbox run**.
> Validated: 2026-09-06 · claims + output provenance · session 4e8d4393

# 📦 Why Babel & the Compiler Landscape (2026)

Covers syllabus **§1.1 What Babel Does**, **§1.2 Babel vs SWC vs esbuild vs tsc**, and **§1.3 Where Babel Still Matters**.

## 1. Concept & Under-the-Hood Mechanics

### 1.1 What Babel Does

Babel is a **source-to-source compiler** (transpiler), **not a bundler**. It:

1. **Parses** JS/TS/JSX into an AST (`@babel/parser`)  
2. **Transforms** the AST with plugins/presets (`@babel/traverse` visitors)  
3. **Generates** JS text + source maps (`@babel/generator`)

It does **not** resolve `node_modules`, split chunks, or tree-shake a graph—that is Webpack/Vite/Rollup/etc.

Two distinct jobs people conflate:

| Job | Mechanism | Example |
| --- | --- | --- |
| **Syntax support** | Parser plugins / syntax plugins | Understand optional chaining so the file parses |
| **Semantic transform** | Transform plugins | Rewrite optional chaining to older ES for old browsers |

A syntax plugin alone does **not** downlevel code. The other half of that rule is the one that
saves you listing both:

> *"Transform plugins will enable the corresponding syntax plugin so you don't have to specify
> both."* — [Plugins](https://babeljs.io/docs/plugins)

🔴 **Babel 8 went further and deleted most of them.** The migration guide's own words:
*"The following syntax plugins are no longer needed, you can safely remove them from your
configuration and dependencies"* ([Babel 8 breaking changes](https://babeljs.io/docs/v8-migration)).
The syntax-vs-transform distinction above is still the mental model — it is just that on Babel 8
the syntax half is built into the parser for anything that has shipped in the language.

### 1.2 Babel vs SWC vs esbuild vs tsc

| Tool | Role | Typical strength |
| --- | --- | --- |
| **Babel** | JS-based AST transforms | Plugin ecosystem, macros, custom codemods |
| **SWC** | Rust compiler (Next default path) | Speed; growing plugin story |
| **esbuild** | Go bundler/transformer (Vite dev/deps) | Extreme speed; fewer deep AST plugins |
| **tsc** | TypeScript checker/emitter | Types; not a full JSX/plugin ecosystem replacement for app transforms |

Frameworks moved off Babel primarily for **wall-clock compile cost**: JS visitor traversal does not match Rust/Go pipelines on large apps. `tsc` by default **type-checks**; using it as the only emit tool is a different architecture (e.g. `tsc` for types + bundler for JSX) than “Babel preset-typescript strips types.”

### 1.3 Where Babel Still Matters in 2026

- **Custom plugins / macros** — styled-components/Emotion codegen, `babel-plugin-macros` consumers  
- **Framework escape hatches** — Next.js can fall back to Babel when a custom `babel.config.js` is present (verify current Next docs for your major—SWC is default)  
- **Unusual browser/Node targets** needing granular preset-env control  
- **Codemods** — jscodeshift and many AST tools sit on Babel’s parser/traverse model  

If none of the above apply, Babel may be **dead weight**—see [migration recipes](../15-migration-and-decision-recipes/01-swc-esbuild-keep-or-audit.md).

---

## 2. Real-World Engineering Scenario

**Scenario: Next.js app still on Babel five years after SWC default.**

Someone added `babel-plugin-styled-components` in 2021 via `babel.config.js`. Every deploy compiles slower than peer apps on SWC. New hires assume “Next is just slow.” Fix: migrate to SWC styled-components compiler option (or Emotion SWC plugin), delete `babel.config.js`, measure build time before/after. Babel was not “required by React”—it was required by one plugin.

---

## 3. Production-Grade Code Example

```js
// babel.config.js — still justified when a macro/plugin has no SWC twin
module.exports = {
  presets: [
    ['@babel/preset-env', { targets: 'defaults' }],
    ['@babel/preset-react', { runtime: 'automatic' }],
    '@babel/preset-typescript',
  ],
  plugins: ['babel-plugin-macros'],
};
```

```bash
# Prove Babel is in the path (Webpack)
# Look for babel-loader in the bundler config; if absent, Babel may only run in Jest
```

---

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Calling Babel a bundler in design docs
Leads to wrong ownership of code-splitting and asset decisions.

### ⚠️ Enabling syntax plugins without transforms for legacy targets
Parses fine in modern Node CI, breaks in old browsers at runtime.

### ⚠️ Keeping Babel “because we always had it”
Measure; inventory plugins; delete when unused.

### ⚠️ Assuming tsc emit replaces preset-react/preset-env
Different feature sets—especially decorators, JSX runtimes, and polyfill strategies.

## Gotchas

**★ "We removed Babel" usually means "we removed one of the two places Babel runs."** The
bundler and the test runner are configured separately, so deleting `babel-loader` from the
webpack config leaves the test-runner transform untouched — and a repo can sit for years with a
fast production build and a Babel-shaped test pipeline nobody remembers configuring. Audit both
before you claim the dependency is gone: the bundler config, and whatever `transform` key your
test runner uses.

**★ A syntax plugin does not change one byte of output.** Symptom: the file parses in CI on
modern Node, then throws a `SyntaxError` in an old browser. Cause: you added
`@babel/plugin-syntax-*` when you needed `@babel/plugin-transform-*`. Fix: add the transform (or
let `preset-env` pick it from your targets) — *"Transform plugins will enable the corresponding
syntax plugin so you don't have to specify both."*

**★ On Babel 8 a config full of `@babel/plugin-syntax-*` entries is dead weight at best.** The
migration guide says they *"are no longer needed"* and to *"safely remove them from your
configuration and dependencies"*. They were the standard copy-paste answer on Stack Overflow for
years, which is exactly why they survive in configs long after the syntax landed in the parser.

**★ Babel 8 raised the Node floor, so a Babel upgrade can break the CI image before it breaks
the build.** *"All Babel 8 packages require Node.js `^22.18.0 || >=24.11.0`."* An older Node in a
Docker base image fails at install/resolve time, which reads as an unrelated infrastructure
failure rather than a compiler upgrade.

**★ Advice written for Babel 7 inverts on Babel 8 in at least one place you will copy.**
`@babel/preset-react`'s `runtime` option: probed as `runtime = "classic"` in the installed
`@babel/preset-react` 7.29.7, but the current docs state it *"defaults to `automatic`"*, and the
Babel 8 guide describes the change as *"Use the new JSX implementation by default"*. So "you must
set `runtime: 'automatic'`" is true, dated advice — harmless to keep writing, wrong as a
diagnosis. See [presets](../04-presets/01-env-react-typescript-and-framework.md).

**★ Whether your framework still *has* a Babel escape hatch is a framework question, and this
page does not answer it.** The Next.js bullet above is deliberately hedged: this validation pass
checked Babel's own documentation, not Next.js's, so treat "drop in a `babel.config.js` and Next
falls back" as **unconfirmed for your major**. Read your framework's current compiler page before
planning around it — the cost of being wrong is a build that silently leaves the fast path.

**★ "Keep Babel because we always had it" survives because nobody owns the question.** Fix is
procedural, not technical: list every plugin in the config, name the feature each one provides,
and delete the config the day the last one has a native or bundler equivalent. A plugin list is a
five-minute inventory; "is Babel needed?" is an unbounded argument.

**★ `tsc` emit and `preset-env` are not interchangeable, and the gap is polyfills.** `tsc`
downlevels *syntax* to its `target`; `preset-env`'s reason for existing is that it also decides
which `core-js` polyfills to inject for your browser matrix. Swapping one for the other therefore
changes what runs in old browsers, not just how the code is printed. Check the TypeScript
documentation for exactly what its `target` does and does not emit before treating them as
equivalent.

## Interview questions

**★ Is Babel a bundler? If not, what is it, and what does the bundler still have to do?**
Babel is a source-to-source compiler: it takes one file's source text, parses it to an AST,
transforms that AST with plugins, and prints JavaScript plus a source map. It has no module graph.
It does not resolve `node_modules`, split chunks, hash filenames or tree-shake — every one of those
needs a whole-program view that a per-file compiler does not have. That is why "we use Babel" and
"we use webpack/Vite/Rollup" are answers to different questions, and why a team can drop Babel
without touching bundling at all.

**★ What is the difference between a syntax plugin and a transform plugin, and when would you
ever need a bare syntax plugin?**
A syntax plugin only teaches the parser to accept a grammar — output is unchanged. A transform
plugin rewrites the AST, and it enables the matching syntax plugin for you. So the only reason to
reach for a bare syntax plugin is when you want Babel to *parse* something it will not *transform*:
a proposal whose transform does not exist yet, or a pipeline where a later tool consumes the AST
and you only need Babel to get through the file. On Babel 8 even that shrank, because the syntax
plugins for anything standardised were removed as unnecessary.

**★ Why did the big frameworks move to SWC and esbuild, and what did they give up?**
Wall-clock compile cost. A JavaScript visitor traversal over every file in a large app does not
compete with a Rust or Go pipeline, and compile time is felt on every save and every deploy. What
they gave up is the plugin ecosystem: macros, bespoke codemods, and the long tail of
`babel-plugin-*` packages that have no equivalent on the fast compilers. That trade is why the
honest answer to "should we keep Babel" is a plugin inventory rather than a benchmark.

**★ A team wants to delete Babel. How do you decide whether they can?**
List what Babel is actually doing for them, plugin by plugin. Is it syntax the target runtimes
already support? Then the bundler's own transform covers it. Is it JSX or type stripping? Every
fast compiler does both. Is it a macro, a CSS-in-JS codegen plugin, or a house codemod? That is
the case where Babel is load-bearing, and the migration is "find the SWC/esbuild equivalent or
keep Babel", not "delete the config". Then check both pipelines — bundler *and* tests — because
they are configured independently.

**★ `tsc` already compiles TypeScript. Why would a project run Babel over TS at all?**
Because they do different jobs. `@babel/preset-typescript` strips types per file and emits fast,
with no type checking at all; `tsc` type-checks a whole program. The common arrangement is both:
Babel (or a fast compiler) for emit in the build, `tsc --noEmit` for checking in CI. Using `tsc`
as the only emit tool is a legitimate but different architecture, and it does not give you
`preset-env`'s polyfill injection or `preset-react`'s JSX runtime options.

**★ What changed in Babel 8 that would catch out someone who last configured Babel in 2021?**
Four things, all of which change behaviour without changing your config: `@babel/preset-react`'s
`runtime` now defaults to `automatic` rather than `classic`; the standard `@babel/plugin-syntax-*`
packages were removed as no longer needed; `@babel/preset-env`'s default targets moved from
Babel 7's *"`targets: ">= 0%"` (all browsers)"* to *"`targets: "defaults"`"*, which changes the
output of a config that never set targets; and every package now requires Node
`^22.18.0 || >=24.11.0`.
