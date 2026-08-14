---
title: "04 · textContent vs innerText vs innerHTML"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [`innerText`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/innerText), [`textContent`](https://developer.mozilla.org/en-US/docs/Web/API/Node/textContent), [`innerHTML`](https://developer.mozilla.org/en-US/docs/Web/API/Element/innerHTML). Documentation-validated.

**Three properties that look interchangeable and are not** — one is a security boundary, one
is a performance trap, one is the default.

| | Parses HTML? | Sees hidden text? | Costs layout? |
|---|---|---|---|
| `textContent` | **no** | **yes** (incl. `<script>`, `<style>`) | no |
| `innerText` | no | **no** — rendered only | **yes** |
| `innerHTML` | **yes** — injection sink | n/a | on write |

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[The three properties](./01-the-three-properties.md)** | `textContent` as the default and why it is the fix for most XSS; MDN's *"aware of the rendered appearance"* line and the **reflow** that follows from it, plus `innerText` converting `\n` into real `<br>` elements; and `innerHTML` as an injection sink — including why *"scripts don't run"* is the most dangerous half-truth in frontend security |

## The three sentences to keep

1. **If the value is text, use `textContent`.** It cannot inject markup, whatever the string
   contains.
2. **`innerText` needs layout**, so reading it can force a reflow — never the default.
3. **`<img src=x onerror=…>` needs no `<script>` tag.** `innerHTML` is a sink regardless.

## Phase gate

You are done with this topic when you can state the three differences MDN draws between
`innerText` and `textContent`, explain why `innerHTML` is unsafe even though inserted scripts
do not execute, and name two non-security reasons to avoid it.

## Where this connects

- [03 · Creating and inserting](../03-creating-and-inserting/README.md) — `append` with a string, the safe way to add text
- [06 · Sanitising HTML](../README.md) — what to do when you genuinely have untrusted markup

---

Start → [01 · The three properties](./01-the-three-properties.md)
