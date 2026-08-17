---
title: "Higher-kinded types"
sidebar_label: "16 · Higher-kinded types"
sidebar_position: 16
---

<span className="db-tier t-when">When Needed</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Generics*, *Conditional Types*,
> *Declaration Merging*). ⚠️ **There are no release notes to cite here, because nothing
> shipped** — this topic is about a capability TypeScript does not have, and the workaround
> is a community pattern rather than a language feature. It is labelled as such throughout.
> Declaration merging is
> [phase 4 · topic 01](../phase-4-classes-declarations/01-module-augmentation/README.md)'s.
> **No sandbox, no console block, no timings.**

Every other topic in this phase is about something TypeScript **can** do. This one is about
the thing it cannot, why the gap is where it is, and what libraries do instead.

It is a *When Needed* topic on purpose: most codebases never need it, and the readers who do
will know it by the shape of the error they cannot get rid of.

## The gap

A generic takes a **type** as a parameter:

```ts
function first<T>(items: T[]): T | undefined { … }
//               ^ T is a type — string, User, number[]
```

What you cannot do is take a **type constructor** as a parameter — something that is still
waiting for a type argument of its own:

```ts
// ❌ not TypeScript. There is no syntax for this.
interface Mappable<F<_>> {
  map<A, B>(fa: F<A>, f: (a: A) => B): F<B>;
}
```

`Array`, `Promise`, `Set`, `Map<string, _>`, a `Result<_, E>` — each is a *function from
types to types*, and TypeScript has no way to name one and apply it later. That is what
"higher-kinded" means: a parameter whose own kind is `type → type` rather than `type`.

🔴 **The practical consequence is one sentence: you cannot write a single interface that
`Array`, `Promise` and your own `Option` all implement.** Everything else in this topic is a
way of living with that.

⚠️ **The failure does not look like a missing feature.** It looks like a signature that
almost works — you write `map<F, A, B>(fa: F, f: (a: A) => B): F` and then discover the
return `F` is the *input's* `F`, still containing `A`, with no way to say "the same container,
different element". People go around this loop several times before recognising it as a
language gap rather than a syntax problem.

## The workaround libraries actually use

The pattern has a name in the literature — **defunctionalisation** — and one shape: since you
cannot pass the type constructor, pass a **key** that stands for it, and keep a registry that
maps keys to applications.

```ts
// 1. the registry — open, and extended by declaration merging
interface Kind1<A> {
  Array: A[];
  Promise: Promise<A>;
}

// 2. a name for "some key in the registry"
type Kind1Key = keyof Kind1<unknown>;

// 3. "apply the constructor named K to A" is an indexed access
type Apply<K extends Kind1Key, A> = Kind1<A>[K];

// 4. now the interface that was impossible above
interface Mappable<K extends Kind1Key> {
  map<A, B>(fa: Apply<K, A>, f: (a: A) => B): Apply<K, B>;
}
```

📌 **Step 3 is the whole trick.** Type *application* — the thing the language will not let you
write — becomes an **indexed access into an interface parameterised by the element type**.
`Kind1<A>["Array"]` is `A[]`; `Kind1<B>["Array"]` is `B[]`. Same key, different argument,
which is exactly what a type constructor does.

And a user adds their own container the same way anyone extends a library type — by
**declaration merging** ([phase 4 · topic 01](../phase-4-classes-declarations/01-module-augmentation/README.md)):

```ts
declare module "the-library" {
  interface Kind1<A> {
    Option: Option<A>;
  }
}
```

## What it costs, stated plainly

| | |
|---|---|
| **Openness** | The registry is open *by augmentation only*. A type nobody registered cannot be abstracted over, so the abstraction is not universal — it covers exactly the entries in the map |
| **Arity** | `Kind1` handles one type parameter. `Either<E, A>`, `Map<K, V>` need a `Kind2`, and there is no way to be generic over arity itself |
| **Error messages** | Failures report in terms of `Apply<K, A>` and indexed accesses, not in terms of the container the user was thinking about — [topic 08 · chunk 01](./08-knowing-when-to-stop/01-the-error-is-the-interface.md)'s problem in an acute form |
| **Inference** | `K` is rarely inferable from a value, so call sites tend to need explicit type arguments — which is most of what makes these libraries feel heavy |
| **Reader cost** | Every reader must understand the encoding before they can read any signature that uses it |

🔴 **That last row is the decisive one for application code.** The encoding is not hard, but
it is *unfamiliar*, and it appears in every signature it touches. A library can amortise that
across its whole audience; a single application cannot.

## When you actually need it

Almost never, and the honest test is short:

- **Are you writing a library whose whole purpose is abstraction over containers?** Then yes,
  and this is the known solution.
- **Do you have three or more container types that must share one interface, today, not
  hypothetically?** Then maybe — and count them again, because two is not three.
- **Anything else?** No. Write the two or three concrete overloads. They are longer, they are
  readable by everyone, and their errors name real types.

⚠️ **The common false positive:** wanting `map` to work over both `Array` and `Promise` in one
helper. That is two functions, and writing them as two functions costs six lines and removes
the entire apparatus above.

## What "when needed" means here

This is the phase's only *When Needed* topic, and that tier is doing real work: **you should
be able to recognise the encoding when you meet it in a dependency's types, and know why it is
there.** Reading `Apply<K, A>` in a signature and knowing it means "the container `K`, holding
`A`" is the whole requirement. Building one is a different decision, and this page's advice on
that decision is: probably not.

## Gotchas

**Symptom:** A generic `map` returns the input container's element type, not the output's.
**Cause:** `F` is a plain type parameter, so it is the whole `F<A>` — there is no way to say
"the same constructor applied to `B`".
**Fix:** Recognise it as the language gap, not a syntax error. Two concrete functions, or the
registry encoding if you are a library.

**Symptom:** The registry works for the library's own types and not for the user's.
**Cause:** The map is only open through declaration merging, and the user has not augmented it.
**Fix:** Document the augmentation as part of the public API. An unregistered type is invisible
to the abstraction by construction.

**Symptom:** `Either<E, A>` does not fit the registry.
**Cause:** `Kind1` encodes one type parameter.
**Fix:** A parallel `Kind2` interface. There is no way to be generic over arity, so the
duplication is structural, not laziness.

**Symptom:** Every call site needs an explicit type argument.
**Cause:** The key `K` is a string-literal type that rarely appears in a value's type, so
there is nothing to infer it from.
**Fix:** Pass a witness value that carries the key, or accept the explicit arguments. This is
the main ergonomic cost of the pattern.

**Symptom:** An error names `Apply<"Array", A>` and the reader does not know what failed.
**Cause:** The checker reports on the encoded type.
**Fix:** Nothing local — this is the cost. It is also the strongest argument for keeping the
encoding at a library boundary rather than in application code.

**Symptom:** Someone reimplemented the registry inside an application "for consistency".
**Cause:** The pattern looks like architecture.
**Fix:** Count the container types that genuinely share an interface. Below three, concrete
functions win on every axis that matters.

**Symptom:** Augmenting the registry in one file changes types in an unrelated file.
**Cause:** Declaration merging is global to the program, by design.
**Fix:** Expected, and worth knowing before adopting: the registry is a shared, global,
append-only structure.

## Interview questions

**★ What are higher-kinded types, and what does TypeScript lack?**
A higher-kinded type is a type parameter whose own kind is `type → type` — a **type
constructor** rather than a type. TypeScript generics take types, so you can write `T` and use
`T[]`, but you cannot write a parameter `F` and apply it as `F<A>` and `F<B>`. The practical
consequence is that you cannot write one interface that `Array`, `Promise` and a user's
`Option` all implement.

**★ How do libraries work around it?**
Defunctionalisation: instead of passing the type constructor, pass a **key** that stands for
it, and keep an interface mapping keys to applications. `interface Kind1<A> { Array: A[];
Promise: Promise<A> }`, and then "apply `K` to `A`" is the indexed access `Kind1<A>[K]`. Users
add their own containers by declaration merging into that interface.

**★ Why is an indexed access the right encoding?**
Because it separates the two things a type constructor does. The interface is parameterised by
the *element* type, and the key selects the *container*, so `Kind1<A>["Array"]` is `A[]` and
`Kind1<B>["Array"]` is `B[]`. Same key, different argument — which is precisely application,
expressed with machinery the language does have.

**★ What does the encoding cost?**
Five things. It is open only to registered types, so the abstraction is not universal. It is
fixed to one arity, so `Either` needs a parallel `Kind2`. Errors report in terms of the
encoding rather than the container. The key is rarely inferable, so call sites need explicit
type arguments. And every reader has to learn the encoding before reading any signature that
uses it — which is the decisive cost outside a library.

**★ When should you reach for it?**
When you are writing a library whose purpose is abstraction over containers, or when you have
three or more container types that must share one interface today. Otherwise write the
concrete functions: they are longer, readable by everyone, and their errors name real types.
Wanting one `map` for `Array` and `Promise` is the common false positive — that is two
functions and six lines.

**Why is this a *When Needed* topic rather than something to learn properly?**
Because the requirement is recognition. Meeting `Apply<K, A>` in a dependency's types and
knowing it means "the container `K` holding `A`" is enough to read the library. Building the
encoding is a separate decision that most codebases should answer with "no", so the depth
belongs in recognising it rather than in constructing it.

## Where this connects

- **← [Phase 3 · Generic interfaces and type aliases](../phase-3-generics/03-generic-interfaces-and-aliases/README.md)**
  — what a type parameter is, which is what makes the missing capability legible.
- **← [Phase 4 · Module augmentation](../phase-4-classes-declarations/01-module-augmentation/README.md)**
  — how the registry is extended, and why that extension is global.
- **← [08 · Knowing when to stop](./08-knowing-when-to-stop/README.md)** — the decision this
  page ends on, and the error-message argument that decides it.
- **← [15 · Union → intersection and other identities](./15-union-to-intersection.md)** — the
  other recognition topic: things the language *can* express awkwardly, where this one is
  something it cannot express at all.

---

← [15 · Union → intersection and other identities](./15-union-to-intersection.md) ·
[Phase 5 index](./README.md)
