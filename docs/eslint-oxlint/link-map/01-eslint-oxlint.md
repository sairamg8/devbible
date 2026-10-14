---
title: "Link map · ESLint and Oxlint · Part 1 (all sections)"
sidebar_label: "01 · eslint and oxlint"
sidebar_position: 1
---

# Link map · ESLint and Oxlint · Part 1 (all sections)

Covers all 21 sections of `docs/eslint-oxlint/pages/`. Each section is one page of ours (one chunk file), so each block below maps to that page. Four pages cover two or three distinct sub-topics (their H3 headings, such as 7.1 and 7.2) and get blocks `a` and `b`. This track has no syllabus directory, so the topic list comes from the page tree. Section numbers come from the directory names.
*read* = the claim is in the fetched text; *headings only* = fetched at 200 and only the headings or opening were checked (the fetch tool returns summaries, so *read* is only given where the claim came back in them). Third-party links carry the date the page shows. No `#anchors` are given. Official here includes the ESLint blog (Zakas, Trotta, Constantinou), so those posts are "Also good", not "Beyond". Where no good third-party explanation turned up after searching, the block has no "Beyond the docs" line.

🔴 **Version note.** ESLint's docs switcher on 2026-10-14 lists v10.12.0 as latest (then v9.39.5 and v8.57.1). v10 removed the legacy `.eslintrc` format and needs Node 20.19+, 22.13+ or 24+. ESLint docs banners say v9.x reached end-of-life on 2026-08-06 and v8.x on 2024-10-05. Official ESLint links below use `/docs/latest/`, so they describe v10 and flat config only. Pages that explain the legacy format (section 02, part of 19) have to be read against the v8 docs, linked in T02-01. Oxlint links point at oxc.rs. The Oxc blog calls type-aware linting stable (tsgolint v7, 2026-07-22), but `--type-check` and `options.typeCheck` are still labelled experimental in the current CLI and config pages, and JS plugins are alpha. The Oxlint overview page labels neither type-aware linting nor `--type-check`. Only our page 01 carries a `> Verified:` line (2026-09-08, against the Oxlint docs), so the other pages' version stamps could not be compared.

**Stale statements found in our pages** (pages not edited; fix on the next pass):
- Page 02 line 39 says ESLint v9+ "treats flat config as the supported path" with eslintrc as history. v10 removed eslintrc, and v9 is end-of-life.
- Page 19 line 16 says "move to ESLint 9+ APIs". The current line is v10.
- Page 21 line 70 uses `tseslint.config(`. typescript-eslint deprecated it in favour of ESLint's `defineConfig()`; its own docs now use `defineConfig` with `extends`. Pages 03 and 07 already use `defineConfig`.
- Page 08 line 23 lists `unix` and `compact` formatters. The v10 formatter reference lists only `html`, `json-with-metadata`, `json` and `stylish`.
- Page 10 line 129 has a `context.getFilename()` pitfall. The v10 custom-rules docs say old context methods were removed; use `context.filename`.
- Page 18 puts `oxlint.configs['flat/recommended']` first in the array. The eslint-plugin-oxlint README says to list it last.
- Page 13 says nearest-config resolution "wins/merges". The Oxlint nested-config page says configs are not merged automatically.
- Not stale: page 15 calls `--type-check` experimental, which still matches the Oxlint CLI and config docs. Page 18 does not name `buildFromConfigFile` at all (see T18-01).

---

## Section 01 — Linting landscape and tooling decisions

### T01-01 · Why lint, choosing tools, format boundaries — Topic · ✅ written `docs/eslint-oxlint/pages/01-linting-landscape-and-tooling-decisions/01-why-choose-and-boundaries.md`
- **Read this:** [Oxlint overview](https://oxc.rs/docs/guide/usage/linter.html) · oxc.rs · has a "Choosing a JavaScript linter" section, more than 870 rules (871 on the rules page), and the project's own "50 to 100 times faster" claim (*read*) · covers our angle: **partial** — vendor view, so it does not weigh Biome or Prettier fairly · fetched 2026-10-14
- **Also good:** [Integrating with Linters](https://prettier.io/docs/integrating-with-linters) · Prettier docs · turn off conflicting rules with `eslint-config-prettier`; `eslint-plugin-prettier` is "generally not recommended" because it is slower and adds noise (*read*) · fetched 2026-10-14
- **Also good:** [Biome linter](https://biomejs.dev/linter/) · Biome docs · 568 rules; Biome has no formatting rules because its formatter handles layout (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Biome vs ESLint vs Oxlint: JS Linters 2026](https://dev.to/royce_fabbd83cb268312e928/biome-vs-eslint-vs-oxlint-js-linters-2026-408h) · Royce, DEV Community, posted Mar 18 (year not shown; says it was first published at pkgpulse.com) · chooses by plugin needs, formatting, project stage and CI speed; its numbers are its own and unverified (*read*) · fetched 2026-10-14
- **Our delta:** the decision table (ESLint-only, Oxlint-only, both, Biome, Vite+) and the format boundary as a policy. Page 01 is the one page with a `> Verified:` line.

---

## Section 02 — ESLint core architecture

### T02-01 · Pipeline and legacy config — Topic · ✅ written `docs/eslint-oxlint/pages/02-eslint-core-architecture/01-pipeline-and-legacy-config.md`
- **Read this:** [Core Concepts](https://eslint.org/docs/latest/use/core-concepts/) · ESLint docs · short definitions of rule, parser (Espree by default), processor and formatter, plus fixes versus suggestions (*read*) · covers our angle: **partial** — names the stages, does not trace them; says nothing on legacy config · fetched 2026-10-14
- **Also good:** [Configuration Files (v8.x, legacy)](https://eslint.org/docs/v8.x/use/configure/configuration-files) · ESLint docs, v8 · the `.eslintrc` cascade, `extends` and `overrides`; carries an end-of-life banner (2024-10-05), so use it only to read old repos (*read*) · fetched 2026-10-14
- **Also good:** [Flat config rationale, part 2](https://eslint.org/blog/2022/08/new-config-system-part-2/) · Nicholas C. Zakas, ESLint blog, 2022-08-05 (updated 2024-08-12) · why the directory cascade of eslintrc was dropped, in the author's words (*read*) · fetched 2026-10-14
- **Beyond the docs:** [ESLint v10: Flat Config Completion and JSX Tracking](https://www.infoq.com/news/2026/04/eslint-10-release/) · Daniel Curtis, InfoQ, 2026-04-01 · eslintrc is gone in v10, and config lookup now starts from each linted file's directory (*read*) · fetched 2026-10-14
- **Our delta:** the lint pipeline end to end and the legacy cascade as a reading guide, which v10 docs no longer describe. Fix line 39 (see stale list).

---

## Section 03 — ESLint flat config

### T03-01 · Forms, fields and composition — Topic · ✅ written `docs/eslint-oxlint/pages/03-eslint-flat-config/01-forms-fields-and-composition.md`
- **Read this:** [Configuration Files](https://eslint.org/docs/latest/use/configure/configuration-files) · ESLint docs · later config objects override earlier ones; `files` and `ignores` resolve relative to the config file; `defineConfig()` with `extends`; `eslint.config.ts` needs `jiti` 2.2+ on Node (*read*) · covers our angle: **full** for the fields; "Extending Configurations" and "When to Use Extends vs Cascading" are the composition part · fetched 2026-10-14
- **Also good:** [Configure Plugins](https://eslint.org/docs/latest/use/configure/plugins) · ESLint docs · the `plugins` key maps a namespace to a plugin object; local and virtual plugins (*read*) · fetched 2026-10-14
- **Also good:** [New config system, part 2](https://eslint.org/blog/2022/08/new-config-system-part-2/) · Nicholas C. Zakas, ESLint blog, 2022-08-05 · "Glob-based configs everywhere" and "Goodbye extends, hello flat cascade" explain the shape (*read*) · fetched 2026-10-14
- **Beyond the docs:** [What is ESLint flat config?](https://nx.dev/docs/kb/flat-config) · Nx docs (undated) · how `files` replaces `overrides`, `.eslintignore` moves into `ignores`, and `globalIgnores`; it does not explain precedence (*read*) · fetched 2026-10-14
- **Our delta:** the three config forms side by side and when each wins. Our claims on `defineConfig` and `extends` match the current docs.

---

## Section 04 — Language options, globals and parsing

### T04-01 · Language options and file targeting — Topic · ✅ written `docs/eslint-oxlint/pages/04-eslint-language-options-globals-and-parsing/01-language-options-and-file-targeting.md`
- **Read this:** [Language Options](https://eslint.org/docs/latest/use/configure/language-options) · ESLint docs · ESLint assumes no globals beyond the `ecmaVersion` built-ins; `ecmaVersion` defaults to `latest` and `sourceType` to `module`; globals via comments or `languageOptions.globals` (*read*) · covers our angle: **partial** — language options only, not the file-glob side · fetched 2026-10-14
- **Also good:** [Configuration Files](https://eslint.org/docs/latest/use/configure/configuration-files) · ESLint docs · "Specify `files` and `ignores`", with the advice to always include `files` when you set `ignores` (*read*) · fetched 2026-10-14
- **Our delta:** parser and globals choices per file type in one worked example. v10 now reports `eslint-env` comments as errors (migration guide); our page does not mention them.

---

## Section 05 — ESLint rules system

### T05-01 · Severity, core rules and presets — Topic · ✅ written `docs/eslint-oxlint/pages/05-eslint-rules-system/01-severity-core-rules-and-presets.md`
- **Read this:** [Configure Rules](https://eslint.org/docs/latest/use/configure/rules) · ESLint docs · off, warn (exit code unchanged), error (exit 1); inline config comments have the highest priority; plugin rules take a namespace prefix (*read*) · covers our angle: **partial** — severities yes, preset choice no · fetched 2026-10-14
- **Also good:** [Migrate to v10.0.0](https://eslint.org/docs/latest/use/migrate-to-10.0.0) · ESLint docs · `eslint:recommended` gains `no-unassigned-vars`, `no-useless-assignment` and `preserve-caught-error` (*read*) · fetched 2026-10-14
- **Our delta:** which preset to start from and a severity ladder for CI. Our page does not say the recommended set grew in v10.

---

## Section 06 — ESLint plugin ecosystem

### T06-01 · Plugins: frontend, Node, security and pitfalls — Topic · ✅ written `docs/eslint-oxlint/pages/06-eslint-plugin-ecosystem/01-plugins-frontend-node-and-pitfalls.md`
- **Read this:** [eslint-plugin-react-hooks](https://react.dev/reference/eslint-plugin-react-hooks) · react.dev · the plugin enforces the Rules of React; its `recommended` preset enables 17 rules, including `exhaustive-deps`, `rules-of-hooks` and React Compiler diagnostics (*read*) · covers our angle: **partial** — React only; no Node, import or security plugin; no setup example · fetched 2026-10-14
- **Also good:** [Configure Plugins](https://eslint.org/docs/latest/use/configure/plugins) · ESLint docs · "Common Problems" links to two cases only: plugin rules on the pre-9 API, plugin configs not yet flat (*read*) · fetched 2026-10-14
- **Our delta:** plugin picks for Node and security (`eslint-plugin-n`, `eslint-plugin-security`) and the pitfalls list. No official page was fetched for those two, so the page's claims about them still need checking against each plugin's README. A search found no good third-party explainer for this set.

---

## Section 07 — typescript-eslint

### T07-01a · Architecture: parser and shared configs — Topic · ✅ written `docs/eslint-oxlint/pages/07-typescript-eslint/01-architecture-type-aware-and-stacks.md`
- **Read this:** [@typescript-eslint/parser](https://typescript-eslint.io/packages/parser/) · typescript-eslint.io · turns TypeScript into ESLint-compatible nodes; `projectService` uses the nearest `tsconfig.json` for each file; `programs` accepts your own TS program (*read*) · covers our angle: **partial** for 7.1 — our page has a three-row package table and no option reference · fetched 2026-10-14
- **Also good:** [typescript-eslint package](https://typescript-eslint.io/packages/typescript-eslint/) · typescript-eslint.io · exports `configs`, `extensions`, `globs`; `config(...)` is deprecated in favour of ESLint's `defineConfig(...)`, and the usage example now uses `defineConfig` with `extends` (*read*) · fetched 2026-10-14
- **Our delta:** the TS + React + Next stack in 7.3. Page 07 already uses `defineConfig`; only page 21 still uses `tseslint.config(`.

### T07-01b · Type-aware linting — Topic · ✅ written `docs/eslint-oxlint/pages/07-typescript-eslint/01-architecture-type-aware-and-stacks.md`
- **Read this:** [Linting with Type Information](https://typescript-eslint.io/getting-started/typed-linting/) · typescript-eslint.io · `parserOptions.projectService: true`; typed rules need TypeScript to analyse the whole project, so they are slower (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Also good:** [Performance](https://typescript-eslint.io/troubleshooting/typed-linting/performance/) · typescript-eslint.io · narrow `tsconfig` includes; slow third-party rules named: `@stylistic/indent`, `eslint-plugin-prettier`, and several `eslint-plugin-import` rules (*read*) · fetched 2026-10-14
- **Also good:** [Project Service](https://typescript-eslint.io/blog/project-service/) · Josh Goldberg, typescript-eslint blog, 2025-05-29 · why the project service replaces `parserOptions.project`; stable since v8 (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Configuring ESLint with TypeScript](https://nx.dev/docs/kb/configuring-eslint-with-typescript) · Nx docs (undated) · turn typed linting on per project only when needed, because building the TS programs is expensive; its examples use `FlatCompat`, not `defineConfig` (*read*) · fetched 2026-10-14
- **Our delta:** the gotcha list around `no-floating-promises`, duplicate installs and `.next` ignores. Our page does not list the slow-plugin culprits above.

---

## Section 08 — ESLint CLI, output, cache and fixes

### T08-01 · CLI and programmatic usage — Topic · ✅ written `docs/eslint-oxlint/pages/08-eslint-cli-output-cache-and-fixes/01-cli-and-programmatic-usage.md`
- **Read this:** [Command Line Interface](https://eslint.org/docs/latest/use/command-line-interface) · ESLint docs · `--cache` (default `.eslintcache`, stale for cross-file rules), `--fix`, `--max-warnings`, `--format` (default `stylish`), exit codes 0, 1, 2, and `--concurrency` (*read*) · covers our angle: **partial** — flags and exit codes yes; our formatter list is out of date and `--concurrency` is missing · fetched 2026-10-14
- **Also good:** [Node.js API](https://eslint.org/docs/latest/integrate/nodejs-api) · ESLint docs · `lintFiles`, `lintText`, `loadFormatter`, static `ESLint.outputFixes`, plus `loadESLint()` (*read*) · fetched 2026-10-14
- **Also good:** [Formatters Reference](https://eslint.org/docs/latest/use/formatters/) · ESLint docs · built-ins are `stylish` (default), `json`, `json-with-metadata`, `html` (*read*) · fetched 2026-10-14
- **Also good:** [Integration tutorial](https://eslint.org/docs/latest/integrate/integration-tutorial) · ESLint docs · a small Node module that lints, fixes with `outputFixes` and prints results; one code comment still names `.eslintrc` (*read*) · fetched 2026-10-14
- **Our delta:** a cache-and-fix recipe for CI with the exit-code policy. Fix the formatter row (see stale list).

---

## Section 09 — Suppressions, ignores and governance

### T09-01 · Disables, ignores and governance — Topic · ✅ written `docs/eslint-oxlint/pages/09-eslint-suppressions-ignores-and-governance/01-disables-ignores-and-governance.md`
- **Read this:** [Ignore Files](https://eslint.org/docs/latest/use/configure/ignore) · ESLint docs · `globalIgnores()` is the way to skip directories; `ignores` inside a config only matches files; unignoring; `includeIgnoreFile` for `.gitignore`; no mention of `.eslintignore` (*read*) · covers our angle: **partial** — ignores only · fetched 2026-10-14
- **Also good:** [Bulk Suppressions](https://eslint.org/docs/latest/use/suppressions) · ESLint docs · `eslint-suppressions.json` at the project root, committed to the repo; `--suppress-all`, `--suppress-rule`, `--prune-suppressions` (*read*) · covers our angle: **none** — our page does not mention bulk suppressions · fetched 2026-10-14
- **Also good:** [Introducing bulk suppressions](https://eslint.org/blog/2025/04/introducing-bulk-suppressions/) · Iacovos Constantinou, ESLint blog, 2025-04-04 · record existing violations, enforce the rule as error for new code, fix the backlog over time (*read*) · fetched 2026-10-14
- **Also good:** [Configure Rules](https://eslint.org/docs/latest/use/configure/rules) · ESLint docs · disabling rules with comments; `reportUnusedDisableDirectives` defaults to warn (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Bulk Suppressions: A new ESLint feature for large codebases](https://developers.tiktok.com/blog/bulk-suppressions-a-new-eslint-feature-for-large-codebases) · Kevin Yang, TikTok for Developers (undated) · why inline disables do not scale and a four-step adoption flow; it describes the earlier Rush Stack patch, not the built-in feature (*read*) · fetched 2026-10-14
- **Our delta:** a governance policy (who may disable, what must carry a reason). Add a bulk-suppressions section next pass.

---

## Section 10 — Custom ESLint rules and processors

### T10-01 · Authoring, testing and processors — Topic · ✅ written `docs/eslint-oxlint/pages/10-custom-eslint-rules-and-processors/01-authoring-testing-and-processors.md`
- **Read this:** [Custom Rules](https://eslint.org/docs/latest/extend/custom-rules) · ESLint docs · a rule exports `meta` and `create(context)` returning visitors; `meta.schema`, scopes, code paths, `RuleTester`, `TIMING` profiling (*read*) · covers our angle: **full** for authoring · fetched 2026-10-14
- **Also good:** [Custom Rule Tutorial](https://eslint.org/docs/latest/extend/custom-rule-tutorial) · ESLint docs · build, test with `RuleTester`, bundle in a plugin, publish with `eslint` as a peer dependency (*read*) · fetched 2026-10-14
- **Also good:** [Custom Processors](https://eslint.org/docs/latest/extend/custom-processors) · ESLint docs · `preprocess` and `postprocess`; no autofix unless the processor sets `supportsAutofix` (*read*) · covers our angle: **partial** — our 10.3 does not mention `supportsAutofix` · fetched 2026-10-14
- **Beyond the docs:** [How I built my first custom ESLint rule](https://blog.maximeheckel.com/posts/how-to-build-first-eslint-rule/) · Maxime Heckel, 2019-11-19 · gentle walkthrough of the AST, `meta`, `create` and testing with `RuleTester`; written before flat config, so its plugin setup is dated (*read*) · fetched 2026-10-14
- **Our delta:** testing and processor pitfalls in one worked rule. Fix the `getFilename` pitfall (see stale list).

---

## Section 11 — ESLint editor and local workflow

### T11-01 · IDE integration, git hooks and scripts — Topic · ✅ written `docs/eslint-oxlint/pages/11-eslint-editor-and-local-workflow/01-ide-hooks-and-scripts.md`
- **Read this:** [Integrations](https://eslint.org/docs/latest/use/integrations) · ESLint docs · a list of editor plugins (VS Code, JetBrains, Vim, Neovim and more) and a few git hook entries (a generic pre-commit hook, a staged-only hook, overcommit); it lists neither lint-staged nor husky (*read*) · covers our angle: **partial** — a link list, no setup steps · fetched 2026-10-14
- **Also good:** [Setup editors](https://oxc.rs/docs/guide/usage/linter/editors.html) · oxc.rs · editor extensions run `oxlint --lsp` from your project, so Oxlint must be installed locally (*read*) · fetched 2026-10-14
- **Also good:** [Setup CI and other integrations](https://oxc.rs/docs/guide/usage/linter/ci.html) · oxc.rs · lint-staged and pre-commit examples; husky suggested for installing the hook (*read*) · fetched 2026-10-14
- **Beyond the docs:** [Husky and lint-staged](https://betterstack.com/community/guides/scaling-nodejs/husky-and-lint-staged/) · Stanley Ulili, Better Stack, updated 2025-06-10 · uses `npx husky init` (the v9 flow); `.husky/pre-commit` holds one `lint-staged` line, and the lint-staged config runs `eslint --fix --max-warnings=0` (*read*) · fetched 2026-10-14
- **Our delta:** the local loop (editor, hook, script) tied together. Our page has no Oxlint editor setup.

---

## Section 12 — Oxlint core architecture

### T12-01 · What Oxlint is and how it differs from ESLint — Topic · ✅ written `docs/eslint-oxlint/pages/12-oxlint-core-architecture/01-what-oxlint-is-and-vs-eslint.md`
- **Read this:** [Oxlint overview](https://oxc.rs/docs/guide/usage/linter.html) · oxc.rs · built on the Oxc stack, native plugins "without a large JavaScript dependency tree", type-aware linting through the native Go port of TypeScript (*read*) · covers our angle: **partial** — claims, not mechanism · fetched 2026-10-14
- **Also good:** [Linter architecture](https://oxc.rs/docs/learn/architecture/linter.html) · oxc.rs · the linter service iterates file paths in parallel with `rayon`, parses to an AST, builds semantic data, then runs rules (*read*) · fetched 2026-10-14
- **Also good:** [Migrate from ESLint](https://oxc.rs/docs/guide/usage/linter/migrate-from-eslint.html) · oxc.rs · "When to migrate" section; stay on ESLint if a missing behavior blocks you (*read*) · fetched 2026-10-14
- **Beyond the docs:** [A Look at the JavaScript Oxidation Compiler](https://blog.openreplay.com/javascript-oxidation-compiler/) · OpenReplay Team, 2026-08-21 · why Oxc is fast: one shared AST across tools, arena allocation, parallel analysis; brief on the linter itself (*read*) · fetched 2026-10-14
- **Our delta:** the ESLint versus Oxlint difference table, with the speed numbers labelled as vendor benchmarks.

---

## Section 13 — Oxlint installation, CLI and config files

### T13-01 · Install, CLI and config schema — Topic · ✅ written `docs/eslint-oxlint/pages/13-oxlint-installation-cli-and-config-files/01-install-cli-and-config-schema.md`
- **Read this:** [Configuration](https://oxc.rs/docs/guide/usage/linter/config.html) · oxc.rs · discovers `.oxlintrc.json`, `.oxlintrc.jsonc`, `oxlint.config.ts` or `oxlint.config.mts`; JSON and TS configs cannot coexist; `defineConfig` from `oxlint`; `options.typeCheck` is experimental (*read*) · covers our angle: **full** for the schema; our `oxlint.config.ts` form matches · fetched 2026-10-14
- **Also good:** [Command-line interface](https://oxc.rs/docs/guide/usage/linter/cli.html) · oxc.rs · `--fix`, `-c`, `--type-aware`, `-D`, `-W`, `-A`, `--format` values (checkstyle, github, gitlab, json, junit, sarif and more) (*read*) · fetched 2026-10-14
- **Also good:** [Nested config files](https://oxc.rs/docs/guide/usage/linter/nested-config.html) · oxc.rs · per-package configs in a monorepo, a shared base through `extends`; "not automatically merged" (*read*) · fetched 2026-10-14
- **Our delta:** the install matrix and a commented schema example. Correct the "wins/merges" wording for nearest-config resolution.

---

## Section 14 — Oxlint native plugins and rule coverage

### T14-01 · Native plugins and category strategy — Topic · ✅ written `docs/eslint-oxlint/pages/14-oxlint-native-plugins-and-rule-coverage/01-plugins-and-categories.md`
- **Read this:** [Built-in Plugins](https://oxc.rs/docs/guide/usage/linter/plugins.html) · oxc.rs · defaults are `eslint`, `typescript`, `unicorn`, `oxc`; setting `plugins` overwrites that set; `--<name>-plugin` flags; only default plugins can be disabled (*read*) · covers our angle: **partial** — our table omits the `nextjs` plugin and the overwrite rule · fetched 2026-10-14
- **Also good:** [Rules reference](https://oxc.rs/docs/guide/usage/linter/rules.html) · oxc.rs · 871 rules; category filter lists correctness, nursery, pedantic, perf, restriction, style, suspicious (*read*) · fetched 2026-10-14
- **Also good:** [Configuration](https://oxc.rs/docs/guide/usage/linter/config.html) · oxc.rs · "Enable groups of rules with categories"; `correctness` on by default (*read*) · fetched 2026-10-14
- **Our delta:** a category ladder for adoption (correctness first, then suspicious). No third-party source on gradual adoption turned up.

---

## Section 15 — Oxlint type-aware linting and multi-file analysis

### T15-01a · Type-aware mode — Topic · ✅ written `docs/eslint-oxlint/pages/15-oxlint-type-aware-linting-and-multi-file-analysis/01-type-aware-and-multi-file.md`
- **Read this:** [Type-Aware Linting](https://oxc.rs/docs/guide/usage/linter/type-aware.html) · oxc.rs · `oxlint-tsgolint` as a dev dependency, TypeScript 7.0+, 59 of 61 typescript-eslint type-aware rules, no `baseUrl` support; `options.typeAware` works only in the root config (*read*) · covers our angle: **partial** — our page gives the flag, config key and dependency but not the version floor, rule count or `baseUrl` limit · fetched 2026-10-14
- **Also good:** [Type-Aware Linting Stable](https://oxc.rs/blog/2026-07-22-type-aware-linting-stable) · Cameron, oxc.rs blog, slug dated 2026-07-22 · tsgolint v7 as `oxlint-tsgolint@7`, version string tied to the TypeScript release, 59 of 61 rules (*read*) · fetched 2026-10-14
- **Our delta:** our page does not say type-aware linting is now stable. Its `--type-check` wording ("experimental") still matches the current CLI and config pages, but the stable post does not mention `--type-check`, so recheck that one before the next edit. The VoidZero launch post (2025-08-22) still called tsgolint "experimental", so older guides are dated.

### T15-01b · Multi-file analysis — Topic · ✅ written `docs/eslint-oxlint/pages/15-oxlint-type-aware-linting-and-multi-file-analysis/01-type-aware-and-multi-file.md`
- **Read this:** [Multi-file analysis](https://oxc.rs/docs/guide/usage/linter/multi-file-analysis.html) · oxc.rs · needs the `import` plugin; builds the module graph in the core engine; resolves TypeScript path aliases from `tsconfig.json`; its ESLint comparison figures are reports from projects, not benchmarks (*read*) · covers our angle: **full** · fetched 2026-10-14
- **Our delta:** the cost of enabling it alongside JS plugins and type-aware on one PR. A search found only vendor-reported monorepo numbers.

---

## Section 16 — Oxlint JS plugins and extensibility

### T16-01 · JS plugins (alpha) and custom rules strategy — Topic · ✅ written `docs/eslint-oxlint/pages/16-oxlint-js-plugins-and-extensibility/01-js-plugins-and-custom-rules.md`
- **Read this:** [JS Plugins](https://oxc.rs/docs/guide/usage/linter/js-plugins.html) · oxc.rs · alpha, API targets ESLint v9+, `jsPlugins` key, known-supported plugins such as cypress, playwright and sonarjs (*read*) · covers our angle: **full** for the bridge · fetched 2026-10-14
- **Also good:** [Writing JS Plugins](https://oxc.rs/docs/guide/usage/linter/writing-js-plugins.html) · oxc.rs · ESLint-compatible `create` versus `createOnce` (not faster yet, expected to be); a `RuleTester` based on ESLint's (*read*) · covers our angle: **none** for `createOnce` · fetched 2026-10-14
- **Also good:** [Oxlint JS plugins alpha](https://oxc.rs/blog/2026-03-11-oxlint-js-plugins-alpha) · overlookmotel and Cameron, oxc.rs blog, slug dated 2026-03-11 · conformance table (ESLint built-ins 100%, SonarJS 99.6%), no custom type-aware rules, Windows memory issues, tips to move formatting out of the linter (*read*) · fetched 2026-10-14
- **Our delta:** when to keep a custom rule in ESLint instead of porting it. The reserved-names list on our page omits `nextjs`.

---

## Section 17 — Oxlint fixes, ignores and diagnostics

### T17-01 · Fixes, ignore comments and diagnostics — Topic · ✅ written `docs/eslint-oxlint/pages/17-oxlint-fixes-ignores-and-diagnostics/01-fixes-ignores-and-diagnostics.md`
- **Read this:** [Automatic fixes](https://oxc.rs/docs/guide/usage/linter/automatic-fixes.html) · oxc.rs · `--fix` (safe), `--fix-suggestions`, `--fix-dangerously`, and how to combine them (*read*) · covers our angle: **partial** — our page names only safe `--fix` · fetched 2026-10-14
- **Also good:** [Inline ignore comments](https://oxc.rs/docs/guide/usage/linter/ignore-comments.html) · oxc.rs · `oxlint-disable`, `-enable`, `-disable-line`, `-disable-next-line`; `eslint-` forms also honoured; unused-comment reporting is off by default (*read*) · fetched 2026-10-14
- **Also good:** [Command-line interface](https://oxc.rs/docs/guide/usage/linter/cli.html) · oxc.rs · `--format` values, `--deny-warnings`, `--max-warnings` (*read*) · fetched 2026-10-14
- **Our delta:** diagnostics reading guide and a fix-mode policy for CI. Our claim that `.eslintignore` "may be respected" has no support in the pages fetched. A search found no good third-party piece on these flags.

---

## Section 18 — Coexistence: ESLint and Oxlint

### T18-01 · Running ESLint and Oxlint together — Topic · ✅ written `docs/eslint-oxlint/pages/18-coexistence-eslint-and-oxlint/01-dual-run-overlap-and-retirement.md`
- **Read this:** [Migrate from ESLint](https://oxc.rs/docs/guide/usage/linter/migrate-from-eslint.html) · oxc.rs · "Running Oxlint and ESLint together": run Oxlint first (`oxlint && eslint`); `eslint-plugin-oxlint` disables the overlap (*read*) · covers our angle: **full** for overlap · fetched 2026-10-14
- **Also good:** [eslint-plugin-oxlint](https://github.com/oxc-project/eslint-plugin-oxlint) · oxc-project, GitHub README · `oxlint.configs['flat/recommended']` for flat config, listed last; `buildFromConfigFile(path)` and `buildFromOxlintConfig(object)` read your Oxlint config; `buildFromConfigFile` is not supported for ESLint below 9 (*read*) · fetched 2026-10-14
- **Beyond the docs:** [How to Migrate from ESLint to Oxlint](https://www.hongkiat.com/blog/eslint-to-oxlint-migration-guide/) · Hongkiat Lim, updated 2025-11-21 · keeps ESLint for unsupported rules with `eslint-plugin-oxlint` and chains `npx oxlint && npx eslint` in one script (*read*) · fetched 2026-10-14
- **Our delta:** retiring ESLint, with a rollback switch. Our page never names `buildFromConfigFile`; it uses the static `flat/recommended` export, which exists. Move that spread to the end of the array.

---

## Section 19 — Migration paths

### T19-01a · Legacy to flat config — Topic · ✅ written `docs/eslint-oxlint/pages/19-migration-paths/01-legacy-flat-oxlint-and-phased.md`
- **Read this:** [Configuration Migration Guide](https://eslint.org/docs/latest/use/configure/migration-guide) · ESLint docs · plugins and parsers become imported objects; `globals` and `parserOptions` move under `languageOptions`; `@eslint/migrate-config` gives a starting point; `FlatCompat` for old shareable configs (*read*) · covers our angle: **full**, but it has no v10 content · fetched 2026-10-14
- **Also good:** [Migrate to v10.0.0](https://eslint.org/docs/latest/use/migrate-to-10.0.0) · ESLint docs · eslintrc no longer supported; Node 20.19+, 22.13+, 24+; new config lookup algorithm (*read*) · fetched 2026-10-14
- **Also good:** [New config system, part 2](https://eslint.org/blog/2022/08/new-config-system-part-2/) · Nicholas C. Zakas, ESLint blog, 2022-08-05 · the design reasons behind the change (*read*) · fetched 2026-10-14
- **Beyond the docs:** [ESLint v10: Flat Config Completion and JSX Tracking](https://www.infoq.com/news/2026/04/eslint-10-release/) · Daniel Curtis, InfoQ, 2026-04-01 · what teams still on `.eslintrc` must do before upgrading to v10, including `npx @eslint/migrate-config` (*read*) · fetched 2026-10-14
- **Our delta:** ordering (flat first, then Oxlint) and the `.eslintignore` cleanup. Change "ESLint 9+ APIs" to v10 (see stale list).

### T19-01b · ESLint to Oxlint and phased dual-stack — Topic · ✅ written `docs/eslint-oxlint/pages/19-migration-paths/01-legacy-flat-oxlint-and-phased.md`
- **Read this:** [Migrate from ESLint](https://oxc.rs/docs/guide/usage/linter/migrate-from-eslint.html) · oxc.rs · `npx @oxlint/migrate` converts a flat config; `--type-aware` and JS-plugin options; legacy `.eslintrc` must go through `@eslint/migrate-config` first (*read*) · covers our angle: **full** for the tool, **partial** for monorepo phasing · fetched 2026-10-14
- **Beyond the docs:** [How to Migrate from ESLint to Oxlint](https://www.hongkiat.com/blog/eslint-to-oxlint-migration-guide/) · Hongkiat Lim, updated 2025-11-21 · short steps: run `@oxlint/migrate`, then Oxlint, then add the lint script; handling unsupported rules (*read*) · fetched 2026-10-14
- **Our delta:** the phase plan for big monorepos and the gap triage after `@oxlint/migrate`.

---

## Section 20 — CI, monorepos and performance engineering

### T20-01 · CI, monorepos and lint performance — Topic · ✅ written `docs/eslint-oxlint/pages/20-ci-monorepos-and-performance-engineering/01-ci-monorepos-and-perf.md`
- **Read this:** [Setup CI and other integrations](https://oxc.rs/docs/guide/usage/linter/ci.html) · oxc.rs · detects GitHub Actions and turns on annotations; `--format=gitlab` for GitLab Code Quality; `--format` overrides (*read*) · covers our angle: **partial** — Oxlint only · fetched 2026-10-14
- **Also good:** [Multithread linting](https://eslint.org/blog/2025/08/multithread-linting/) · Francesco Trotta, ESLint blog, 2025-08-22 · `--concurrency` takes a number, `auto` or `off`; `auto` uses half the cores on large projects; Node API `concurrency` option needs cloneable options (*read*) · covers our angle: **none** — our page never mentions `--concurrency` · fetched 2026-10-14
- **Also good:** [Nested config files](https://oxc.rs/docs/guide/usage/linter/nested-config.html) · oxc.rs · monorepo pattern with a shared base (*read*) · fetched 2026-10-14
- **Also good:** [Typed linting performance](https://typescript-eslint.io/troubleshooting/typed-linting/performance/) · typescript-eslint.io · where typed-lint time goes (*read*) · fetched 2026-10-14
- **Our delta:** cache keys and cost budget per CI job. The ESLint `TIMING` variable is documented on the Custom Rules page (profiling the slowest rules), so a section on it is safe to add. A search found no good third-party source on ESLint CI tuning.

---

## Section 21 — Real-world workflows and recipes

### T21-01 · Bootstrap, migration and day-to-day — Topic · ✅ written `docs/eslint-oxlint/pages/21-real-world-workflows-and-recipes/01-bootstrap-migration-and-day-to-day.md`
- **Read this:** [Getting Started with ESLint](https://eslint.org/docs/latest/use/getting-started) · ESLint docs · `npm init @eslint/config` asks questions and writes `eslint.config.js` or `.mjs`; Node 20.19+, 22.13+ or 24+ (*read*) · covers our angle: **partial** — bootstrap only · fetched 2026-10-14
- **Also good:** [Migrate from ESLint](https://oxc.rs/docs/guide/usage/linter/migrate-from-eslint.html) · oxc.rs · the migration recipe, including running both tools (*read*) · fetched 2026-10-14
- **Beyond the docs:** [How to Migrate from ESLint to Oxlint](https://www.hongkiat.com/blog/eslint-to-oxlint-migration-guide/) · Hongkiat Lim, updated 2025-11-21 · the migrate, run and script steps with a note on unsupported rules; no full sample config or lint output (*read*) · fetched 2026-10-14
- **Our delta:** day-to-day recipes (new rule rollout, warning budgets) that no single upstream page covers. Replace `tseslint.config(` on line 70 with `defineConfig(`.
