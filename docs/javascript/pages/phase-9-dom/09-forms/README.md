---
title: "09 · Forms"
sidebar_label: "Overview"
sidebar_position: 0
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against MDN — [`FormData`](https://developer.mozilla.org/en-US/docs/Web/API/FormData), [Client-side form validation](https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Forms/Form_validation), [`HTMLFormElement.requestSubmit()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement/requestSubmit). Documentation-validated; **no timings**.

**The platform already does most of this**, and the reason to learn the built-in form APIs is not
purity — it is that every hand-rolled replacement re-implements something the browser does better:
accessible error announcements, keyboard behaviour, autofill, password managers, and submission
encoding.

> **Read the whole form in one line, validate with the constraint API, and submit through the
> platform's own event.**

```js
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form));   // ⚠️ one caveat — chunk 01
  send(data);
});
```

Three things that line hides, and each is a chunk:

## Chunks

| # | Chunk | Covers |
|---|---|---|
| 01 | **[`FormData` and reading a form](./01-formdata.md)** | What actually ends up in a `FormData`, why `Object.fromEntries` loses checkbox groups and multi-selects, `form.elements`, files, and sending it with `fetch` |
| 02 | **[Constraint validation](./02-constraint-validation.md)** | `checkValidity` vs `reportValidity`, the `ValidityState` flags, `setCustomValidity` and the bug it causes, `novalidate`, and `:user-invalid` |
| 03 | **[`input`, `change` and submitting](./03-form-events.md)** | When each event fires, `beforeinput`, the `submit` event and its `submitter`, and why `form.submit()` is not the one you want |

## Phase gate

You can render a list from an array into the DOM with no framework, update one row without
rebuilding the list, and explain which parts are XSS-safe.

## Where this connects

- [05 · Attributes versus properties](../05-attributes-vs-properties/README.md) — why
  `input.value` and `input.getAttribute('value')` disagree the moment a user types
- [Phase 10 · 03 · The event object](../../phase-10-events/03-the-event-object/README.md) —
  `preventDefault` and what `target` means on a form event
- **Phase 11 · Network** — sending the result; the `fetch` half is written at Master tier there

---

Start → [01 · `FormData` and reading a form](./01-formdata.md)
