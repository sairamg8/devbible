---
title: "Phase 1 — JSX and what a component returns"
sidebar_label: "Overview"
sidebar_position: 0
---

> **Target: React 19.2.8 and react-dom 19.2.8.** Every console block on these
> pages was produced by a script in `sandbox/react-p1/`, run on **Node 24.19.0**
> with browser experiments in **Firefox 153.0**. Nothing is written from memory.

JSX is not a template language and not HTML. It is syntax for one function call,
and every confusing thing about it follows from that — including the three that
cost the most time in practice: a `0` appearing where a list should be, a click
handler that never fires because it was spelled `onclick`, and typed text
following the wrong row after a sort.

The load-bearing pages are **01**, **02**, **04** and **07**. If you read four,
read those.

| # | Page | Tier | In one line |
|---|---|---|---|
| 01 | **[JSX is a function call](01-jsx-is-a-function-call.md)** | <span className="db-tier t-understand">Understand</span> | One call per element; `key` is a third argument, not a prop |
| 02 | **[Embedding expressions](02-embedding-expressions.md)** | <span className="db-tier t-master">Master</span> | `null`/`undefined`/booleans vanish; `0` and `NaN` do not |
| 03 | **[What can be rendered](03-what-can-be-rendered.md)** | <span className="db-tier t-understand">Understand</span> | Renders, renders nothing, throws, or suspends — four outcomes |
| 04 | **[Attributes vs props](04-attributes-vs-props.md)** | <span className="db-tier t-master">Master</span> | Renamed, passed through, or silently dropped |
| 05 | **[Capitalization](05-capitalization.md)** | <span className="db-tier t-understand">Understand</span> | One character decides string or function — and there is no error |
| 06 | **[Conditional rendering](06-conditional-rendering.md)** | <span className="db-tier t-master">Master</span> | The `&&` trap, and which branch keeps its state |
| 07 | **[Lists and key](07-lists-and-keys.md)** | <span className="db-tier t-master">Master</span> | Index keys do not remount — they attach the wrong data |
| 08 | **[Fragments](08-fragments.md)** | <span className="db-tier t-understand">Understand</span> | Group without a DOM node; only `key` and `children` allowed |
| 09 | **[children](09-children.md)** | <span className="db-tier t-master">Master</span> | An ordinary prop whose shape the compiler chose |
| 10 | **[Spreading props](10-spreading-props.md)** | <span className="db-tier t-understand">Understand</span> | Object spread: order wins, and unknown props leak to the DOM |
| 11 | **[Inline style](11-inline-style.md)** | <span className="db-tier t-understand">Understand</span> | camelCase, automatic `px`, and the unitless list |
| 12 | **[dangerouslySetInnerHTML](12-dangerously-set-inner-html.md)** | <span className="db-tier t-understand">Understand</span> | `<script>` does not run; `<img onerror>` does |
| 13 | **[Form elements in JSX](13-form-elements/README.md)** | <span className="db-tier t-master">Master</span> | Who owns the value — React or the DOM |
| 14 | **[Whitespace and text](14-whitespace-and-text.md)** | <span className="db-tier t-know">Know</span> | Why a space disappears when you break a line |
| 15 | **[The classic runtime](15-the-classic-runtime.md)** | <span className="db-tier t-when">When Needed</span> | `React.createElement`, pragmas, and "React is not defined" |

## Coverage

The syllabus lists **15 topics** for this phase and they become **15 pages**,
one for one. Topic 6 (form elements) runs past the 300-line file cap and is
split into a topic directory of two chunks — the content is not reduced.

| Syllabus topic | Page |
|---|---|
| Embedding expressions | 02 |
| Attributes vs props | 04 |
| Conditional rendering | 06 |
| Lists and `key` | 07 |
| `children` | 09 |
| Form elements in JSX | 13 (two chunks) |
| JSX is a function call | 01 |
| Fragments | 08 |
| Spreading props | 10 |
| Inline `style` | 11 |
| `dangerouslySetInnerHTML` | 12 |
| Capitalization decides everything | 05 |
| What can be rendered | 03 |
| Whitespace and text | 14 |
| The classic runtime and `@jsxImportSource` | 15 |

## How these pages were verified

The sandbox is `sandbox/react-p1/`. Each page's `> Verified:` line names the
script behind it.

| Script | Produces |
|---|---|
| `ex01-jsx-is-a-call.mjs` | Babel output for both runtimes, `jsxDEV`, pragmas, the runtime's exports |
| `ex02-what-renders.mjs` | Every value rendered into a live root, with markup or error |
| `ex03-attributes.mjs` | The markup React produced for 30 attribute cases, and every warning |
| `ex04-capitalization.mjs` | Compiler output per spelling, and the silent lowercase-component bug |
| `ex05-conditional.mjs` | The `&&` left-operand table, and state survival across four conditional shapes |
| `ex06-lists-and-keys.mjs` | Index vs stable keys: DOM state, node identity and mutation counts |
| `ex07-fragments.mjs` | Fragment markup, the `<tr>` nesting errors, the fragment-prop warnings |
| `ex08-children.mjs` | `children` shapes, `Children.*` behaviour and the keys it invents |
| `ex09-spread.mjs` | Spread precedence, the spread-`key` warning, props leaking to the DOM |
| `ex10-inline-style.mjs` | The `style` attribute for 40 cases, including the unitless list |
| `ex11-dangerous-html.mjs` | Which XSS payloads actually executed in a live page |
| `ex12-form-elements.mjs` | Form markup, every form warning, and the real event sequence per keystroke |
| `ex13-whitespace.mjs` | Compiled children arrays and the text that reached the DOM |

**React 19 ships no UMD build**, so browser experiments are bundled with esbuild
and served to a real Firefox over `puppeteer-core`. Scratch files stay inside
`sandbox/react-p1/tmp/`, never the host's `/tmp`.

Two results in this phase contradicted what is commonly written and are called
out where they appear: **index keys do not cause a remount** (React keeps the
nodes and rewrites their text), and **the missing-key warning is suppressed**
after the first offending list with a given parent tag — so its absence proves
nothing.

## Gate

Move on to Phase 2 when you can:

1. Hand-compile a small JSX tree into `jsx()` calls, including where `key` goes.
2. Say what a list renders after two items swap places, with index keys and with
   stable keys — and what happens to text the user had typed into each row.
3. Explain why `{items.length && <List/>}` can put a `0` on the screen.

---

← Index: [React — Explanations](../README.md) · Start → [JSX is a function call](01-jsx-is-a-function-call.md)
