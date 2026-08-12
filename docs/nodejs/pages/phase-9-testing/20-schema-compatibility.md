---
title: "Schema compatibility — breaking vs non-breaking changes"
sidebar_label: "20 · Schema compatibility"
sidebar_position: 20
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0** — `zod` 4.4.3, messages quoted verbatim.

**"Is this change breaking?" has a mechanical answer, and it is worth knowing it by
heart** — because the wrong answer costs a version bump nobody needed, or an incident
nobody expected.

## The rule

A change is **non-breaking** if every message valid under the old schema is still valid
under the new one, and every consumer written against the old schema still finds what it
reads.

Direction matters, and it inverts between the two sides:

- **Response** (you → consumer): **adding** is safe, **removing or narrowing** is not.
- **Request** (consumer → you): **relaxing** is safe, **tightening** is not.

Adding a required request field is breaking. Adding a response field is not. Same verb,
opposite answers — which is why "we only added something" is not a defence.

## The measured matrix

Against a consumer contract of
`{id: number, name: string, email: string, createdAt: string}`:

| Change | Verdict | What the consumer sees |
|---|---|---|
| Add an optional field (`nickname`) | ✅ compatible | ignored |
| Widen a free-string value | ✅ compatible | ignored |
| **Remove a field** | ✖ **breaking** | `email: Invalid input: expected string, received undefined` |
| **Rename a field** | ✖ **breaking** | `createdAt: Invalid input: expected string, received undefined` |
| **Narrow a type** (`1` → `'1'`) | ✖ **breaking** | `id: Invalid input: expected number, received string` |
| **Null a required field** | ✖ **breaking** | `email: Invalid input: expected string, received null` |

**A rename is a removal plus an addition** and reads identically to a deletion at the
consumer. There is no such thing as "just renaming a field" across an API boundary.

## The fuller table

| Change | Response | Request |
|---|---|---|
| Add optional field | ✅ | ✅ |
| Add **required** field | ✅ | ✖ |
| Remove field | ✖ | ✅ |
| Rename field | ✖ | ✖ |
| Widen type (`number` → `number \| string`) | ✖ | ✅ |
| Narrow type | ✖ | ✅ for the server, ✖ for existing callers |
| Make a field nullable | ✖ | ✅ |
| Make a nullable field required | ✅ | ✖ |
| **Add** an enum value | ✖ (see below) | ✅ |
| Remove an enum value | ✅ if unused | ✖ |
| Change a field's meaning, same type | ✖ **worst case** | ✖ |
| Loosen validation | ✅ | ✅ |
| Tighten validation | ✅ | ✖ |

Two rows deserve their own explanation.

**Adding an enum value to a response is breaking**, though it looks additive: a consumer
with an exhaustive `switch` — or a TypeScript union — meets a value it has no branch
for. Ship the *handling* first, wait for consumers to deploy, then start emitting it.

**Changing a field's meaning while keeping its type** is the worst change on the table,
because no schema check catches it. `amount` in euros becoming `amount` in cents
validates perfectly and is off by a hundred. Never redefine a field — add a new one and
deprecate the old.

## Testing it

Keep the previous schema and assert that old payloads still validate:

```js
import {UserResponseV1} from '../contracts/user-response.v1.mjs';
import {UserResponse} from '../contracts/user-response.mjs';

test('v1 consumers still work against the current response', async () => {
  const body = await getUser(1);
  assert.equal(UserResponse.safeParse(body).success, true);     // current
  assert.equal(UserResponseV1.safeParse(body).success, true);   // still compatible
});
```

The second assertion is the compatibility test. It fails the moment someone removes,
renames or narrows a field a v1 consumer reads — in the provider's own suite, with the
field named ([page 19](./19-contract-testing.md)).

For a machine check, `oasdiff` or `openapi-diff` classify changes between two OpenAPI
documents and exit non-zero on a breaking one — a useful CI gate when the spec is
authoritative.

## Making a breaking change safely

**Expand, migrate, contract** — the same shape as a zero-downtime schema migration:

```
1. EXPAND    add `created_at` alongside `createdAt`; populate both
2. MIGRATE   consumers move to `created_at` at their own pace
3. CONTRACT  remove `createdAt` once telemetry shows nobody reads it
```

The contract step needs evidence, not an announcement. Log which fields consumers
request where you can (GraphQL, sparse fieldsets), or version the client and track
deployed versions. "We emailed everyone" is not evidence.

When a change genuinely cannot be expanded — a restructure, not a rename — version it:

```
/v1/users    → keeps the old shape until it can be retired
/v2/users    → the new one
```

Versioning is expensive: two code paths, two test suites, two sets of bugs. Spend it on
real restructures, not on a field rename that expand-migrate-contract would have
handled.

## Deprecation that works

```js
res.setHeader('Deprecation', 'true');
res.setHeader('Sunset', 'Wed, 31 Dec 2026 23:59:59 GMT');
res.setHeader('Link', '</docs/migrations/v2>; rel="deprecation"');
```

Standard headers a client can log or alert on. Pair them with a metric per deprecated
field or endpoint, so the contract step is a decision made from data.

## Gotchas

**Symptom:** "We only added a field" and a consumer broke
**Cause:** It was added to a *request* as required, or it was a new enum value in a
response.
**Fix:** Optional on requests; ship enum handling before emitting the value.

**Symptom:** A rename broke everything despite the data being unchanged
**Cause:** A rename is a removal plus an addition. Measured: the consumer reports
`createdAt … received undefined`, identical to a deletion.
**Fix:** Expand, migrate, contract.

**Symptom:** Everything validates and the numbers are wrong by 100×
**Cause:** A field's meaning changed while its type did not — euros to cents.
**Fix:** Never redefine a field; add a new one and deprecate the old.

**Symptom:** A field was removed and an old client still broke, months later
**Cause:** Removal based on an announcement rather than evidence.
**Fix:** Instrument usage; remove when it reaches zero.

**Symptom:** A response field is now sometimes `null` and consumers crash
**Cause:** Making a field nullable is breaking for a response.
**Fix:** Treat it as a type change: expand, migrate, contract.

**Symptom:** Every change turns into a new API version
**Cause:** Versioning used where expand-migrate-contract would work.
**Fix:** Reserve versioning for restructures; two live versions is two of everything.

## Interview questions

**★ Why is adding a field breaking for a request but not for a response?**
Direction. A consumer ignores unknown response fields, so adding one is safe; a server
that now requires a new field rejects every existing caller. The rule is: relax what
you accept, do not remove what you return.

**★ Is renaming a field a breaking change?**
Yes, always, across an API boundary. It is a removal plus an addition, and the
consumer's error is identical to a deletion —
`createdAt: Invalid input: expected string, received undefined`. Expand, migrate,
contract.

**★ Why is adding an enum value to a response breaking?**
Consumers with exhaustive handling — a `switch`, a TypeScript union — meet a value they
have no branch for. Ship the handling first, let consumers deploy, then emit it.

**★ What is the most dangerous change of all?**
Changing a field's meaning while keeping its type — euros becoming cents. Every schema
check passes and the value is wrong by a factor of a hundred. Add a new field instead.

**How do you know it is safe to remove a deprecated field?**
Evidence of zero usage — telemetry per field or per client version — not an
announcement. Pair `Deprecation` and `Sunset` headers with a usage metric.

**When do you version an API rather than evolve it?**
When the change is a restructure that cannot be expressed as adding alongside the old
shape. Versioning costs two code paths and two test suites, so it is not the answer to
a rename.

---

← Prev: [19 · Contract testing](./19-contract-testing.md) ·
Next → [Phase 10 · Observability](../phase-10-observability/)
