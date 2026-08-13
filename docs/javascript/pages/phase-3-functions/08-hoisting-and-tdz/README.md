---
title: "08 · Hoisting and the temporal dead zone"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [Glossary: Hoisting](https://developer.mozilla.org/en-US/docs/Glossary/Hoisting), [`var`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/var), [`let`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/let), [`function`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/function), [`class`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/class), [Default parameters](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/Default_parameters), [Modules guide](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules), [ReferenceError: can't access lexical declaration before initialization](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Cant_access_lexical_declaration_before_init). Documentation-validated.

**Nothing is moved to the top of anything.** Entering a scope creates a binding for
every declaration in it *before* any of its code runs — and the only thing that
differs between `var`, `function`, `let`, `const`, `class` and `import` is whether
that binding starts out with a value in it.

That single question — *what went into the slot?* — produces `undefined` for
`var`, a callable function for a declaration, and a `ReferenceError` for the
lexical forms. The temporal dead zone is the third case, and it is a **stretch of
time**, not a region of source code.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The two-step scope entry](./01-the-two-step-scope-entry.md)** | Why nothing moves, MDN's four hoisting kinds, the one table, why `let` *is* hoisted, why the spec has no "hoisting", and the three error types |
| 2 | **[`var` and function declarations](./02-var-and-function-declarations.md)** | `var`'s declaration/initialisation split, redeclaration, value hoisting, function expressions failing differently, the `var`-plus-function precedence rule, and script vs module globals |
| 3 | **[The temporal dead zone](./03-the-temporal-dead-zone.md)** | The definition, why "temporal" is literal, MDN's execution-order example, when the zone closes, self-reference, and per-iteration bindings |
| 4 | **[`typeof`, error messages and why it's a feature](./04-typeof-and-why-its-a-feature.md)** | `typeof` no longer being a safe probe, the three engines' error strings, and the three things the TDZ buys you |
| 5 | **[Block functions and the parameter list](./05-block-functions-and-parameters.md)** | Block-level function declarations in strict vs Annex B sloppy mode, and the parameter list's own TDZ and parent-scope relationship to the body |
| 6 | **[Classes and circular imports](./06-classes-and-circular-imports.md)** | Class TDZ, the const-like inner binding, `extends` ordering, import hoisting, and circular ESM imports vs CommonJS |

## The one table

| Declaration | Binding at scope entry | Initialised to | Usable before its line? |
|---|---|---|---|
| `function` | yes | the finished function | **yes** |
| `var` | yes | `undefined` | yes, as `undefined` |
| `let`, `const`, `class` | yes | **nothing** | **no** — `ReferenceError` |
| `import` | yes | the exported binding | yes, side effects first |

## Phase gate

You are done with this topic when you can explain why
`var a = 1; function a() {}` logs `1`, why an arrow function defined above a `let`
may reference it but not be called there, and what
`ReferenceError: Cannot access 'x' before initialization` means when there is no
local `x` in the file.

## Where this connects

- [01 · Declarations, expressions and arrow functions](../01-declarations-expressions-arrows.md) — the declaration-vs-expression split this topic explains the timing of
- [02 · Parameters](../02-parameters/README.md) — the parameter list's own TDZ, measured there
- [06 · Closures](../06-closures/README.md) — why `let` gives a per-iteration binding and `var` does not
- [07 · Lexical scope and the scope chain](../07-lexical-scope/README.md) — *where* a binding lives; this topic is *when* it becomes usable

---

Start → [The two-step scope entry](./01-the-two-step-scope-entry.md)
