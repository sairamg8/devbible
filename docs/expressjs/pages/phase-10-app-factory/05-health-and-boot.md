---
title: "Health checks and boot order"
sidebar_label: "05 · Health · boot"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

**Liveness is cheap. Readiness checks pool/redis. Boot: validate env → connect deps → createApp → listen → ready.**

```text
validate env → connect pool → createApp(deps) → server.listen → signal ready
```

Cross-link Node Phases 10–11 for probe semantics and container PID 1.

## Interview questions

**★ Why split liveness and readiness?**  
Failing readiness stops new traffic; failing liveness restarts the process — conflating them causes restart storms.


---

← Prev: [Auth in tests](04-auth-in-tests.md) · Next → [Shutdown and entrypoint](06-shutdown-and-entrypoint.md)
