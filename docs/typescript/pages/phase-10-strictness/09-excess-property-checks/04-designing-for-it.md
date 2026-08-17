---
title: "Designing for it"
sidebar_label: "04 · Designing for it"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 from the **compiler's own option table** in the **TypeScript
> 5.9.3** build — `suppressExcessPropertyErrors`, *"Disable reporting of excess
> property errors during the creation of object literals"*,
> `defaultValueDescription: false`, **`category: Backwards_Compatibility`** — and
> the **TypeScript handbook** on `satisfies` and on checking a literal against a
> union. **No sandbox, no console block.**

Three rules with known gaps is a fact about the compiler. This chunk is what to
do about it in code you control.

## Rule 1 · `satisfies` on every configuration object

The single highest-value habit from this topic:

```ts
export const config = {
  port: 3000,
  host: 'localhost',
  timeoutMs: 5000,
} satisfies ServerConfig;
```

It buys two things at once, and the second is why it beats an annotation:

- **The literal is checked** — typos are caught, at the one place the information
  exists.
- **The narrow type survives.** `config.port` is `3000`, not `number`;
  `config.host` is `'localhost'`, not `string`. An annotation would widen both.

🔴 **`satisfies` is what an annotation should have been for config objects.**
Annotating gives you the check and takes the precision; `satisfies` gives you the
check and keeps it. Full treatment:
[phase 2 · `satisfies`](../../phase-2-narrowing/10-satisfies/README.md).

📌 **Apply it at the declaration, not at the use.** The value of the check is
proportional to how close it is to where someone types a property name.

## Rule 2 · Annotate factory return types

```ts
function defaultOptions(): Options {          // ← the annotation is the check
  return { retries: 3, timeoutMs: 500 };
}
```

Without it the returned literal has no target and is unchecked
([chunk 02](./02-where-freshness-is-lost.md)). Factories are precisely where
option objects are constructed, so this is where the check is worth the most and
is most often missing.

## Rule 3 · Do not put an options bag behind one required field

The gap from [chunk 03](./03-the-second-and-third-rules.md) — a typo in an
optional property, on a type with one required property, through a variable — is
reachable because this shape is common:

```ts
interface RequestOptions {
  url: string;              // required — kills weak type detection
  timeoutMs?: number;
  retries?: number;
}
```

Two ways out, both improving the API independently:

```ts
// A — the required thing is a separate parameter
function request(url: string, opts?: RequestOptions): void;

// B — the object is genuinely all-optional, so weak type detection protects it
interface RequestOptions { timeoutMs?: number; retries?: number }
```

📌 **Option A is usually better design anyway.** A required field inside an
"options" object is not an option, and separating it makes the signature say so.
The type-checking improvement is a side effect of getting the shape right.

## Rule 4 · Discriminate before checking against a union

A literal checked against a union gets a weaker check
([chunk 02](./02-where-freshness-is-lost.md)). Where it matters, narrow the
target:

```ts
const c = { kind: 'circle', radius: 1 } satisfies Extract<Shape, { kind: 'circle' }>;
```

⚠️ **Do not rely on a union target for typo detection.** If a factory or a
reducer builds values of a union type, check each branch against its specific
member.

## Rule 5 · Never `suppressExcessPropertyErrors`

The compiler option that turns this entire topic off, project-wide:

```json
{ "compilerOptions": { "suppressExcessPropertyErrors": true } }
```

🔴 **It sits in `category: Backwards_Compatibility`** in the option table, which
is the compiler's own assessment. It exists so that pre-1.6 projects keep
compiling, not as a configuration choice.

Turning it on removes:

- typo detection on every object literal in the project,
- the `TS2561` *"Did you mean to write…"* suggestions, which are the most
  actionable errors TypeScript produces,
- the check at every nesting level of every config object.

…and leaves **no per-site record** that any of it happened. A reader at an
affected literal sees nothing.

⚠️ **It is the first thing to grep for on an unfamiliar codebase with an
implausibly low error count**, alongside the rest of
[topic 08 chunk 03](../08-suppression-directives/03-the-suppression-tiers.md)'s
config audit.

## When you genuinely want the extra property

Occasionally a literal really should carry more than the target declares — a
metadata field a downstream consumer reads, a marker property. The honest ways,
best first:

1. **Put it in the type.** If something reads it, it is part of the contract.
2. **Widen with an index signature** where the extras are genuinely open-ended:
   `interface Options { retries?: number; [k: string]: unknown }`. ⚠️ This
   disables the typo check for *every* key, so it is a real cost, and it is what
   [topic 06's `noPropertyAccessFromIndexSignature`](../06-the-other-correctness-flags/02-index-signature-access.md)
   exists to make visible again.
3. **Assign through a variable**, knowingly, with a comment. This is the
   freshness escape used deliberately rather than by accident.
4. **`as`** — last, and it needs the same justification as any other assertion
   ([topic 07](../07-unsound-by-design/02-the-holes-you-opt-into.md)).

## Gotchas

**Symptom:** `satisfies` was added and a downstream type broke.
**Cause:** it preserves the narrow literal type, which is usually wanted and
occasionally not — a mutable `port: 3000` cannot later be assigned `4000`.
**Fix:** annotate instead where you need the wider type, or widen the specific
field.

**Symptom:** a config object is checked and a nested one is not.
**Cause:** `satisfies` at the outer level does check nested literals — so the
nested object came from a variable or a spread.
**Fix:** `satisfies` at the inner declaration too.

**Symptom:** adding an index signature silenced the typo errors.
**Cause:** every key is now legal. This is the documented cost of the escape.
**Fix:** `noPropertyAccessFromIndexSignature` at least makes index access
visible, but the typo check does not come back. Prefer putting the field in the
type.

**Symptom:** a required field was added to an options interface and typo
detection quietly weakened.
**Cause:** weak type detection stopped applying.
**Fix:** move the required field to its own parameter, which is better design
regardless.

**Symptom:** the project has `suppressExcessPropertyErrors` and nobody knows who
added it.
**Cause:** usually copied from an old config, or added during a migration and
never removed.
**Fix:** remove it and fix the resulting errors. Expect most to be real typos and
renames.

**Symptom:** `satisfies` is unavailable.
**Cause:** it needs TypeScript 4.9 or later.
**Fix:** annotate a separate `const` used only for the check, or upgrade. On the
versions this corpus targets it is always available.

## Interview questions

**What is the single most useful habit from this topic?**
`satisfies` on configuration objects at their declaration. It checks the literal
where the typo would be written and keeps the narrow inferred type, whereas an
annotation checks it and widens it. For config objects the narrow type is
normally the one you want.

**Why annotate a factory's return type?**
Because without it the returned literal has no target and is not checked at all.
Factories are exactly where option objects get built, so an unannotated factory
is the most likely place for a silently-misspelled property to originate.

**Why is a required field inside an options object a type-checking problem?**
Because it stops the type being weak, so weak type detection no longer applies —
and if the object is then passed through a variable, excess property checking
does not apply either. A typo in one of the optional fields is caught by nothing.
Moving the required field to its own parameter fixes it, and is better API design
anyway.

**What does `suppressExcessPropertyErrors` do and why should you never set it?**
It disables excess property checking project-wide, removing typo detection on
every object literal at every nesting level along with the `TS2561` "did you mean"
suggestions — and it leaves no record at any affected site. The compiler files it
under `Backwards_Compatibility`, which is its own assessment: it exists so old
projects keep compiling.

**When is an extra property on a literal legitimate, and how should you express
it?**
When something downstream reads it — in which case it belongs in the type. If the
extras are genuinely open-ended, an index signature is honest but disables typo
checking for every key. Passing through a variable is the deliberate freshness
escape, and `as` is the last resort with the same burden of justification as any
other assertion.

---

← [03 · The second and third rules](./03-the-second-and-third-rules.md) · [Topic index](./README.md) · Next → **10 · The error codes you will actually meet** *(not written yet)*
