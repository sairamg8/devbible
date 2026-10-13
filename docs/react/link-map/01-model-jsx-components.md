---
title: "Link map · React · Part 1 (phases 0–1–2)"
sidebar_label: "01 · model jsx components"
sidebar_position: 1
---

# Link map · React · Part 1 (phases 0–1–2)

Covers every topic row of `docs/react/syllabus/01-the-react-model.md` in phase 0 (T00-01 to T00-17, how React runs), phase 1 (T01-01 to T01-15, JSX) and phase 2 (T02-01 to T02-16, components, props and composition). That is 48 rows. Every row has a written page of ours, so all blocks are ✅. Where one page carries two rows the block says so: T00-06 (declarative vs imperative) sits in the what-React-is page, and T00-11 (React 19.2) and T00-16 (governance) sit in the pages on 19 and on versions.
*read* = the passage that supports the claim was read; *headings only* = fetched, headings/size checked. Third-party links carry a date only where the page shows one. No `#anchors` are given. Every URL was re-fetched on 2026-10-13 and returns 200 at the URL shown (canonical, after redirects). "Covers our angle" is judged against the syllabus row, not against the text of our written page.

🔴 **Version note.** Our syllabus targets **React 19.2.8** (`docs/react/README.md`). react.dev is the current docs. Several third-party picks are older and are flagged where it matters: Dan Abramov's 2015 to 2019 posts, Kent C. Dodds's 2018 render-props post (written while Hooks were in alpha), and all `legacy.reactjs.org` pages, which say they are no longer updated (class-component and pre-hooks material, still accurate for the model). The Callstack React 19 post (2024-09-03) was written before the stable release and uses future tense. `defaultProps` for function components, `propTypes`, `ReactDOM.render`, `hydrate` and `unmountComponentAtNode` are removed in 19 (upgrade guide, *read*). `forwardRef` still works in 19 but is no longer needed.

---

## Phase 0 — How React runs

### T00-01 · What React is — Master · ✅ written `docs/react/pages/phase-0-how-react-runs/01-what-react-is.md`
- **Read this:** [react-dom](https://react.dev/reference/react-dom) · react.dev · says react-dom is the web-only package with the DOM APIs, not supported in React Native, and lists `react-dom/client` and `react-dom/server` as entry points (*read*) · covers our angle: **partial** — does not say why the core is separate or that versions must match · fetched 2026-10-13
- **Beyond the docs:** [How Does setState Know What to Do?](https://overreacted.io/how-does-setstate-know-what-to-do/) · Dan Abramov, Overreacted, 2018-12-09 · the `react` package only defines components, the renderer supplies the implementation and plugs in an updater, which is the "no DOM in the core" claim shown in code · fetched 2026-10-13 (*read*)
- **Our delta:** the version-match rule between `react` and `react-dom`, and "renderer, not the DOM part".

### T00-02 · Render → reconcile → commit — Master · ✅ written `docs/react/pages/phase-0-how-react-runs/03-render-reconcile-commit.md`
- **Read this:** [Render and Commit](https://react.dev/learn/render-and-commit) · react.dev · trigger, render, commit; render must be a pure calculation and React touches the DOM only if the output differs (*read*) · covers our angle: **partial** — three steps here, no separate "reconcile" and no talk of render being thrown away · fetched 2026-10-13
- **Beyond the docs:** [A (Mostly) Complete Guide to React Rendering Behavior](https://blog.isquaredsoftware.com/2020/05/blogged-answers-a-mostly-complete-guide-to-react-rendering-behavior/) · Mark Erikson, 2020-05-17 (updated October 2022 for React 18) · separate Render and Commit phases, a reconciliation section, the parent-re-renders-children default, and the statement that under concurrent rendering React may render a component several times and throw the output away · fetched 2026-10-13 (*read*)
- **Our delta:** why a render can be discarded and a commit cannot.

### T00-03 · Reconciliation and the diffing rules — Master · ✅ written `docs/react/pages/phase-0-how-react-runs/04-reconciliation.md`
- **Read this:** [Reconciliation](https://legacy.reactjs.org/docs/reconciliation.html) · legacy React docs · the two assumptions (different types give different trees, keys mark stable children) and the O(n³) to O(n) argument; root type change destroys the old tree and its state (*read*) · covers our angle: **full** (page says it is no longer updated; the algorithm text is still the clearest statement) · fetched 2026-10-13
- **Beyond the docs:** [React as a UI Runtime](https://overreacted.io/react-as-a-ui-runtime/) · Dan Abramov, Overreacted, 2019-02-02 · builds the host tree, renderer, elements and reconciliation one after another, so the diff rules read as consequences of a model; the reconciliation section covers same type reuses the host instance and different type recreates it, while keys are explained later under Lists (*read*) · fetched 2026-10-13
- **Our delta:** the gate question: type change drops state, prop change does not.

### T00-04 · `StrictMode` — Master · ✅ written `docs/react/pages/phase-0-how-react-runs/07-strictmode.md`
- **Read this:** [StrictMode](https://react.dev/reference/react/StrictMode) · react.dev · extra component calls expose impure code, one extra setup and cleanup cycle per Effect, development only (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [Why useEffect Runs Twice](https://blog.openreplay.com/useeffect-runs-twice/) · OpenReplay Team, 2026-10-04 · treats the double run as a test of cleanup logic and warns against removing StrictMode or adding ref guards to hide it · fetched 2026-10-13 (*read*)
- **Our delta:** "switching it off is how you ship the bug".

### T00-05 · The element — Understand · ✅ written `docs/react/pages/phase-0-how-react-runs/02-the-element.md`
- **Read this:** [createElement](https://react.dev/reference/react/createElement) · react.dev · returns an object with `type`, `props`, `ref`, `key`; treat it as immutable, frozen in development (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [React Components, Elements, and Instances](https://legacy.reactjs.org/blog/2015/12/18/react-components-elements-and-instances.html) · Dan Abramov, 2015-12-18 · separates element, component and instance; older (class-era) but the distinction is unchanged · fetched 2026-10-13 (*read*)
- **Our delta:** the 19 shape, where `ref` is a prop on the element.

### T00-06 · Declarative vs imperative — Understand · ✅ written `docs/react/pages/phase-0-how-react-runs/01-what-react-is.md` (section "Why it exists")
- **Read this:** [Reacting to Input with State](https://react.dev/learn/reacting-to-input-with-state) · react.dev · the taxi analogy; imperative `disable` and `show` calls versus setting a status and deriving the UI (*read*) · covers our angle: **partial** — no "what you give up" · fetched 2026-10-13
- **Our delta:** the trade: direct control given up, manual sync removed.

### T00-07 · Fiber — Understand · ✅ written `docs/react/pages/phase-0-how-react-runs/05-fiber.md`
- **Read this:** [react-fiber-architecture](https://github.com/acdlite/react-fiber-architecture) · Andrew Clark, GitHub · a fiber is a unit of work and a virtual stack frame; current and work-in-progress fibers are each other's `alternate`. States it is not an official document; says nothing about a work loop (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Beyond the docs:** [Inside Fiber: an in-depth overview of the new reconciliation algorithm in React](https://www.ag-grid.com/blog/inside-fiber-an-in-depth-overview-of-the-new-reconciliation-algorithm-in-react) · Max Koretskyi, 2018-11-27 · walks `workLoop`, `performUnitOfWork`, `beginWork`, the alternate link and the effects list, which is the vocabulary of a stack trace; React 16 era · fetched 2026-10-13 (*read*)
- **Our delta:** reading "work loop" and "alternate" in a stack trace today.

### T00-08 · `createRoot` and `root.render` — Understand · ✅ written `docs/react/pages/phase-0-how-react-runs/06-createroot.md`
- **Read this:** [createRoot](https://react.dev/reference/react-dom/client/createRoot) · react.dev · `root.render` shows and updates, `root.unmount` tears down, plus error-handler options (*read*) · covers our angle: **partial** — never mentions the removed `ReactDOM.render` · fetched 2026-10-13
- **Also good:** [React 19 Upgrade Guide](https://react.dev/blog/2024/04/25/react-19-upgrade-guide) · react.dev · `render`, `hydrate` and `unmountComponentAtNode` removed, with the `createRoot`, `hydrateRoot` and `root.unmount` replacements (*read*) · fetched 2026-10-13
- **Our delta:** the removal list in one place.

### T00-09 · Release channels — Understand · ✅ written `docs/react/pages/phase-0-how-react-runs/08-versions-and-channels.md`
- **Read this:** [Versioning Policy](https://react.dev/community/versioning-policy) · react.dev · Latest, Canary, Experimental, and the version-string formats for each (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Our delta:** reading `19.3.0-canary-22e4f993-20260811` and what to pin.

### T00-10 · What React 19 changed — Understand · ✅ written `docs/react/pages/phase-0-how-react-runs/09-what-changed-in-19.md`
- **Read this:** [React v19](https://react.dev/blog/2024/12/05/react-19) · react.dev · Actions, `use`, `ref` as a prop, document metadata, preloading, `useActionState`, `useOptimistic`, hydration error diff (*read*) · covers our angle: **partial** — removals are in the upgrade guide, not here · fetched 2026-10-13
- **Also good:** [React 19 Upgrade Guide](https://react.dev/blog/2024/04/25/react-19-upgrade-guide) · react.dev · the removals that break upgrades (*read*) · fetched 2026-10-13
- **Beyond the docs:** [The Complete Developer Guide to React 19, Part 2](https://www.callstack.com/blog/the-complete-developer-guide-to-react-19-part-2-new-enhancements) · Hristo Totov, Callstack, 2024-09-03 · ref as a prop with the class-component limit and ref cleanup callbacks; pre-release, so future tense · fetched 2026-10-13 (*read*)
- **Our delta:** the removals shown by diffing exports across 18.3, 19.0 and 19.2.

### T00-11 · What React 19.2 added — Understand · ✅ written `docs/react/pages/phase-0-how-react-runs/09-what-changed-in-19.md` (section "React 19.0 → 19.2")
- **Read this:** [React 19.2](https://react.dev/blog/2025/10/01/react-19-2) · react.dev · `Activity`, `useEffectEvent`, `cacheSignal`, Partial Pre-rendering with `resume`, `useId` prefix now `_r_`, Performance Tracks (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [React 19.2 is here](https://blog.logrocket.com/react-19-2-is-here/) · David Omotayo, LogRocket, 2025-10-13 · contrasts `Activity` with conditional rendering (state kept) and gives a timer example for `useEffectEvent`; sample code has a typo · fetched 2026-10-13 (*read*)
- **Our delta:** which of these are still experimental or server-only.

### T00-12 · Starting a React project in 2026 — Understand · ✅ written `docs/react/pages/phase-0-how-react-runs/10-starting-a-project.md`
- **Read this:** [Sunsetting Create React App](https://react.dev/blog/2025/02/14/sunsetting-create-react-app) · react.dev · CRA deprecated for new apps; frameworks (Next.js, React Router, Expo) preferred, Vite, Parcel or Rsbuild for special cases (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Our delta:** a concrete Vite plus `@vitejs/plugin-react` recipe.

### T00-13 · The React Compiler exists — Understand · ✅ written `docs/react/pages/phase-0-how-react-runs/11-the-compiler.md`
- **Read this:** [React Compiler](https://react.dev/learn/react-compiler) · react.dev · index of introduction, installation, incremental adoption, debugging, configuration; the page itself has no code or detail, the substance is on the subpages (*read*) · covers our angle: **partial** — a map, little explanation · fetched 2026-10-13
- **Beyond the docs:** [React Compiler Internals](https://gitnation.com/contents/react-compiter-internals) · Lydia Hallie, React Summit 2025, 2025-06-13 · 23-minute talk through HIR, SSA, reactive analysis, scope discovery and code generation, and the limits when rules are broken; given at release-candidate stage (*read* the abstract, did not watch) · fetched 2026-10-13
- **Our delta:** "named here, taught in Phase 6".

### T00-14 · React DevTools — Understand · ✅ written `docs/react/pages/phase-0-how-react-runs/12-devtools-and-profiler.md`
- **Read this:** [React Developer Tools](https://react.dev/learn/react-developer-tools) · react.dev · install for Chrome, Firefox, Edge; standalone for Safari; Components and Profiler panels (*read*) · covers our angle: **partial** — install page, no Profiler or Performance Tracks walkthrough · fetched 2026-10-13
- **Beyond the docs:** [Measuring Performance with Real Tools](https://stevekinney.com/courses/react-performance/measuring-performance-with-real-tools) · Steve Kinney (course notes, last modified 2025-09-28) · recording a profile, flamegraph, Ranked view and "why did this render"; no "highlight updates" · fetched 2026-10-13 (*read*)
- **Our delta:** "highlight updates" and the 19.2 Performance Tracks.

### T00-15 · React on other renderers — Know · ✅ written `docs/react/pages/phase-0-how-react-runs/13-other-renderers.md`
- **Read this:** [react-reconciler README](https://github.com/facebook/react/tree/main/packages/react-reconciler) · facebook/react · a host config object passed to `Reconciler`; mutation vs persistence mode; notes the API changes often (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Beyond the docs:** [How to Create a Custom React Renderer](https://www.thisdot.co/blog/how-to-create-a-custom-react-renderer) · Matthew Pagan, This Dot, 2021-09-24 (updated 2023-02-14) · rebuilds a small react-dom with `createInstance` and `appendChild`; site says it may be out of date, so check method names against the README · fetched 2026-10-13 (*read*)
- **Our delta:** React Native, three-fiber and Ink named as renderers.

### T00-16 · Governance and cadence — Know · ✅ written `docs/react/pages/phase-0-how-react-runs/08-versions-and-channels.md` (section "Governance")
- **Read this:** [The React Foundation](https://react.dev/blog/2026/02/24/the-react-foundation) · react.dev, 2026-02-24 · React, React Native and JSX owned by an independent foundation hosted by the Linux Foundation; eight Platinum members; technical direction stays with maintainers (*read*) · covers our angle: **partial** — nothing on the RFC process or reading changelogs · fetched 2026-10-13
- **Our delta:** RFC process and how to read a changelog for an upgrade.

### T00-17 · React vs Vue, Svelte and Solid — Know · ✅ written `docs/react/pages/phase-0-how-react-runs/14-react-vs-alternatives.md`
- **Beyond the docs:** [Virtual DOM is pure overhead](https://svelte.dev/blog/virtual-dom-is-pure-overhead) · Rich Harris, Svelte blog, 2018-12-27 · argues the virtual DOM is a means to declarative UI, not a speed feature, and that update work can move to build time; written by a competing framework's author and from 2018, before the React Compiler · fetched 2026-10-13 (*read*)
- **Our delta:** the trade-off table and the Compiler's effect on the argument. No primary React page covers this, and the Solid docs comparison URL tried returned 404.

---

## Phase 1 — JSX and what a component returns

### T01-01 · Embedding expressions — Master · ✅ written `docs/react/pages/phase-1-jsx/02-embedding-expressions.md`
- **Read this:** [JavaScript in JSX with Curly Braces](https://react.dev/learn/javascript-in-jsx-with-curly-braces) · react.dev · braces work as text inside a tag or right after `=` in an attribute; any expression works, statements are not mentioned (*read*) · covers our angle: **partial** — no table of what renders and what does not · fetched 2026-10-13
- **Beyond the docs:** [How JSX Renders Different Data Types in ReactJS](https://www.bennadel.com/blog/2879-how-jsx-renders-different-data-types-in-reactjs.htm) · Ben Nadel, 2015-07-31 · tries booleans, null, undefined, 0, NaN, strings, arrays and objects one by one; React 0.13.3, where an object rendered each key-value pair, which today throws "Objects are not valid as a React child" · fetched 2026-10-13 (*read*)
- **Our delta:** the statement vs expression rule and the full render table.

### T01-02 · Attributes vs props — Master · ✅ written `docs/react/pages/phase-1-jsx/04-attributes-vs-props.md`
- **Read this:** [Common components](https://react.dev/reference/react-dom/components/common) · react.dev · `className`, `htmlFor`, `aria-*` identical to HTML, `data-*` supported, `style` camelCase (*read*) · covers our angle: **partial** — no general camelCase rule or rename list · fetched 2026-10-13
- **Our delta:** which attributes are renamed, passed through, or dropped.

### T01-03 · Conditional rendering — Master · ✅ written `docs/react/pages/phase-1-jsx/06-conditional-rendering.md`
- **Read this:** [Conditional Rendering](https://react.dev/learn/conditional-rendering) · react.dev · a Pitfall on `messageCount && ...` showing a literal 0, fixed with `messageCount > 0 && ...` (*read*) · covers our angle: **partial** — lookup objects appear only inside a challenge solution, not as a technique · fetched 2026-10-13
- **Beyond the docs:** [Common Beginner Mistakes with React](https://www.joshwcomeau.com/react/common-beginner-mistakes/) · Josh Comeau, 2023-03-06 (updated 2026-01-30) · "Evaluating with zero": `items.length && ...` prints 0, with the fix as `> 0` or a ternary · fetched 2026-10-13 (*read*)
- **Our delta:** lookup objects for many states.

### T01-04 · Lists and `key` — Master · ✅ written `docs/react/pages/phase-1-jsx/07-lists-and-keys.md`
- **Read this:** [Rendering Lists](https://react.dev/learn/rendering-lists) · react.dev · keys come from data and must not be generated during render; index keys break on insert, delete, reorder; put the key on the component element, not its inner root (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [Index as a key is an anti-pattern](https://robinpokorny.com/blog/index-as-a-key-is-an-anti-pattern/) · Robin Pokorny, 2015-10-11 · explains how a reused key matches the wrong element after a removal; no input-state example, so pair with our page · fetched 2026-10-13 (*read*)
- **Our delta:** the two-items-swap exercise with index keys vs stable keys.

### T01-05 · `children` — Master · ✅ written `docs/react/pages/phase-1-jsx/09-children.md`
- **Read this:** [Passing Props to a Component](https://react.dev/learn/passing-props-to-a-component) · react.dev · nested content arrives as `children`, a "hole" the parent fills with JSX (*read*) · covers our angle: **partial** — no named slots or function children · fetched 2026-10-13
- **Also good:** [Composition vs Inheritance](https://legacy.reactjs.org/docs/composition-vs-inheritance.html) · legacy React docs · `children` for containment, plain props such as `left` and `right` for several slots (*read*) · fetched 2026-10-13
- **Our delta:** `children` as a function.

### T01-06 · Form elements in JSX — Master · ✅ written `docs/react/pages/phase-1-jsx/13-form-elements/01-controlled-and-uncontrolled.md`
- **Read this:** [input](https://react.dev/reference/react-dom/components/input) · react.dev · `value` vs `defaultValue`, `checked` vs `defaultChecked`, `onChange` fires on every keystroke like the DOM `input` event (*read*) · covers our angle: **partial** — `select`, `textarea` and `option` are on other pages · fetched 2026-10-13
- **Beyond the docs:** [Controlled and uncontrolled form inputs in React don't have to be complicated](https://goshacmd.com/controlled-vs-uncontrolled-inputs-react/) · Gosha Spark, 2016-11-07 · a table of the value and change-callback props for text inputs, checkboxes, radios, textareas and selects, plus a feature comparison; 2016 and ref-based, so use `defaultValue` and hooks from our page; has a book promotion at the end · fetched 2026-10-13 (*read*)
- **Our delta:** `select` and `textarea` value handling.

### T01-07 · JSX is a function call — Understand · ✅ written `docs/react/pages/phase-1-jsx/01-jsx-is-a-function-call.md`
- **Read this:** [Introducing the New JSX Transform](https://legacy.reactjs.org/blog/2020/09/22/introducing-the-new-jsx-transform.html) · legacy React blog · the compiler imports from `react/jsx-runtime`, no `import React` needed, and those functions are for the compiler only (*read*) · covers our angle: **partial** — no `jsxs` or `jsxDEV` · fetched 2026-10-13
- **Beyond the docs:** [What is JSX?](https://kentcdodds.com/blog/what-is-jsx) · Kent C. Dodds, 2018-07-09 · each JSX snippet beside its `React.createElement` form; classic-runtime output, so the call name differs today · fetched 2026-10-13 (*read*)
- **Our delta:** hand-compiling to `jsx()` and `jsxs()`.

### T01-08 · Fragments — Understand · ✅ written `docs/react/pages/phase-1-jsx/08-fragments.md`
- **Read this:** [Fragment](https://react.dev/reference/react/Fragment) · react.dev · shorthand `<>` cannot take a `key`; import `Fragment` for keyed lists; state survives some Fragment-to-element swaps one level deep (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Our delta:** none beyond the reference.

### T01-09 · Spreading props — Understand · ✅ written `docs/react/pages/phase-1-jsx/10-spreading-props.md`
- **Read this:** [Unknown Prop Warning](https://react.dev/warnings/unknown-prop) · react.dev · spreading `props` onto a DOM element forwards parent-only props; destructure them out first (*read*) · covers our angle: **partial** — nothing on unreadable call sites · fetched 2026-10-13
- **Our delta:** the readability cost at call sites. A third-party page (React Patterns, no byline, one short example) was dropped as thin.

### T01-10 · Inline `style` — Understand · ✅ written `docs/react/pages/phase-1-jsx/11-inline-style.md`
- **Read this:** [Common components](https://react.dev/reference/react-dom/components/common) · react.dev · camelCase object, plain numbers get `px` unless the property is unitless; `className` for static styles, `style` for dynamic values (*read*) · covers our angle: **partial** — does not say why media queries and pseudo-classes are lost · fetched 2026-10-13
- **Our delta:** why a `style` attribute cannot hold selectors or at-rules.

### T01-11 · `dangerouslySetInnerHTML` — Understand · ✅ written `docs/react/pages/phase-1-jsx/12-dangerously-set-inner-html.md`
- **Read this:** [Common components](https://react.dev/reference/react-dom/components/common) · react.dev · takes an object with `__html`, carries an XSS warning, cannot be combined with `children` (*read*) · covers our angle: **partial** — no sanitizing advice · fetched 2026-10-13
- **Beyond the docs:** [dangerouslySetInnerHTML in a React application](https://blog.logrocket.com/using-dangerouslysetinnerhtml-react-application/) · Doğacan Bilgili, LogRocket (page says last updated 2024-09-13 by Ikeh Akinyemi; no separate original date) · two XSS payloads (`onmouseover`, `img onerror`) stripped by `DOMPurify.sanitize`, and the jsdom note for Node · fetched 2026-10-13 (*read*)
- **Our delta:** the threat model and the safer alternatives.

### T01-12 · Capitalization decides everything — Understand · ✅ written `docs/react/pages/phase-1-jsx/05-capitalization.md`
- **Read this:** [Your First Component](https://react.dev/learn/your-first-component) · react.dev · "their names must start with a capital letter or they won't work"; lowercase is read as an HTML tag (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [Unknown Prop Warning](https://react.dev/warnings/unknown-prop) · react.dev · lists a lowercase custom component such as `myButton` as a cause of the warning (*read*) · fetched 2026-10-13
- **Beyond the docs:** [The uppercase rule for React component names](https://angularindepth.com/article/why-component-identifiers-must-be-capitalized-in-react/) · Andrei Gatej, Angular In Depth, 2022-04-07 · shows Babel's `getTag` turning a lowercase name into a string and a capitalized name into an identifier · fetched 2026-10-13 (*read*)
- **Our delta:** the silent failure when a component name is lowercased.

### T01-13 · What can be rendered — Understand · ✅ written `docs/react/pages/phase-1-jsx/03-what-can-be-rendered.md`
- **Read this:** [isValidElement](https://react.dev/reference/react/isValidElement) · react.dev · elements are only one kind of React node; strings, numbers, arrays and portals are renderable but are not elements (*read*) · covers our angle: **partial** — no list of renderable types and no error text · fetched 2026-10-13
- **Beyond the docs:** [Objects are not valid as a React child](https://kinsta.com/blog/objects-are-not-valid-as-a-react-child/) · Joel Olawanle, Kinsta, 2023-06-08 (updated 2026-03-20) · rendering an object literal, an object in a variable, or an array directly; does not cover the Promise case (*read*) · fetched 2026-10-13
- **Our delta:** the three ways people hit the error.

### T01-14 · Whitespace and text — Know · ✅ written `docs/react/pages/phase-1-jsx/14-whitespace-and-text.md`
- **Read this:** [JSX In Depth](https://legacy.reactjs.org/docs/jsx-in-depth.html) · legacy React docs · JSX trims leading and trailing whitespace per line, drops blank lines, removes newlines adjacent to tags, and collapses newlines inside text to one space (*read*) · covers our angle: **partial** — no `{' '}` recipe or entities · fetched 2026-10-13
- **Our delta:** `{' '}`, entities and multi-line text formatting. The JSX spec repo (github.com/facebook/jsx) was fetched and says nothing on whitespace.

### T01-15 · The classic runtime and `@jsxImportSource` — When Needed · ✅ written `docs/react/pages/phase-1-jsx/15-the-classic-runtime.md`
- **Read this:** [@babel/plugin-transform-react-jsx](https://babeljs.io/docs/babel-plugin-transform-react-jsx) · Babel · `runtime` classic vs automatic, `importSource`, and the per-file pragmas `@jsxRuntime`, `@jsxImportSource`, `@jsx`, `@jsxFrag` (*read*) · covers our angle: **full** (page says classic was the default for Babel 7 and earlier, so the default has since changed) · fetched 2026-10-13
- **Also good:** [Introducing the New JSX Transform](https://legacy.reactjs.org/blog/2020/09/22/introducing-the-new-jsx-transform.html) · legacy React blog · classic needs React in scope; `importSource` for other libraries (*read*) · fetched 2026-10-13
- **Our delta:** when you still meet `React.createElement` output.

---

## Phase 2 — Components, props and composition

### T02-01 · Function components — Master · ✅ written `docs/react/pages/phase-2-components/01-function-components/01-what-makes-a-component.md`
- **Read this:** [Your First Component](https://react.dev/learn/your-first-component) · react.dev · "you must never nest their definitions"; a component defined inside another is "very slow and causes bugs" (*read*) · covers our angle: **partial** — no component vs helper function · fetched 2026-10-13
- **Also good:** [static-components](https://react.dev/reference/eslint-plugin-react-hooks/lints/static-components) · react.dev · a nested component is a new type each render, so state and DOM are destroyed; define at module level (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Don't call a React function component](https://kentcdodds.com/blog/dont-call-a-react-function-component) · Kent C. Dodds, 2019-12-08 · calling a component as a plain function attaches its hooks to the caller, giving "Rendered fewer hooks than expected" · fetched 2026-10-13 (*read*)
- **Our delta:** what separates a component from a helper.

### T02-02 · Purity — Master · ✅ written `docs/react/pages/phase-2-components/02-purity/01-the-two-rules.md`
- **Read this:** [Keeping Components Pure](https://react.dev/learn/keeping-components-pure) · react.dev · same inputs give same JSX; do not mutate pre-existing values; local mutation is fine; StrictMode double-calls to expose it (*read*) · covers our angle: **partial** — no Compiler link · fetched 2026-10-13
- **Beyond the docs:** [Component Purity and StrictMode in React](https://certificates.dev/blog/component-purity-and-strictmode-in-react) · Aurora Scharff, certificates.dev, 2025-07-09 · mutating props and non-idempotent values like the current time in render, with StrictMode as the detector; suggests capturing the time once with a `useState` initializer · fetched 2026-10-13 (*read*)
- **Our delta:** the rule StrictMode and the Compiler both check.

### T02-03 · Composition over configuration — Master · ✅ written `docs/react/pages/phase-2-components/03-composition/01-the-configuration-trap.md`
- **Read this:** [Composition vs Inheritance](https://legacy.reactjs.org/docs/composition-vs-inheritance.html) · legacy React docs · `children` for containment, several element props as slots (*read*) · covers our angle: **partial** — no boolean-prop explosion · fetched 2026-10-13
- **Beyond the docs:** [Inversion of Control](https://kentcdodds.com/blog/inversion-of-control) · Kent C. Dodds, 2019-11-18 · "make your abstraction do less stuff": replace an `items` option with composed children, and a `closeOnSelection` option with a caller-supplied `stateReducer` · fetched 2026-10-13 (*read*)
- **Our delta:** the twelve-boolean API and the slots pattern.

### T02-04 · Controlled vs uncontrolled — Master · ✅ written `docs/react/pages/phase-2-components/04-controlled-vs-uncontrolled/01-who-owns-the-value.md`
- **Read this:** [Sharing State Between Components](https://react.dev/learn/sharing-state-between-components) · react.dev · controlled gets key values from props, uncontrolled owns its state; real components mix both (*read*) · covers our angle: **partial** — the switch warning is on the input reference · fetched 2026-10-13
- **Also good:** [input](https://react.dev/reference/react-dom/components/input) · react.dev · an input cannot switch modes; use `value ?? ''` rather than null or undefined (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Controlled and uncontrolled form inputs in React don't have to be complicated](https://goshacmd.com/controlled-vs-uncontrolled-inputs-react/) · Gosha Spark, 2016-11-07 · when to pick each (instant validation, formatting, dynamic inputs vs simple forms) and how to migrate from uncontrolled to controlled later; does not cover the controlled-to-uncontrolled switch warning, which stays on the react.dev input page; 2016, ref-based · fetched 2026-10-13 (*read*)
- **Our delta:** a component that works both ways (the Dialog gate).

### T02-05 · Lifting state up — Master · ✅ written `docs/react/pages/phase-2-components/05-lifting-state-up/01-the-procedure.md`
- **Read this:** [Sharing State Between Components](https://react.dev/learn/sharing-state-between-components) · react.dev · three-step accordion procedure; one owner per piece of state (*read*) · covers our angle: **partial** — the re-render cost is not stated · fetched 2026-10-13
- **Beyond the docs:** [State Colocation will make your React app faster](https://kentcdodds.com/blog/state-colocation-will-make-your-app-faster) · Kent C. Dodds, 2019-09-23 · state high in the tree makes React walk every component below it; moving it down skips them · fetched 2026-10-13 (*read*)
- **Our delta:** the cost side of lifting.

### T02-06 · Props are read-only — Understand · ✅ written `docs/react/pages/phase-2-components/06-props-are-read-only.md`
- **Read this:** [Passing Props to a Component](https://react.dev/learn/passing-props-to-a-component) · react.dev · "props are immutable"; respond to input with state, parent passes new props (*read*) · covers our angle: **partial** — no account of why mutation appears to work · fetched 2026-10-13
- **Beyond the docs:** [Can you modify React props?](https://epicreact.dev/can-you-modify-react-props) · Kent C. Dodds, EpicReact (no date shown) · mutating the props object surprises other code and does not re-render; reassigning a destructured variable is fine · fetched 2026-10-13 (*read*)
- **Our delta:** callbacks down instead of mutation.

### T02-07 · Destructuring and default values — Understand · ✅ written `docs/react/pages/phase-2-components/07-destructuring-and-defaults.md`
- **Read this:** [React 19 Upgrade Guide](https://react.dev/blog/2024/04/25/react-19-upgrade-guide) · react.dev · `defaultProps` removed for function components (use default parameters), class components keep it; `propTypes` silently ignored (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [Passing Props to a Component](https://react.dev/learn/passing-props-to-a-component) · react.dev · the default applies only for a missing or undefined prop, not `null` or `0` (*read*) · fetched 2026-10-13
- **Our delta:** none beyond the two pages.

### T02-08 · Children patterns — Understand · ✅ written `docs/react/pages/phase-2-components/08-children-patterns.md`
- **Read this:** [Render Props](https://legacy.reactjs.org/docs/render-props.html) · legacy React docs · the function prop can be named `children`; notes custom Hooks replace many uses (*read*) · covers our angle: **partial** — no compound components · fetched 2026-10-13
- **Beyond the docs:** [Compound Components In React](https://smashingmagazine.com/2021/08/compound-components-react) · Ichoku Chinonso, Smashing Magazine, 2021-08-27 · an accordion whose sub-components share open state through context, with pros and cons; the demo code has inconsistencies (`toggleIsShown` used but not provided), so follow the idea, not the code · fetched 2026-10-13 (*read*)
- **Our delta:** layout and wrapper components.

### T02-09 · `ref` as a prop (React 19) — Understand · ✅ written `docs/react/pages/phase-2-components/09-ref-as-a-prop.md`
- **Read this:** [forwardRef](https://react.dev/reference/react/forwardRef) · react.dev · "In React 19, forwardRef is no longer necessary. Pass ref as a prop instead"; to be deprecated later, not yet (*read*) · covers our angle: **partial** — no codemod · fetched 2026-10-13
- **Also good:** [React v19](https://react.dev/blog/2024/12/05/react-19) · react.dev · the `ref` as a prop section (*read*) · fetched 2026-10-13
- **Beyond the docs:** [The Complete Developer Guide to React 19, Part 2](https://www.callstack.com/blog/the-complete-developer-guide-to-react-19-part-2-new-enhancements) · Hristo Totov, Callstack, 2024-09-03 · does not work on class components; ref callbacks may return a cleanup; pre-release, so codemod and deprecation are future tense · fetched 2026-10-13 (*read*)
- **Our delta:** what still needs `forwardRef` in a library.

### T02-10 · Component boundaries — Understand · ✅ written `docs/react/pages/phase-2-components/10-component-boundaries.md`
- **Read this:** [Thinking in React](https://react.dev/learn/thinking-in-react) · react.dev · one concern per component, align with the data model; whether to split a table header is "a matter of preference" (*read*) · covers our angle: **partial** — nothing on when splitting hides the flow · fetched 2026-10-13
- **Beyond the docs:** [Colocation](https://kentcdodds.com/blog/colocation) · Kent C. Dodds, 2019-06-17 · "place code as close to where it's relevant as possible"; aimed at files and state in general, not only components · fetched 2026-10-13 (*read*)
- **Our delta:** when splitting hides the flow.

### T02-11 · Portals — Understand · ✅ written `docs/react/pages/phase-2-components/11-portals.md`
- **Read this:** [createPortal](https://react.dev/reference/react-dom/createPortal) · react.dev · a portal acts as a child of its React parent; events bubble through the React tree, stated in the Caveats in prose (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Our delta:** the Dialog gate.

### T02-12 · Render props and function-as-children — Know · ✅ written `docs/react/pages/phase-2-components/12-render-props/01-the-pattern.md`
- **Read this:** [Render Props](https://legacy.reactjs.org/docs/render-props.html) · legacy React docs · mouse-tracker example, `children` as the function, inline functions defeat `PureComponent` (*read*) · covers our angle: **partial** — "where it still wins" is not stated · fetched 2026-10-13
- **Beyond the docs:** [React Hooks: What's going to happen to render props?](https://kentcdodds.com/blog/react-hooks-whats-going-to-happen-to-render-props) · Kent C. Dodds, 2018-12-10 · hooks replace many render props, but render props stay for inversion of control such as `rowRenderer`; written while Hooks were in alpha · fetched 2026-10-13 (*read*)
- **Our delta:** the cases where a render prop still beats a hook.

### T02-13 · Higher-order components — Know · ✅ written `docs/react/pages/phase-2-components/13-higher-order-components/01-the-pattern-and-the-caveats.md`
- **Read this:** [Higher-Order Components](https://legacy.reactjs.org/docs/higher-order-components.html) · legacy React docs · caveats: never wrap inside `render`, static methods not copied, refs not passed through; `displayName` is a separate convention section (*read*) · covers our angle: **partial** — prop collisions and hooks are covered elsewhere · fetched 2026-10-13
- **Beyond the docs:** [React Higher-Order Components](https://www.robinwieruch.de/react-higher-order-components/) · Robin Wieruch, 2022-04-19 · HOC patterns for loading and empty states, composing several, and the hidden-dependency trap when order matters · fetched 2026-10-13 (*read*)
- **Our delta:** why hooks replaced almost all of it.

### T02-14 · Class components — Know · ✅ written `docs/react/pages/phase-2-components/14-class-components/01-anatomy-and-this.md`
- **Read this:** [Component](https://react.dev/reference/react/Component) · react.dev · mount, update, unmount methods map to `useEffect`; `getDerivedStateFromError` and `componentDidCatch` have no hook form (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [How Are Function Components Different from Classes?](https://overreacted.io/how-are-function-components-different-from-classes/) · Dan Abramov, Overreacted, 2019-03-03 · a class reads `this.props` at call time and React mutates `this`, so a delayed callback can see newer props, while a function component captures its render's values; binding in the constructor does not fix it · fetched 2026-10-13 (*read*)
- **Our delta:** `this` binding.

### T02-15 · `Component` vs `PureComponent` — Know · ✅ written `docs/react/pages/phase-2-components/15-purecomponent.md`
- **Read this:** [PureComponent](https://react.dev/reference/react/PureComponent) · react.dev · same as a `shouldComponentUpdate` that shallow-compares props and state; `memo` compares props only (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Beyond the docs:** [PureComponent and React.memo](https://blog.logrocket.com/pure-component-in-react) · Glad Chinda, LogRocket, 2025-03-03 · side-by-side of `PureComponent`, `memo` with `arePropsEqual`, and a hand-written `shouldComponentUpdate`; notes `arePropsEqual` returns true to skip, the opposite of `shouldComponentUpdate`; also covers the old Recompose `pure` HOC · fetched 2026-10-13 (*read*)
- **Our delta:** reading them in inherited code.

### T02-16 · `cloneElement`, `Children.map` and `isValidElement` — Know · ✅ written `docs/react/pages/phase-2-components/16-element-manipulation.md`
- **Read this:** [cloneElement](https://react.dev/reference/react/cloneElement) · react.dev · "can lead to fragile code" and hides data flow; alternatives are a render prop, context, or a custom hook (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [Children](https://react.dev/reference/react/Children) · react.dev · `Children` only sees the JSX passed in, not rendered output; alternatives are exposing components, an array prop, or a render prop (*read*) · [isValidElement](https://react.dev/reference/react/isValidElement) · react.dev · rarely needed; not a test for "can be rendered" (*read*) · fetched 2026-10-13
- **Our delta:** the context-based replacement shown end to end.
