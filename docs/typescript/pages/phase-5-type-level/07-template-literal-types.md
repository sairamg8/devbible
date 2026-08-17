---
title: "Template literal types"
sidebar_label: "07 · Template literal types"
sidebar_position: 7
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Template Literal
> Types*), whose `World`/`Greeting`, `AllLocaleIDs`, `LocaleMessageIDs`,
> `PropEventSource`/`makeWatchedObject` and the four intrinsic examples are
> **quoted verbatim**, including the statement that the intrinsics use
> JavaScript's native string methods and are not locale-aware. `TS2590` is read
> out of the compiler's own message table and confirmed present in **TypeScript
> 7.0.2**. **No console block** — no sandbox run covers this phase.

A template literal type is a **string built at the type level**. Same syntax as a
JavaScript template literal, in a type position:

```ts
type World = "world";

type Greeting = `hello ${World}`;
// type Greeting = "hello world"
```

On its own that is a curiosity. What makes it a feature is what happens when a
**union** is interpolated.

## Unions expand, and multiple slots multiply

```ts
type EmailLocaleIDs = "welcome_email" | "email_heading";
type FooterLocaleIDs = "footer_title" | "footer_sendoff";

type AllLocaleIDs = `${EmailLocaleIDs | FooterLocaleIDs}_id`;
// type AllLocaleIDs = "welcome_email_id" | "email_heading_id" |
//                     "footer_title_id" | "footer_sendoff_id"
```

Every member of the union produces a string, and the result is the union of all of
them. With more than one interpolated position they **cross-multiply**:

```ts
type Lang = "en" | "ja" | "pt";

type LocaleMessageIDs = `${Lang}_${AllLocaleIDs}`;
// "en_welcome_email_id" | "en_email_heading_id" | … 12 members in total
```

3 × 4 = 12. That multiplication is the feature and the hazard in one: four slots
of ten members each is ten thousand string literals, and the compiler will tell
you when it has had enough:

> **`TS2590`: Expression produces a union type that is too complex to represent.**

**Keep the number of interpolated unions small, and keep them small.** If a
pattern genuinely has thousands of valid strings, match it with `infer`
([topic 06 · chunk 02](./06-infer/02-strings-and-your-own.md)) instead of
enumerating it.

## The event-handler example, in full

This is the handbook's showcase, and it is worth reading closely because it
combines everything in the phase:

```ts
type PropEventSource<Type> = {
  on<Key extends string & keyof Type>(
    eventName: `${Key}Changed`,
    callback: (newValue: Type[Key]) => void,
  ): void;
};

declare function makeWatchedObject<Type>(
  obj: Type,
): Type & PropEventSource<Type>;

const person = makeWatchedObject({
  firstName: "Saoirse",
  lastName: "Ronan",
  age: 26,
});

person.on("firstNameChanged", (newName) => {
  console.log(`new name is ${newName.toUpperCase()}`);
});

person.on("ageChanged", (newAge) => {
  if (newAge < 0) console.warn("warning! negative age");
});
```

Three things happen at once, and the third is the one people miss:

1. **The event name is checked against a pattern.** `"firstNameChanged"` is legal
   because `firstName` is a key; `"firstNameChangd"` is not.
2. **`Key` is inferred backwards out of the string.** The compiler matches
   `"firstNameChanged"` against `` `${Key}Changed` `` and concludes
   `Key = "firstName"`.
3. **The callback is typed from that inference.** `newValue: Type[Key]` makes
   `newName` a `string` and `newAge` a `number` — different types for different
   event names in the same API.

`string & keyof Type` appears again here for the same reason as in
[topic 04](./04-key-remapping.md): keys can be `number` or `symbol`, and a
template slot needs a string.

## The four intrinsics

```ts
type Greeting = "Hello, world";

type ShoutyGreeting = Uppercase<Greeting>;
// type ShoutyGreeting = "HELLO, WORLD"

type QuietGreeting = Lowercase<Greeting>;
// type QuietGreeting = "hello, world"
```

`Capitalize` and `Uncapitalize` change only the first character. All four are
**compiler intrinsics** — there is no `lib` definition to read, and you cannot
write a fifth ([topic 03 · chunk 05](./03-utility-types/05-oddities.md)).

⚠️ **They are not locale-aware.** The handbook says they use JavaScript's native
string methods, which means Turkish dotted/dotless `i` and similar cases behave as
`String.prototype.toUpperCase` does, not as a locale-aware transform would. For
identifiers and API keys that is exactly right; for anything user-facing, this is
the wrong tool and always was.

## What it is actually for

Four patterns that recur, all of which are the same idea — **a string whose shape
carries meaning**:

```ts
// 1 · Prefixed keys, derived from a model
type Model = { name: string; age: number };
type Setters = { [K in keyof Model as `set${Capitalize<string & K>}`]: (v: Model[K]) => void };

// 2 · CSS-ish units that cannot be mixed up
type Px = `${number}px`;
type Percent = `${number}%`;
const width: Px = "12px";      // ✅
// const bad: Px = "12";       // ❌

// 3 · Route patterns
type Route = `/${string}`;
function navigate(to: Route) {}
// navigate("users");          // ❌ must start with a slash

// 4 · Discriminating an id by its prefix
type UserId = `user_${string}`;
type OrderId = `order_${string}`;
```

Pattern 4 is the cheap alternative to a branded type
([phase 4 · topic 07](../phase-4-classes-declarations/07-branded-nominal-types.md)):
no constructor, no cast, and it catches the common mistake of passing one id where
another belongs. What it cannot do is stop a *hand-written* `"user_x"` from being
used as a `UserId` — for that you still need a brand.

## The limits worth knowing before you commit

- **`${number}` and `${string}` are patterns, not parsers.** `` `${number}px` ``
  accepts `"1e5px"` and `"-0px"`, because those are valid number literals. It is a
  shape check, not validation.
- **No arithmetic.** You cannot add, compare or count with template literal types;
  numeric work at the type level is done with tuple lengths
  (**13 · Tuple manipulation**, *not written yet*).
- **The expansion is eager.** A union interpolated into a template is materialised
  as literals, so it costs memory in the checker and shows up in hover output as a
  wall of strings.
- **Error messages print every member.** A twelve-member union prints twelve
  strings; a two-hundred-member one prints two hundred. This is the readability
  cost topic 08 is about.

## Gotchas

**Symptom:** `TS2590` — the union is too complex to represent
**Cause:** Interpolated unions cross-multiply; three or four slots is enough.
**Fix:** Reduce the slots, narrow the unions, or stop enumerating and match with
`infer` instead.

**Symptom:** `Capitalize<K>` errors inside a mapped type
**Cause:** `keyof T` may include `number` and `symbol`.
**Fix:** `Capitalize<string & K>`, at the cost of homomorphism
([topic 04](./04-key-remapping.md)).

**Symptom:** `` `${number}px` `` accepted a string you consider invalid
**Cause:** It matches any valid numeric literal — `"1e5px"`, `"-0px"`, `"0.5px"`.
**Fix:** It is a shape check. Validate at runtime if the exact format matters.

**Symptom:** An intrinsic produced an unexpected letter
**Cause:** The intrinsics are not locale-aware; they follow the native string
methods.
**Fix:** Do not use them on user-facing text; they are for identifiers.

**Symptom:** Hover on a template type prints hundreds of strings
**Cause:** The expansion is eager and every member is a literal.
**Fix:** Alias the type, or express the constraint with a pattern rather than an
enumeration.

**Symptom:** The `on("xChanged")` style API infers `Key` as `string`
**Cause:** The argument was not a literal — a widened `const`, or a variable.
**Fix:** Pass the literal directly, or `as const` at the source.

**Symptom:** A `UserId` template type accepted a hand-written string
**Cause:** Template literal types are structural — any matching string qualifies.
**Fix:** Expected. If you need it unforgeable, use a branded type.

## Interview questions

**★ What happens when you interpolate a union into a template literal type?**
It expands: every member of the union produces one string literal, and the result
is the union of all of them. With several interpolated positions the unions
**cross-multiply** — `Lang` (3) × `AllLocaleIDs` (4) gives 12 members. That growth
is why `TS2590`, *"Expression produces a union type that is too complex to
represent"*, exists.

**★ Explain how `person.on("firstNameChanged", cb)` types its callback.**
The parameter is `` `${Key}Changed` `` with `Key extends string & keyof Type`, so
matching the literal `"firstNameChanged"` infers `Key = "firstName"`. The callback
is then typed `(newValue: Type[Key]) => void`, so it receives a `string` for that
event and a `number` for `"ageChanged"`. The inference runs *backwards* out of the
string, which is the part worth being able to explain.

**★ What are the four intrinsic string types, and what should you not use them
for?**
`Uppercase`, `Lowercase`, `Capitalize`, `Uncapitalize`. They are compiler
intrinsics with no `lib` definition, so you cannot add a fifth, and the handbook
notes they use JavaScript's native string methods and are **not locale-aware** —
so they belong on identifiers and API keys, never on user-facing text.

**When is a template literal type a good alternative to a branded type?**
When you want cheap discrimination between id kinds — `` `user_${string}` `` vs
`` `order_${string}` `` — with no constructor and no assertion. It catches the
common mistake of passing the wrong id. It does not make the type unforgeable: any
matching literal qualifies, so a genuine invariant still needs a brand.

**Why does `` `${number}px` `` accept `"1e5px"`?**
Because `${number}` matches any valid numeric literal, not a restricted format. It
is a shape check rather than validation — useful for stopping `"12"` where
`"12px"` is required, useless for enforcing a specific numeric syntax.

**What are the costs of leaning on template literal types?**
Eager expansion — the members are materialised, so memory and hover output grow
with the product of the unions — and error messages that print every member. Both
are the same readability problem the phase keeps returning to: the type is only
worth it if the failure it produces is readable.

---

← [Phase 5 index](./README.md) · Prev: [06 · Extracting with `infer`](./06-infer/README.md) · Next → **08 · Knowing when to stop** *(not written yet)*
