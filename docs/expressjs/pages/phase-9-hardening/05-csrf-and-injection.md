---
title: "CSRF and injection surfaces"
sidebar_label: "05 · CSRF · injection"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

**Cookie session APIs may need CSRF defenses. Bearer tokens in Authorization usually do not. Never `res.redirect(userInput)` unchecked.**

`csurf` is **archived** — do not teach it as current. Prefer modern patterns (double-submit cookie, SameSite, framework guidance) aligned with Node Phase 8.

Open redirects and header injection are handler bugs:

```js
// bad
res.redirect(req.query.next);
// good — allow-list relative paths
```

Cross-link Node SSRF/open-redirect pages for measured bypasses.

## Interview questions

**★ When is CSRF a concern for a JSON API?**  
When auth relies on cookies automatically sent by the browser cross-site.


---

← Prev: [Rate limiting](04-rate-limiting.md) · Next → [Timeouts and secrets at edge](06-timeouts-and-secrets.md)
