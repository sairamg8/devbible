---
title: "Link map · ESLint and Oxlint · Part 1 (all sections)"
sidebar_label: "01 · eslint and oxlint"
sidebar_position: 1
---

# Link map · ESLint and Oxlint · Part 1 (all sections)

Covers all 21 sections of `docs/eslint-oxlint/pages/`. Each section is one page of ours (one chunk file), so each block below maps to that page. Four pages cover two or three distinct sub-topics (their H3 headings, such as 7.1 and 7.2) and get blocks `a` and `b`. This track has no syllabus directory, so the topic list comes from the page tree. Section numbers come from the directory names.
*read* = I read the passage that supports the claim in the fetched text; *headings only* = fetched at 200 and only the headings or opening were checked. Third-party links carry the date the page shows. No `#anchors` are given. Where no good non-official explanation turned up after searching, the block has no "Beyond the docs" line.

🔴 **Version note.** ESLint's docs switcher on 2026-10-14 lists v10.12.0 as latest. ESLint v10 removed the legacy `.eslintrc` format and needs Node 20.19+, 22.13+ or 24+. Official ESLint links below use `/docs/latest/`, so they describe v10 and flat config only. Pages that explain the legacy format (section 02, part of 19) have to be read against `/docs/v8.x/`. The migration guide still covers the move. Oxlint links point at oxc.rs, which now lists type-aware linting as stable (tsgolint v7, July 2026) and JS plugins as alpha. Only our page 01 carries a `> Verified:` line (2026-09-08, against the Oxlint docs). The other pages carry none, so their version stamps could not be compared.

---

## Section 01 — Linting landscape and tooling decisions

### T01-01 · Why lint, choosing tools, format boundaries — Topic · ✅ written `docs/eslint-oxlint/pages/01-linting-landscape-and-tooling-decisions/01-why-choose-and-boundaries.md`
- **Read this:** [Oxlint overview](https://oxc.rs/docs/guide/usage/linter.html) · oxc.rs · has a "Choosing a JavaScript linter" section, 870+ built-in rules, and the project's own 50 to 100 times speed claim (*read*) · covers our angle: **partial** — vendor view, so it does not weigh Biome or Prettier fairly · fetched 2026-10-14
- **Also good:** [Integrating with Linters](https://prettier.io/docs/integrating-with-linters) · Prettier docs · why to turn off conflicting rules with `eslint-config-prettier` and not run Prettier inside ESLint (*read*) · fetched 2026-10-14
- **Also good:** [Biome linter](https://biomejs.dev/linter/) · Biome docs · 568 rules across languages, one tool for both lint and format (*headings only*) · fetched 2026-10-14
- **Our delta:** the decision table (when ESLint, when Oxlint, when both) and the format boundary as a policy.

---

## Section 02 — ESLint core architecture

### T02-01 · Pipeline and legacy config — Topic · ✅ written `docs/eslint-oxlint/pages/02-eslint-core-architecture/01-pipeline-and-legacy-config.md`
- **Read this:** [Core Concepts](https://eslint.org/docs/latest/use/core-concepts/) · ESLint docs · short definitions of rule, parser (Espree by default), processor and formatter, plus rule fixes versus suggestions (*read*) · covers our angle: **partial** — names the stages, does not trace them; says nothing on legacy config · fetched 2026-10-14
- **Also good:** [Custom Processors](https://eslint.org/docs/latest/extend/custom-processors) · ESLint docs · `preprocess` splits a file into blocks, `postprocess` maps messages back (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Flat config rationale, part 2](https://eslint.org/blog/2022/08/new-config-system-part-2/) · Nicholas C. Zakas, ESLint blog, 2022-08-05 (updated 2024-08-12) · why the directory cascade of eslintrc was dropped, in the author's words (*read*) · fetched 2026-10-14
- **Our delta:** the lint pipeline end to end and the legacy cascade as a reading guide, which v10 docs no longer describe.

---

## Section 03 — ESLint flat config

### T03-01 · Forms, fields and composition — Topic · ✅ written `docs/eslint-oxlint/pages/03-eslint-flat-config/01-forms-fields-and-composition.md`
- **Read this:** [Configuration Files](https://eslint.org/docs/latest/use/configure/configuration-files) · ESLint docs · configuration objects merge with later ones overriding earlier ones; `files` and `ignores` resolve relative to the config file; covers `extends` and TypeScript config files (*read*) · covers our angle: **full** for the fields; the extends versus cascading section is the composition part · fetched 2026-10-14
- **Also good:** [Configure Plugins](https://eslint.org/docs/latest/use/configure/plugins) · ESLint docs · the `plugins` key maps a namespace to a plugin object; local and virtual plugins (*read*) · fetched 2026-10-14
- **Beyond the docs:** [New config system, part 2](https://eslint.org/blog/2022/08/new-config-system-part-2/) · Nicholas C. Zakas, ESLint blog, 2022-08-05 · "Glob-based configs everywhere" and "Goodbye extends, hello flat cascade" explain the shape (*read*) · fetched 2026-10-14
- **Our delta:** the three config forms side by side and when each wins.

---

## Section 04 — Language options, globals and parsing

### T04-01 · Language options and file targeting — Topic · ✅ written `docs/eslint-oxlint/pages/04-eslint-language-options-globals-and-parsing/01-language-options-and-file-targeting.md`
- **Read this:** [Language Options](https://eslint.org/docs/latest/use/configure/language-options) · ESLint docs · no globals by default; `ecmaVersion` defaults to latest and `sourceType` to module; globals via comments or config (*read*) · covers our angle: **partial** — language options only, not the file-glob side · fetched 2026-10-14
- **Also good:** [Configuration Files](https://eslint.org/docs/latest/use/configure/configuration-files) · ESLint docs · "Specify `files` and `ignores`" section, with the advice to pair `ignores` with `files` (*read*) · fetched 2026-10-14
- **Our delta:** parser and globals choices per file type in one worked example.

---

## Section 05 — ESLint rules system

### T05-01 · Severity, core rules and presets — Topic · ✅ written `docs/eslint-oxlint/pages/05-eslint-rules-system/01-severity-core-rules-and-presets.md`
- **Read this:** [Configure Rules](https://eslint.org/docs/latest/use/configure/rules) · ESLint docs · off, warn (exit code unchanged), error (non-zero exit); inline config comments beat config files; rules from plugins (*read*) · covers our angle: **partial** — severities yes, preset choice no · fetched 2026-10-14
- **Also good:** [Migrate to v10.0.0](https://eslint.org/docs/latest/use/migrate-to-10.0.0) · ESLint docs · `eslint:recommended` changed in v10 (*headings only*) · fetched 2026-10-14
- **Our delta:** which preset to start from and what a severity ladder looks like in CI.

---

## Section 06 — ESLint plugin ecosystem

### T06-01 · Plugins: frontend, Node, security and pitfalls — Topic · ✅ written `docs/eslint-oxlint/pages/06-eslint-plugin-ecosystem/01-plugins-frontend-node-and-pitfalls.md`
- **Read this:** [eslint-plugin-react-hooks](https://react.dev/reference/eslint-plugin-react-hooks) · react.dev · the plugin catches Rules of React violations; its `recommended` preset enables 19 rules (*read*) · covers our angle: **partial** — React only; no Node, import or security plugin · fetched 2026-10-14
- **Also good:** [Configure Plugins](https://eslint.org/docs/latest/use/configure/plugins) · ESLint docs · "Common Problems": plugin rules on the pre-9 API, plugin configs not yet flat (*read*) · fetched 2026-10-14
- **Our delta:** plugin picks for Node and security (`eslint-plugin-n`, `eslint-plugin-security`) and the pitfalls list. No official page was fetched for those two, so the page's claims about them still need checking against each plugin's README.

---

## Section 07 — typescript-eslint

### T07-01a · Architecture: parser and shared configs — Topic · ✅ written `docs/eslint-oxlint/pages/07-typescript-eslint/01-architecture-type-aware-and-stacks.md`
- **Read this:** [@typescript-eslint/parser](https://typescript-eslint.io/packages/parser) · typescript-eslint.io · turns TypeScript into nodes ESLint understands and can supply a TS program; `projectService` picks the nearest tsconfig (*read*) · covers our angle: **full** for 7.1 · fetched 2026-10-14
- **Also good:** [typescript-eslint package](https://typescript-eslint.io/packages/typescript-eslint) · typescript-eslint.io · `configs`, `extensions`, `globs`; `config(...)` is deprecated in favour of ESLint's `defineConfig(...)` (*read*) · fetched 2026-10-14
- **Our delta:** the TS + React + Next stack in 7.3. Check our use of `tseslint.config` against the deprecation above.

### T07-01b · Type-aware linting — Topic · ✅ written `docs/eslint-oxlint/pages/07-typescript-eslint/01-architecture-type-aware-and-stacks.md`
- **Read this:** [Linting with Type Information](https://typescript-eslint.io/getting-started/typed-linting) · typescript-eslint.io · `parserOptions.projectService: true`; typed linting makes TypeScript analyse the whole project first, so it is slower (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Performance](https://typescript-eslint.io/troubleshooting/typed-linting/performance) · typescript-eslint.io · narrow `tsconfig` includes and simple types matter most; slow third-party rules listed (*read*) · fetched 2026-10-14
- **Also good:** [Project Service](https://typescript-eslint.io/blog/project-service) · Josh Goldberg, typescript-eslint blog, 2025-05-29 · why the project service replaces `parserOptions.project` (*read*) · fetched 2026-10-14
- **Our delta:** the gotcha list around `no-floating-promises`, duplicate installs and `.next` ignores.

---

## Section 08 — ESLint CLI, output, cache and fixes

### T08-01 · CLI and programmatic usage — Topic · ✅ written `docs/eslint-oxlint/pages/08-eslint-cli-output-cache-and-fixes/01-cli-and-programmatic-usage.md`
- **Read this:** [Command Line Interface](https://eslint.org/docs/latest/use/command-line-interface) · ESLint docs · `--cache`, `--fix`, `--max-warnings`, `--format`, exit codes (*read*) · covers our angle: **full** for the CLI half · fetched 2026-10-14
- **Also good:** [Node.js API](https://eslint.org/docs/latest/integrate/nodejs-api) · ESLint docs · `lintFiles`, `lintText`, `loadFormatter`, `outputFixes` (*read*) · fetched 2026-10-14
- **Also good:** [Formatters Reference](https://eslint.org/docs/latest/use/formatters/) · ESLint docs · built-ins are `stylish` (default), `json`, `json-with-metadata`, `html` (*read*) · fetched 2026-10-14
- **Also good:** [Integration tutorial](https://eslint.org/docs/latest/integrate/integration-tutorial) · ESLint docs · a small Node project that lints, fixes and prints results (*headings only*) · fetched 2026-10-14
- **Our delta:** a cache-and-fix recipe for CI with the exit-code policy.

---

## Section 09 — Suppressions, ignores and governance

### T09-01 · Disables, ignores and governance — Topic · ✅ written `docs/eslint-oxlint/pages/09-eslint-suppressions-ignores-and-governance/01-disables-ignores-and-governance.md`
- **Read this:** [Ignore Files](https://eslint.org/docs/latest/use/configure/ignore) · ESLint docs · `globalIgnores()` skips directories; `ignores` inside a config only matches files; unignoring; `.gitignore` inclusion (*read*) · covers our angle: **partial** — ignores only · fetched 2026-10-14
- **Also good:** [Bulk Suppressions](https://eslint.org/docs/latest/use/suppressions) · ESLint docs · `eslint-suppressions.json` at the project root, committed to the repo (*read*) · fetched 2026-10-14
- **Also good:** [Introducing bulk suppressions](https://eslint.org/blog/2025/04/introducing-bulk-suppressions/) · Iacovos Constantinou, ESLint blog, 2025-04-04 · enforce a rule as error for new code and fix the backlog over time (*headings only*) · fetched 2026-10-14
- **Also good:** [Configure Rules](https://eslint.org/docs/latest/use/configure/rules) · ESLint docs · disabling rules with comments, and reporting unused disable comments (*read*) · fetched 2026-10-14
- **Our delta:** a governance policy (who may disable, what must carry a reason).

---

## Section 10 — Custom ESLint rules and processors

### T10-01 · Authoring, testing and processors — Topic · ✅ written `docs/eslint-oxlint/pages/10-custom-eslint-rules-and-processors/01-authoring-testing-and-processors.md`
- **Read this:** [Custom Rules](https://eslint.org/docs/latest/extend/custom-rules) · ESLint docs · a rule exports `meta` and `create(context)` returning node visitors; covers options schemas, scopes, code paths, `RuleTester` and profiling (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Custom Rule Tutorial](https://eslint.org/docs/latest/extend/custom-rule-tutorial) · ESLint docs · build, test with `RuleTester`, bundle in a plugin, publish (*read*) · fetched 2026-10-14
- **Also good:** [Custom Processors](https://eslint.org/docs/latest/extend/custom-processors) · ESLint docs · `preprocess` and `postprocess`, plugin and processor `meta` (*read*) · fetched 2026-10-14
- **Beyond the docs:** [How I built my first custom ESLint rule](https://blog.maximeheckel.com/posts/how-to-build-first-eslint-rule/) · Maxime Heckel, 2019-11-19 · gentle walkthrough of the AST, `meta`, `create` and testing; written before flat config, so its plugin setup is dated (*read*) · fetched 2026-10-14
- **Our delta:** testing and processor pitfalls in one worked rule.

---

## Section 11 — ESLint editor and local workflow

### T11-01 · IDE integration, git hooks and scripts — Topic · ✅ written `docs/eslint-oxlint/pages/11-eslint-editor-and-local-workflow/01-ide-hooks-and-scripts.md`
- **Read this:** [Integrations](https://eslint.org/docs/latest/use/integrations) · ESLint docs · a list of editor plugins (VS Code, JetBrains, Vim and more) and pre-commit hook tools (*read*) · covers our angle: **partial** — a link list, no setup steps · fetched 2026-10-14
- **Also good:** [Setup editors](https://oxc.rs/docs/guide/usage/linter/editors.html) · oxc.rs · the VS Code extension runs `oxlint --lsp` from your project install (*read*) · fetched 2026-10-14
- **Also good:** [Setup CI and other integrations](https://oxc.rs/docs/guide/usage/linter/ci.html) · oxc.rs · lint-staged and pre-commit examples (*headings only*) · fetched 2026-10-14
- **Our delta:** the local loop (editor, hook, script) tied together. No fetched non-official source gave a current Husky v9 setup; one search result showed the v8 helper line that v9 removed.

---

## Section 12 — Oxlint core architecture

### T12-01 · What Oxlint is and how it differs from ESLint — Topic · ✅ written `docs/eslint-oxlint/pages/12-oxlint-core-architecture/01-what-oxlint-is-and-vs-eslint.md`
- **Read this:** [Oxlint overview](https://oxc.rs/docs/guide/usage/linter.html) · oxc.rs · built on the Oxc stack, native plugins in place of a JS dependency tree, type-aware linting through the TypeScript Go port (*read*) · covers our angle: **partial** — claims, not mechanism · fetched 2026-10-14
- **Also good:** [Linter architecture](https://oxc.rs/docs/learn/architecture/linter.html) · oxc.rs · `LintService` runs files in parallel with `rayon`, builds an AST and semantic data, then runs rules (*read*) · fetched 2026-10-14
- **Also good:** [Migrate from ESLint](https://oxc.rs/docs/guide/usage/linter/migrate-from-eslint.html) · oxc.rs · "When to migrate" section (*headings only*) · fetched 2026-10-14
- **Our delta:** the ESLint versus Oxlint difference table, with the speed numbers labelled as vendor benchmarks.

---

## Section 13 — Oxlint installation, CLI and config files

### T13-01 · Install, CLI and config schema — Topic · ✅ written `docs/eslint-oxlint/pages/13-oxlint-installation-cli-and-config-files/01-install-cli-and-config-schema.md`
- **Read this:** [Configuration](https://oxc.rs/docs/guide/usage/linter/config.html) · oxc.rs · discovers `.oxlintrc.json`, `.oxlintrc.jsonc`, `oxlint.config.ts` or `oxlint.config.mts`; one file per directory; `categories`, `plugins`, `overrides`, extends (*read*) · covers our angle: **full** for the schema · fetched 2026-10-14
- **Also good:** [Command-line interface](https://oxc.rs/docs/guide/usage/linter/cli.html) · oxc.rs · `--fix`, `-c`, `--type-aware`, `-D`, `-W`, `-A`, formats (*read*) · fetched 2026-10-14
- **Also good:** [Nested config files](https://oxc.rs/docs/guide/usage/linter/nested-config.html) · oxc.rs · per-package configs in a monorepo; extends a root config; not merged automatically (*read*) · fetched 2026-10-14
- **Our delta:** the install matrix and a commented schema example. Check the `oxlint.config.ts` form against our page, since many guides still show only JSON.

---

## Section 14 — Oxlint native plugins and rule coverage

### T14-01 · Native plugins and category strategy — Topic · ✅ written `docs/eslint-oxlint/pages/14-oxlint-native-plugins-and-rule-coverage/01-plugins-and-categories.md`
- **Read this:** [Built-in Plugins](https://oxc.rs/docs/guide/usage/linter/plugins.html) · oxc.rs · native ports of ESLint plugin rule sets, enabled by the `plugins` field or `--<name>-plugin` flags; disabling the default plugins (*read*) · covers our angle: **full** for plugins · fetched 2026-10-14
- **Also good:** [Rules reference](https://oxc.rs/docs/guide/usage/linter/rules.html) · oxc.rs · categories: correctness, nursery, pedantic, perf, restriction, style, suspicious (*headings only*) · fetched 2026-10-14
- **Also good:** [Configuration](https://oxc.rs/docs/guide/usage/linter/config.html) · oxc.rs · "Enable groups of rules with categories"; `correctness` on by default (*read*) · fetched 2026-10-14
- **Our delta:** a category ladder for adoption (correctness first, then suspicious).

---

## Section 15 — Oxlint type-aware linting and multi-file analysis

### T15-01a · Type-aware mode — Topic · ✅ written `docs/eslint-oxlint/pages/15-oxlint-type-aware-linting-and-multi-file-analysis/01-type-aware-and-multi-file.md`
- **Read this:** [Type-Aware Linting](https://oxc.rs/docs/guide/usage/linter/type-aware.html) · oxc.rs · `oxlint-tsgolint` as a dev dependency, TypeScript 7.0 or later, 59 of 61 typescript-eslint type-aware rules, no `baseUrl` support (*read*) · covers our angle: **full** — but see the version note · fetched 2026-10-14
- **Also good:** [Type-Aware Linting Stable](https://oxc.rs/blog/2026-07-22-type-aware-linting-stable) · Cameron, oxc.rs blog, slug dated 2026-07-22 · tsgolint v7 leaves alpha; versioning tied to TypeScript (*headings only*) · fetched 2026-10-14
- **Our delta:** our page calls `--type-check` experimental and `typeAware` needing tsgolint. The docs now say stable, so re-check wording against the stable post before the next edit.

### T15-01b · Multi-file analysis — Topic · ✅ written `docs/eslint-oxlint/pages/15-oxlint-type-aware-linting-and-multi-file-analysis/01-type-aware-and-multi-file.md`
- **Read this:** [Multi-file analysis](https://oxc.rs/docs/guide/usage/linter/multi-file-analysis.html) · oxc.rs · lets `import` plugin rules check module relationships across the project, such as `import/no-cycle`; covers TypeScript path aliases (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Our delta:** the cost of enabling it alongside JS plugins and type-aware on one PR.

---

## Section 16 — Oxlint JS plugins and extensibility

### T16-01 · JS plugins (alpha) and custom rules strategy — Topic · ✅ written `docs/eslint-oxlint/pages/16-oxlint-js-plugins-and-extensibility/01-js-plugins-and-custom-rules.md`
- **Read this:** [JS Plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html) · oxc.rs · alpha, API designed to match ESLint v9+, list of known-supported plugins (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Writing JS Plugins](https://oxc.rs/docs/guide/usage/linter/writing-js-plugins.html) · oxc.rs · ESLint-compatible API versus the faster `createOnce` API; testing with `RuleTester` (*headings only*) · fetched 2026-10-14
- **Also good:** [Oxlint JS plugins alpha](https://oxc.rs/blog/2026-03-11-oxlint-js-plugins-alpha) · overlookmotel and Cameron, oxc.rs blog, slug dated 2026-03-11 · reliability claims, what it cannot do yet, performance tips (*headings only*) · fetched 2026-10-14
- **Our delta:** when to keep a custom rule in ESLint instead of porting it.

---

## Section 17 — Oxlint fixes, ignores and diagnostics

### T17-01 · Fixes, ignore comments and diagnostics — Topic · ✅ written `docs/eslint-oxlint/pages/17-oxlint-fixes-ignores-and-diagnostics/01-fixes-ignores-and-diagnostics.md`
- **Read this:** [Automatic fixes](https://oxc.rs/docs/guide/usage/linter/automatic-fixes.html) · oxc.rs · safe fixes, suggestions and dangerous fixes, and how to combine them (*read*) · covers our angle: **full** for fixes · fetched 2026-10-14
- **Also good:** [Inline ignore comments](https://oxc.rs/docs/guide/usage/linter/ignore-comments.html) · oxc.rs · `oxlint-disable`, `-enable`, `-disable-line`, `-disable-next-line`, ESLint compatibility, reporting unused comments (*read*) · fetched 2026-10-14
- **Also good:** [Command-line interface](https://oxc.rs/docs/guide/usage/linter/cli.html) · oxc.rs · "Output" and "Handle Warnings" sections (*headings only*) · fetched 2026-10-14
- **Our delta:** diagnostics reading guide and a fix-mode policy for CI.

---

## Section 18 — Coexistence: ESLint and Oxlint

### T18-01 · Running ESLint and Oxlint together — Topic · ✅ written `docs/eslint-oxlint/pages/18-coexistence-eslint-and-oxlint/01-dual-run-overlap-and-retirement.md`
- **Read this:** [Migrate from ESLint](https://oxc.rs/docs/guide/usage/linter/migrate-from-eslint.html) · oxc.rs · "Running Oxlint and ESLint together": `eslint-plugin-oxlint` turns off ESLint rules Oxlint already covers (*read*) · covers our angle: **full** for overlap · fetched 2026-10-14
- **Also good:** [eslint-plugin-oxlint](https://github.com/oxc-project/eslint-plugin-oxlint) · oxc-project, GitHub README · run oxlint before eslint; flat and legacy config; detects rules from `.oxlintrc.json` through `buildFromConfigFile` (*read*) · fetched 2026-10-14
- **Beyond the docs:** [How to Migrate from ESLint to Oxlint](https://www.hongkiat.com/blog/eslint-to-oxlint-migration-guide/) · Hongkiat Lim, updated 2025-11-21 · keeps ESLint for unsupported rules and chains `npx oxlint && npx eslint` in one script (*read*) · fetched 2026-10-14
- **Our delta:** retiring ESLint, with a rollback switch. Our page says the plugin helper name once; the README names `buildFromConfigFile`, so check ours matches.

---

## Section 19 — Migration paths

### T19-01a · Legacy to flat config — Topic · ✅ written `docs/eslint-oxlint/pages/19-migration-paths/01-legacy-flat-oxlint-and-phased.md`
- **Read this:** [Configuration Migration Guide](https://eslint.org/docs/latest/use/configure/migration-guide) · ESLint docs · plugins and parsers become imported objects; globals and parser options merge into `languageOptions`; `@eslint/migrate-config` gives a starting point (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Migrate to v10.0.0](https://eslint.org/docs/latest/use/migrate-to-10.0.0) · ESLint docs · eslintrc no longer supported; Node 20.19+, 22.13+, 24+ (*read*) · fetched 2026-10-14
- **Also good:** [New config system, part 2](https://eslint.org/blog/2022/08/new-config-system-part-2/) · Nicholas C. Zakas, ESLint blog, 2022-08-05 · the design reasons behind the change (*read*) · fetched 2026-10-14
- **Our delta:** ordering (flat first, then Oxlint) and the `.eslintignore` cleanup.

### T19-01b · ESLint to Oxlint and phased dual-stack — Topic · ✅ written `docs/eslint-oxlint/pages/19-migration-paths/01-legacy-flat-oxlint-and-phased.md`
- **Read this:** [Migrate from ESLint](https://oxc.rs/docs/guide/usage/linter/migrate-from-eslint.html) · oxc.rs · `@oxlint/migrate` converts a flat config; type-aware and JS plugin notes; v8 configs (*read*) · covers our angle: **full** for the tool, **partial** for monorepo phasing · fetched 2026-10-14
- **Beyond the docs:** [How to Migrate from ESLint to Oxlint](https://www.hongkiat.com/blog/eslint-to-oxlint-migration-guide/) · Hongkiat Lim, updated 2025-11-21 · migration of an existing project and handling unsupported rules (*read*) · fetched 2026-10-14
- **Our delta:** the phase plan for big monorepos and the gap triage after `@oxlint/migrate`.

---

## Section 20 — CI, monorepos and performance engineering

### T20-01 · CI, monorepos and lint performance — Topic · ✅ written `docs/eslint-oxlint/pages/20-ci-monorepos-and-performance-engineering/01-ci-monorepos-and-perf.md`
- **Read this:** [Setup CI and other integrations](https://oxc.rs/docs/guide/usage/linter/ci.html) · oxc.rs · detects GitHub Actions and turns on inline annotations; `--format` picks another output (*read*) · covers our angle: **partial** — Oxlint only · fetched 2026-10-14
- **Also good:** [Multithread linting](https://eslint.org/blog/2025/08/multithread-linting/) · Francesco Trotta, ESLint blog, 2025-08-22 · `--concurrency`, limits of `auto`, Node API support (*headings only*) · fetched 2026-10-14
- **Also good:** [Nested config files](https://oxc.rs/docs/guide/usage/linter/nested-config.html) · oxc.rs · monorepo pattern with a shared base (*read*) · fetched 2026-10-14
- **Also good:** [Typed linting performance](https://typescript-eslint.io/troubleshooting/typed-linting/performance) · typescript-eslint.io · where typed-lint time goes (*read*) · fetched 2026-10-14
- **Our delta:** cache keys and cost budget per CI job. No fetched source confirmed an ESLint `TIMING` variable in search, so any claim on it needs the ESLint docs.

---

## Section 21 — Real-world workflows and recipes

### T21-01 · Bootstrap, migration and day-to-day — Topic · ✅ written `docs/eslint-oxlint/pages/21-real-world-workflows-and-recipes/01-bootstrap-migration-and-day-to-day.md`
- **Read this:** [Getting Started with ESLint](https://eslint.org/docs/latest/use/getting-started) · ESLint docs · `npm init @eslint/config` asks questions and writes `eslint.config.js` or `.mjs` (*read*) · covers our angle: **partial** — bootstrap only · fetched 2026-10-14
- **Also good:** [Migrate from ESLint](https://oxc.rs/docs/guide/usage/linter/migrate-from-eslint.html) · oxc.rs · the migration recipe, including running both tools (*read*) · fetched 2026-10-14
- **Beyond the docs:** [How to Migrate from ESLint to Oxlint](https://www.hongkiat.com/blog/eslint-to-oxlint-migration-guide/) · Hongkiat Lim, updated 2025-11-21 · a worked example end to end (*read*) · fetched 2026-10-14
- **Our delta:** day-to-day recipes (new rule rollout, warning budgets) that no single upstream page covers.
