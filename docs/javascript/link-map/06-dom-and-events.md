---
title: "Link map · JavaScript · Part 6 (phases 9–10)"
sidebar_label: "06 · dom and events"
sidebar_position: 6
---

# Link map · JavaScript · Part 6 (phases 9–10)

Covers every topic row of `docs/javascript/syllabus/03-web-apis.md` in phase 9 (T09-01 to T09-19, the DOM) and phase 10 (T10-01 to T10-14, events and user input). That is 33 rows, and all 33 have a written page of ours.
*read* = I read the passage and it supports the claim; *headings only* = fetched, headings or size checked; *fetched, not read* = the URL returned 200 but I did not read the passage, so treat the pick as a lead. Third-party links carry a date only where the page shows one. No `#anchors` are given.

🔴 **Version note.** Our syllabus targets **Node 24 LTS** (`docs/javascript/README.md`); DOM and events are browser APIs, so MDN (a live reference) is the version that matters. Third-party picks are older than the platform: the Resig fragment post is 2008, the Grigorik page-visibility post is 2015, Zell Liew is 2018, Go Make Things delegation is 2018, and the web.dev Trusted Types page was last updated 2020-03-25 (browser support there is stale). The web.dev custom-elements and shadow-DOM pages date from 2016-2017. The MDN locating-elements page moved: its old URL redirects to the one given, and the old "Introduction to the DOM" URL now redirects to the DOM hub page.

🔴 **Search coverage.** The shared web-search budget ran out twice: once during the first pass and again during verification. Web searches were run for T09-01 to T09-13 only (first pass; I could not re-run them). T09-14 to T09-19 and all of phase 10 were **not searched**. During verification the 15 spot-check searches could not be run, so the only "Beyond the docs" picks added there (T10-04, T10-10) are pages I fetched and read directly, not search results. A missing "Beyond the docs" line is a gap to fill in a follow-up pass, not a finding that nothing good exists. Every URL below was re-fetched on 2026-10-13 and returned 200 (the Cloud Four page refuses a plain `curl` with 403 but opens in the page fetcher and was read there).

---

## Phase 9 — The DOM

### T09-01 · What the DOM is — Master · ✅ written `docs/javascript/pages/phase-9-dom/01-what-the-dom-is/01-a-tree-of-nodes.md`
- **Read this:** [Anatomy of the DOM](https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model/Anatomy_of_the_DOM) · MDN · the document as a tree of `Node` objects, `Element` as one kind of node, and `parentElement`/`children` versus `parentNode`/`childNodes` (*read*) · covers our angle: **partial** — never addresses where markup ends and JavaScript begins · fetched 2026-10-13
- **Also good:** [Document Object Model (DOM)](https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model) · MDN · hub page for the guides and the Node and Element interfaces (*headings only*) · fetched 2026-10-13
- **Beyond the docs:** [What is the Difference Between a DOM Node and an Element?](https://dmitripavlutin.com/dom-node-element/) · Dmitri Pavlutin, 2021-01-05 · shows text and document nodes with `nodeType` and contrasts `childNodes` with `children` (comment nodes are only named in passing) · fetched 2026-10-13 (*read*)
- **Our delta:** nodes versus elements and the markup/JavaScript line framed together.

### T09-02 · Selecting elements — Master · ✅ written `docs/javascript/pages/phase-9-dom/02-selecting-elements/01-the-selector-methods.md`
- **Read this:** [Selection and traversal on the DOM tree](https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model/Selection_and_traversal_on_the_DOM_tree) · MDN · `getElementById`, `querySelector`/`querySelectorAll`, `matches`/`closest`, and a "Live and static collections" section (*read*) · covers our angle: **full** · fetched 2026-10-13 (page moved: the old "Locating DOM elements using selectors" URL redirects here)
- **Also good:** [Searching: getElement*, querySelector*](https://javascript.info/searching-elements-dom) · javascript.info · a live-collections section with a length-changes demo (*read*) · fetched 2026-10-13
- **Beyond the docs:** [Static versus live NodeLists and HTMLCollections in vanilla JavaScript](https://gomakethings.com/articles/static-versus-live-nodelists-and-htmlcollections-in-vanilla-javascript/) · Go Make Things, 2022-07-25 · `querySelectorAll` is a snapshot, `getElementsByTagName` and `children` update; the demos are linked CodePens (no loop-bug walk-through in the text) · fetched 2026-10-13 (*read*)
- **Our delta:** liveness depends on the API that made the collection, not on the type name (`childNodes` is a live NodeList).

### T09-03 · Creating and inserting — Master · ✅ written `docs/javascript/pages/phase-9-dom/03-creating-and-inserting/01-building-and-placing.md`
- **Read this:** [Modifying the document](https://javascript.info/modifying-document) · javascript.info · `createElement`, the insertion methods (`append`, `prepend`, `before`, `after`, `replaceWith`), `insertAdjacentHTML`, `cloneNode` and `DocumentFragment` together (*headings only*) · covers our angle: **full** by headings · fetched 2026-10-13
- **Also good:** [Element.insertAdjacentHTML()](https://developer.mozilla.org/en-US/docs/Web/API/Element/insertAdjacentHTML) · MDN · four positions and the no-sanitisation security note (*read*) · covers: one method only · fetched 2026-10-13
- **Our delta:** build the subtree before attaching it.

### T09-04 · `textContent` vs `innerText` vs `innerHTML` — Master · ✅ written `docs/javascript/pages/phase-9-dom/04-text-vs-html/01-the-three-properties.md`
- **Read this:** [Node.textContent](https://developer.mozilla.org/en-US/docs/Web/API/Node/textContent) · MDN · has "Differences from innerText" (`innerText` is layout-aware and triggers a reflow) and "Differences from innerHTML" (XSS, HTML parser cost) (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [HTMLElement.innerText](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/innerText) · MDN · layout-aware, rendered-text reading (*headings only*) · fetched 2026-10-13
- **Our delta:** the layout cost `innerText` pays and the XSS boundary stated together.

### T09-05 · Attributes versus properties — Master · ✅ written `docs/javascript/pages/phase-9-dom/05-attributes-vs-properties/01-two-parallel-worlds.md`
- **Read this:** [HTML attributes vs DOM properties](https://jakearchibald.com/2024/attributes-vs-properties/) · Jake Archibald, 2024-04-24 · covers `<details open>` as a boolean attribute and `value` versus `defaultValue` (*read*) · covers our angle: **partial** — no `dataset` · fetched 2026-10-13
- **Also good:** [HTMLElement.dataset](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/dataset) · MDN · `data-*` to camelCase mapping (*headings only*) · fetched 2026-10-13
- **Beyond the docs:** [The Difference Between HTML Attributes and Properties](https://cloudfour.com/thinks/the-difference-between-html-attributes-and-properties/) · Paul Hebert, Cloud Four, 2025-01-06 · an `<input>` value property drifting from its attribute, in a shorter telling than Archibald · fetched 2026-10-13 (*read*)
- **Our delta:** `dataset` and the boolean-attribute rule in one place.

### T09-06 · Sanitising HTML — Master · ✅ written `docs/javascript/pages/phase-9-dom/06-sanitising-html/01-sinks-and-sanitisers.md`
- **Read this:** [Prevent DOM-based cross-site scripting vulnerabilities with Trusted Types](https://web.dev/articles/trusted-types) · web.dev, last updated 2020-03-25 · lists the sinks (`innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval`) and the policy model; DOMPurify appears only in a "use a library" section and a default-policy example (*read*) · covers our angle: **partial** — Trusted Types centred, no DOMPurify walkthrough; 2020 text, so browser-support tables are stale · fetched 2026-10-13
- **Also good:** [Trusted Types API](https://developer.mozilla.org/en-US/docs/Web/API/Trusted_Types_API) · MDN · current support and the API shape (*headings only*) · [Element.setHTMLUnsafe()](https://developer.mozilla.org/en-US/docs/Web/API/Element/setHTMLUnsafe) · MDN (*headings only*) · fetched 2026-10-13
- **Our delta:** the grep list of sinks and when a sanitiser is the wrong fix.

### T09-07 · Traversal — Understand · ✅ written `docs/javascript/pages/phase-9-dom/07-traversal/01-the-two-families.md`
- **Read this:** [Element.closest()](https://developer.mozilla.org/en-US/docs/Web/API/Element/closest) · MDN · starts at the element itself, returns `null` when nothing matches (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [Anatomy of the DOM](https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model/Anatomy_of_the_DOM) · MDN · `parentElement` versus `parentNode`, `children` versus `childNodes` (*read*) · fetched 2026-10-13
- **Beyond the docs:** [DOM traversals](https://zellwk.com/blog/dom-traversals/) · Zell Liew, 2018-04-11 · up (`parentElement`, `closest`), down (`children`) and sideways (`nextElementSibling`); uses only the element-only siblings and never explains the node-versus-element split · fetched 2026-10-13 (*read*)
- **Our delta:** why `closest` beats manual walking when markup changes.

### T09-08 · Classes and styles from JavaScript — Understand · ✅ written `docs/javascript/pages/phase-9-dom/08-classes-and-styles/01-classlist.md`
- **Read this:** [Element.classList](https://developer.mozilla.org/en-US/docs/Web/API/Element/classList) · MDN · `add`, `remove`, `replace`, `toggle`; the `force` second argument to `toggle` is shown only in an example comment (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [CSSStyleDeclaration.setProperty()](https://developer.mozilla.org/en-US/docs/Web/API/CSSStyleDeclaration/setProperty) · MDN · the route for custom properties (*headings only*) · [Styles and classes](https://javascript.info/styles-and-classes) · javascript.info (*fetched, not read*) · fetched 2026-10-13
- **Our delta:** read via `getComputedStyle`, write via inline `style.setProperty`, for custom properties.

### T09-09 · Forms — Understand · ✅ written `docs/javascript/pages/phase-9-dom/09-forms/01-formdata.md`
- **Read this:** [Using FormData objects](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest_API/Using_FormData_Objects) · MDN · `new FormData(form)` from a form element, sent with `fetch`, only named inputs included, plus a gotchas section (*read*) · covers our angle: **partial** — nothing on `input` versus `change` or validation · fetched 2026-10-13
- **Also good:** [FormData](https://developer.mozilla.org/en-US/docs/Web/API/FormData) · MDN · method list (`get`, `getAll`, `set`, `append`, `entries`); no form-element example on this page (*read*) · [Constraint validation](https://developer.mozilla.org/en-US/docs/Web/HTML/Guides/Constraint_validation) · MDN · `checkValidity`, `setCustomValidity`, validity states (*headings only*) · [Form properties and methods](https://javascript.info/form-elements) · javascript.info (*fetched, not read*) · fetched 2026-10-13
- **Our delta:** `input` versus `change` and reading a whole form in one line.

### T09-10 · Removing and replacing — Understand · ✅ written `docs/javascript/pages/phase-9-dom/10-removing-and-replacing/01-the-api.md`
- **Read this:** [Element.replaceWith()](https://developer.mozilla.org/en-US/docs/Web/API/Element/replaceWith) · MDN · replaces a node with nodes or strings (*read*) · covers our angle: **partial** — nothing on listener cleanup · fetched 2026-10-13
- **Also good:** [Element.replaceChildren()](https://developer.mozilla.org/en-US/docs/Web/API/Element/replaceChildren) · MDN · empties and refills in one call (*headings only*) · fetched 2026-10-13
- **Our delta:** the listener and reference cleanup that removal does not do for you.

### T09-11 · Batching DOM work — Understand · ✅ written `docs/javascript/pages/phase-9-dom/11-batching-dom-work/01-build-off-document.md`
- **Read this:** [DocumentFragment](https://developer.mozilla.org/en-US/docs/Web/API/DocumentFragment) · MDN · a minimal document object outside the live tree; inserting it moves its nodes and leaves it empty (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [The template element](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/template) · MDN · `content` is a `DocumentFragment`; clone it with `document.importNode(template.content, true)` (*read*) · fetched 2026-10-13
- **Beyond the docs:** [DOM DocumentFragments](https://johnresig.com/blog/dom-documentfragments/) · John Resig, 2008-07-21 · reports 2-3x faster insertion by batching in a fragment, with a per-browser timing table; commenters dispute the benchmark (a detached `span` did about as well). 2008 numbers, so treat as the idea, not a benchmark · fetched 2026-10-13 (*read*)
- **Our delta:** a 1 000-row table without freezing the page.

### T09-12 · Layout thrashing — Understand · ✅ written `docs/javascript/pages/phase-9-dom/12-layout-thrashing/01-the-forced-reflow.md`
- **Read this:** [What forces layout/reflow. The comprehensive list.](https://gist.github.com/paulirish/5d52fb081b3570c81e3a) · Paul Irish (gist), body says "Updated slightly April 2020" · the property and method list that forces layout, grouped by API (element, window, document, forms, mouse offsets, `getComputedStyle`, `Range`, SVG, contenteditable); a short appendix recommends batching reads and writes (*read*) · covers our angle: **partial** — a list, with only a brief fix note · fetched 2026-10-13
- **Also good:** [Avoid large, complex layouts and layout thrashing](https://web.dev/articles/avoid-large-complex-layouts-and-layout-thrashing) · web.dev, last updated 2025-05-07 · a loop that reads then writes per iteration is a read-write cycle; the fix is to read once before the loop (*read*) · fetched 2026-10-13
- **Our delta:** the write-then-read pattern and the batch-reads-first fix.

### T09-13 · Measuring elements — Understand · ✅ written `docs/javascript/pages/phase-9-dom/13-measuring-elements/01-the-four-families.md`
- **Read this:** [Determining the dimensions of elements](https://developer.mozilla.org/en-US/docs/Web/API/CSS_Object_Model/Determining_the_dimensions_of_elements) · MDN · `offsetWidth` is layout width, `getBoundingClientRect` is rendered width (a `scale(0.5)` box reads 50 versus 100) (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [Element.getBoundingClientRect()](https://developer.mozilla.org/en-US/docs/Web/API/Element/getBoundingClientRect) · MDN (*headings only*) · [Element size and scrolling](https://javascript.info/size-and-scroll) · javascript.info (*fetched, not read*) · fetched 2026-10-13
- **Our delta:** device pixel ratio and the four families side by side.

### T09-14 · Scrolling — Understand · ✅ written `docs/javascript/pages/phase-9-dom/14-scrolling/01-moving-the-scroll-position.md`
- **Read this:** [Element.scrollIntoView()](https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollIntoView) · MDN · options object: `behavior` (`smooth`, `instant`, `auto`), `block`, `inline`, and a `container` option (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [History.scrollRestoration](https://developer.mozilla.org/en-US/docs/Web/API/History/scrollRestoration) · MDN · `auto` or `manual` (*read*) · fetched 2026-10-13
- **Search status:** not searched (web-search budget exhausted).
- **Our delta:** scroll containers, sticky and restoring position.

### T09-15 · Focus and accessibility from JavaScript — Understand · ✅ written `docs/javascript/pages/phase-9-dom/15-focus-and-accessibility/01-what-can-hold-focus.md`
- **Read this:** [Focusing: focus/blur](https://javascript.info/focus-blur) · javascript.info · `focus()`/`blur()`, `tabindex` to make any element focusable, and `focusin`/`focusout` (*headings only*) · covers our angle: **partial** — nothing on focus traps or `aria-*` · fetched 2026-10-13
- **Also good:** [ARIA live regions](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Guides/Live_regions) · MDN · `aria-live` polite/assertive, create the region before updating it; does not cover focus management (*read*) · [Keyboard focus](https://web.dev/learn/accessibility/focus) · web.dev, last updated 2022-10-31 · `tabindex` values only; defers JavaScript focus management to another module (*read*) · fetched 2026-10-13
- **Search status:** not searched (web-search budget exhausted).
- **Our delta:** a working focus trap for modals.

### T09-16 · `<dialog>`, the popover API and `inert` — Know · ✅ written `docs/javascript/pages/phase-9-dom/16-dialog-popover-inert/01-the-dialog-element.md`
- **Read this:** [The dialog element](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog) · MDN · `showModal()` versus `show()`, `close()`, `::backdrop`; says the browser makes everything outside a modal dialog inert, and never uses the phrase "focus trap" (*read*) · covers our angle: **partial** — popover only by link · fetched 2026-10-13
- **Also good:** [Popover API](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API) · MDN (*headings only*) · [inert](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/inert) · MDN (*headings only*) · fetched 2026-10-13
- **Search status:** not searched (web-search budget exhausted).
- **Our delta:** the three features framed as replacing libraries.

### T09-17 · `MutationObserver` — Know · ✅ written `docs/javascript/pages/phase-9-dom/17-mutationobserver/01-the-api.md`
- **Read this:** [Mutation observer](https://javascript.info/mutation-observer) · javascript.info · config options (`childList`, `subtree`, `attributes`), the record properties, `disconnect`/`takeRecords`, and a "Dynamic highlight demo" (*headings only*) · covers our angle: **partial** — observer feedback loops not confirmed · fetched 2026-10-13
- **Also good:** [MutationObserver](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver) · MDN · constructor, one-line `disconnect`/`takeRecords` and an example; the option list and record shape live on the linked `observe()` and `MutationRecord` pages, not here (*read*) · [MutationObserver.observe()](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver/observe) · MDN (*fetched, not read*) · fetched 2026-10-13
- **Search status:** not searched (web-search budget exhausted).
- **Our delta:** reacting without polling, and avoiding observer feedback loops.

### T09-18 · Shadow DOM and custom elements — Know · ✅ written `docs/javascript/pages/phase-9-dom/18-shadow-dom-and-custom-elements/01-custom-elements.md`
- **Read this:** [Using custom elements](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements) · MDN · `connectedCallback`, `disconnectedCallback`, `adoptedCallback`, `attributeChangedCallback` (and `connectedMoveCallback`) (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [Using shadow DOM](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM) · MDN (*headings only*) · [Shadow DOM v1 - Self-Contained Web Components](https://web.dev/articles/shadowdom-v1) · Eric Bidelman, web.dev, last updated 2016-08-01 · slots, `:host`, `::slotted` and custom properties as styling hooks, but a 2016 text (*read*) · [Shadow DOM](https://javascript.info/shadow-dom) · javascript.info (*fetched, not read*) · fetched 2026-10-13
- **Search status:** not searched (web-search budget exhausted).
- **Our delta:** where style boundaries help and hurt.

### T09-19 · Selection, `Range` and `contenteditable` — When Needed · ✅ written `docs/javascript/pages/phase-9-dom/19-selection-range-contenteditable/01-selection-and-range.md`
- **Read this:** [Selection](https://developer.mozilla.org/en-US/docs/Web/API/Selection) · MDN · one selection object per document via `getSelection()`, `anchorNode`, `getRangeAt()`; `contenteditable` only in the glossary (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [Range](https://developer.mozilla.org/en-US/docs/Web/API/Range) · MDN (*headings only*) · [Selection and Range](https://javascript.info/selection-range) · javascript.info (*fetched, not read*) · fetched 2026-10-13
- **Search status:** not searched (web-search budget exhausted).
- **Our delta:** the surface behind a rich-text editor.


## Phase 10 — Events and user input

### T10-01 · The event model — Master · ✅ written `docs/javascript/pages/phase-10-events/01-the-event-model/01-three-phases.md`
- **Read this:** [Event bubbling](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting/Event_bubbling) · MDN · sections on bubbling, event capture, delegation, and `target` versus `currentTarget` (*read*) · covers our angle: **full** · fetched 2026-10-13
- **Also good:** [Bubbling and capturing](https://javascript.info/bubbling-and-capturing) · javascript.info · capturing, target and bubbling phases mapped to `eventPhase` values 1, 2, 3 (*headings only*) · fetched 2026-10-13
- **Search status:** not searched (web-search budget exhausted).
- **Our delta:** a listener on an element you did not click.

### T10-02 · `addEventListener` — Master · ✅ written `docs/javascript/pages/phase-10-events/02-addeventlistener/01-options-and-removal.md`
- **Read this:** [EventTarget.addEventListener()](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener) · MDN · options `once`, `capture`, `passive`, `signal`; anonymous functions are never identical, so they cannot be removed (*read*) · covers our angle: **partial** — the rule that removal must also match the `capture` flag is not stated here · fetched 2026-10-13
- **Also good:** [EventTarget.removeEventListener()](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/removeEventListener) · MDN · the removal side (*fetched, not read*) · fetched 2026-10-13
- **Search status:** not searched (web-search budget exhausted).
- **Our delta:** the identity trap with inline functions.

### T10-03 · The event object — Master · ✅ written `docs/javascript/pages/phase-10-events/03-the-event-object/01-target-default-propagation.md`
- **Read this:** [Event.currentTarget](https://developer.mozilla.org/en-US/docs/Web/API/Event/currentTarget) · MDN · versus `target`, with a parent/child click example (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [Event.stopImmediatePropagation()](https://developer.mozilla.org/en-US/docs/Web/API/Event/stopImmediatePropagation) · MDN (*headings only*) · [Event.preventDefault()](https://developer.mozilla.org/en-US/docs/Web/API/Event/preventDefault) · MDN (*headings only*) · fetched 2026-10-13
- **Search status:** not searched (web-search budget exhausted).
- **Our delta:** the three calls compared in one table.

### T10-04 · Event delegation — Master · ✅ written `docs/javascript/pages/phase-10-events/04-event-delegation/01-one-listener.md`
- **Read this:** [Event delegation](https://javascript.info/event-delegation) · javascript.info · one handler on a table with `event.target.closest('td')`; limits: the event must bubble, low-level handlers must not call `stopPropagation()` (*read*) · covers our angle: **partial** — no re-render discussion · fetched 2026-10-13
- **Also good:** [Event bubbling](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting/Event_bubbling) · MDN · has an "Event delegation" section (*headings only*) · fetched 2026-10-13
- **Beyond the docs:** [Why event delegation is a better way to listen for events in vanilla JS](https://gomakethings.com/articles/why-event-delegation-is-a-better-way-to-listen-for-events-in-vanilla-js/) · Go Make Things (Chris Ferdinandi), 2018-02-14 · one parent listener checks selectors at click time, so elements added later are covered; says nothing on non-bubbling events · fetched 2026-10-13 (*read*)
- **Search status:** not searched (web-search budget exhausted); the Beyond pick above was found by direct fetch, not by search.
- **Our delta:** the cases where delegation fails.

### T10-05 · Form and input events — Understand · ✅ written `docs/javascript/pages/phase-10-events/05-form-and-input-events/01-the-event-set.md`
- **Read this:** [Element: input event](https://developer.mozilla.org/en-US/docs/Web/API/Element/input_event) · MDN · `input` fires as the user edits, `change` when the value is committed; programmatic `value` changes fire neither (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [beforeinput](https://developer.mozilla.org/en-US/docs/Web/API/Element/beforeinput_event) · MDN (*headings only*) · [Events: change, input, cut, copy, paste](https://javascript.info/events-change-input) · javascript.info (*headings only*) · fetched 2026-10-13
- **Search status:** not searched (web-search budget exhausted).
- **Our delta:** a controlled input by hand.

### T10-06 · Keyboard events — Understand · ✅ written `docs/javascript/pages/phase-10-events/06-keyboard-events/01-key-code-and-keycode.md`
- **Read this:** [Keyboard: keydown and keyup](https://javascript.info/keyboard-events) · javascript.info · `event.key` (the character, layout-dependent) versus `event.code` (the physical key), legacy `keyCode`, modifier flags, mobile/IME keys reporting `Unidentified` (*read*) · covers our angle: **partial** — composition events are not discussed · fetched 2026-10-13
- **Also good:** [KeyboardEvent.key](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key) · MDN · defines `key` only; it does not explain `code`, `keyCode` or IME (*read*) · [KeyboardEvent.code](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code) · MDN (*headings only*) · [KeyboardEvent.isComposing](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/isComposing) · MDN (*fetched, not read*) · fetched 2026-10-13
- **Search status:** not searched (web-search budget exhausted).
- **Our delta:** IME composition and a shortcut implementation.

### T10-07 · Pointer events — Understand · ✅ written `docs/javascript/pages/phase-10-events/07-pointer-events/01-the-unified-model.md`
- **Read this:** [Pointer events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events) · MDN · one event model for mouse, pen and touch; "Capturing the pointer", `touch-action`, and mouse-event compatibility sections (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [Element.setPointerCapture()](https://developer.mozilla.org/en-US/docs/Web/API/Element/setPointerCapture) · MDN (*headings only*) · [Pointer events](https://javascript.info/pointer-events) · javascript.info · a slider built on pointer capture and a drag with `pointercancel` and `touch-action: none` (*headings only*) · fetched 2026-10-13
- **Search status:** not searched (web-search budget exhausted).
- **Our delta:** a drag that does not leak listeners.

### T10-08 · Custom events — Understand · ✅ written `docs/javascript/pages/phase-10-events/08-custom-events/01-dispatching-and-listening.md`
- **Read this:** [DOM events](https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model/Events) · MDN · "Creating and dispatching events": `new CustomEvent(name, { detail })`, subclassing `Event`, bubbling, dynamic dispatch (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [Dispatching custom events](https://javascript.info/dispatch-events) · javascript.info · `CustomEvent` and `detail`, `dispatchEvent`, the `bubbles` default, `isTrusted`, and that nested dispatch is synchronous (*headings only*) · [CustomEvent](https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent) · MDN · reference page with no code example (*read*) · fetched 2026-10-13
- **Search status:** not searched (web-search budget exhausted).
- **Our delta:** decoupling components without a framework.

### T10-09 · Scroll, resize and visibility — Understand · ✅ written `docs/javascript/pages/phase-10-events/09-scroll-resize-visibility/01-the-high-frequency-events.md`
- **Read this:** [IntersectionObserver](https://developer.mozilla.org/en-US/docs/Web/API/IntersectionObserver) · MDN · asynchronous intersection with a root; the example loads more items when a footer scrolls into view (*read*) · covers our angle: **partial** — no throttling or `passive` discussion · fetched 2026-10-13
- **Also good:** [ResizeObserver](https://developer.mozilla.org/en-US/docs/Web/API/ResizeObserver) · MDN (*headings only*) · [Element: scroll event](https://developer.mozilla.org/en-US/docs/Web/API/Element/scroll_event) · MDN (*headings only*) · fetched 2026-10-13
- **Search status:** not searched (web-search budget exhausted).
- **Our delta:** throttling versus an observer, and `passive: true`.

### T10-10 · Page lifecycle — Understand · ✅ written `docs/javascript/pages/phase-10-events/10-page-lifecycle/01-startup.md`
- **Read this:** [Page Lifecycle API](https://developer.chrome.com/docs/web-platform/page-lifecycle-api) · Chrome for Developers, last updated 2023-12-01 · says to rely on `visibilitychange` to detect a session ending (the hidden state is the last reliable time to save) and to use `pagehide` instead of `unload` (*read*) · covers our angle: **partial** — Chromium-centred · fetched 2026-10-13
- **Also good:** [Document: DOMContentLoaded](https://developer.mozilla.org/en-US/docs/Web/API/Document/DOMContentLoaded_event) · MDN (*headings only*) · [visibilitychange](https://developer.mozilla.org/en-US/docs/Web/API/Document/visibilitychange_event) · MDN (*headings only*) · [pagehide](https://developer.mozilla.org/en-US/docs/Web/API/Window/pagehide_event) · MDN (*headings only*) · [beforeunload](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event) · MDN (*headings only*) · [Back/forward cache](https://web.dev/articles/bfcache) · web.dev (*headings only*) · [Page: DOMContentLoaded, load, beforeunload, unload](https://javascript.info/onload-ondomcontentloaded) · javascript.info · also covers `readyState` (*headings only*) · fetched 2026-10-13
- **Beyond the docs:** [Don't lose user and app state, use Page Visibility](https://www.igvita.com/2015/11/20/dont-lose-user-and-app-state-use-page-visibility/) · Ilya Grigorik, 2015-11-20 · argues `visibilitychange` is the only event to count on, and that `pagehide`, `beforeunload` and `unload` do not reliably fire on mobile; written before the Page Lifecycle API, so read it for the argument · fetched 2026-10-13 (*read*)
- **Search status:** not searched (web-search budget exhausted); the Beyond pick above was found by direct fetch, not by search.
- **Our delta:** a single answer to which event saves state.

### T10-11 · Default actions you should not block — Understand · ✅ written `docs/javascript/pages/phase-10-events/11-default-actions/01-what-preventdefault-costs.md`
- **Read this:** [Event.preventDefault()](https://developer.mozilla.org/en-US/docs/Web/API/Event/preventDefault) · MDN (*headings only*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [Making touch scrolling fast by default](https://developer.chrome.com/blog/scrolling-intervention) · Chrome for Developers blog, last updated 2017-01-10 · why `preventDefault()` in a `touchstart` or first `touchmove` listener blocks scrolling and what passive listeners change; touch events only, nothing on `wheel` (*read*) · [Browser default actions](https://javascript.info/default-browser-action) · javascript.info · `preventDefault`, the `passive` handler option, `defaultPrevented` (*headings only*) · fetched 2026-10-13
- **Search status:** not searched (web-search budget exhausted).
- **Our delta:** what breaks when a scroll is cancelled.

### T10-12 · `EventTarget` as a base class — Know · ✅ written `docs/javascript/pages/phase-10-events/12-eventtarget-base-class/01-building-on-the-platform.md`
- **Read this:** [EventTarget() constructor](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/EventTarget) · MDN · a `class Counter extends EventTarget` example that dispatches a custom `valuechange` event (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [EventTarget](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget) · MDN · the interface page; lists the constructor but says nothing about subclassing and has no example (*read*) · fetched 2026-10-13
- **Search status:** not searched (web-search budget exhausted).
- **Our delta:** an emitter without shipping a library.

### T10-13 · Touch and gestures — Know · ✅ written `docs/javascript/pages/phase-10-events/13-touch-and-gestures/01-touch-events.md`
- **Read this:** [Touch events](https://developer.mozilla.org/en-US/docs/Web/API/Touch_events) · MDN · multi-touch tracking with `changedTouches` and `Touch.identifier`; tells you to use pointer events to support touch and mouse together (*read*) · covers our angle: **partial** — the 300 ms delay is not mentioned · fetched 2026-10-13
- **Also good:** [Pointer events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events) · MDN (*read*) · fetched 2026-10-13
- **Search status:** not searched (web-search budget exhausted).
- **Our delta:** why pointer events usually suffice.

### T10-14 · Debugging events — Know · ✅ written `docs/javascript/pages/phase-10-events/14-debugging-events/01-finding-what-stole-your-click.md`
- **Read this:** [Console Utilities API reference](https://developer.chrome.com/docs/devtools/console/utilities) · Chrome for Developers · `getEventListeners(object)` and `monitorEvents` both documented (*read*) · covers our angle: **partial** · fetched 2026-10-13
- **Also good:** [Pause your code with breakpoints](https://developer.chrome.com/docs/devtools/javascript/breakpoints) · Chrome for Developers · event-listener breakpoints (*headings only*) · fetched 2026-10-13
- **Search status:** not searched (web-search budget exhausted).
- **Our delta:** finding what stole your click.
