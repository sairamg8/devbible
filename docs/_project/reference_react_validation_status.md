---
name: devbible-react-validation-status
description: Which React pages are evidence-backed and which are written but not yet validated — the single tracker, replacing per-page markers
metadata:
  type: reference
---

**This file is the only place validation status is recorded.** User instruction
2026-08-13: *"you do not need to mark separately what are with sandbox and what not —
just from now onwards whatever you're writing those not validated yet, so in separate
file or somewhere mention it."*

So: **no `Sandbox-proven` badge on pages.** A short-lived experiment added one to all 31
React pages and it was reverted the same session. Pages carry their ordinary
`> Verified:` line and nothing else. Status lives here.

## The standing rule

Under [[devbible-react-phase1]]'s rule change (hard rule 8 — no new sandboxes), everything
written from React Phase 2 onward is **UNVALIDATED when written**. It becomes VALIDATED
only after a documentation pass against a primary source. Default state is unvalidated;
say so rather than assuming.

| State | Means |
|---|---|
| ✅ **MEASURED** | A sandbox script was actually run and its output is on the page |
| ✅ **DOC-CHECKED** | Cross-checked against react.dev / MDN / release notes, source named |
| ⬜ **UNVALIDATED** | Written from knowledge; no run, no doc pass yet. **The default for all new work** |

## Current status

| Phase | Pages | State |
|---|---|---|
| 0 — How React runs | 14 | ✅ MEASURED (`sandbox/react-p0`, 13 scripts) |
| 1 — JSX | 16 files / 15 topics | ✅ MEASURED (`sandbox/react-p1`, 13 scripts) + partial DOC-CHECK, below |
| **2 — Components, props, composition** | **29 files / 16 topics** | ✅ **DOC-CHECKED throughout** — no sandbox, no console blocks. See below |
| 3–14 | not written | — |

### Phase 2 — the first fully doc-validated phase

Written 2026-08-13 under rule 8. **Every page carries a `> Verified:` line naming the
documentation pages behind it and no console output at all**, which is the shape all
later phases should copy. Sources used:

- react.dev **Learn** — Your First Component, Keeping Components Pure, Passing Props to a
  Component, Sharing State Between Components, Preserving and Resetting State, Thinking in
  React, Passing Data Deeply with Context.
- react.dev **Reference** — `Component`, `PureComponent`, `cloneElement`, `Children`,
  `createContext`, `createPortal`, `forwardRef`, `<input>`, `memo`.
- **React 19 release post + upgrade guide** — `ref` as a prop, the `propTypes`/
  `defaultProps` removal, string refs, legacy context, `findDOMNode`, ref cleanup, and the
  exact `npx codemod@latest …` commands.
- **legacy.reactjs.org** — Higher-Order Components and Render Props, which are where the
  caveats for those patterns are still documented and still accurate.
- **W3C WAI-ARIA** Modal Authoring Practices, for the portal accessibility section.

🔴 **Two claims are flagged on the pages themselves as reasoning, not citation** — this is
the rule-8 "state it as uncertain" case and the pages say so in the prose:

1. **What still requires `forwardRef`** (topic 09). The docs name *no* remaining use case;
   the page argues supporting React 18 alongside 19 is the practical one, and labels that
   as reasoning.
2. **Colocation** (topic 10) — keeping a component next to its only caller is community
   practice, not documented React guidance. Labelled as such on the page.

Three findings worth reusing:

- **`propTypes` was removed *silently*** — the upgrade guide says using it "will be
  silently ignored". An upgrade deletes every runtime prop check with no warning.
- **`forwardRef` is NOT removed in 19** — it is documented as unnecessary and carries a
  "will be deprecated in a future release" notice. Frequently overstated as removed.
- **`shouldComponentUpdate` returning `false` is a hint React may ignore** — stated
  outright in the docs, and it applies to `memo` too. Memoization is never a correctness
  mechanism.

### Phase 1 — what the documentation pass covered

Done 2026-08-13, on the highest-risk claims only:

- ✅ **MDN `Element.innerHTML`** — confirms `<script>` inserted via innerHTML does **not**
  execute while `<img src=x onerror=…>` **does**. Same example as the measurement. Two
  independent sources agree.
- ✅ **React 19 release notes** — *"react-dom: Error for javascript URLs in src and href"*,
  confirming the `javascript:` finding. The measurement adds the mechanism the notes do
  not give: React **rewrites** the href into a throwing expression rather than stripping it.
- ✅ **react.dev common-components reference** — confirms the `style` px/unitless rule; the
  custom-attribute rule (*"must be lowercase and must not start with `on`"*, `null`/
  `undefined` removes it); and that `children` + `dangerouslySetInnerHTML` cannot coexist.

### Phase 1 — claims resting on the measurement ALONE

Documentation does not cover these. They are measured, not cited — if a reviewer disputes
one, the script is the only evidence:

- **`class` and `for` work in React 19** (correct markup, dev warning only). react.dev
  documents `className`/`htmlFor` and implies the raw forms do not work.
- **Unknown props with a boolean value are dropped**, while string values are lowercased
  and rendered. Not documented.
- **Index keys do not remount** — React keeps the DOM nodes and rewrites their text
  (`added=0 removed=0 text=3`), so DOM state stays with the slot. Contradicts most
  articles, which say the rows remount.
- **The missing-key warning is deduped by parent element type, not component** — so its
  absence proves nothing. Established from two runs in opposite orders.
- **A `Map` renders**; **a promise child suspends with no DOM at all**.
- **A hyphenated style key still applies** while warning.
- **`onChange` fires on the DOM `input` event**, and a native `change` afterwards fires
  nothing. react.dev describes the behaviour but not the second half.

## What to do at the start of each new phase

1. Write the pages. Mark the phase ⬜ UNVALIDATED here as soon as it exists.
2. Run a documentation pass over the load-bearing claims — the ones a reader would act on,
   and anything that contradicts common belief.
3. Move the row to ✅ DOC-CHECKED and list the sources here.
4. Anything documentation cannot settle: **state the uncertainty on the page** and record
   it in the "resting on nothing yet" list below.

## Claims flagged uncertain on the page

*(none yet — Phase 2 has not been written)*

Related: [[devbible-react-phase1]] · [[devbible-react-phase0]] · [[devbible-react-syllabus]] ·
[[devbible-verify-your-own-measurements]]
