---
title: "Domain vs transport"
sidebar_label: "02 · Domain vs transport"
sidebar_position: 2
---

<span className="db-tier t-understand">Understand</span>

**Transport is HTTP. Domain is your product language. Crossing them freely couples tests to Express.**

```js
// controller
const input = req.validated; // from Zod middleware
const user = await userService.register(input);
res.status(201).json(toUserDto(user));
```

```js
// service — pure-ish
export async function register(input, {users, hasher}) { /* … */ }
```

## Interview questions

**★ What is a DTO at the edge for?**  
Stable API shapes when persistence models change.


---

← Prev: [CSR wiring](01-controller-service-repository.md) · Next → [Fat controllers](03-fat-controllers.md)
