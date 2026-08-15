---
title: "01 · Stack, heap, and what a variable holds"
sidebar_label: "01 · Stack and heap"
sidebar_position: 1
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-15 against MDN — [Memory management](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Memory_management), [JavaScript data types and data structures](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Data_structures), [Equality comparisons and sameness](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Equality_comparisons_and_sameness), [`structuredClone()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/structuredClone), [`Object.freeze()`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/freeze) — and ECMAScript [§ ECMAScript Language Types](https://tc39.es/ecma262/multipage/ecmascript-data-types-and-values.html#sec-ecmascript-language-types). Documentation-validated; **no timings, no console blocks**.

⚠️ **Values versus references is Phase 1 material**
([1 · 02 · References vs values](../../phase-1-values-and-coercion/02-references-vs-values.md)),
and **reachability and mark-and-sweep are Master material**
([04 · Reachability](../04-leaks/01-reachability.md)). **This page is the model in between:**
where things live, what a variable actually holds, and why "how big is this object" is almost
never the question you want answered.

## The two regions, and what the language guarantees

MDN describes memory management in terms of a **stack** — static, known-size data associated with
executing code — and a **heap**, where objects and everything dynamically sized live.

| | Stack | Heap |
|---|---|---|
| Holds | primitives, references, call frames | objects, arrays, functions, closures |
| Size known | at compile time | at runtime |
| Lifetime | the call frame | until unreachable |
| Reclaimed by | popping the frame — free | the **garbage collector** |
| You control it by | nothing | **what you keep referencing** |

🔴 **This is a mental model, not a specification.** The language defines no stack and no heap; an
engine may keep an object entirely in registers, store a small integer without allocating, share
one representation for identical strings, or move objects as it collects. **Reason with the model,
and never write code that depends on it** — that is where invented performance claims come from.

**What *is* specified, and is what actually matters:** the eight language types, that objects have
identity, and that garbage collection is by reachability from roots.

## A variable holds a value or a reference — never an object

```js
const a = { n: 1 };
const b = a;          // the REFERENCE is copied; there is still one object
b.n = 2;
a.n;                  // 2
```

Everything people find surprising about object handling follows from that one line:

**`=` copies what the variable holds.** For a primitive that is the value; for an object it is the
reference. There is no deep copy anywhere in the language's assignment.

**Passing an argument is the same copy.** So a function can *mutate* what you passed but cannot
*replace* it:

```js
function reset(o)  { o.n = 0; }      // ✅ visible to the caller — same object
function replace(o){ o = { n: 0 }; } // ❌ rebinds the parameter only
```

**Equality compares identity, not contents.** `{a:1} === {a:1}` is `false` because they are two
objects; two variables are `===` only when they hold the same reference. Value-comparison is
something you implement — [Phase 1 · 14 · Value equality](../../phase-1-values-and-coercion/14-value-equality.md).

**`const` freezes the binding, not the object.** `const` means the variable cannot be reassigned;
the object it points at is as mutable as ever
([Phase 1 · 07 · `const` is not immutable](../../phase-1-values-and-coercion/07-const-is-not-immutable.md)),
and `Object.freeze` is shallow
([Phase 4 · 12 · Freeze and seal](../../phase-4-objects-and-classes/12-freeze-and-seal/README.md)).

## Copying: three depths, three costs

```js
const shallow = { ...original };              // one level; nested objects are SHARED
const deep    = structuredClone(original);    // a real deep copy
const json    = JSON.parse(JSON.stringify(original));   // ⚠️ lossy
```

| | Shares nested objects | Handles cycles | Loses |
|---|---|---|---|
| `{ ...o }` / `Object.assign` | 🔴 yes | n/a | nothing — but it is one level deep |
| `structuredClone` | no | ✅ yes | functions, DOM nodes, prototypes (throws on the unclonable) |
| `JSON` round-trip | no | ❌ throws | `undefined`, functions, `Symbol`, `Date` → string, `Map`/`Set`, `NaN`/`Infinity` → `null` |

🔴 **A shallow copy of an object with nested state is the aliasing bug people ship most often**:
the copy looks independent, and editing `copy.address.city` changes the original too. The full
comparison is
[Phase 4 · 04 · Shallow vs deep copy](../../phase-4-objects-and-classes/04-shallow-vs-deep-copy/README.md).

⚠️ **`structuredClone` also *duplicates memory*.** Deep-copying a large structure to "be safe"
doubles it, and if the copy is then kept alive you have doubled the program's footprint for a
guarantee that a `Object.freeze` or a discipline might have given for nothing.

## What a reference costs

Almost nothing to store, and potentially everything to keep.

🔴 **A reference is a handle; its cost is not its own size but what it prevents from being
collected.** One live reference to the root of a graph keeps the entire graph alive — the
reachability rule from [04 · Reachability](../04-leaks/01-reachability.md).

That reframes every "is this expensive?" question:

| The question people ask | The question that matters |
|---|---|
| "How big is this object?" | "**How long is it kept, and by whom?**" |
| "Should I null this out?" | "Is anything else still pointing at it?" |
| "Does this copy cost memory?" | "Does the copy *outlive* the original?" |

**A large object used briefly and dropped is cheap.** A small object stored in a module-level
`Map` for the life of the page is not, especially if it references a DOM subtree.

## Two vocabulary items you will need

The profiler in **12 · Finding a leak** *(not written yet)* uses these constantly, and they are
worth having before you open it:

- **Shallow size** — the memory the object itself occupies.
- **Retained size** — what would be freed if it were collected: the object *plus* everything only
  it keeps alive.

**Retained size is the number that matters**, and it is why a 40-byte closure can be responsible
for megabytes. Shallow size tells you what an object weighs; retained size tells you what it is
holding.

## Primitives are copied, immutable, and cheap — with two caveats

```js
let s = 'hello';
s.toUpperCase();      // returns a NEW string; s is unchanged
s[0] = 'H';           // silently does nothing (non-strict); throws in strict mode
```

Strings and numbers cannot be mutated, so passing them around is always safe. Two things to keep
in mind:

**Building a string in a loop allocates.** Each concatenation conceptually produces a new string;
engines optimise this heavily, but assembling megabytes by repeated `+=` is a pattern to replace
with an array and one `join`.

**A primitive can still keep something alive indirectly** — as a key in a `Map` whose *value* is
huge, for instance. The primitive is cheap; the entry is not, and a `Map` keyed by string never
releases entries on its own ([04 · The four leaks](../04-leaks/02-the-four-leaks.md)).

## Gotchas

**Symptom: editing a "copy" changed the original.**
Cause — a shallow copy; nested objects are shared.
Fix — `structuredClone` for a real deep copy, or copy the nested level you actually change.

**Symptom: `structuredClone` throws on an object that looks ordinary.**
Cause — it contains a function, a DOM node or a class instance whose prototype cannot be cloned.
Fix — clone the data, not the behaviour; extract a plain-object form first.

**Symptom: a `Date` came back as a string after a round trip.**
Cause — `JSON.parse(JSON.stringify(x))`.
Fix — `structuredClone`, which preserves `Date`, `Map`, `Set` and cycles.

**Symptom: `const` did not prevent the object being changed.**
Cause — `const` binds the variable, not the value.
Fix — `Object.freeze` for one level, and remember it is shallow.

**Symptom: reassigning a parameter had no effect outside the function.**
Cause — the reference was copied on the way in.
Fix — mutate the object, or return the new value.

**Symptom: two objects with identical contents are not `===`.**
Cause — equality compares identity.
Fix — compare fields, or a canonical serialisation.

**Symptom: memory grows even though every object is small.**
Cause — the count and the lifetime, not the size — usually a long-lived `Map` or array.
Fix — think in retained size; evict, or use a weak collection where the key is an object.

## Interview questions

**★ What is on the stack and what is on the heap?**
As a model: primitives, references and call frames on the stack; objects, arrays, functions and
closures on the heap. It is a model — the language specifies neither, and engines may do something
quite different.

**★ What does a variable holding an object actually contain?**
A reference. Assignment and argument passing copy that reference, so two variables can name one
object — which is why a function can mutate what you passed but not replace it.

**★ What does a reference cost?**
Almost nothing to store, and everything it retains. One live reference to a graph's root keeps the
whole graph alive, which is why the useful question is "how long is it kept" rather than "how big
is it".

**★ Shallow size or retained size?**
Retained. Shallow size is the object itself; retained size is what would be freed with it — the
number that explains why a tiny closure can hold megabytes.

**★ Which deep copy would you use?**
`structuredClone` — it handles cycles, `Date`, `Map` and `Set`, and throws on things it cannot
clone rather than silently mangling them, which the `JSON` round trip does.

**★ Does `const` make an object immutable?**
No — it prevents reassigning the binding. `Object.freeze` freezes one level of the object itself.

**Why is `{a:1} === {a:1}` false?**
Object equality is identity. They are two distinct objects, so they are not the same reference.
