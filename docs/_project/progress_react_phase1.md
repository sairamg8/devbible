---
name: devbible-react-phase1
description: Live progress for React Phase 1 (JSX) — the sandbox/react-p1 scripts, the full measured dataset, and the per-page table
metadata:
  type: project
---

**Updated after every completed page and at phase end** ([[devbible-memory-update-cadence]]).
Syllabus: [[devbible-react-syllabus]]. Phase 0: [[devbible-react-phase0]].

Phase 1 is **"JSX and what a component returns", 15 topics → 15 pages** in
`docs/react/pages/phase-1-jsx/`.

## 🔴 Working in a git worktree

User instruction 2026-08-13: *"please work on new tree"*. Work is in
`.claude/worktrees/react-phases` on branch `worktree-react-phases`, created from
`origin/main` at `2285dac` (local main and origin/main were identical). A worktree needs
its **own** `yarn install` at the root and its own `npm install` in the sandbox — nothing
is shared with the main checkout. Both were run.

✅ **Merged into `main` as `e40c5b3`** (`--no-ff`, no conflicts), 2026-08-13, on the
user's instruction to merge all branches. **The branch was not deleted and this
worktree is still `locked`** — resuming here branches from the pre-merge point,
which the next merge absorbs. Do not delete the branch or remove the worktree.

Phase 1 contributed **no broken links** to the post-merge build — all 15 remaining
are JavaScript forward refs and pre-existing TypeScript
([[devbible-postgresql-repo-and-build]]). Two paths in this worktree were left
uncommitted deliberately: `.yarn/install-state.gz` and `build-react-p1/`, both
build artifacts.

## 🔴 Rule change mid-phase: no more sandboxes

**2026-08-13, user instruction to every running session at once: sandboxing is closed** —
it cost more time and token budget than the evidence was worth. Written as **hard rule 8**
in `~/.claude/CLAUDE.md` and mirrored as item 7 in the store's `MEMORY.md`; the
"write the script and run it" half of the never-invent-output rule is **superseded**.

What this means for React:
- **Phase 0 and Phase 1 keep their sandboxes and console blocks.** All 31 pages in those
  two phases now carry a `🧪 **Sandbox-proven**` marker above the `> Verified:` line.
- **Phase 2 onward: no `react-p2`.** Claims are validated against react.dev / MDN /
  release notes, the source is named in the `> Verified:` line, and **a page with no run
  carries no console block** — never a reconstructed one.
- The user reversed direction twice during this phase (no sandbox → keep sandbox → no
  sandbox, final). The final instruction is the one above.

**Documentation cross-check already done** on the two highest-risk Phase 1 claims:
- **MDN `Element.innerHTML`** independently confirms `<script>` does not execute while
  `<img src=x onerror=…>` does — same example as the measurement.
- **React 19 release notes** list *"react-dom: Error for javascript URLs in src and href"*,
  confirming the `javascript:` finding; the measurement adds the mechanism (React
  **rewrites** the href to a throwing expression rather than stripping it).
- react.dev's common-components reference confirms the `style` px/unitless rule, the
  custom-attribute rule ("must be lowercase and must not start with `on`"; `null`/
  `undefined` removes it) and the `children` + `dangerouslySetInnerHTML` exclusion. It does
  **not** document `class`/`for` working or the boolean-drop — those rest on the
  measurement alone.

## Status

**PHASE 1 COMPLETE — 15 topics, 16 files, build-verified.** Sandbox complete (13 scripts,
all run). Committed on `worktree-react-phases` as `77167d7`.

Line counts 175–287 after the split; `13-form-elements.md` hit **306** and became a topic
directory (`README` + 2 chunks) rather than being trimmed.

✅ **Phase 2 is now DONE too** — see [[devbible-react-phase2]], which is the live resume
point. **Do not resume in the `react-phases` worktree**: it is still `locked` and predates
Phase 2's commit `c462cc8` on `main`.

| # | Page | Topic | Script | Done |
|---|---|---|---|---|
| 01 | jsx-is-a-function-call | JSX is a function call | ex01 | ✅ |
| 02 | embedding-expressions | Embedding expressions | ex02, ex05 | ✅ |
| 03 | what-can-be-rendered | What can be rendered | ex02 | ✅ |
| 04 | attributes-vs-props | Attributes vs props | ex03 | ✅ |
| 05 | capitalization | Capitalization decides everything | ex04 | ✅ |
| 06 | conditional-rendering | Conditional rendering | ex05 | ✅ |
| 07 | lists-and-keys | Lists and `key` | ex06 | ✅ |
| 08 | fragments | Fragments | ex07 | ✅ |
| 09 | children | `children` | ex08 | ✅ |
| 10 | spreading-props | Spreading props | ex09 | ✅ |
| 11 | inline-style | Inline `style` | ex10 | ✅ |
| 12 | dangerously-set-inner-html | `dangerouslySetInnerHTML` | ex11 | ✅ |
| 13 | **form-elements/** (dir: README + 2 chunks) | Form elements in JSX | ex12 | ✅ |
| 14 | whitespace-and-text | Whitespace and text | ex13 | ✅ |
| 15 | the-classic-runtime | Classic runtime, `@jsxImportSource` | ex01 | ✅ |

Phase closing checklist — **all done**: phase `README.md`, `docs/react/pages/README.md`
row, `src/data/progress.js` → `pages: 15`, clean rebuild + grep.

**Build:** `yarn build --out-dir build-react-p1`, clean `.docusaurus` first. **17 HTML
routes** under `phase-1-jsx/`, **zero** React warnings or broken links.
🔴 **The first build FAILED and reported exit 0** — a bare `{...}` in prose in
`03-what-can-be-rendered.md` is an MDX expression (`Could not parse expression with
acorn`). The rule-4 trap again: *grep the log for `MDX compilation failed`, never trust
the exit code.* Braces inside fenced code blocks are safe; only prose braces matter.

## The sandbox — `sandbox/react-p1/`

`harness.mjs` copied from `react-p0` (esbuild → local http server → system Firefox over
`puppeteer-core`; **React 19 has no UMD build**). Same pinned deps.

**The pattern that made these measurable:** render each case into its own root with
`flushSync`, then read `host.innerHTML`. Render errors are captured with React 19's
`createRoot(el, {onUncaughtError})` — a plain try/catch does not see them. Every script
runs the *same source* twice, production and development, because production gives
minified error codes and development gives the sentence people quote.

## Measured facts

**ex01 — JSX is a call**
- Automatic runtime: `_jsx("h1", {className, children})`; `key` is the **third argument**.
- **`jsx` vs `jsxs`**: `jsxs` is emitted when children were written literally — that is
  why a hand-written sibling list never asks for keys and `.map()` always does. It also
  decides whether `props.children` is an element or an array.
- `jsxDEV` comes from a **different entry point** (`react/jsx-dev-runtime`) and carries
  `{fileName, lineNumber, columnNumber}` + `this`. Source of "Check the render method of X".
- 🔴 `jsxDEV.length` is **4** but Babel passes **six** args + `this`. Do not infer "unused"
  from arity.
- `react/jsx-runtime` exports `Fragment default jsx jsxs`; `jsx !== jsxs`,
  `jsx !== createElement`. (`module.exports` also appears — a CJS-from-ESM artifact.)
- `createElement` is **still exported** in 19.2.8. The automatic runtime is a *compiler*
  change, not an API removal.
- `@jsxImportSource preact` → `import {jsx} from "preact/jsx-runtime"`. Classic pragma
  `/** @jsx h */` → `h(Frag, null, …)`.

**ex02 — what a child slot renders** (production markup, dev warnings)
- Nothing: `null undefined true false '' []`. Text: `0` → `"0"`, `NaN` → `"NaN"`,
  `-0` → `"0"`, bigint `10n` → `"10"`.
- 🔴 **A `Map` renders** (`"kv"`) — it is iterable, yielding `[k,v]` string arrays. A `Set`
  and a generator render too. All three warn in dev; the generator warning explains that
  enumerating it **mutates** it, so StrictMode's second render finds it empty.
- Objects and `Date` **throw**: dev `Objects are not valid as a React child (found: object
  with keys {a})` / `(found: [object Date])`; prod `Minified React error #31` with the
  same detail encoded in `args[]`.
- 🔴 **Symbols and functions render nothing and do not throw** — dev-only warnings
  (`Symbols are not valid as a React child.` / `Functions are not valid as a React child…`).
- 🔴 **A promise child suspends**: `innerHTML` was `""` — not even the wrapper `<span>`.
  No boundary → the whole root withheld its commit, silently.

**ex03 — attributes** (the four outcomes)
- Renamed: `className→class`, `htmlFor→for`, `tabIndex→tabindex`, `readOnly→readonly`,
  `crossOrigin→crossorigin`, SVG `strokeWidth→stroke-width`.
- 🔴 **`class` and `for` now WORK in React 19** — correct markup, dev warning only
  (`Invalid DOM property \`class\`. Did you mean \`className\`?`).
- 🔴 **`onclick` is dropped entirely** — no attribute, no handler, and **no warning in
  production**. `Unknown event handler property \`onFoo\`. It will be ignored.`
- Unknown prop with a **string** value → lowercased and rendered (`myAttr` → `myattr="v"`).
  Unknown prop with a **boolean** value → **dropped** (`isActive={true}`, see ex09).
- Booleans: `disabled={false}` removes it; `disabled="false"` **sets it** (warned:
  "The browser will interpret it as a truthy value").
- 🔴 **`aria-*` and `data-*` are not boolean-collapsed**: `aria-hidden={false}` renders
  `aria-hidden="false"`, `data-x={false}` renders `data-x="false"`.
- `null`/`undefined` remove an attribute; `0` and `NaN` are stringified (`NaN` warns).
- `data-userId` → `data-userid` with a warning — `dataset.userId` will not find it.
- `style="…"` **throws**: "The `style` prop expects a mapping from style properties to
  values, not a string."

**ex04 — capitalization**
- Babel: lowercase → string; uppercase → identifier; **hyphen → string** (`"my-widget"`);
  **any member expression → identifier**, including `<Ui.button/>`; `_` and `$` count as
  uppercase-ish (emitted as identifiers).
- 🔴 **`<button label="x"/>` with a `button` component in scope rendered
  `<button label="x"></button>` — no warning in either build.** The silent bug.
- `<Div/>` undefined → `Element type is invalid: expected a string … but got: undefined.
  You likely forgot to export your component…` (prod: error #130).
- `{Button}` in a child slot → renders nothing + dev warning; `{Button({...})}` renders
  but inlines it with no fiber.

**ex05 — conditional rendering**
- `&&` left operand on screen: `0 → "0"`, `NaN → "NaN"`, `0n → "0"`, `-0 → "0"`;
  `'' null undefined false` → nothing.
- State survival across a conditional, one `Box` per slot, counter never reset:
  `{c ? <Box/> : <Box/>}` **kept instance #1 across every switch**; wrapping one branch in
  `<p>` remounted; `{c && <Box/>}` and `{c ? <Box/> : null}` remounted. 8 instances for 4 slots.

**ex06 — lists and keys** (the phase's best measurement)
- Uncontrolled inputs typed into, then the last item moved to the front:
  - `key={index}`: `after: Cy=typed-Ada, Ada=typed-Bob, Bob=typed-Cy` — **typed text stayed
    with the position**. DOM node order **unchanged** (`li0 li1 li2`), mutations
    `added=0 removed=0 text=3` — React rewrote the *text* of the existing nodes.
  - `key={item.id}`: `after: Cy=typed-Cy, Ada=typed-Ada, Bob=typed-Bob` — correct. DOM node
    order **`li2 li0 li1`**, mutations `added=2 removed=2 text=0` — React **moved the real
    nodes** and rewrote nothing.
  - Zero remounts in both cases (3 Row instances each). The bug is not a remount.
- 🔴 **The missing-key warning is deduped by the parent element type, not the component.**
  Forward order: `NoKey` (`ul`) warned, then `InnerKey`/`ArrayLit` (`ul`) were **silent**;
  `TwoLists` (`ul`+`ol`) warned once. Reversed order: `TwoLists` warned **twice** (both
  lists), and every later `ul` case was silent. Two independent runs agree.
- Texts: `Each child in a list should have a unique "key" prop.` +
  `Check the render method of \`NoKey\`.`; `Encountered two children with the same key, \`x\`…`
- `<>` cannot take a key — it is a **syntax error**, not a runtime one.

**ex07 — fragments**
- `<>…</>` and `<Fragment>` put nothing in the DOM; a keyed `<Fragment>` in a `.map` yields
  `<dl><dt>…</dt><dd>…</dd><dt>…` with no wrapper.
- A wrapper `<div>` inside `<tr>` triggers React 19's nesting validator:
  `In HTML, <div> cannot be a child of <tr>. This will cause a hydration error.` plus an
  ancestor tree — the fragment version is clean.
- `Invalid prop \`className\` supplied to \`React.Fragment\`. React.Fragment can only have
  \`key\` and \`children\` props.` ⚠️ The first run appeared to show `onClick` *not*
  warning; an isolated re-run proved it does — the first output was simply truncated.
  Kept the isolated check in the script.

**ex08 — children** (Node only; `renderToStaticMarkup`)
- Shape: no children → `undefined`; one text child → **string**; one element →
  **the element, not an array**; two → array. `Array.isArray(one.children)` is `false`
  and `one.children.map` is `undefined`.
- `Children.count`: 1 / 2 / `null`→0 / nested `[[1,2],[3]]`→**3** (it flattens).
- `Children.toArray` on `[<b key=k1>, null, [<i/>, <u key=k2>], 'text', false]` → **4**
  items with invented keys `.$k1`, `.2:0`, `.2:$k2`, and **`null` for the string**.
- `Children.map` rewrites keys to `.$a .$b`; a plain `.map` leaves `a b`.
- 🔴 **Nesting beats the attribute**: `<div children="from-prop">from-nesting</div>` renders
  `from-nesting`. With no nesting, `children="from-prop"` is used.
- A `<Fragment>` child is **one** child (`Children.count` = 1).

**ex09 — spreading props**
- `{...props}` compiles to object spread, so **source order decides the winner** —
  measured both ways.
- 🔴 Full React 19 text: `A props object containing a "key" prop is being spread into JSX:
  let props = {key: someKey, name: ...}; <input {...props} /> React keys must be passed
  directly to JSX without using spread: … <input key={someKey} {...props} />`
- Rest spread onto a host element: `onSelectRow` → `Unknown event handler property`;
  `isActive={true}` → `React does not recognize the \`isActive\` prop…` **and the attribute
  is absent from the markup** (boolean values are dropped).

**ex10 — inline style**
- `{fontSize: 12}` → `font-size: 12px`; **`{fontSize: '12'}` → nothing at all** (invalid CSS).
- Unitless (no px added): `lineHeight zIndex opacity flex flexGrow fontWeight order
  columnCount gridRow aspectRatio scale tabSize`. Px added: `width margin padding top
  borderWidth fontSize`.
- `WebkitLineClamp` → `-webkit-line-clamp`; `MozBoxSizing` → `box-sizing` (Firefox
  normalised it); **`msTransform` produced nothing** in Firefox 153.
- Custom properties work and are **not** px-suffixed: `{'--gap': 8}` → `--gap: 8`.
- 🔴 A hyphenated key **still applies** — `{'font-size': 12}` → `font-size: 12px` — while
  warning `Unsupported style property font-size. Did you mean fontSize?`
- `{notACssProperty: 1}` → nothing, **no warning**. `{':hover': {...}}` → nothing, **no
  warning**. `{'@media …': {...}}` → nothing, *with* a (nonsensical) camelCase suggestion.

**ex11 — dangerouslySetInnerHTML**
- 🔴 **`<script>` inserted through innerHTML does NOT execute; `<img onerror>` and
  `<iframe srcdoc>` DO.** Measured live: `payloads that executed: [1,"img-onerror"]`
  (the `1` is the srcdoc frame). `<svg onload>` did not fire in Firefox 153.
- 🔴 **React 19 neutralises `javascript:` URLs by rewriting them**:
  `href="javascript:throw new Error('React has blocked a javascript: URL as a security
  precaution.')"`.
- `{__html: 42}` renders `42`; `undefined`/`null` render empty; a missing `__html` or a
  string instead of an object throws ``props.dangerouslySetInnerHTML` must be in the form
  `{__html: ...}``; with children as well → `Can only set one of \`children\` or
  \`props.dangerouslySetInnerHTML\`.` (prod: #61 and #60).

**ex12 — form elements**
- 🔴 **React's `onChange` is the DOM's `input` event**: dispatching `input` fired
  `onInput` then `onChange` per keystroke (`["onKeyDown","onInput:input","onChange:change:a",
  "onKeyDown","onInput:input","onChange:change:ab"]`); a subsequent native `change` event
  fired **nothing**.
- `defaultValue="initial"` then user typing: markup still `value="initial"`,
  `el.value` = `"typed by the user"`. **The markup never shows the live value.**
- `selected` on `<option>` is stripped (warned); `defaultValue` on `<select>` renders
  `selected=""` on the right option.
- Warnings captured verbatim: value-without-onChange, `checked` without onChange,
  `value` prop should not be null, `<textarea>` children (and the throw
  `If you supply \`defaultValue\` on a <textarea>, do not pass children.`), and **both**
  directions of the controlled/uncontrolled switch.
- `value` + `readOnly` → **no warning**.

**ex13 — whitespace**
- Compiler: text across lines joins with one space (`"Hello world"`); a newline between two
  *elements* is dropped entirely; a blank line likewise; **spaces within a line are kept
  verbatim** (`"Hello   "`); `&nbsp;` compiles to `\xA0`.
- ⚠️ **My own display code lied first.** A `.replace(/\s+/g,' ')` used only for printing
  turned `{"   "}` into `" "` and flattened a template literal — the page would have claimed
  the opposite of the truth. Fixed to print the children array verbatim. This is
  [[devbible-verify-your-own-measurements]] hitting the *formatting* of evidence, not the
  measurement.

## Traps hit

1. **`MutationObserver` records are delivered in a microtask**, so after a `flushSync` they
   are still pending. The first version called `obs.takeRecords()` and **discarded** it,
   reporting `added=0 removed=0` for both key strategies — which would have destroyed the
   page's whole point. Count what `takeRecords()` returns.
2. A dev-build log filtered on `l.type !== 'log'` hides errors that were captured by
   `onUncaughtError` and re-printed with `console.log`. Filter on content, not type.
3. React 19.2 dev builds emit **hundreds of `console.timeStamp` calls** (Performance
   Tracks). Filter `timeStamp`/`info`/`debug` out or the real warnings are unreadable.

Related: [[devbible-react-phase0]] · [[devbible-react-syllabus]] · [[devbible-brief]] ·
[[devbible-never-compress-to-fit-cap]] · [[devbible-verify-your-own-measurements]] ·
[[devbible-parallel-sessions]]
