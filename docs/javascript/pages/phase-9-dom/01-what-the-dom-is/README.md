---
title: "01 · What the DOM is"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08-14 against MDN — [Introduction to the DOM](https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model/Introduction), [`Node`](https://developer.mozilla.org/en-US/docs/Web/API/Node), [`Element`](https://developer.mozilla.org/en-US/docs/Web/API/Element). Documentation-validated.

**Not a JavaScript feature — a Web API the browser hands you**, describing the document as a
tree in which every element is a node but most nodes are not elements.

> "The DOM is **not part of the JavaScript language**, but is instead a **Web API** used to
> build websites." — MDN

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 1 | **[A tree of nodes](./01-a-tree-of-nodes.md)** | Why `document is not defined` in Node is correct; language-independence and the API shape it explains; **nodes versus elements**, with whitespace-as-text-nodes and the paired `childNodes`/`children` family; the core interfaces and the `HTMLInputElement → Node` chain; and why the live tree, not your markup, is the truth |

## The two sentences to keep

1. **Every element is a node; most nodes are not.** Whitespace between tags is a text node,
   which is why `children` is almost always the one you want.
2. **Markup is a serialisation, parsed once.** The parser corrects it, scripts change it, and
   devtools shows the result — view-source does not.

## Phase gate

You are done with this topic when you can say why the DOM is not part of JavaScript, explain
the difference between `childNodes` and `children` without hedging, and say when `parentNode`
and `parentElement` disagree.

## Where this connects

- [Phase 0 · 06 · Hosts and globals](../../phase-0-how-javascript-runs/06-hosts-and-globals.md) — the language/host split this topic rests on
- [Phase 8 · 04 · Leaks](../../phase-8-modules-errors/04-leaks/README.md) — detached nodes, which only make sense once the tree does

---

Start → [01 · A tree of nodes](./01-a-tree-of-nodes.md)
