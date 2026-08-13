---
title: "05 · The prototype chain"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-13 against MDN — [Inheritance and the prototype chain](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Inheritance_and_the_prototype_chain), [`Object.create`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/create), [`Object.setPrototypeOf`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/setPrototypeOf). Documentation-validated.

**An object is some own properties plus a link to another object.** That is the
entire inheritance model — no classes underneath, nothing copied onto instances,
just a chain that property lookup walks until it finds a name or reaches `null`.

This is the topic that makes `class` stop being magic, so it comes before topic 06
deliberately.

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[How lookup walks the chain](./01-how-lookup-walks.md)** | `[[Prototype]]`, the four-step lookup, why a **miss** is the most expensive lookup, property shadowing on read, why every object has `toString`, and why `this` is the receiver rather than where the method lives |
| 2 | **[`prototype` vs `[[Prototype]]`](./02-prototype-vs-the-slot.md)** | The two things that share a name, what `new` really does, `class` as the same machinery, the `constructor` back-reference and how it breaks, and `Object.create` |
| 3 | **[Writing, shadowing and mutating the chain](./03-writing-and-mutation.md)** | Why a write never travels up, the shared-mutable-state trap, inherited setters as the exception, MDN's warning about `Object.setPrototypeOf`, and why chains should stay short |

## The distinction to get right first

| | `obj.[[Prototype]]` | `Fn.prototype` |
|---|---|---|
| What | internal slot, on **every** object | ordinary property, **only** on functions |
| Read with | `Object.getPrototypeOf(obj)` | `Fn.prototype` |
| Means | where lookup goes next **for this object** | what to give **instances** made with `new` |

`Object.getPrototypeOf(Fn)` is `Function.prototype` — *not* `Fn.prototype`. Those
are different objects, and mixing them up is the single biggest source of prototype
confusion.

## Phase gate

You are done with this topic when you can draw the chain for `new Box(1)`, say why
`Fn.prototype.items = []` is shared across instances while `Fn.prototype.count = 0`
is effectively not, and explain what `this` is inside a method found three levels up.

## Where this connects

- [01 · `__proto__` and null-prototype objects](../01-object-literals/04-proto-and-null-prototype.md) — the literal form that sets the link, and cutting the chain entirely
- [03 · `in` and `Object.hasOwn`](../03-existence-checks-and-delete/01-in-and-hasown.md) — `in` walks this chain; `hasOwn` does not
- [04 · Shallow vs deep copy](../04-shallow-vs-deep-copy/README.md) — every copy operation in that topic drops the link
- [Phase 3 · 03 · `this`](../../phase-3-functions/03-this/README.md) — the receiver rule, applied along a chain

---

Start → [How lookup walks the chain](./01-how-lookup-walks.md)
