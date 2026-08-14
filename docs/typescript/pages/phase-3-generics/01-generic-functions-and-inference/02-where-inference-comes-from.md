---
title: "Where inference comes from"
sidebar_label: "02 · Where inference comes from"
sidebar_position: 2
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against the **TypeScript handbook** (*Generics → Type
> argument inference*). `TS2558` (*"Expected {0} type arguments, but got {1}."*),
> `TS2347` (*"Untyped function calls may not accept type arguments."*) and
> `TS2345` were read out of the **compiler's own diagnostic table**, not
> recalled. ⚠️ Compiler inspected: TypeScript **6.0.3**, not the 7.0.2 this
> corpus targets. **No console block** — no sandbox run covers this phase.

Almost nobody writes `first<number>([1, 2, 3])`. They write `first([1, 2, 3])`
and the type parameter is solved for them. **That solving step is the part worth
understanding**, because when a generic "does not work" it is nearly always
inference that had nothing to work from, or worked from the wrong thing.

## Inference sites

The compiler matches each **argument** against the corresponding **parameter
type**, and every place a type parameter appears in a parameter type is an
*inference site* that contributes a candidate.

```ts
function map<T, U>(arr: T[], fn: (item: T) => U): U[] { … }

map(['a', 'bb'], s => s.length);
//   ^^^^^^^^^^^ site for T: T[] vs string[]      → T = string
//                ^^^^^^^^^^^^ site for U: return of fn → U = number
```

Two things in that order matter:

1. **`T` is solved from the first argument**, before the callback is checked.
2. **The solved `T` is then used as the callback's contextual type**, which is
   why `s` is `string` and not an implicit `any`.

That ordering is why rearranging parameters can break inference that used to
work, and why a callback's parameter suddenly goes `any` after someone reorders
a signature. **Put the argument that determines the type first.**

## Several sites, one answer

When a type parameter appears in more than one parameter, every occurrence
contributes a candidate and the compiler has to find a single type that works
for all of them:

```ts
function pair<T>(a: T, b: T): T[] { return [a, b]; }

pair(1, 2);            // T = number
pair('a', 'b');        // T = string
pair(1, 'a');          // the candidates conflict
```

```text
error TS2345: Argument of type 'string' is not assignable to parameter of
type 'number'.
```

The error lands on the argument that did not fit the candidate already in hand,
which is **why the reported position is often not the one you consider wrong**.
If mixed types are legitimate, say so in the signature rather than fighting the
message — either widen the parameter (`T extends string | number`) or use two
parameters (`pair<A, B>(a: A, b: B): [A, B]`). Which of the two is right depends
on whether the arguments must agree; that is a design decision the error is
prompting you to make.

## When there is nothing to infer from

```ts
declare function create<T>(): T;

const x = create();          // T = unknown
```

With no inference site, an unconstrained parameter falls back to `unknown`. That
is deliberate and it is the safe answer: the compiler will not guess, and
`unknown` forces the caller to narrow.

With a constraint, the constraint is the fallback:

```ts
declare function create<T extends object>(): T;
const y = create();          // T = object
```

**A generic whose parameter appears only in the return type is a warning sign.**
It looks like it is giving you type safety and it is really giving the caller a
free `as` — whatever they annotate is what they get, with nothing checking it.
That is the subject of **topic 13 · When not to write a generic** *(not written
yet)*, and it is one of the most common ways generics are misused in real
codebases:

```ts
declare function getJson<T>(url: string): Promise<T>;

const user = await getJson<User>('/api/me');   // no check whatsoever
```

## Passing type arguments explicitly

Sometimes inference genuinely cannot get there, and passing the argument is
correct rather than a smell:

```ts
const [value, setValue] = useState<string | null>(null);
```

Inferring from `null` alone would give `null`, and the state could then never
hold a string. The annotation is supplying information that does not exist at the
call site — which is exactly when an explicit type argument is the right tool.

Two rules constrain how you may pass them.

**It is all or nothing.** There is no partial type argument list:

```ts
declare function convert<T, U>(input: T): U;

convert<string>('x');
```

```text
error TS2558: Expected 2 type arguments, but got 1.
```

The usual workaround is a **default** on the trailing parameters
(**topic 08** *(not written yet)*) so the ones you want inferred have something
to fall back to — or splitting the function so each call supplies what it knows.

**And the callee must be typed.** Calling something typed `any` with a type
argument is refused rather than ignored:

```text
error TS2347: Untyped function calls may not accept type arguments.
```

Usually the real problem is an untyped import, not the call.

## Literal types: the `extends string` trick

By default, inference for a plain type parameter widens the way ordinary
assignment does — you get `string`, not `'ready'`. Constraining the parameter to
a primitive changes that:

```ts
declare function tag<T extends string>(s: T): T;

const a = tag('ready');           // 'ready' — the literal survives
```

```ts
declare function keys<T extends string>(...ks: T[]): T[];

const k = keys('id', 'name');     // ('id' | 'name')[]
```

**This is the mechanism behind a great many precise-looking library APIs**, and
it costs one word. When you need the same effect for *object* and *array*
literals, the tool is a `const` type parameter — **topic 12** *(not written
yet)*.

## Reading what was actually inferred

You cannot photograph a type, and a hover tooltip is editor tooling rather than
the compiler — it can be stale, and it is the wrong evidence for a claim you
intend to write down. The technique this corpus uses is the one from
[Phase 2](../../phase-2-narrowing/README.md): **make the compiler say the type
out loud** by assigning to the literal type `1`.

```ts
const r = map(['a'], s => s.length);
const reveal: 1 = r;     // error names the exact type of r
```

Nothing is assignable to `1` except `1`, so the assignment always fails and the
message names what the checker is holding. It works just as well on an inferred
type argument as on a narrowed variable, and it is the fastest way to settle
"what did `T` actually become?" without trusting a tooltip.

## Trade-off

**Letting inference do the work** keeps call sites short and, more importantly,
keeps them *correct when the signature changes* — a call with no type arguments
re-solves automatically. It costs you predictability: a signature change can
silently alter what a call infers.

**Passing type arguments explicitly** is precise and self-documenting, and it
pins the call so a later signature change becomes an error rather than a silent
difference. It costs verbosity, and it is the wrong instinct when used to paper
over a signature that should have related its arguments properly.

Default to inference. Reach for explicit arguments when there is no argument to
infer from, or when you genuinely want the call pinned.

## Gotchas

**Symptom:** A callback's parameter is implicitly `any` inside a generic call
**Cause:** The signature does not connect the callback's parameter to an earlier
argument, or the determining argument comes *after* the callback.
**Fix:** Relate them — `(arr: T[], fn: (item: T) => U)` — and put the
type-determining argument first.

**Symptom:** `TS2558: Expected 2 type arguments, but got 1`
**Cause:** Partial type argument lists are not allowed.
**Fix:** Supply all of them, or give the trailing parameters defaults so they can
be omitted.

**Symptom:** `T` comes out as `unknown`
**Cause:** No inference site — the parameter appears only in the return type.
**Fix:** Pass a value the type can be read from, or accept that the generic is
doing nothing and remove it.

**Symptom:** `TS2345` blames an argument that looks correct
**Cause:** A candidate for `T` was already fixed by an earlier argument.
**Fix:** Read the *first* argument for that parameter, not the reported one.
Then decide whether the arguments should agree at all.

**Symptom:** A generic API returns exactly the type the caller asked for, always
**Cause:** The parameter appears only in the return position — the caller is
performing an unchecked assertion.
**Fix:** Validate at the boundary and return `unknown`, or take a schema.

**Symptom:** `'ready'` widens to `string` through a helper
**Cause:** Ordinary widening on an unconstrained parameter.
**Fix:** `<T extends string>` for primitives; a `const` type parameter for object
and array literals.

## Interview questions

**★ Where does TypeScript get the value of a type parameter?**
From the arguments. Each argument is matched against its parameter type, and
every occurrence of the parameter there is an inference site contributing a
candidate. With several candidates the compiler must find one type that satisfies
all of them; with none, an unconstrained parameter falls back to `unknown` and a
constrained one to its constraint.

**★ Why is a callback's parameter typed without an annotation in `map(arr, x =>
…)`?**
Because `T` is solved from the array argument *first*, and the solved `T` then
becomes the contextual type for the callback. That ordering is also why moving
the callback before the array breaks it — put the type-determining argument
first.

**★ What is wrong with `getJson<T>(url: string): Promise<T>`?**
`T` appears only in the return type, so there is no inference site and nothing is
checked — the caller writes `getJson<User>(…)` and receives exactly what they
asked for, which is an `as` with extra steps. Return `unknown` and validate, or
take a schema that can actually verify the shape.

**When should you pass a type argument explicitly?**
When the call site has no value to infer from — `useState<string | null>(null)`,
where inferring from `null` would give `null` — or when you deliberately want the
call pinned so a later signature change errors instead of silently inferring
something else.

**How do you make a helper preserve literal types?**
Constrain the parameter to the primitive: `<T extends string>(s: T) => T` infers
`'ready'` rather than `string`. For object and array literals the equivalent is a
`const` type parameter.

---

← Prev: [01 · What a type parameter is](./01-what-a-type-parameter-is.md) · Next → **02 · Constraints** *(not written yet)*
