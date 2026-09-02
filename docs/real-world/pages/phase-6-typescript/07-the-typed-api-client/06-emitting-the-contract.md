---
title: "The target for an OpenAPI 3.1 document is draft-2020-12 and there is no openapi-3.1 target, but a stray ({} and string) in the option's declared type means the wrong value compiles silently"
sidebar_label: "06 · Emitting the contract"
sidebar_position: 11
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the **zod 4.4.3** declaration read directly in this
> repo, `node_modules/zod/v4/core/to-json-schema.d.cts` —
> `target?: "draft-04" | "draft-07" | "draft-2020-12" | "openapi-3.0" | ({} & string) | undefined;`,
> `io?: "input" | "output";`, `unrepresentable?: "throw" | "any";`,
> `cycles?: "ref" | "throw";`, `reused?: "ref" | "inline";`, `metadata?:
> $ZodRegistry<Record<string, any>>` — and
> `$schema?: "https://json-schema.org/draft/2020-12/schema" |
> "http://json-schema.org/draft-07/schema#" |
> "http://json-schema.org/draft-04/schema#"` in `v4/core/json-schema.d.cts`;
> the [zod JSON Schema docs](https://zod.dev/json-schema); and the
> [OpenAPI 3.1.0 specification](https://spec.openapis.org/oas/v3.1.0.html).
> Target: **TypeScript 7.0.2** (phase spine), zod **4.4.3**.
> Documentation-validated; **no console blocks, no timings**.

**The schemas that validate every request and type every response can emit the
API's published contract, and the single most important line in that pipeline
is the one that names the JSON Schema target.** Get it wrong and nothing tells
you: zod's `target` option is declared with `({} & string)` in the union, which
accepts any string at all while still offering the four real values as
completions. `'openapi-3.1'` therefore compiles, is not a target zod
implements, and produces whatever the generator does with a value it does not
recognise. **OpenAPI 3.1 documents want `target: 'draft-2020-12'`**, and this
chunk is why; [06b](06b-emitting-from-the-route-map.md) is the emission
pipeline itself.

## 🔴 The declaration, verbatim, with the comment

```ts
/** The JSON Schema version to target.
 * - `"draft-2020-12"` — Default. JSON Schema Draft 2020-12
 * - `"draft-07"` — JSON Schema Draft 7
 * - `"draft-04"` — JSON Schema Draft 4
 * - `"openapi-3.0"` — OpenAPI 3.0 Schema Object */
target?: "draft-04" | "draft-07" | "draft-2020-12" | "openapi-3.0" | ({} & string) | undefined;
```

**Four targets. `'openapi-3.1'` is not one of them.** The zod docs list the
same four:

```js
z.toJSONSchema(schema, { target: "draft-07" });
z.toJSONSchema(schema, { target: "draft-2020-12" });
z.toJSONSchema(schema, { target: "draft-04" });
z.toJSONSchema(schema, { target: "openapi-3.0" });
```

> *"By default, Zod will target Draft 2020-12."*

### Why the wrong value compiles

`({} & string)` is the standard idiom for *"any string, but keep the literal
completions"*. A bare `string` in the union would absorb the four literals and
your editor would stop suggesting them; intersecting with `{}` produces a type
that is assignable from any string yet is not identical to `string`, so the
literals survive as completion candidates. The cost is exactly what bites here:
**every typo type-checks.** `'draft-2020'`, `'openapi3.1'` and `'openapi-3.1'`
are all accepted by the compiler, and only the last one looks so plausible that
nobody questions it.

⚠️ **What the generator does with an unrecognised target is not something the
declaration promises**, and this page does not guess. The rule to carry is
simpler: **the four documented values are the only ones to write.**

### And OpenAPI 3.1 does not need a target of its own

The OpenAPI 3.1.0 specification is explicit that its schemas *are* JSON Schema
2020-12:

> *"Data types in the OAS are based on the types supported by the JSON Schema
> Specification Draft 2020-12"*

> *"Models are defined using the Schema Object, which is a superset of JSON
> Schema Specification Draft 2020-12."*

So `target: 'draft-2020-12'` **is** the OpenAPI 3.1 target. `'openapi-3.0'`
exists as a separate value because 3.0 predates 2020-12 and needs the older,
divergent dialect — `nullable: true` instead of a type union, no `$defs`, and
so on. Asking for an `'openapi-3.1'` target is asking for something that would
be identical to the one you already have.

## `io` decides which of the two types you emitted

```ts
io?: "input" | "output";
```

> *"Some schema types have different input and output types, e.g. `ZodPipe`,
> `ZodDefault`, and coerced primitives. By default, the result of
> `z.toJSONSchema` represents the output type; use `"io": "input"` to extract
> the input type instead."*

🔴 **A request body must be emitted with `io: 'input'` and a response with the
default `'output'`, and getting it backwards produces a document that is wrong
in the most expensive direction.** The request schema is where the defaults and
the coercions live
([chapter 02·02](../02-zod-as-the-source-of-truth/02-input-versus-output.md)):
emit its *output* and the published contract says a field is required that the
API happily defaults, so every generated client sends it. Emit a response's
*input* and the contract describes the pre-transform wire shape, which for
`created_at: z.iso.datetime().transform(…)` is at least still a string — the
error there is quieter and no less wrong.

**One schema, two documents.** That is the same asymmetry
[chunk 02](02-parsing-the-response.md) drew for the client, arriving at the
publishing step.

## Gotchas

**★ 🔴 `target: 'openapi-3.1'` compiles and is not a target.** The union's
`({} & string)` member accepts any string, so the typo has no diagnostic. The
four values in the declaration's own doc comment are the whole list, and an
OpenAPI 3.1 document wants `'draft-2020-12'` because 3.1's Schema Object *is*
2020-12. Put the target in one constant and use it everywhere:
`const TARGET = 'draft-2020-12' as const;`

**★ `({} & string)` is why your editor still autocompletes the four values.**
Understanding the idiom is what stops you "fixing" the type by narrowing it, or
assuming the union means the option is open-ended by design. It is a
completions trick with an accepted safety cost, and it appears in a lot of
library declarations — recognising it is worth more than this one option.

**★ Emitting a request body with the default `io: 'output'` publishes a
contract that demands fields the API defaults.** `z.object({limit:
z.number().default(24)})` has an *output* type where `limit` is required, so
the document says required, and every code-generated client sends a value for a
field that exists precisely so clients need not. Request bodies and query
parameters are `io: 'input'`, always.

**★ `unrepresentable` defaults to `'throw'`, and that is the option that will
stop your build.** A `z.date()`, a `z.bigint()` or a `.transform()` with no JSON
Schema equivalent throws during emission. That is the right default — silently
emitting `{}` for a field is a worse contract than none — and the fix is either
`unrepresentable: 'any'` for a schema you accept losing, or replacing the field
with something representable (`z.iso.datetime()` instead of `z.date()`), which
is what the wire types chapter recommends anyway.

**★ The zod documentation shows an `unrepresentable` *function* form that the
4.4.3 declaration in this repo does not have.** The docs' example passes
`({zodSchema}) => …` returning a schema or `"throw"`; the installed
`to-json-schema.d.cts` declares `unrepresentable?: "throw" | "any";`. **I could
not reconcile these from the sources available here** — it is most likely a
newer feature than 4.4.3 — so check your installed declaration before writing
the function form, and expect a type error if you are on this version.

## Interview questions

**★ You want to publish an OpenAPI 3.1 document from zod schemas. What target
do you pass?**
`'draft-2020-12'`. OpenAPI 3.1's Schema Object *is* JSON Schema Draft 2020-12 —
the specification says models are defined with "a superset of JSON Schema
Specification Draft 2020-12" — so there is nothing for a separate
`'openapi-3.1'` target to do. `'openapi-3.0'` exists as its own value only
because 3.0 predates 2020-12 and uses a divergent dialect.

**★ Someone writes `target: 'openapi-3.1'` and it compiles. Why, and how do
you prevent it?**
Because the option's declared type ends in `({} & string)`, an idiom that
accepts any string while keeping the four real values as editor completions —
so every typo type-checks. Prevent it by declaring the target once,
`const TARGET = 'draft-2020-12' as const`, and passing that constant
everywhere; then a wrong value exists in exactly one place and is reviewed once
rather than copy-pasted.

**★ What is `({} & string)` and why do libraries write it?**
It is a type that behaves like `string` for assignability but is not
*identical* to `string`, so a union containing it does not absorb its literal
members — which means an editor still suggests `'draft-07'`,
`'draft-2020-12'` and the rest while any other string is accepted. It is a
deliberate trade of type safety for autocompletion, common in library options,
and worth recognising because it means "the union lists four values" and "only
four values are accepted" are different statements.

**★ Which `io` direction do you emit a request body with, and what goes wrong
if you get it backwards?**
`io: 'input'`. Request schemas are where defaults and coercions live, and their
*output* type has the defaulted fields as required — so emitting the output
publishes a contract demanding fields the API exists to supply, and every
generated client sends them. The reverse mistake, emitting a response's input,
describes the pre-transform wire shape and is usually less damaging but equally
wrong.

---

← Prev: [Typing the retry wrapper](05b-typing-the-retry-wrapper.md) ·
[Overview](README.md) ·
Next → [Emitting from the route map](06b-emitting-from-the-route-map.md)
