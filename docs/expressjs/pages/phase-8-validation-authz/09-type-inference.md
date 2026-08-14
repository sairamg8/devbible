---
title: "Type inference from schemas"
sidebar_label: "09 · Type inference"
sidebar_position: 9
---

<span className="db-tier t-know">Know</span>

**The schema already describes the shape. Derive the type from it instead of
writing the same fields twice — and keep `req` honest without reaching for
`any`.**

> Verified: 2026-08-14 — **no sandbox run**. This is a **TypeScript-and-Zod** topic that
> lands in Express because `req` is where the two meet; nothing here is an Express API.
> The Express-side facts it depends on are documented: middleware may *"modify the request
> and response objects"* ([using middleware](https://expressjs.com/en/guide/using-middleware.html)),
> which is why `req.validated` needs declaring to TypeScript at all, and **`req.query` is a
> getter in Express 5** — *"no longer a writable property"*
> ([migration guide](https://expressjs.com/en/guide/migrating-5.html)) — which rules out
> the Express 4 trick of overwriting it with a typed value.
> `@types/express` ships the `Express.Request` interface that declaration merging extends;
> the merging mechanism itself is TypeScript's, covered in
> [TypeScript Phase 4](../../../typescript/pages/README.md).

## The duplication this removes

Written by hand, every field exists twice and the two can disagree:

```ts
// ⛔ two sources of truth, and nothing checks that they match
interface CreateOrder {
  items: {sku: string; qty: number}[];
  note?: string;
}

const createOrderSchema = z.object({
  items: z.array(z.object({sku: z.string(), qty: z.number().int().positive()})),
  note: z.string().max(500).optional(),
});
```

Add a field to one and forget the other, and TypeScript is happy while the runtime
rejects it — or worse, accepts a field the type says cannot exist.

Inference collapses them:

```ts
// ✅ one source of truth; the type is a projection of the schema
const createOrderSchema = z.object({
  items: z.array(z.object({sku: z.string(), qty: z.number().int().positive()})),
  note: z.string().max(500).optional(),
});

type CreateOrder = z.infer<typeof createOrderSchema>;
// → {items: {sku: string; qty: number}[]; note?: string}
```

**The schema is the definition; the type is derived.** Changing the schema changes
the type in the same commit, and every consumer that no longer type-checks is a
compile error rather than a runtime surprise.

Note what inference does *not* give you: `z.number().int().positive()` infers as
plain `number`. **The runtime constraints are stronger than the type**, always —
which is exactly why validation still has to run.

## Teaching TypeScript about `req.validated`

`req.validated` is a field you invented, so TypeScript does not know it exists.
Two approaches, and the second is better.

**Declaration merging** — global, convenient, and lies a little:

```ts
declare global {
  namespace Express {
    interface Request {
      validated?: unknown;   // note: optional, and NOT typed per route
      user?: AuthenticatedUser;
    }
  }
}
```

This makes `req.validated` legal everywhere. The problem is that "everywhere" is
the point: a handler with no validation middleware still type-checks when it reads
`req.validated`, so the type says nothing useful. Declaring it **optional** is the
honest version — it forces a check — but it also makes every handler write a guard.

**A typed handler wrapper** — narrower, and the type actually means something:

```ts
type Validated<S extends z.ZodTypeAny> = {
  validated: z.infer<S>;
};

function handler<S extends z.ZodTypeAny>(
  schema: S,
  fn: (req: Request & Validated<S>, res: Response) => Promise<void>,
) {
  return [validate({body: schema}), fn] as const;
}

router.post('/orders', ...handler(createOrderSchema, async (req, res) => {
  req.validated.items;   // ← typed, and only because the schema is attached here
  res.status(201).json(/* … */);
}));
```

The type is now tied to the schema *for that route*, which is the only place the
claim is true. It costs a small generic helper; it buys a type that cannot be wrong.

## `req.user` deserves the same scepticism

The most common declaration is also the most misleading:

```ts
// ⚠️ this asserts every request has a user — most do not
interface Request { user: AuthenticatedUser }

// ✅ honest: optional, so handlers must narrow
interface Request { user?: AuthenticatedUser }
```

Declaring `user` non-optional makes `req.user.id` compile on a public route and
throw at runtime — the type system actively hiding the bug that
[optional auth](08-tenant-and-logout.md) warns about. Declare it optional and let
authenticated handlers narrow it, either with a guard or through a wrapper that
proves the middleware ran.

## Trade-off

Inference removes a real class of drift and makes the schema the single definition
— for request shapes, that is close to unambiguously correct.

Two costs are worth naming. **The type is weaker than the schema**: branded strings,
`.email()`, ranges and refinements all erase to `string` or `number`, so the type
gives you no protection the validator does not already give at runtime. Reading
`type CreateOrder` tells you less than reading the schema.

And **inference chains can get expensive** — deeply nested or heavily-refined
schemas slow the compiler and produce error messages that are hard to read. For a
large API, exporting the inferred types explicitly (rather than inferring inline at
every use) keeps both under control.

The global-declaration shortcut is where people trade correctness for convenience,
and it is worth resisting: a global `validated: any` type-checks everything and
proves nothing.

## Gotchas

**Symptom:** `Property 'validated' does not exist on type 'Request'`  
**Cause:** It is your field, not Express's — TypeScript has never heard of it  
**Fix:** Declaration merging, or a typed wrapper that carries the schema's type

**Symptom:** `req.user.id` compiles but throws on a public route  
**Cause:** `user` declared non-optional in the global Request interface  
**Fix:** Declare it optional. A type that lies is worse than no type

**Symptom:** `req.validated` is typed but wrong for this route  
**Cause:** One global type for a field whose shape differs per endpoint  
**Fix:** Tie the type to the schema at the route — a wrapper, not a global declaration

**Symptom:** The inferred type says `number` where the schema says positive integer  
**Cause:** Inference erases refinements by design  
**Fix:** Nothing to fix — but do not conclude the type replaces the validation. It never does

**Symptom:** Assigning the parsed result to `req.query` fails to compile *and* throws  
**Cause:** Express 5 made `req.query` a getter  
**Fix:** `req.validated.query`

**Symptom:** Type-checking slows noticeably as schemas grow  
**Cause:** Deep inference chains re-evaluated at every use site  
**Fix:** Export the inferred type once and import it, rather than inferring inline

## Interview questions

**★ What does `z.infer` give you, and what does it deliberately not?**
It derives a static type from the schema, so the shape is defined once. It does **not**
carry refinements — `z.number().int().positive()` infers as `number`, and `.email()`
as `string`. The runtime guarantee is always stronger than the type.

**★ Why is `declare global { namespace Express { interface Request { user: User } } }` risky?**
Because it asserts every request has a user. `req.user.id` then compiles on a public
route and throws at runtime — the type system concealing exactly the bug optional-auth
middleware creates. Declare it optional and narrow.

**★ Why can't you just overwrite `req.query` with the parsed value and type it?**
Express 5 made `req.query` a getter — *"no longer a writable property"* — so assignment
throws regardless of what the types say. The parsed result belongs on your own field.

**How do you get a per-route type for validated input?**
Tie it to the schema at the route with a small generic wrapper, rather than declaring
one global type for a field whose shape differs per endpoint. A global `validated: any`
type-checks everything and proves nothing.

**If the type is weaker than the schema, why bother inferring it?**
To remove drift. The value is that a schema change breaks compilation everywhere the
shape is consumed, in the same commit — not that the type enforces the constraints.

---

← Prev: [Multi-tenant and logout](08-tenant-and-logout.md) · Index: [Phase 8](README.md)
