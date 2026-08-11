---
title: "Operational vs programmer errors"
sidebar_label: "05 · Error kinds"
sidebar_position: 5
---

<span className="db-tier t-understand">Understand</span>

**Operational errors are expected at the edge (bad input, not found). Programmer
errors are bugs. At the HTTP edge: expose the first, hide the second, log both.**

| Kind | Example | Client sees |
|---|---|---|
| Operational | Invalid JSON, 404, 409 | Clear message + code |
| Programmer | `Cannot read properties of undefined` | Generic 500 |

Do not keep the process alive after unknown programmer errors in a bad state —
process-level policy is Node’s syllabus (`uncaughtException` → log and exit).
Express error middleware is for **request-scoped** failures.

## Interview questions

**★ Why hide programmer error messages?**  
They leak paths, schemas, and exploit detail.

---

← Prev: [Mapping to HTTP](04-mapping-to-http.md) · Next → [404 and process errors](06-not-found-and-process.md)
