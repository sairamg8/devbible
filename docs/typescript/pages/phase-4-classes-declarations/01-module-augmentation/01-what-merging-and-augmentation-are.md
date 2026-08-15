---
title: "What merging and augmentation are"
sidebar_label: "01 · What merging and augmentation are"
sidebar_position: 1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Declaration Merging* —
> *Merging Interfaces*, *Module Augmentation*). The `Observable` example and the
> `Document.createElement` overload set are quoted verbatim from that page, and
> the merge-ordering rules are quoted rather than paraphrased. **No console
> block** — no sandbox run covers this phase.

## Interfaces are open

Everything in this topic follows from one property. Declare a `type` alias twice
and you get an error. Declare an **interface** twice and TypeScript combines them:

```ts
interface Box { height: number }
interface Box { width: number }

const b: Box = { height: 10, width: 20 };   // both required
```

There is one `Box`, with two members. No one had to say "extend" — the second
declaration *reopened* the first.

This is not an accident of the syntax. It is the mechanism that lets `lib.dom.d.ts`
describe `Window` across many files, and it is what makes the rest of this topic
possible.

## The merge rules, precisely

The handbook is specific, and the details matter more than they look.

**Non-function members must not conflict.**

> Non-function members of the interfaces should be unique. If they are not
> unique, they must be of the same type.

So a second declaration adding `height: number` to a `Box` that already has
`height: number` is fine — redundant, but legal. Adding `height: string` is an
error. **You cannot use merging to change a member's type**, only to add members.
That single sentence rules out most of what people first try to do with it.

**Function members become overloads.**

> Each function member of the same name is treated as describing an overload of
> the same function.

Two declarations of `send(x: string)` and `send(x: Buffer)` do not conflict —
they produce one `send` with two overloads.

**Ordering: later declarations come first.** Within one interface the members
keep their written order, but a *later* interface's group is placed **above** an
earlier one's in the merged overload list. That is the opposite of what most
people assume, and it is what makes augmentation useful: your addition is
consulted before the library's general case.

⚠️ **The one exception, and it is a real one:** signatures whose parameter is a
**single string literal type** (not a union) are bubbled toward the top of the
merged list. The handbook's own illustration:

```ts
interface Document {
  createElement(tagName: "canvas"): HTMLCanvasElement;
  createElement(tagName: "div"): HTMLDivElement;
  createElement(tagName: "span"): HTMLSpanElement;
  createElement(tagName: string): HTMLElement;
  createElement(tagName: any): Element;
}
```

The specialised literal signatures come first, then `string`, then `any`. Without
that rule, `document.createElement('div')` would match the general `string`
overload — declared in a different file — and hand you an `HTMLElement` instead
of an `HTMLDivElement`. Every `createElement` call you have ever written depends
on this.

## From merging to augmenting

Merging within one file is a curiosity. Merging into **someone else's** file is
the feature. The handbook's example, verbatim:

```ts
// observable.ts
export class Observable<T> {
  // ... implementation left as an exercise for the reader ...
}

// map.ts
import { Observable } from "./observable";

declare module "./observable" {
  interface Observable<T> {
    map<U>(f: (x: T) => U): Observable<U>;
  }
}

Observable.prototype.map = function (f) {
  // ... another exercise for the reader
};

// consumer.ts
import { Observable } from "./observable";
import "./map";

let o: Observable<number>;
o.map((x) => x.toFixed());
```

Read it in three beats, because each is load-bearing:

1. **`import { Observable } from "./observable";`** — the augmenting file must be
   a **module**. This import is what makes it one. (Chunk 03 is largely about
   what happens when it is not.)
2. **`declare module "./observable" { … }`** — reopen that module and merge an
   `interface Observable<T>` into the class's instance type. A class declaration
   creates a type, and interfaces merge with it.
3. **`Observable.prototype.map = …`** — the **runtime** half. `declare module`
   only describes; it moves no code.

And in the consumer, `import "./map";` — a side-effect import whose entire job is
to make the augmentation (and the prototype assignment) load. Delete that line
and `o.map` stops existing, in both worlds at once.

## 🔴 The type half and the runtime half are separate

Worth stating on its own, because it is the mistake that produces a runtime
`TypeError` on code that compiled cleanly.

`declare module` is a **claim about types**. It emits nothing. If you augment
`Observable` with `map` and never assign `Observable.prototype.map`, the compiler
is satisfied and the program crashes at the call.

The reverse is just as common: a library that really does add the method at
runtime, with nobody having written the augmentation, gives you
`Property 'map' does not exist` on code that works perfectly.

**Both halves, always.** When you are augmenting types for a package that already
does its own runtime patching — which is the usual case, as in chunk 02 — your
job is only the type half, and the runtime half is the library's. Knowing which
half you owe is the whole skill.

## Why an interface and not a type alias

```ts
declare module "./observable" {
  type Observable<T> = { … };   // ❌ TS2300: Duplicate identifier
}
```

A type alias is a closed statement — one name, one definition. Augmentation
*requires* the openness of `interface` and `namespace`. This is the concrete
answer to "does it ever actually matter which I pick?", and it is why library
authors who want to be extensible publish interfaces.

⚠️ It follows that **you cannot augment a library that exports its shapes as type
aliases.** Nothing you write can reopen them, and the options narrow to
`declare module` on a wrapper of your own, a fork, or a pull request. Worth
checking before promising an augmentation will work.

---

← [Overview](./README.md) · Next → [02 · Augmenting a package](./02-augmenting-a-package.md)
