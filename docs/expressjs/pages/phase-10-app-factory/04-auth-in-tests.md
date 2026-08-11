---
title: "Auth in tests"
sidebar_label: "04 · Auth in tests"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

**Test helpers mint sessions or JWTs without copying production crypto pages.**

```js
function authed(agent) {
  return agent.set('Authorization', `Bearer ${testTokenFor('admin')}`);
}
```

Keep secrets for tests local and deterministic.

## Interview questions

**★ Why not hit the real IdP in unit/integration route tests?**  
Slow, flaky, and out of process — contract tests can cover IdP separately.


---

← Prev: [Supertest](03-supertest.md) · Next → [Health and boot](05-health-and-boot.md)
