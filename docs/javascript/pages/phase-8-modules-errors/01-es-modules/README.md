---
title: "01 · ES modules"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [JavaScript modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules), [`import`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import), [`export`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/export), [`await`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/await). Documentation-validated.

**A module is a file with its own scope and an explicit interface** — and an `import` is a
live view of someone else's binding, not a copy of a value.

> "module features are imported into the scope of a single script — **they aren't available
> in the global scope**." — MDN

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[`import` and `export`](./01-import-and-export.md)** | Named vs default and the case for named (the identifier as contract); **live bindings** — read-only views you cannot reassign but whose objects you can mutate, and how that differs from CommonJS `require`; namespace imports; re-exporting and why `export *` skips the default; and why a specifier must be a string literal |
| 2 | **[Specifiers, loading and top-level `await`](./02-specifiers-and-the-graph.md)** | Why the **file extension is required** in the browser but not under a bundler; bare names and **import maps**; `type="module"`, the `file://` CORS failure and the `.mjs` MIME-type failure — two load errors that do not look like JavaScript errors; and top-level `await`, which blocks importers but **not siblings** |

## The three sentences to keep

1. **An import is a read-only live view**, not a copy — the binding is frozen, the object is
   not.
2. **The browser resolves a specifier as a URL.** No extension guessing, no bare names
   without an import map.
3. **Top-level `await` blocks every importer and no sibling**, and importers cannot opt out.

## Phase gate

You are done with this topic when you can explain live bindings and what they change versus
`require`, say why a default import's name has no contract, and diagnose the three
load-time failures (CORS on `file://`, `.mjs` MIME type, missing extension) from their error
messages.

## Where this connects

- [Phase 0 · 07 · Loading scripts](../../phase-0-how-javascript-runs/07-loading-scripts.md) — how a script reaches the engine
- [Phase 7 · 07 · 02 · Where it suspends](../../phase-7-async/07-async-await/02-where-it-suspends.md) — where `await` is allowed, and top-level `await`
- [Phase 1 · 07 · `const` is not immutable](../../phase-1-values-and-coercion/07-const-is-not-immutable.md) — the binding-versus-value distinction imports reuse

---

Start → [01 · `import` and `export`](./01-import-and-export.md)
