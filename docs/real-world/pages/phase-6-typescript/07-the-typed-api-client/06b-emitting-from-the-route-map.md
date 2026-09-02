---
title: "The route map already holds every path, method and schema the document needs, so emission is a loop rather than a second description of the API — and everything it cannot reach is a place OpenAPI wants a shape zod does not produce"
sidebar_label: "06b · Emitting from the route map"
sidebar_position: 12
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-09 against the **zod 4.4.3** declarations read in this repo
> (`toJSONSchema`'s `metadata`, `cycles`, `reused`, `external` parameters;
> `$ZodRegistry`; the `$schema` union in `v4/core/json-schema.d.cts`), the
> [zod JSON Schema docs](https://zod.dev/json-schema) on registries and
> `$defs`, and the
> [OpenAPI 3.1.0 specification](https://spec.openapis.org/oas/v3.1.0.html)
> (Parameter Object, `jsonSchemaDialect`, Responses Object).
> Target: **TypeScript 7.0.2** (phase spine), zod **4.4.3**.
> Documentation-validated; **no console blocks, no timings**.

**Once the target and the `io` direction are settled
([06](06-emitting-the-contract.md)), publishing the contract is a loop over the
route map.** That is the fourth thing
[03b](03b-typed-path-parameters.md) claimed the map buys, collected here: the
paths, the methods, the query schemas, the body schemas and the response
schemas are already one object, so the document is derived rather than
maintained. The interesting part is the residue — the four places OpenAPI wants
a shape zod does not emit, and the one thing the whole pipeline still does not
prove.

## Emitting from the route map

```ts
// tools/emit-openapi.ts
import {z} from 'zod';
import {routes} from '@storefront/shared';

const TARGET = 'draft-2020-12' as const;          // one constant, one place to be wrong
const paths: Record<string, Record<string, unknown>> = {};

for (const [method, table] of Object.entries(routes)) {
  for (const [path, spec] of Object.entries(table)) {
    const openApiPath = path.replace(/:([A-Za-z0-9_]+)/g, '{$1}');   // :slug → {slug}
    paths[openApiPath] ??= {};
    paths[openApiPath][method] = {
      parameters: [
        ...pathParameters(path),
        ...('query' in spec
          ? queryParameters(z.toJSONSchema(spec.query, {target: TARGET, io: 'input'}))
          : []),
      ],
      ...('body' in spec && {
        requestBody: {
          required: true,
          content: {'application/json': {
            schema: z.toJSONSchema(spec.body, {target: TARGET, io: 'input'}),
          }},
        },
      }),
      responses: {
        '200': {content: {'application/json': {
          schema: z.toJSONSchema(spec.response, {target: TARGET}),   // io: 'output'
        }}},
        default: {content: {'application/json': {
          schema: z.toJSONSchema(ErrorBody, {target: TARGET}),
        }}},
      },
    };
  }
}
```

📌 **`:slug` becomes `{slug}`.** Express path syntax and OpenAPI path
templating are two notations for the same thing, and the conversion is one
`replace` — the same regular expression the client's `interpolate` uses to find
them, and the same one `pathParameters` uses to enumerate them.

## Registries, `$defs` and shared components

Emitting each schema standalone inlines `Money`, `Address` and `OrderStatus`
into every route that mentions them. The registry is how they become
`components/schemas` instead:

```js
z.globalRegistry.add(User, {id: "User"});
z.globalRegistry.add(Post, {id: "Post"});
z.toJSONSchema(z.globalRegistry);
```

> *"All schemas should have a registered `id` property in the registry! Any
> schemas without an `id` will be ignored."*

…and the `$ref` URIs are steerable, which is what makes the output droppable
into a document whose components live at `#/components/schemas/{id}`:

```js
z.toJSONSchema(z.globalRegistry, {
  uri: (id) => `https://example.com/${id}.json`
});
```

Two related options are worth knowing before you need them. `cycles: 'ref'` is
the default and represents a cycle with a `$ref` — the docs' example shows
`friend: { '$ref': '#' }` for a self-referential `User` — while `'throw'`
refuses it. `reused: 'ref'` extracts a repeated subschema into `$defs` rather
than inlining it, producing refs like `{'$ref': '#/$defs/__schema0'}` with a
generated name.

⚠️ **Generated `$defs` names are not stable API.** `__schema0` is positional:
reorder the properties of a schema and the numbering changes, so a committed
document diffs noisily and any consumer that referenced the name breaks.
Register the schemas you care about with real ids and reserve `reused: 'ref'`
for the anonymous ones.

## Gotchas

**★ The emitted schema carries a `$schema` key that OpenAPI components
usually should not.** zod's `JSONSchema` type declares `$schema` as one of
three dialect URIs, and an emitted root includes it. Inside
`components/schemas` an OpenAPI document normally expresses the dialect once
via `jsonSchemaDialect` on the root object, so the per-schema `$schema` is at
best redundant. Strip it when embedding, and keep it when publishing standalone
JSON Schema files.

**★ Query parameters are not a JSON Schema.** OpenAPI wants an array of
parameter objects with `name`, `in: 'query'`, `required` and a `schema` each —
not one object schema. `queryParameters` in the loop above is a real function
you have to write: walk the emitted object's `properties`, and use its
`required` array to set each parameter's `required`. Handing the object schema
straight to `parameters` produces a document that validators reject.

**★ Path parameters have to be emitted too, and they are not in the schemas.**
The route map declares `query`, `body` and `response`; `:slug` and `:id` exist
only in the path string. Either extract them in the emitter with the same
regular expression and emit a parameter object
(`{name, in: 'path', required: true, schema: {type: 'string'}}`), or add a
`params` schema to `RouteSpec` and have both the client and the emitter read
it. The second is better and costs an entry per parameterised route.

**★ Two `default` responses is a common shape error.** The loop above attaches
`ErrorBody` under `default`, which is right, and then every route that
documents a specific 409 or 402 needs its own entry alongside it. The status
codes live in the API's classify table
([chapter 05·03d](../05-typed-express-handlers/03d-the-classify-table-and-the-handler.md)),
which is a third source the emitter would have to read to get per-route status
lists right — and this app does not, publishing `default` only.

**★ Emission is not verification.** A document generated from the schemas is
guaranteed to match the *schemas*, not the handlers. A handler that returns a
field the response schema strips, or a status the document does not list, is
invisible here. The contract test and the route parity test remain the things
that check the server; the emitted document is a faithful description of what
the schemas say.

**★ `Object.entries(routes)` loses every type the map had.** Its result is
`[string, Record<string, RouteSpec>][]`, so inside the loop `spec` is the
generic `RouteSpec` and `path` is a `string` — all the literal-key precision
[chunk 03](03-the-route-map.md) fought for is gone. That is correct and
acceptable: the emitter iterates at run time, so it needs the *values*, not the
types. Do not try to keep the types here; keep them where call sites are.

**★ `'query' in spec` and `'body' in spec` are the narrowings that make the
optional members reachable.** Because `RouteSpec` declares them optional,
`spec.query` is `z.ZodType | undefined` and passing it straight to
`toJSONSchema` fails. The `in` operator is the narrowing the handbook lists for
exactly this — and it is worth using rather than `spec.query!`, because the
non-null assertion would silently emit `undefined` if the key were ever
removed.

**★ A schema registered in `z.globalRegistry` from two packages can collide on
`id`.** The registry is a module-level singleton, so a shared package and an
app that both register something as `'Order'` are writing to the same map. Use
a dedicated registry per document — `toJSONSchema` takes a `metadata` registry
option — rather than reaching for the global one in library code.

**★ The document is only as good as the response schemas, and one of them is
deliberately loose.** The admin list endpoint declares its rows as
`z.array(z.unknown())` so the client can skip parsing them
([chunk 02](02-parsing-the-response.md)); emitted, that becomes `{}` per item
and the published contract says nothing about admin rows. A performance
decision on the client silently degraded the public documentation, and the only
way to notice is to read the emitted output.

**★ Regenerating the document must be part of CI, not a manual step.** Nothing
in the type system fails when the map changes and the committed
`openapi.json` does not. The check is a CI step that regenerates and diffs — if
the output differs from the committed file, fail the build. That is the same
shape of check as the route parity test, and for the same reason: the
relationship spans an artefact the compiler cannot see.

## Interview questions

**★ How do shared types like `Money` and `Address` become
`components/schemas` rather than being inlined everywhere?**
Through a registry. Registering each schema with an `id` — the docs are
explicit that schemas without one are ignored — and calling `z.toJSONSchema`
on the registry emits them as separate definitions with `$ref`s between them,
and the `uri` option steers those refs to wherever your document keeps its
components. The related `reused: 'ref'` option does the same for repeated
anonymous subschemas, extracting them into `$defs` with generated names.

**★ What does an emitted document prove about the running API?**
That the schemas say what the document says. It proves nothing about the
handlers: a handler returning an extra field, a status the document does not
list, or an error extra the client's table does not know about are all
invisible to emission, because emission reads declarations rather than
behaviour. The checks that reach the server are the route parity test and the
error contract test.

**★ Why is the route map a good input to the emitter?**
Because everything the document needs is already there in one object — path,
method, query schema, body schema, response schema — so the emitter is a loop
rather than a second description of the API written by hand. A hand-maintained
OpenAPI file is a third copy of the contract alongside the server's schemas and
the client's expectations, and it drifts first because nothing breaks when it
does.

**★ The emitter iterates with `Object.entries` and loses all the literal
types. Is that a problem?**
No — it is the correct boundary. The emitter runs at build time over *values*:
it needs each schema object to hand to `toJSONSchema`, not the literal path
type. The precision exists to check call sites, and there are no call sites
here. Trying to keep it would mean type-level iteration over the map for no
gain, and the loop would still produce the same JSON.

**★ What does OpenAPI need that zod does not emit?**
Four things. Query parameters as an array of parameter objects rather than one
object schema; path parameters, which are not in any schema at all because they
live in the path string; per-route status codes, which live in the API's
classify table; and a document without a per-schema `$schema` key, since the
dialect is declared once on the root via `jsonSchemaDialect`. Each of those is
a small transform in the emitter, and each is a place a naive pipeline produces
a document validators reject.

**★ How do you keep the published document from going stale?**
Regenerate it in CI and fail on a diff against the committed file. Nothing in
the type system relates a checked-in `openapi.json` to the schemas it was
generated from, so the only reliable check is to run the generator and compare
— the same pattern as the route parity test and the Postgres enum test, all
three of which exist because the relationship spans something the compiler
cannot see.

---

← Prev: [Emitting the contract](06-emitting-the-contract.md) ·
[Overview](README.md) ·
Next chapter → **Utility types in app code** *(not written yet)*
