---
title: "The conditions you get wrong — six bugs"
sidebar_label: "06 · The conditions you get wrong"
sidebar_position: 6
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against the **ECMAScript specification** for `ToBoolean`, for
> numeric enum member values, and for the logical operators (`&&` and `||`
> **return an operand, not a boolean** — the fact bug 5 rests on); against **MDN**
> for *Falsy* and `Number.isFinite`; against **react.dev** for which child values
> render and which render nothing; and against **typescript-eslint's**
> `strict-boolean-expressions` page for which option reports which case.
> ⚠️ typescript-eslint is not installed here, so rule behaviour is
> documentation-attributed. **No sandbox, no console block.**

[Chunk 05](./05-strict-boolean-expressions.md) established the principle: `if (x)`
is a null check exactly when `x`'s type has no falsy member. This chunk is what it
costs when that is not true — **six bugs, in rough order of how often they ship.**
The fixes are here in outline; [chunk 07](./07-fixing-them-without-breaking-them.md)
takes the ones that **change runtime behaviour** and works out the migration.

🔴 **Read for the pattern, not the list.** Four of the six land on the *most
travelled* path rather than an edge case — the default enum member, the empty list,
the zero-valued option, the blank field. That is why they reach production: they are
not rare inputs, they are the ordinary ones, and every one of them reads as
idiomatic in review.

## 1 · The empty string

```ts
function greet(name: string) {
  return name ? `Welcome back, ${name}` : 'Welcome, guest'
}
greet('')     // → "Welcome, guest"
```

A user whose name is an empty string — trimmed whitespace, a cleared profile, a
blank CSV column — becomes a guest. **The type is `string` and the value is a
`string`;** nothing is missing, nothing is `undefined`, and the code took the absent
branch anyway.

**Fix:** `name !== ''`, or `name.trim() !== ''` if whitespace should count as empty
— which is usually the real requirement, and is a *different* fix from the one the
lint report implies.

⚠️ **Reported only with `allowString: false`.** The default configuration permits
this case entirely.

## 2 · The zero-valued option

```ts
function retry(opts: { attempts?: number }) {
  const attempts = opts.attempts || 3    // ← `attempts: 0` means "do not retry"
}
```

`0` is falsy, so **the one caller who explicitly asked for no retries gets three.**
The same bug wears many names: `{ timeout: 0 }`, `{ padding: 0 }`, `{ limit: 0 }`,
`{ retries: 0 }` — every numeric option whose meaningful value is zero.

**Fix:** `opts.attempts ?? 3`. `??` tests **only** `null` and `undefined`, which is
what "did the caller supply this?" always meant.

| Value of `opts.attempts` | `\|\| 3` | `?? 3` |
|---|---|---|
| `5` | `5` | `5` |
| 🔴 `0` | **`3`** — the bug | `0` |
| `undefined` | `3` | `3` |
| `null` | `3` | `3` |

⚠️ The same table with `''` in place of `0` is the string version, and it is why
`name || 'Anonymous'` overrides a deliberately blank display name.

## 3 · `NaN`

```ts
const n = Number(input)
if (n) { … }              // NaN is falsy → skipped, silently
```

A parse failure produces `NaN`, `NaN` is falsy, and the failure becomes
indistinguishable from a zero **and** from an absent value — three different
conditions collapsed into one branch.

🔴 **This is the bug whose obvious fix is also wrong**, which is why it gets its own
treatment in [chunk 07](./07-fixing-them-without-breaking-them.md): `n !== 0` is
`true` for `NaN`, so the mechanical rewrite *admits* the failure the original
rejected. The question you are actually asking is `Number.isFinite(n)`.

📌 **`-0` is not a second case.** It is falsy, but `-0 !== 0` is `false`, so it
behaves identically under both spellings. **`NaN` is the only value in the language
where truthiness and `!== 0` genuinely disagree.**

## 4 · The numeric enum's first member

```ts
enum Role { User, Admin, Owner }    // User = 0

function label(role: Role | undefined) {
  return role ? Role[role] : 'no role'
}
label(Role.User)     // → "no role"
```

A numeric enum starts at `0` unless told otherwise, so 🔴 **the falsy member is the
one declared first — which is almost always the default, ordinary, most common
case.** The bug lands on the majority path, not an edge case, which is why it tends
to be found in production rather than in review.

**Fix:** `role !== undefined`. **Better fix:** use a string enum, or start the
numeric one at `1`, and the class of bug is *gone* rather than guarded against.

⚠️ String enums are safe **unless** a member's value is `''`, which is legal and
occasionally used to mean "unset" — a spelling that reintroduces the whole problem
with none of the warning signs.

## 5 · 🔴 `{count && <Badge/>}` renders a literal `0`

The highest-visibility instance, because it is visible to users rather than to a
debugger:

```tsx
{unreadCount && <Badge count={unreadCount} />}     // renders "0" when 0
{items.length && <List items={items} />}           // renders "0" when empty
```

Two facts combine. **`&&` returns an operand, not a boolean** — `0 && x` evaluates
to `0`. And **React renders numbers**, while `false`, `null` and `undefined` render
nothing. So a falsy *number* short-circuit puts a bare `0` into the DOM, exactly
where a badge was supposed to be absent.

**Fix:** produce a boolean, or use a ternary:

```tsx
{unreadCount > 0 && <Badge count={unreadCount} />}
{items.length > 0 ? <List items={items} /> : null}
```

📌 **The string version is silent, and that is worse.** `{name && <p>{name}</p>}`
with `name === ''` evaluates to `''`, which React renders as nothing — so the markup
is *accidentally* correct, the habit is reinforced, and the identical pattern ships
next to a number where it is not.

⚠️ Reported only with `allowNumber: false`, which is the single strongest argument
for setting it.

## 6 · The optional boolean's third state

```ts
interface Options { verbose?: boolean }

if (opts.verbose) { … }    // `false` and "not supplied" take the same branch
```

An optional boolean has **three** states and truthiness collapses two of them. Fine
when the default *is* `false`; a bug the moment "unset" is supposed to inherit
something else — a config file, an environment variable, a parent component's value.

**Fix:** resolve it once at the boundary — `opts.verbose ?? inherited` — so
everything downstream holds a plain `boolean`. 🔴 **The real fix is in the type, not
in the condition.** Once the three-state value never reaches the interior, the
question stops being asked.

## Gotchas

**Symptom:** a badge shows `0` where it should be absent.
**Cause:** `{count && <Badge/>}` — `&&` returns the operand, and React renders the
number `0`.
**Fix:** `count > 0 && …`. ⚠️ Then check the strings nearby: the same pattern is
silently harmless there, which is how the habit survives long enough to reach a
number.

**Symptom:** an enum-valued condition works for every member except the common one.
**Cause:** the first member of a numeric enum is `0`.
**Fix:** `!== undefined`. And 🔴 **consider starting numeric enums at `1`** — one of
the few bug classes you can delete by declaration instead of defending against.

**Symptom:** the empty-string case is reported by nothing and ships anyway.
**Cause:** `allowString` defaults to `true`, so the default configuration never
looked at it ([chunk 05](./05-strict-boolean-expressions.md)).
**Fix:** set it to `false` deliberately, as a scheduled pass.

**Symptom:** a legitimately blank form field is treated as missing across several
layers.
**Cause:** `''` was the absent marker in one place and `undefined` in another, and
truthiness makes them interchangeable — so nothing ever forced the question.
**Fix:** pick one spelling for absent at the boundary
([topic 05 · the JSON boundary](../05-exactoptionalpropertytypes/02-the-json-boundary.md)),
and the conditions downstream stop being ambiguous on their own.

**Symptom:** a `Number(input)` result flows through the system and everything
downstream becomes `NaN`.
**Cause:** the truthiness guard rejected it at one point and a later refactor to
`!== 0` let it through.
**Fix:** `Number.isFinite`, and see chunk 07 — this is the migration's one genuine
trap.

**Symptom:** the team is convinced these are all beginner mistakes.
**Cause:** each one looks like it in isolation.
**Fix:** the enum and JSX cases are not — they hit the *default member* and the
*empty list*, the most-travelled paths in the code. Neither is visible in review,
because both read as ordinary idiom.

## Interview questions

**Give an example where truthiness produces a bug that a null check would not.**
A numeric option with a meaningful zero: `opts.attempts || 3` gives three attempts
to the caller who explicitly asked for none. `??` fixes it, because it tests only
`null` and `undefined` — the question `||` was standing in for.

**Why does `{count && <Badge/>}` render a `0`?**
Because `&&` returns one of its operands rather than a boolean, so when `count` is
`0` the whole expression *is* `0` — and React renders numbers, while it renders
nothing for `false`, `null` and `undefined`. Fix it by producing a real boolean with
`count > 0`. The same pattern on a string is invisible, because `''` renders as
nothing, which is why the habit persists.

**What is wrong with numeric enums in conditions?**
Their first member is `0` unless you say otherwise, so it is falsy — and the first
member is usually the default or most common case, which puts the bug on the
majority path. Compare against `undefined` explicitly, or remove the class of bug
entirely with a string enum or by starting at `1`.

**Which of these does the rule's default configuration actually catch?**
Only the ones involving a nullable value — the optional boolean, and the enum and
string cases *when they are optional*. `allowString` and `allowNumber` both default
to `true`, so a plain `string` or `number` in a condition is permitted. The empty
username and the zero-valued option are not reported until you set those two options
to `false` yourself.

**Why do these reach production when they look obvious on a slide?**
Because they land on the ordinary path rather than an edge case: the first enum
member is the default role, the empty list is the new user's list, the blank field
is the optional one, and zero is a legitimate configuration. None of them requires
unusual input, and all of them read as idiomatic JavaScript in review — there is
nothing at the call site for a reviewer to notice.

**Which of the six would you fix first on an existing codebase?**
The JSX number case, for two reasons: it is user-visible, and it is mechanically
findable with `allowNumber: false` in a pass small enough to review in one sitting.
The empty-string pass is larger and mostly stylistic; the enum one is best fixed at
the declaration rather than at every condition.

---

← [05 · `strict-boolean-expressions`](./05-strict-boolean-expressions.md) · [Topic index](./README.md) · Next → [07 · Fixing them without breaking them](./07-fixing-them-without-breaking-them.md)
