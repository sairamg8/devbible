---
title: "no-floating-promises — the check the compiler genuinely does not have"
sidebar_label: "02 · no-floating-promises"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 against **typescript-eslint's own rule page** for
> `no-floating-promises` — description, preset membership and every option default
> quoted from it — and the **TypeScript 5.9.3 numbered diagnostic table** for the
> claim that no compiler diagnostic covers this (searched for the codes that come
> closest and named them). ⚠️ typescript-eslint is not installed here, so the rule
> metadata is from documentation, not source. **No sandbox, no console block.**

If you adopt one type-aware rule, adopt this one.

> 🔴 **This is the clearest case in the whole topic where the compiler has
> nothing.** Not a weaker version, not a version behind a flag —
> **`strict: true` with all nine flags on, plus every correctness flag from
> [topic 06](../06-the-other-correctness-flags/README.md), reports nothing at all
> for an unhandled promise.** The bug is invisible to `tsc` by construction.

The rule's description, verbatim: *"Require Promise-like statements to be handled
appropriately."*

## The bug

```ts
async function saveOrder(o: Order) { /* … writes to the database */ }

function handler(req, res) {
  saveOrder(req.body);          // ← nothing awaits this
  res.status(200).send("ok");
}
```

**The response is sent before the write completes**, and if the write rejects the
rejection is unhandled. On Node that terminates the process by default — so the
failure mode is *"the API returned 200 and then the server restarted"*.

📌 **What makes this class of bug distinctive is that the happy path works.** In
development, against a fast local database, the write almost always finishes first.
The bug appears under load, in production, as data that is sometimes missing.

## 🔴 Why the compiler cannot catch it, and what it does instead

An expression statement that discards its value is **legal JavaScript** and legal
TypeScript. `saveOrder(req.body);` is exactly as well-typed as `computeTotal();` —
the type system has no notion of "this value must be consumed".

The closest the compiler comes is a set of codes that fire when a promise ends up
somewhere it *does* type-check against something:

| Code | Fires on | But not on |
|---|---|---|
| `TS2801` *"This condition will always return true since this '{0}' is always defined."* | `if (promise)` | a bare statement |
| `TS2367` *"…the types '{0}' and '{1}' have no overlap."* | `promise === value` | a bare statement |
| `TS2339` + `TS2773` *"Did you forget to use 'await'?"* | `promise.field` | a bare statement |

🔴 **Every one of those needs the promise to be *used*.** A floating promise is
precisely the case where it is used for nothing, so there is no comparison, no
property access and no condition to attach a diagnostic to. ([Chunk 03](./03-no-misused-promises.md) is the
rule covering the cases the compiler *partly* covers; this one has no overlap at
all.)

📌 **This is worth being precise about**, because the topic's framing elsewhere is
that the compiler often does more than people think. Here it does nothing, and the
reason is structural rather than an omission.

## The options, and the one convention that matters

| Option | Default |
|---|---|
| `ignoreVoid` | 🔴 **`true`** |
| `ignoreIIFE` | `false` |
| `checkThenables` | `false` |
| `allowForKnownSafePromises` | `[]` |
| `allowForKnownSafeCalls` | `[]` |

### 🔴 `ignoreVoid: true` is why you see `void` in front of calls

Because the default is `true`, the rule accepts the `void` operator as an explicit
"I am deliberately not awaiting this":

```ts
void saveOrder(req.body);        // accepted: deliberate fire-and-forget
```

**This is the single most useful thing to know about the rule**, because
`void somePromise()` in a codebase looks like a mistake and is the opposite — it is
a reviewed decision, made visible. ⚠️ **And it is not a fix for the bug above.** It
silences the rule; it does not make the write finish before the response. Use it
only where dropping the result is genuinely correct — metrics, fire-and-forget
logging, cache warming.

📌 **`void` beats `.catch(() => {})` for this**, because a bare `.catch` swallows
the error silently while `void` leaves the rejection to whatever global handler you
have. If the promise can reject and you do not want to crash, you need a real
`.catch` **with a body that reports**, not an empty one.

### The three fixes, in order

```ts
await saveOrder(req.body);                          // 1. the usual answer
void saveOrder(req.body);                           // 2. deliberate, and visible
saveOrder(req.body).catch(err => log.error(err));   // 3. detached but reported
```

### `checkThenables: false` is a deliberately narrow default

With it off the rule checks real `Promise`s and not arbitrary objects that happen
to have a `.then`. 📌 **Turn it on if you use a library with a custom thenable** —
older query builders and some ORMs return lazily-executing thenables, which are
exactly as easy to float as a promise and are invisible with the default.

### The two allowlists

`allowForKnownSafePromises` and `allowForKnownSafeCalls` both default to `[]` and
take type or function specifiers. ⚠️ **Reach for these rather than a blanket
`ignoreVoid` change** when a framework legitimately returns a promise nobody should
await — a common case with test-runner and router APIs. An allowlist keeps the rule
on everywhere else.

## Where this connects to the rest of the phase

- **[Topic 08](../08-suppression-directives/README.md)'s ladder applies to lint
  rules too.** `// eslint-disable-next-line @typescript-eslint/no-floating-promises`
  is the same category of act as `@ts-expect-error` — ⚠️ **but with one important
  difference: ESLint has no `TS2578` equivalent.** There is no built-in error for a
  disable comment that has become unnecessary, so lint suppressions rot in a way
  `@ts-expect-error` provably cannot.
- 📌 **That asymmetry is a genuine argument for preferring `void`** over a disable
  comment: `void` is code the compiler still checks, not a comment that switches
  checking off.
- **[Phase 7 · Typed Express handlers](../../phase-7-server/05-typed-express-handlers/02-a-promise-the-compiler-cannot-keep.md)**
  argues the same territory from the framework side — an `async` handler whose
  rejection Express 4 will not catch. **That page owns the framework case; this rule
  is the general check**, and the two together are why this bug class is worth a
  CI rule rather than a code-review habit.

## Gotchas

**Symptom:** the rule fires on a call you deliberately do not await.
**Cause:** working as intended.
**Fix:** `void` in front of it — the default `ignoreVoid: true` exists for exactly
this. Not a disable comment, which switches off future checking of that line too.

**Symptom:** `void promise()` in a codebase looks like someone was confused.
**Cause:** it is the rule's sanctioned spelling for deliberate fire-and-forget.
**Fix:** none — but a one-line comment saying *why* nothing awaits it makes the
next reader's job much easier.

**Symptom:** the rule does not fire on your ORM's query builder.
**Cause:** `checkThenables` defaults to `false`, and a lazily-executing query
builder is a thenable rather than a `Promise`.
**Fix:** `checkThenables: true`. This is the option most worth changing on a
database-heavy codebase.

**Symptom:** an unhandled rejection crashes the process and the code looked fine.
**Cause:** a floating promise. Node terminates on unhandled rejections by default.
**Fix:** the rule. And note that this is a *production* failure mode — a floating
promise that always resolves in development is invisible until it does not.

**Symptom:** `.catch(() => {})` was added to satisfy the rule.
**Cause:** it does satisfy it, and it is worse than the original.
**Fix:** an empty catch converts a loud crash into silent data loss. Either report
in the catch body, or use `void` and let the global handler see it.

**Symptom:** the rule fires inside a `forEach` callback and `await` does not help.
**Cause:** ⚠️ this is the neighbouring bug — an `async` callback passed to something
that ignores its return value. `await` inside the callback does not make `forEach`
wait.
**Fix:** [`no-misused-promises`](./03-no-misused-promises.md) is the rule for that
shape, and `for…of` with `await`, or `Promise.all(map(…))`, is the code fix.

**Symptom:** you cannot enable the rule because a framework API floats promises
everywhere.
**Cause:** a real conflict, common with routers and test runners.
**Fix:** `allowForKnownSafeCalls` or `allowForKnownSafePromises` rather than
disabling the rule. Both default to `[]`, and both keep the rule live elsewhere.

## Interview questions

**What is a floating promise and why can't the compiler catch it?**
A promise-returning call whose result is discarded — `saveOrder(x);` with no
`await`. The compiler cannot catch it because an expression statement that discards
its value is legal, and the type system has no concept of a value that must be
consumed. The codes that come closest — `TS2801`, `TS2367`, `TS2339` with its
*"Did you forget to use 'await'?"* hint — all require the promise to be *used*
somewhere, which is precisely what a floating promise does not do.

**Why is this the first type-aware rule to adopt?**
Because it is the only one where the compiler offers nothing at all, and the bug it
finds is a production-only failure: the happy path works in development, and the
symptom under load is a response sent before its write completed, plus an unhandled
rejection that terminates the process. It is also the cheapest to comply with —
usually one `await`.

**What does `void somePromise()` mean in a codebase using this rule?**
That someone deliberately chose not to await it. The rule's `ignoreVoid` option
defaults to `true`, making the `void` operator the sanctioned way to say
fire-and-forget. It is preferable to a disable comment because it is code the
compiler still checks, and preferable to `.catch(() => {})` because it leaves the
rejection visible to a global handler instead of swallowing it.

**When would you change `checkThenables`?**
On a codebase using a library whose API returns lazily-executing thenables rather
than real promises — some query builders and ORMs. The default of `false` means
those are not checked, so exactly the same bug is invisible. Turning it on is the
highest-value option change for a database-heavy project.

**Someone silences the rule with `.catch(() => {})`. What is the problem?**
It converts a loud failure into a silent one. The unhandled rejection was at least
going to crash the process and appear in the logs; an empty catch means the write
fails and nothing anywhere records it. Either the catch body reports the error, or
`void` is the honest spelling.

**How does suppressing a lint rule differ from suppressing a compiler error?**
`@ts-expect-error` has `TS2578` — the compiler errors when the suppression becomes
unnecessary, which makes it self-cleaning. ESLint has no equivalent, so an
`eslint-disable` comment stays valid forever and rots silently. That asymmetry is a
concrete reason to prefer a code-level answer like `void` over a comment.

---

← [01 · What type-aware means](./01-what-type-aware-means.md) · [Topic index](./README.md) · Next → [03 · `no-misused-promises`](./03-no-misused-promises.md)
