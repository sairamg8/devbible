---
title: "Mapping to HTTP"
sidebar_label: "04 · HTTP mapping"
sidebar_position: 4
---

<span className="db-tier t-understand">Understand</span>

**Carry `statusCode` (or `status`) on errors you throw. Map domain failures once
in error middleware — not with ad-hoc `res.status` in every catch.**

| Situation | Status |
|---|---|
| Validation failed | 400 or 422 |
| Not logged in | 401 |
| Logged in, not allowed | 403 |
| Missing resource | 404 |
| Conflict / duplicate | 409 |
| Rate limited | 429 |
| Upstream/db down | 503 |
| Bug / unknown | 500 |

Thin helper:

```js
export class HttpError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.expose = statusCode < 500;
  }
}
```

Avoid deep inheritance trees — Node error design already covers advanced cases.

## Interview questions

**★ 401 vs 403 in one line?**  
401 = who are you?; 403 = I know who you are and you may not.

---

← Prev: [Error response contract](03-error-contract.md) · Next → [Operational vs programmer](05-operational-vs-programmer.md)
