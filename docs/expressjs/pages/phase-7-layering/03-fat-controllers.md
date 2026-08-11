---
title: "Avoiding fat controllers"
sidebar_label: "03 · Fat controllers"
sidebar_position: 3
---

<span className="db-tier t-understand">Understand</span>

**If a handler needs scrolling, logic leaked upward. Push validation and auth to middleware; keep one use-case per handler.**

## Smells

- SQL in the route file  
- 200-line `try/catch` with five status codes  
- Copy-pasted auth checks  

## Fix

Auth middleware → validate middleware → thin handler → service.

## Interview questions

**★ Where should RBAC checks live?**  
Route-level middleware or service for multi-resource rules — not duplicated string compares in every handler.


---

← Prev: [Domain vs transport](02-domain-vs-transport.md) · Next → [DI without a framework](04-di-without-framework.md)
