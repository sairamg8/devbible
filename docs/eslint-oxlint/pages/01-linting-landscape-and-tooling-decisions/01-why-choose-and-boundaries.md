---
title: "Linting Landscape: Why Lint, Choosing Tools & Format Boundaries"
sidebar_label: "Linting Landscape"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09-08 against the Oxlint documentation —
> [Linter](https://oxc.rs/docs/guide/usage/linter.html),
> [Migrate from ESLint](https://oxc.rs/docs/guide/usage/linter/migrate-from-eslint) —
> [`eslint-plugin-oxlint`](https://github.com/oxc-project/eslint-plugin-oxlint), and the
> ESLint blog, [*Deprecation of formatting rules*](https://eslint.org/blog/2023/10/deprecating-formatting-rules/).
> Documentation-validated; **no sandbox run, no timings**.
> Validated: 2026-09-08 · claims + output provenance · session 8b9ca9ad

# 🔍 Linting Landscape: Why Lint, Choosing Tools & Format Boundaries

Covers syllabus **§1.1 Why Lint at All**, **§1.2 Choosing a Linter**, and **§1.3 Lint vs Format Boundary**.

## 1. Concept & Under-the-Hood Mechanics

### 1.1 Why Lint at All

Linting is **static pattern analysis** over a program’s AST (and sometimes types or a module graph). It is not a test runner and not a type checker:

| Layer | What it proves | What it misses |
| --- | --- | --- |
| **Types (`tsc` / type-aware lint)** | Values fit declared shapes; many API misuse cases | Hook order bugs, a11y anti-patterns, import cycles, stylistic policy |
| **Unit/integration tests** | Behavior for exercised paths | Unexercised branches, whole-repo graph issues, editor-time feedback |
| **Lint** | Known bug patterns, framework rules, import policy, a11y heuristics | Full semantic correctness of business logic |

High-value lint catches things types and tests routinely miss: `react-hooks/rules-of-hooks`, floating promises (with type-aware rules), `import/no-cycle`, jsx-a11y keyboard traps, accidental `eval` / secret-shaped strings (security plugins).

**Signal vs noise.** Correctness rules (undefined vars, broken hooks, unsafe regex) earn trust. Style nits (quote style, trailing commas) fight the formatter and train people to ignore the Problems panel. Tools that default to *correctness-first* (Oxlint’s category model) adopt faster than “enable everything.”

**Feedback loop cost.** Lint runs in three places with different latency budgets:

1. **Editor** — sub-second on the open file; must not freeze the UI.
2. **Pre-commit** — seconds on staged files; if it takes minutes, people use `--no-verify`.
3. **CI** — whole tree; slow lint becomes a PR queue bottleneck.

A linter that is “more complete” but 50× slower can *reduce* overall quality if developers disable hooks or skip CI locally.

### 1.2 Choosing a Linter (Decision Tree)

As of **2026**, the practical decision space for JS/TS frontend/fullstack repos:

| Choice | When it fits | Tradeoff |
| --- | --- | --- |
| **ESLint-only** | Irreplaceable custom rules, obscure plugins, or plugin APIs Oxlint cannot host yet | Slowest on large trees; richest ecosystem |
| **Oxlint-only** | Greenfield or greenfield-like; native plugins cover the ruleset; CI time hurts | Gaps (e.g. security-oriented ESLint plugins) may still matter |
| **Oxlint + ESLint** | Large legacy monorepos (recommended incremental path) | Two configs to govern; need overlap disabled |
| **Biome (or all-in-one)** | Team wants one binary for format+lint and accepts its rule set | Weaker escape hatch for odd ESLint plugins than Oxlint’s dual-run story |
| **Vite+ / unified toolchain** | Team standardizes on Oxc-family tools (Oxlint + Oxfmt, etc.) as a productized stack | Couples lint choice to broader toolchain adoption |

Oxlint’s own docs frame it as: prefer Oxlint as the dedicated linter; stay ESLint-only for unsupported edge-case plugin behavior; use dual-run while migrating large repos. The speed claim is Oxlint's own and it is specific — *"Our benchmarks show Oxlint is 50 to 100 times faster than ESLint"* — but it is **their** benchmark, not yours: always measure on *your* tree and rule set, because the number moves with type-aware mode, JS plugins and disk cache.

### 1.3 Lint vs Format Boundary

**Formatters** (Prettier, Oxfmt, Biome format) own *layout*: whitespace, wrapping, quote style, trailing commas. They parse (or partially parse) and reprint.

**Linters** own *correctness and API policy*: unused bindings, hooks rules, security patterns, import boundaries. When both rewrite style, you get thrashing: Prettier formats a line, ESLint `--fix` restyles it, next save undoes it.

Historical ESLint “layout” rules were deprecated in October 2023 and moved out to **`@stylistic/eslint-plugin-js`** and **`@stylistic/eslint-plugin-ts`** (eslint.style). ESLint's own recommendation in that post is a dedicated formatter — it names **Prettier** and **dprint**. The durable pattern:

1. One formatter is source of truth for style.
2. `eslint-config-prettier` (or equivalent) turns off ESLint rules that conflict.
3. Lint autofix is for *semantic* fixes, not indentation wars.

---

## 2. Real-World Engineering Scenario

**Scenario: 12-minute ESLint job on a monorepo, hooks disabled, quality drops.**

A company monorepo has ~4k TS files, `eslint-plugin-import` with cycle detection, and type-aware `typescript-eslint` on every package. CI lint averages 12 minutes; pre-commit runs full `eslint .` and takes ~4 minutes on laptops. Developers start committing with `--no-verify`. Hooks regressions ship for weeks because the only reliable gate was the slow CI job people force-merge around.

The fix is not “more rules.” It is a **tooling decision**:

1. Add **Oxlint** for correctness + native import/react/typescript coverage → ~tens of seconds on the same tree.
2. Keep **ESLint** only for residual custom + security plugins.
3. Use `eslint-plugin-oxlint` so ESLint does not re-run rules Oxlint already owns.
4. Pre-commit runs `oxlint` (and maybe ESLint on staged paths only).

PR velocity recovers; actual bug-pattern coverage *increases* because people stop bypassing the gate. Separately, a long-running bikeshed about single vs double quotes ends when Prettier is declared the only style authority and stylistic ESLint rules are removed.

---

## 3. Production-Grade Code Example

**Dual-run scripts (recommended large-repo shape):**

```json
{
  "scripts": {
    "lint": "oxlint && eslint .",
    "lint:ox": "oxlint",
    "lint:eslint": "eslint .",
    "lint:fix": "oxlint --fix && eslint . --fix",
    "format": "prettier --write ."
  }
}
```

**Decision comment block in repo docs (record the choice):**

```markdown
## Lint policy (2026)

- **Oxlint**: default correctness, React/TS/import native rules, PR fail-fast.
- **ESLint**: custom rules + `eslint-plugin-security` / `eslint-plugin-no-secrets` only.
- **Prettier**: sole formatter. No ESLint stylistic rules. No `eslint-plugin-prettier` dual-run.
```

**Minimal “Oxlint-only greenfield” scripts:**

```json
{
  "scripts": {
    "lint": "oxlint",
    "lint:fix": "oxlint --fix"
  }
}
```

**Kill style conflict (ESLint + Prettier):**

```js
// eslint.config.js (excerpt)
import prettier from 'eslint-config-prettier';

export default [
  // ... recommended configs ...
  prettier, // last: turns off formatting rules that fight Prettier
];
```

---

## Gotchas

### ⚠️ Treating lint as a substitute for tests or types
Lint finds *patterns*. It will not prove checkout totals or race-free concurrent edits. Type-aware lint narrows the gap for async misuse; it still is not a full program proof.

### ⚠️ Enabling “all rules” on day one
`eslint:all`, every Unicorn rule, every pedantic Oxlint category at once produces thousands of findings. Teams disable the linter mentally. Prefer correctness → expand deliberately.

### ⚠️ `eslint-plugin-prettier` as the formatter
Running Prettier *inside* ESLint doubles work and muddies “who owns style.” Prefer Prettier (or Oxfmt) as a separate step + `eslint-config-prettier`.

### ⚠️ Choosing Biome *or* ESLint by blog post, not inventory
List plugins you actually need (`security`, custom AST rules, Next flat configs). All-in-one tools win when the inventory is small; dual Oxlint+ESLint wins when the inventory is large but most rules are “common.”

### ⚠️ Ignoring editor cost
A type-aware ESLint projectService on a huge monorepo can make save lag. Scope type-aware configs to `src/**/*.{ts,tsx}` and keep Node scripts on cheaper configs (see [language options](../04-eslint-language-options-globals-and-parsing/01-language-options-and-file-targeting.md)).

### ⚠️ No written decision for dual-run
Without a rule-ownership matrix, two tools report the same issue at different severities. Document owners (see [coexistence](../18-coexistence-eslint-and-oxlint/01-dual-run-overlap-and-retirement.md)).

---

## Interview questions

**★ You are asked to make lint faster on a 4,000-file TypeScript monorepo. Why is "switch to Oxlint" not automatically the answer?**
Because the question is really about *rule inventory*, not speed. Oxlint's own docs are explicit that you should *"stay on ESLint if a specific missing behavior still blocks migration"* — a local custom plugin, a security rule with no native port, a plugin the JS Plugins system does not host. The honest answer inventories the rules the repo actually depends on, then picks: Oxlint-only if the inventory is covered, dual-run if most rules are common but a few are irreplaceable, ESLint-only if the blockers are load-bearing. Answering with a benchmark number and no inventory is the mistake this whole topic exists to prevent.

**★ In a dual-run setup, what stops the two linters reporting the same problem twice, and where does it go in the config?**
`eslint-plugin-oxlint` — its own description is *"Turn off all rules already supported by oxlint"*. It ships presets both by plugin (`flat/react`, `flat/typescript`, `flat/import`, `flat/jsx-a11y`, …) and by Oxlint category (`flat/correctness`, `flat/pedantic`, `flat/style`, `flat/restriction`, `flat/suspicious`). In flat config it goes **last** in the exported array, for the same reason `eslint-config-prettier` does: a config that turns rules *off* only wins if nothing after it turns them back on.

**★ Why does the recommended order run Oxlint first and ESLint second, rather than in parallel or the other way round?**
Oxlint's migration guide puts it as *"run Oxlint first to catch errors early, then fall back to ESLint only if needed."* The fast tool fails the build in seconds on the errors it can see, so the slow tool never runs for the majority of bad pushes. Reversing the order pays ESLint's full cost before learning anything, and running them in parallel pays it always. The gain is not the linting — it is the developer waiting.

**★ ESLint deprecated its formatting rules. What exactly happened to them, and what is the practical config consequence?**
They were deprecated in October 2023 and moved to `@stylistic/eslint-plugin-js` and `@stylistic/eslint-plugin-ts` at eslint.style; ESLint's own post recommends a dedicated formatter instead, naming Prettier and dprint. Practically: pick one formatter as the sole style authority, add `eslint-config-prettier` last so no ESLint rule fights it, and keep lint autofix for semantic fixes. The failure mode this closes is thrashing — the formatter writes a line, `eslint --fix` rewrites it, the next save undoes that.

**★ A team proposes `eslint-plugin-prettier` so there is "one command". What is wrong with it?**
It runs Prettier *inside* ESLint, so every formatting difference becomes a lint error with a fix, and the file is parsed and reprinted through two pipelines instead of one. It is slower, and worse, it destroys the ownership boundary this topic is built on: with it, "who owns style" has no answer, and every formatting question becomes a lint-severity question. Prefer Prettier (or Oxfmt) as a separate step plus `eslint-config-prettier`.

**★ When is an all-in-one tool like Biome the right call over Oxlint + ESLint?**
When the plugin inventory is small. All-in-one tools win by collapsing format and lint into one binary and one config, and that trade is good exactly when you are not relying on the long tail of the ESLint plugin ecosystem. The moment the inventory contains a custom AST rule or an unported security plugin, the dual-run story — where ESLint stays as the escape hatch — is the stronger position.

