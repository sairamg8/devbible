---
title: "Deriving one function's type from another"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Utility Types* — `Parameters`,
> `ReturnType`, `Awaited`, `ThisParameterType`, `OmitThisParameter`, and the documented
> last-overload behaviour) and the **4.0** and **5.4 release notes** (variadic tuples and
> labelled tuple elements; `NoInfer`). `TS2345`, `TS2769` and `TS7056` are from the compiler's
> own message table (**5.9.3**) and confirmed in **7.0.2**. The extractor *mechanisms* are not
> repeated here — [topic 03 · chunk 04](../03-utility-types/04-extractors.md) owns them.
> **No sandbox, no console block**; the one multi-line error shape is assembled from quoted
> templates and labelled as such. Signature-design recommendations are **judgement**.

The applied half of the extractor family: **a function whose type is defined by another
function's type.** Wrappers, decorators, adapters, retry helpers, instrumented copies — the
places where a signature must stay in step with something you do not own.

| # | Chunk | What it settles |
|---|---|---|
| 01 | [The wrapper signature](./01-the-wrapper-signature.md) | The canonical shape, 🔴 **`never[]` for a bound vs `any[]` for a signature you call**, `Promise<Awaited<…>>`, keeping or dropping `this`, and why optionality and labels survive |
| 02 | [What it quietly loses](./02-what-it-loses.md) | Overloads collapsing to the last signature, genericity erased, modifiers destroyed by rebuilding, and the inference sites a generic wrapper adds |
| 03 | [The shapes in practice](./03-the-shapes-in-practice.md) | Transparent · async-ifying · adapter · re-typing adapter — and which one to refuse to write |

## The one-sentence version

**Infer the parameter tuple, do not extract it** — `<A extends unknown[], R>` beats
`Parameters<typeof f>` because inference happens per call site, so it survives overloads and
keeps genericity.

## The four sentences to keep

1. **`(...a: never[]) => unknown` is a bound; `(...a: any[]) => unknown` is a signature you can
   call.** Parameters are contravariant, so `never` accepts every function — and gives you
   nothing to pass.
2. **`Promise<Awaited<R>>`, never `Promise<R>`**, whenever you add a promise to a derived return
   type. Otherwise the wrapper is wrong for exactly the async half of its callers.
3. **Extraction sees only the last overload and instantiates generics away.** A wrapper derived
   from an overloaded or generic function is quietly wrong at call sites, and the return-position
   case type-checks while being untrue.
4. **Spread `Parameters<F>`; never rebuild it by index.** Optional markers and labelled names
   live on the tuple as declared, and are gone the moment it is taken apart.

## Where this connects

- **← [03 · The built-in utility types · chunk 04](../03-utility-types/04-extractors.md)** — the
  mechanisms: the function family, the documented overload rule, multiple `infer` sites,
  `Awaited`, and the `this` pair. Read it first; this topic assumes it.
- **← [Phase 3 · The `typeof` type operator](../../phase-3-generics/07-typeof-type-operator.md)**
  — why a derived signature needs the function in scope as a **value**, and what to do when it
  is not.
- **← [Phase 3 · Inference sites and contextual typing](../../phase-3-generics/10-inference-sites-and-contextual-typing.md)**
  — why inferring the tuple at the call site beats extracting it.
- **← [Phase 4 · Decorators](../../phase-4-classes-declarations/13-decorators.md)** — a wrapper
  whose outer signature is dictated by a protocol, of which **two incompatible ones are in
  circulation**. The inner function is this topic's shape 1 or 2.
- **← [Phase 4 · Mixins · chunk 01](../../phase-4-classes-declarations/14-mixins/01-the-pattern.md)**
  — the same `never[]`/`any[]` decision on the class side, for construct signatures.
- **→ [13 · Tuple manipulation](../13-tuple-manipulation/README.md)** — `Head`, `Tail`, `Last` and currying, which
  chunk 03 uses one instance of.
- **→ 14 · `NoInfer<T>`** *(not written yet)* — the fence for the inference sites a generic
  wrapper introduces.
- **→ [08 · Knowing when to stop](../08-knowing-when-to-stop/README.md)** — shape 4 is where its
  tests bite: a re-typing adapter used three times should be two hand-written signatures.

---

← [Phase 5 index](../README.md) · Next → [01 · The wrapper signature](./01-the-wrapper-signature.md)
