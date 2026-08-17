---
title: "The oddities, and the ones you write yourself"
sidebar_label: "05 · The oddities"
sidebar_position: 5
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Utility Types* —
> `NoInfer`, `ThisType`, and the intrinsic string manipulation types), whose
> `createStreetLight` and `makeObject`/`ObjectDescriptor` examples and every
> explanatory sentence quoted here are **verbatim**, and *Template Literal Types*
> for where the intrinsics are documented. **No console block** — no sandbox run
> covers this phase.

Three entries in `lib` do not fit any family, and one of them is not a type
function at all. Then the part that matters most in practice: **writing the
utility that is missing.**

## `NoInfer<Type>` — a fence around an inference site

> "Blocks inferences to the contained type. Other than blocking inferences,
> `NoInfer<Type>` is identical to `Type`."

The handbook's example, verbatim:

```ts
function createStreetLight<C extends string>(
  colors: C[],
  defaultColor?: NoInfer<C>,
) {
  // ...
}

createStreetLight(["red", "yellow", "green"], "red");
// OK

createStreetLight(["red", "yellow", "green"], "blue");
// Error
```

Without `NoInfer`, the second argument is also an inference site, so `"blue"`
would be *added* to `C` — `C` becomes `"red" | "yellow" | "green" | "blue"` and
nothing is wrong. Wrapping it says **"check against `C`, do not contribute to
it"**, so the mistake is caught at the argument that made it.

**The general shape:** one parameter defines the set, another must belong to it.
Config keys against a config object, a default against a list of options, an
event name against a handler map. Before 5.4 the workaround was a second type
parameter defaulted to `never` — `NoInfer` replaces that trick and reads far
better. It has its own topic later in the phase: **14 · `NoInfer<T>`** *(not
written yet)*.

## `ThisType<Type>` — a marker, not a transformation

> "This utility does not return a transformed type. Instead, it serves as a
> marker for a contextual `this` type. Note that the `noImplicitThis` flag must
> be enabled to use this utility."

```ts
type ObjectDescriptor<D, M> = {
  data?: D;
  methods?: M & ThisType<D & M>; // Type of 'this' in methods is D & M
};

function makeObject<D, M>(desc: ObjectDescriptor<D, M>): D & M {
  let data: object = desc.data || {};
  let methods: object = desc.methods || {};
  return { ...data, ...methods } as D & M;
}

let obj = makeObject({
  data: { x: 0, y: 0 },
  methods: {
    moveBy(dx: number, dy: number) {
      this.x += dx; // Strongly typed this
      this.y += dy; // Strongly typed this
    },
  },
});

obj.x = 10;
obj.y = 20;
obj.moveBy(5, 5);
```

> "Notice how the type of the `methods` property simultaneously is an inference
> target and a source for the `this` type in methods."
>
> "The `ThisType<T>` marker interface is simply an empty interface declared in
> `lib.d.ts`. Beyond being recognized in the contextual type of an object
> literal, the interface acts like any empty interface."

That last sentence is the one to remember: **it is an empty interface with a
special meaning to the checker in exactly one position** — the contextual type of
an object literal. Everywhere else it is inert.

This is the mechanism behind the classic options-object API — Vue 2's component
options, Mocha-style suites, any `defineX({ data, methods })` shape — where
methods must see sibling data on `this`. If you are not building that kind of API,
you will never need it; if you are, nothing else does the job.

## The intrinsic string types

`Uppercase`, `Lowercase`, `Capitalize` and `Uncapitalize` are the fourth family.
They are documented with template literal types rather than here, because that is
where they are useful:

```ts
type Getter = `get${Capitalize<"name">}`;   // "getName"
type Shout  = Uppercase<"hello">;           // "HELLO"
```

**They are compiler intrinsics, not types written in `lib`** — you cannot look up
their definition, because there is not one to read; the checker computes them.
That also means you cannot write a fifth one of your own. Their real home is
[07 · Template literal types](../07-template-literal-types.md), where key remapping turns
them into `Getters<T>` and typed event names.

## Writing the one that is missing

This is the practical payoff of the whole topic, and it is the phase gate in a
different form. Once the four families are clear, the missing utility is a
one-liner from whichever family it belongs to:

```ts
// Object shaper — a mapping. The opposite of Readonly, absent from lib.
type Mutable<T> = { -readonly [P in keyof T]: T[P] };

// Object shaper — Omit with the key parameter constrained, so typos are caught.
type StrictOmit<T, K extends keyof T> = Omit<T, K>;

// Union filter — Omit that survives a discriminated union.
type DistributiveOmit<T, K extends keyof any> = T extends any ? Omit<T, K> : never;

// Key selection — the keys of T whose values match V.
type KeysMatching<T, V> = { [K in keyof T]-?: T[K] extends V ? K : never }[keyof T];

// Composition — the fields of B win where the two overlap.
type Merge<A, B> = Omit<A, keyof B> & B;

// Readability — force the editor to print a flat object.
type Prettify<T> = { [K in keyof T]: T[K] } & {};
```

Six types, six mechanisms already covered. **The skill this topic is really
teaching is the classification**, because it turns "does TypeScript have a
utility for this?" into "which family is this, and what is its one line?"

⚠️ **Two rules for a home-grown utility**, both learned the hard way and both
judgement rather than documentation:

- **Name it for what it produces, not how it works.** `Merge` and `KeysMatching`
  survive review; `TransformKeysConditional` does not.
- **Put it in one shared file, not next to its first use.** The second copy
  someone writes will differ subtly from the first, and the two will disagree in
  a place nobody looks.

## Gotchas

**Symptom:** `NoInfer` appears to do nothing
**Cause:** The parameter it wraps was not an inference site for that variable
anyway, or the TypeScript version predates 5.4.
**Fix:** Check that the *other* parameter is the one defining the type variable —
`NoInfer` only blocks; something else must supply.

**Symptom:** A wrong default silently widened a union
**Cause:** Every unwrapped occurrence of `C` is an inference site, so the bad value
joined the set instead of failing.
**Fix:** `NoInfer<C>` on the parameter that should only be checked.

**Symptom:** `ThisType` has no effect
**Cause:** `noImplicitThis` is off — the handbook states the flag is required —
or it is used outside the contextual type of an object literal, where it is inert.
**Fix:** Enable the flag; keep it in the type of the object-literal property whose
methods need `this`.

**Symptom:** `this` inside a method is typed as the methods object only
**Cause:** The marker is `ThisType<D & M>` — both halves are needed, and `M` must
be intersected with it.
**Fix:** Follow the handbook's shape exactly: `methods?: M & ThisType<D & M>`.

**Symptom:** `Capitalize<K>` errors when `K` comes from `keyof T`
**Cause:** `keyof T` may include `number` and `symbol`; the intrinsics take
strings.
**Fix:** `Capitalize<string & K>`, and see
[topic 01 · chunk 04](../01-mapped-types/04-limits.md) for the homomorphism this
costs.

**Symptom:** A hand-written `DeepPartial` compiles but the editor becomes slow
**Cause:** Recursive mapped types over large models are expensive and produce huge
displayed types.
**Fix:** Bound the recursion, apply it at one boundary rather than everywhere, and
read topic 12 before adopting it widely.

**Symptom:** Two copies of the same home-grown utility disagree
**Cause:** It was defined next to its first use, then re-derived elsewhere.
**Fix:** One shared module; import it.

## Interview questions

**★ What problem does `NoInfer` solve?**
It stops a parameter from contributing to a type variable while still checking
against it. In `createStreetLight<C extends string>(colors: C[], defaultColor?:
NoInfer<C>)`, the default is validated against the colours rather than widening
them — so passing `"blue"` is an error instead of silently extending `C`.
Before 5.4 people faked it with a second type parameter defaulted to `never`.

**★ What is unusual about `ThisType`?**
It is not a type function — the handbook calls it a marker for a contextual
`this` type, and says it is "simply an empty interface declared in `lib.d.ts`"
that is only recognised in the contextual type of an object literal. It also
requires `noImplicitThis`. Its use is options-object APIs where methods must see
sibling data on `this`.

**★ You need a utility that TypeScript does not ship. How do you approach it?**
Classify it first. If it reshapes an object, it is a mapped type
(`Mutable`, `StrictOmit`). If it filters a union, it is a distributing
conditional (`DistributiveOmit`). If it pulls a type out of another, it is a
conditional with `infer`. If it selects keys, it is the mapped-then-indexed idiom
(`KeysMatching`). Nearly every missing utility is one line once the family is
identified.

**Why can't you write your own `Uppercase`?**
Because the four string-manipulation types are compiler intrinsics — there is no
`lib` definition to read or imitate, the checker computes them. You can compose
them inside template literal types, but you cannot add a fifth.

**Write a version of `Omit` that works on a discriminated union.**
`type DistributiveOmit<T, K extends keyof any> = T extends any ? Omit<T, K> : never`.
The bare `T extends any` makes the conditional distribute, so `Omit` is applied to
each member separately instead of collapsing the union into one object type and
losing the discriminant.

**Where should home-grown utilities live?**
In one shared module, imported everywhere — not defined beside their first use.
The second person to need `Merge` will write a subtly different one, and the two
definitions will disagree in a case nobody tests. Naming matters too: name them
for what they produce, not for the mechanism.

---

← Prev: [04 · The extractors](./04-extractors.md) · [Topic index](./README.md) · Next → [04 · Key remapping with `as`](../04-key-remapping.md)
