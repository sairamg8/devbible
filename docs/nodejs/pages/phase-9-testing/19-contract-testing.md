---
title: "Contract testing and consumer-driven contracts"
sidebar_label: "19 · Contract testing"
sidebar_position: 19
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08 on **Node 24.19.0** — `zod` 4.4.3.

**Where a green unit suite still ships a broken frontend.** Both sides tested their own
half; nobody tested the agreement between them. The backend renamed `createdAt` to
`created_at`, its own tests were updated in the same commit, and the frontend broke in
production.

## The gap

```
Backend tests:  ✔ 214 passing   ← tests the backend against the backend's beliefs
Frontend tests: ✔ 189 passing   ← tests the frontend against a mocked response
Production:     ✖ blank page
```

The frontend's mock is a **copy** of what the backend used to return. Nothing compares
it to what the backend returns *now*, so the two drift silently and neither suite can
notice.

An end-to-end test would catch it, at the cost of running both systems together. A
contract test catches it in each suite separately, in milliseconds.

## The contract

One schema, owned by the **consumer**, describing what it depends on:

```js
// contracts/user-response.mjs — shared, versioned, imported by both sides
import {z} from 'zod';

export const UserResponse = z.object({
  id: z.number().int(),
  name: z.string(),
  email: z.string(),
  createdAt: z.string(),
});
```

Consumer-owned matters: the provider knows what it *can* return, only the consumer knows
what it actually *uses*. A contract written by the provider is a description of the
implementation, and it grows to cover fields nobody reads.

## The provider side — verify against the real handler

```js
import {UserResponse} from '../contracts/user-response.mjs';

test('GET /users/:id honours the consumer contract', async () => {
  const server = createServer();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try {
    const body = await (await fetch(
      `http://127.0.0.1:${server.address().port}/users/1`)).json();
    const result = UserResponse.safeParse(body);
    assert.equal(result.success, true, JSON.stringify(result.error?.issues));
  } finally {
    await new Promise((r) => server.close(r));
  }
});
```

Measured against a provider that renamed the field:

```console
✔ provider honours the consumer contract (59.5ms)
✔ provider drift is caught before the frontend sees it (18.5ms)
  contract violated: createdAt — Invalid input: expected string, received undefined
```

**60 milliseconds, in the backend's own suite, naming the exact field.** The rename now
fails the backend's build, which is where it should fail.

## The consumer side — validate the mock

The other half, and the one usually skipped:

```js
import {UserResponse} from '../contracts/user-response.mjs';
import {userFixture} from './fixtures.mjs';

test('the mock we test against satisfies the contract', () => {
  assert.equal(UserResponse.safeParse(userFixture).success, true);
});
```

Without this the frontend can mock anything it likes and the contract is decorative.
With it, a contract change breaks the consumer's build too — which is the point: **both
sides fail on a breaking change, and neither can change it alone.**

## Consumer-driven contracts, properly

The shared-schema approach above works when both sides live in one repository or share a
package. Across teams and repositories the same idea gets a protocol — this is what
**Pact** provides:

1. The **consumer** writes tests against a Pact mock server; running them produces a
   *pact file* recording the requests it makes and the responses it needs.
2. The pact file is published to a **broker**.
3. The **provider** replays every interaction against its real service in its own CI.
4. The broker's **can-i-deploy** check gates the provider's release on every consumer
   contract still passing.

The value is step 4: the provider learns it is about to break a consumer **before**
deploying, without running the consumer. The cost is real — a broker to operate,
versioning and tagging discipline, and a second test style. It pays off with several
independent teams; for one team shipping a frontend and a backend together, the shared
schema is the better trade.

## Where else contracts apply

| Boundary | The contract |
|---|---|
| REST API ⇄ frontend | response schema per endpoint |
| Your service ⇄ third-party API | a schema over *their* response, validated in an integration test |
| Producer ⇄ queue consumer | the message schema |
| Webhook sender ⇄ your receiver | the payload schema, versioned |

The third-party one earns its place quickly. Validate the provider's response in an
integration test that runs nightly, and their unannounced change is a failed build
rather than a production incident.

## Do not derive the contract from the implementation

```js
// ✗ a contract generated from the model
export const UserResponse = z.object(userModelShape);
```

That cannot fail. If the model changes, the contract changes with it and both sides
agree on the new shape while the frontend still breaks. **The contract must be written
independently** — that independence is the entire mechanism.

Generating an OpenAPI document from code has the same flaw when used this way: it
documents what is, not what was promised.

## Gotchas

**Symptom:** Both suites green, production broken
**Cause:** The frontend tests against a stale copy of the response.
**Fix:** A shared schema validated on both sides.

**Symptom:** The contract test never fails
**Cause:** It is generated from the implementation.
**Fix:** Write it independently, from what the consumer uses.

**Symptom:** The contract grows to cover every field
**Cause:** Provider-owned.
**Fix:** Consumer-owned — only fields actually read.

**Symptom:** The provider passes and the consumer still breaks
**Cause:** Only the provider side is verified; the consumer's mock is unchecked.
**Fix:** Validate the mock against the same schema in the consumer's suite.

**Symptom:** Pact becomes a maintenance burden for one team
**Cause:** Cross-team tooling on a single-team problem.
**Fix:** A shared schema package until there are genuinely independent release cycles.

**Symptom:** A third-party API changed and nothing warned you
**Cause:** Their response is only exercised through mocks.
**Fix:** A nightly integration test validating their real response against your schema.

## Interview questions

**★ What does a contract test catch that unit tests cannot?**
Drift between two independently-tested sides. Each suite tests against its own beliefs,
so a renamed field passes both. Measured: a provider renaming `createdAt` to
`created_at` failed the contract test in **18 ms** with
`createdAt — Invalid input: expected string, received undefined`.

**★ Why should the consumer own the contract?**
Only the consumer knows which fields it actually reads. A provider-written contract
describes the implementation and grows to cover everything, so it stops constraining
anything.

**★ Why must the contract not be generated from the model?**
Because it would change with the implementation and could never fail. The independence
between the contract and the code is the entire mechanism.

**★ What does Pact add over a shared schema?**
A protocol across repositories: the consumer publishes a pact file to a broker, the
provider replays it in its own CI, and `can-i-deploy` gates the provider's release on
every consumer contract. The cost is a broker and versioning discipline — worth it with
several independent teams, not for one team shipping both sides.

**Where else do contracts apply besides REST?**
Message schemas between a producer and queue consumers, webhook payloads, and — most
valuably — a schema over a third-party API's response, validated nightly so their
unannounced change is a failed build rather than an incident.

**Do contract tests replace end-to-end tests?**
They replace most of the reason for them. E2E still proves the pieces are deployed and
connected; contract tests prove the shapes agree, far faster and with a precise failure
message.

---

← Prev: [18 · Load testing](./18-load-testing.md) ·
Next → [20 · Schema compatibility](./20-schema-compatibility.md)
