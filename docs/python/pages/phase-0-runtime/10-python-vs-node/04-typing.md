---
title: "Both languages erase their types before running, and both now run the annotated file directly — the difference is which checker you choose and whether anything validates at the boundary"
sidebar_label: "4 · The typing story"
sidebar_position: 7
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 against the Node.js
> [TypeScript support](https://nodejs.org/api/typescript.html) documentation, the Python
> [`typing`](https://docs.python.org/3.14/library/typing.html) and
> [`annotationlib`](https://docs.python.org/3.14/library/annotationlib.html) docs,
> [What's New in Python 3.14](https://docs.python.org/3.14/whatsnew/3.14.html),
> [PEP 649](https://peps.python.org/pep-0649/) and
> [PEP 484](https://peps.python.org/pep-0484/).
> Targets: **Python 3.14.7** · **Node.js 24 LTS / 26**.

**The received wisdom — "TypeScript is a typed language, Python is a dynamic one with
optional hints bolted on" — was true in 2018 and is not a useful description of either
today. Both languages have types that are erased before the code runs and enforce nothing
at runtime. Both now execute an annotated source file directly with no build step. Both
rely on a separate checker you must run yourself in CI. The real differences are three:
TypeScript's type system is more expressive and its ecosystem's type coverage is more
uniform; Python has two competing checkers rather than one canonical compiler; and
Python's runtime-validation story — Pydantic — is a first-class part of how backends are
actually written, in a way that has no equal-status Node counterpart.**

## The thing people get wrong: neither one checks at runtime

```python
def add(a: int, b: int) -> int:
    return a + b

add("x", "y")     # returns "xy". No error. Ever.
```

```ts
function add(a: number, b: number): number { return a + b; }
// @ts-expect-error — tsc rejects this at check time...
add("x" as any, "y" as any);   // ...and it still runs, returning "xy"
```

Both erase. The annotations are documentation that a *separate program* — `mypy`,
`pyright`, or `tsc` — reads. Neither runtime enforces anything. Anyone who says "Python
types don't do anything at runtime" as a criticism has not noticed that TypeScript's do
not either; the type information is gone before V8 sees the file.

Where Python is actually different is that its annotations are **available at runtime as
objects**, because they are ordinary expressions stored on the function. That is what
makes Pydantic and FastAPI possible, and TypeScript has nothing comparable — its types
are gone, so a framework cannot read them. This is a genuine Python advantage and it is
usually described backwards.

```python
from typing import get_type_hints

def create_user(name: str, age: int) -> dict: ...

get_type_hints(create_user)     # {'name': <class 'str'>, 'age': <class 'int'>, ...}
```

## The build-step story, now that both have closed it

**Node.** Type stripping — replacing TypeScript syntax with whitespace, no type checking,
no source maps needed — was added in **v22.6.0**, enabled by default in **v23.6.0 and
v22.18.0**, and became stable in **v25.2.0 and v24.12.0**. `--experimental-transform-types`
was removed in **v26.0.0**. So `node app.ts` simply works on a current LTS.

The catch is that stripping is not compiling, and it rejects any syntax that would need
code generation:

```ts
enum Color { Red, Green }        // ❌ ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX
namespace A { export let x = 1 } // ❌ runtime namespace — rejected
class C { constructor(private x: number) {} }  // ❌ parameter properties
@decorator class D {}            // ❌ decorators, pending native JS support

namespace TypeOnly { export type A = string }  // ✅ type-only namespace is fine
```

The recommended `tsconfig.json` for this world sets `erasableSyntaxOnly: true`, which
makes `tsc` itself reject the syntax Node cannot strip — so CI catches it rather than
production. Alongside `noEmit: true`, `verbatimModuleSyntax` and
`rewriteRelativeImportExtensions`, that is the modern Node TypeScript setup: **`tsc` is a
checker, not a compiler.**

**Python** never had a build step, and 3.14 improved the runtime side of annotations
rather than removing a step. **PEP 649 and PEP 749 made annotation evaluation lazy**:
annotations are stored in an "annotate function" and evaluated only when something asks
for them. The practical wins:

```python
# Forward references without quotes and without `from __future__ import annotations`:
class Node:
    def add_child(self, child: Node) -> Node: ...   # ✅ works in 3.14

# And introspection can ask for whichever form it needs:
from annotationlib import get_annotations, Format
get_annotations(func, format=Format.STRING)      # the source text
get_annotations(func, format=Format.FORWARDREF)  # unresolved names as ForwardRef
```

The net effect: **the two languages have converged on the same shape.** Write annotated
source, run it directly, check it separately in CI.

## Gotchas

### Believing annotations validate anything
**Symptom.** A handler declared `age: int` receives `"twenty"` from JSON and crashes three
layers down in arithmetic.
**Cause.** Annotations are erased at runtime in both languages. Nothing coerces, nothing
checks.
**Fix.** Validate explicitly at the boundary — Pydantic in Python, `zod` in Node — and
treat every external input as `unknown` until it has been through the validator:

```python
user = CreateUser.model_validate(request_json)   # raises ValidationError on bad input
```

### `enum` in a `.ts` file that Node runs directly
**Symptom.** `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` at startup, in production, on a file that
compiled fine locally with `ts-node` or `tsx`.
**Cause.** Type stripping cannot generate the runtime object an `enum` needs; a full
transpiler could. Your local runner was a full transpiler.
**Fix.** Use a `const` object with a derived type, and turn on `erasableSyntaxOnly` so
`tsc` catches it in CI:

```ts
const Color = { Red: 'red', Green: 'green' } as const;
type Color = typeof Color[keyof typeof Color];
```

### Assuming `from __future__ import annotations` is still needed in 3.14
**Symptom.** Confusing advice in older material, and libraries that break under it because
they read `__annotations__` expecting objects and get strings.
**Cause.** That future import made *all* annotations strings — a blunt instrument that
solved forward references and broke runtime introspection. PEP 649's lazy evaluation is
the proper fix and is the default in 3.14.
**Fix.** On 3.14, drop the future import from new code and use `annotationlib` when you
need a specific form. Keep it only where you still support older versions, and be aware
that Pydantic and similar libraries have version-specific handling for both worlds.

## Interview questions

**Q. Python has "optional" types and TypeScript has "real" ones. Is that fair?**
A. No, and it is the most common misconception in this comparison. Both are erased before
execution and neither enforces anything at runtime — TypeScript's types are gone before
V8 sees the file, just as Python's are ignored by CPython. Both depend on a separate
checker in CI. TypeScript's system is more expressive and its ecosystem coverage is more
uniform, which is the real difference; "real versus optional" is not.

**Q. What can Python do with types that TypeScript cannot?**
A. Read them at runtime. Python annotations are objects available through
`get_type_hints`, which is what lets Pydantic validate data and FastAPI generate an
OpenAPI schema from the same declaration you type-check. TypeScript's types do not exist
at runtime, so `zod` has to invert it: you write a schema and infer the type from it.

**Q. What did Python 3.14 change about annotations?**
A. PEP 649 and PEP 749 made evaluation lazy — annotations are stored in an annotate
function and computed on demand. That means forward references work without quotes or the
`__future__` import, and `annotationlib` lets a tool ask for annotations as values, as
`ForwardRef`s, or as source strings.

**Q. Does Node still need a build step for TypeScript?**
A. Not to run code. Type stripping has been on by default since v22.18.0 / v23.6.0 and
stable since v24.12.0. But stripping does not type-check and it rejects syntax that needs
code generation — `enum`, runtime `namespace`, parameter properties, decorators. So you
still run `tsc --noEmit` in CI, ideally with `erasableSyntaxOnly` so it flags the syntax
Node will refuse.


---

← Prev: [Finding it, and the other traps](03c-finding-it.md) · Index: [Python vs Node](README.md) · Next → [Checkers and validation](04b-checkers-and-validation.md)

{/* FOOTER */}
