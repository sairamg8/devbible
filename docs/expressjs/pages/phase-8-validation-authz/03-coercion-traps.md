---
title: "Coercion traps"
sidebar_label: "03 · Coercion traps"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

**Query and params are strings. `z.number()` without coerce fails or needs `z.coerce.number()` deliberately.**

```js
// ?limit=20 → string "20"
```

Booleans like `?active=false` are the string `"false"` (truthy!). Use explicit enums or coerce helpers.

## Interview questions

**★ Why is `Boolean("false")` a trap?**  
Non-empty strings are truthy in JavaScript.


---

← Prev: [Validation factory](02-validation-factory.md) · Next → [Authn middleware](04-authn-middleware.md)
