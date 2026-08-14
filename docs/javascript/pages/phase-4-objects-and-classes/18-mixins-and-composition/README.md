---
title: "18 · Mixins and composition over inheritance"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08-14 against MDN — [Classes](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes), [`extends`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/extends), [`super`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/super), [`Object.assign()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/assign), [`Symbol.hasInstance`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/hasInstance). Documentation-validated; **no timings**.

Every language says "prefer composition over inheritance". **JavaScript has four specific reasons
it matters more here** — and the second half of this topic is what to do instead, which is a real
question with three real answers.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[Why deep hierarchies fail in JavaScript specifically](./01-why-deep-hierarchies-fail-here.md)** | One parent and no runtime interfaces, nothing enforcing abstract methods, the fragile base class made worse by field-initialisation order, duck typing paying no dividend for the hierarchy — plus what depth costs, when `extends` is still right, and the React mixins → HOCs → hooks arc |
| 2 | **[The three patterns, and choosing](./02-the-three-patterns.md)** | Prototype copying and its three problems, the subclass-factory mixin that fixes them (and what it still does not fix), composition as the default, a comparison table, and how to read code that already uses all three |

## Phase gate

You are done with this topic when you can say **why a mixin copied onto a prototype cannot use
`super`**, and **name the test for a hierarchy that has gone wrong**.

## Where this connects

- [09 · `extends` and `super`](../09-extends-and-super/README.md) — construction order and the home-object rule both chunks depend on
- [06 · `class`](../06-class/README.md) — what `class` desugars to
- [11 · Property descriptors](../11-property-descriptors.md) — why copied methods are enumerable and class methods are not
- [13 · `instanceof` and `Symbol.hasInstance`](../13-instanceof-and-hasinstance/README.md) — making a mixin recognisable
- [14 · Object creation patterns](../14-object-creation-patterns/01-factory-constructor-class.md) — the factory side of the same argument
- [Phase 8 · 03 · Errors and subclasses](../../phase-8-modules-errors/03-error-and-subclasses/README.md) — the case where inheritance is simply correct

---

Start → [Why deep hierarchies fail in JavaScript specifically](./01-why-deep-hierarchies-fail-here.md)
