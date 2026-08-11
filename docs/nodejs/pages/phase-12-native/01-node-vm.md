---
title: "node:vm — and why it is not a security sandbox"
sidebar_label: "01 · node:vm"
sidebar_position: 1
---

<span className="db-tier t-know">Know</span>

> Verified: 2026-08 on **Node 24.19.0** — `node:vm` context execution and classic
> breakout behaviour.

**`node:vm` runs a string of JavaScript in a V8 context you configure. It is a tool for
isolation of *accidental* globals and for template-style scripting — not a security
boundary against hostile code.**

Node's own documentation warns: the module is **not** a security mechanism. Hostile
code can usually reach the outer realm and `process`.

## What it is for

| Use | Example |
|---|---|
| Soft isolation | Run user *formulas* with a frozen API you inject |
| Testing | Load a script with a fake `require` graph carefully |
| REPLs / notebooks | Evaluate cells with a shared context object |

```js
import vm from 'node:vm';

const context = {
  // only what you intentionally expose
  add(a, b) {
    return a + b;
  },
};
vm.createContext(context);

const result = vm.runInContext('add(2, 40)', context, {timeout: 50});
console.log(result); // 42
```

Measured: ordinary arithmetic in a context works. A classic
`this.constructor.constructor("return process")()` breakout against a
`vm.createContext({})` context returned **`process.version` (`v24.19.0`)** on this
runtime — proof the context is not a security boundary. Treat `timeout` as a
best-effort CPU limit, not a complete resource sandbox.

## Why it is not a sandbox

Hostile code reaches outer realm APIs through constructor chains and other escapes.
Node documents `vm` as **not** a security mechanism. If the code is **untrusted**, you
need an OS process boundary, a real capability system, or a dedicated isolate product —
not `vm` alone.

Also: **async** code can outlive `timeout` options depending on how it schedules work.
Do not assume a timed `runInContext` contains a promise chain.

## Harder options when you need isolation

| Approach | Boundary |
|---|---|
| Child process / worker with IPC | OS process (still need to lock down FS/network) |
| Permission model flags | Experimental path restrictions ([Phase 8 topics](../phase-8-security/)) |
| WASI / Wasm guest | Different ABI; still design host imports carefully |
| Separate container | Deployment isolation ([Phase 11](../phase-11-deployment/)) |

## Gotchas

**Symptom:** "Sandbox" executes `process.exit()`
**Cause:** Used `vm` for untrusted code
**Fix:** Do not; use process/container isolation

**Symptom:** Timeout did not stop the script
**Cause:** Async work or native spin outside the checked window
**Fix:** Separate process + kill; never trust timeout alone

**Symptom:** Context accumulates state across runs
**Cause:** Reused context object
**Fix:** Fresh context per evaluation when purity matters

**Symptom:** Performance collapse evaluating many scripts
**Cause:** Compile cost per string
**Fix:** `new vm.Script` and reuse; cache compiled scripts

## Interview questions

**★ Is node:vm a security sandbox?**
No. It is context isolation for trusted or semi-trusted scripting, not hostile code.

**What is vm still useful for?**
Controlled evaluation with an explicit API object, tests, and tooling REPLs.

**How do you bound CPU for a script roughly?**
`timeout` option on run — insufficient alone against hostile actors.

**What is a safer boundary for untrusted code?**
Separate OS process or container with locked-down credentials and syscalls.

**Why can async evade vm timeouts?**
Timeouts focus on the synchronous run; scheduled work may continue afterward.

---

Phase index: [Native and advanced](./README.md) · Next → [WebAssembly](./02-webassembly.md)
