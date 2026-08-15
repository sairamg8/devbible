---
title: "Branded / nominal types"
sidebar_label: "07 · Branded / nominal types"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08. ⚠️ **Branding is a community pattern, not a language
> feature** — there is no handbook chapter for it, and this page says so rather
> than implying otherwise. What *is* validated: the primitives it is built from
> (intersection types, `unique symbol`, declaration-site privacy) against the
> **TypeScript handbook** (*Everyday Types → Intersection Types*, *Symbols*,
> *Classes → Member Visibility*), and every error code below — `TS1331`,
> `TS1332`, `TS2352`, `TS2367` — read out of the **compiler's own diagnostic
> table** with its exact `{0}`-templated text (⚠️ install inspected: TypeScript
> **6.0.3**, not the 7.0.2 this corpus targets). **No console block** — no
> sandbox run covers this phase.

## The problem structural typing creates

TypeScript compares types by **shape**
([phase 1 · structural typing](../phase-1-type-vocabulary/09-structural-typing.md)),
and that is usually what you want. Here it is not:

```ts
type UserId = string;
type PostId = string;

declare function getUser(id: UserId): User;

const postId: PostId = 'p_123';
getUser(postId);   // ✅ compiles. Both are string.
```

`UserId` and `PostId` are aliases for `string`, so they are the same type. The
aliases document intent to a *reader* and mean nothing to the *compiler*.

This class of bug is expensive precisely because it type-checks: an ID from the
wrong table, a metre where a pixel was expected, an unvalidated string reaching a
query. All of them look correct.

Languages with **nominal** typing — where a name is part of the identity — reject
this by construction. TypeScript has no nominal types. Branding is how you fake
one.

## The pattern

Intersect the underlying type with a property that nothing else can have:

```ts
declare const brand: unique symbol;

type Brand<T, B> = T & { readonly [brand]: B };

type UserId = Brand<string, 'UserId'>;
type PostId = Brand<string, 'PostId'>;
```

Now `UserId` and `PostId` are different types, and the earlier call fails —
`PostId` is not assignable to `UserId`, because their brands differ.

A `UserId` is still a `string` at runtime and still has every string method,
because an intersection keeps everything on both sides. **Only the type system
believes in the extra property.**

⚠️ **`declare const brand: unique symbol` is load-bearing and has rules.** A
`unique symbol` type is tied to the exact declaration that produced it, which is
what makes the brand unforgeable. The compiler enforces where it may be declared:

| Code | Message text (verbatim from the diagnostic table) |
|---|---|
| **TS1332** | *"A variable whose type is a 'unique symbol' type must be 'const'."* |
| **TS1331** | *"A property of a class whose type is a 'unique symbol' type must be both 'static' and 'readonly'."* |

A plain string key (`{ readonly __brand: B }`) also works and is more common. It
is marginally weaker — someone could write that property by hand — and much
easier to read in an error message. **Prefer the string key unless you are
publishing a library**, where an unforgeable brand is worth the noise.

## Getting a branded value in the first place

Nothing produces a `UserId` naturally, so something has to assert one. That
assertion is the entire security boundary of the pattern, and it belongs in
exactly one place:

```ts
function toUserId(raw: string): UserId {
  if (!/^u_[a-z0-9]+$/.test(raw)) throw new Error(`bad user id: ${raw}`);
  return raw as UserId;
}
```

🔴 **This is the whole point, and it is easy to miss:** the value of branding is
not that `as UserId` is impossible — it is that `as UserId` appears **once**, in a
function that validates, instead of nowhere and everywhere. You have converted an
invisible convention into a single auditable choke point.

A brand with `as` scattered through the codebase is worse than no brand: it costs
the ceremony and provides none of the guarantee.

⚠️ **You may hit `TS2352`** if you try to assert across an incompatible shape:

> *"Conversion of type '{0}' to type '{1}' may be a mistake because neither type
> sufficiently overlaps with the other. If this was intentional, convert the
> expression to 'unknown' first."*

For a `string`-based brand it does not fire — `string` overlaps its own
intersection. If you see it, the underlying type is wrong, not the brand.

## The other way: declaration-site privacy

A class with a `private` or `#` member compares by **declaration site**, not
structurally — the `TS2442` behaviour from
[phase 3 · generic classes](../phase-3-generics/09-generic-classes.md) and
[topic 02](./02-access-modifiers/02-visibility-rules-and-choosing.md). That is
nominal typing, already built in:

```ts
class UserId {
  #brand!: void;
  constructor(readonly value: string) {}
}
```

Two identically-shaped classes are not interchangeable if either has a private
member, so nothing else can be a `UserId`.

**The trade against the type-level brand:**

| | Type-level brand | Class with a private member |
|---|---|---|
| Runtime cost | **none** — it is a `string` | an object allocation per value |
| Still a `string` | yes — `.toUpperCase()` works | no — `.value` first |
| JSON round-trip | survives | needs reconstructing |
| Runtime check possible | no | `#brand in obj`, `instanceof` |

**Use the type-level brand for identifiers and primitives**, which are the common
case. Reach for the class when you genuinely want runtime identity too — and
remember that `#brand in obj` is the check that survives a duplicated package
([topic 02](./02-access-modifiers/02-visibility-rules-and-choosing.md)).

## Where branding earns its keep

- **Identifiers.** `UserId` vs `PostId` vs `OrderId` — the canonical case, and the
  one that pays for itself fastest in a codebase with many tables.
- **Validated strings.** `Email`, `Url`, `NonEmptyString`. The brand records that
  validation *happened*, which a bare `string` cannot.
- **Units.** `Metres` vs `Feet`, `Milliseconds` vs `Seconds`. Famously expensive
  to get wrong.
- **Trust boundaries.** `RawHtml` vs `SanitisedHtml` — a brand makes "this has
  been through the sanitiser" a compile-time fact, and makes every bypass a
  visible `as`.

The last one is the strongest argument for the whole pattern: **it turns a
convention that lived in code review into something the compiler checks.**

## Where it does not

- **Anything you cannot funnel through a constructor function.** If values arrive
  from a dozen places and each one asserts, you have ceremony without a guarantee.
- **Small codebases with two ID types.** The cost is real — every signature, every
  test fixture, every mock needs the brand.
- **Values crossing a serialisation boundary constantly.** A brand does not
  survive `JSON.parse`; you re-assert on the way in, which is fine if there is one
  entry point and miserable if there are twenty.

⚠️ **And a brand is not validation.** `'' as UserId` compiles. The brand records a
claim that a check occurred; only the constructor function makes the claim true.
Same shape as the `process.env` and return-position-generic traps met earlier —
telling the compiler something does not make it so.

## Trade-off

**Branding** makes a whole class of mix-up bugs impossible, and concentrates
every unsafe conversion into one auditable function. It costs friction
everywhere: constructors on the way in, test fixtures that need them, and error
messages that now mention `string & { readonly __brand: "UserId" }` instead of
`string`.

**Plain aliases** cost nothing, read well, and document intent to humans — while
the compiler treats every one of them as `string` and catches none of the bugs.

The line worth holding: **brand when two same-shaped values must never be
swapped and the cost of swapping them is real** — IDs across tables, units,
sanitised versus raw. Do not brand for tidiness.

## Gotchas

**Symptom:** Two ID types are interchangeable despite having different names
**Cause:** Type aliases are not nominal — both are `string`.
**Fix:** Brand them, or use classes with a private member.

**Symptom:** `as UserId` appears in twenty files
**Cause:** No constructor function; every call site asserts for itself.
**Fix:** One `toUserId` that validates, and treat any other `as UserId` as a
review failure.

**Symptom:** `TS1332: A variable whose type is a 'unique symbol' type must be
'const'.`
**Cause:** `let` or `var` for the brand symbol.
**Fix:** `declare const`. Uniqueness is tied to the declaration.

**Symptom:** `TS1331: A property of a class whose type is a 'unique symbol' type
must be both 'static' and 'readonly'.`
**Cause:** A `unique symbol` as an instance member.
**Fix:** `static readonly`, or move the symbol out of the class.

**Symptom:** A branded value loses its brand after `JSON.parse`
**Cause:** Brands are erased; parsed data is whatever the JSON said.
**Fix:** Re-assert through the constructor function at the boundary — the one
place it should happen anyway.

**Symptom:** `'' as UserId` compiles
**Cause:** A brand is not a validator.
**Fix:** Never assert outside the constructor; put the check there.

**Symptom:** Error messages became unreadable
**Cause:** The brand's intersection now appears in every message mentioning the
type.
**Fix:** Prefer a short string key over `unique symbol`, and name the brand
exactly as the type is named.

**Symptom:** `TS2367: This comparison appears to be unintentional because the
types 'X' and 'Y' have no overlap.`
**Cause:** Comparing two differently-branded values — the brand working.
**Fix:** Compare the underlying values deliberately if that is what you meant.

## Interview questions

**★ What is a branded type and why would you use one?**
An intersection of a real type with a phantom property that nothing else can
have — `type UserId = string & { readonly __brand: 'UserId' }`. It fakes nominal
typing in a structural type system, so a `PostId` can no longer be passed where a
`UserId` belongs. The property exists only in the type system; at runtime the
value is still a `string`.

**★ How do you create a branded value?**
Through one constructor function that validates and asserts —
`function toUserId(raw: string): UserId`. That is the real value of the pattern:
the unsafe `as` appears **once**, in a place that checks, instead of being spread
across the codebase as an invisible convention.

**★ Does a brand guarantee the value is valid?**
No. `'' as UserId` compiles — a brand records the *claim* that validation
happened. Only the constructor function makes the claim true, and a brand with
assertions scattered everywhere is worse than none, because it costs the ceremony
and provides no guarantee.

**What is the alternative to a type-level brand?**
A class with a `private` or `#` member: those compare by declaration site rather
than structurally, which is nominal typing already built into the language. It
costs an allocation per value and the value stops being a `string`, but you gain
a runtime check — `#brand in obj`, which even survives a duplicated package.

**What are the costs?**
Friction at every boundary — constructors on the way in, test fixtures, and
re-asserting after `JSON.parse` — plus error messages that now spell out the
intersection. Brand where a mix-up is genuinely costly: IDs across tables, units,
sanitised versus raw HTML. Not for tidiness.

---

← Prev: [06 · Global augmentation](./06-global-augmentation.md) · Next → [08 · `readonly` members and definite assignment](./08-readonly-and-definite-assignment.md)
