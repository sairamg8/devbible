---
title: "Testing forms and Actions"
sidebar_label: "08 · Forms and Actions"
sidebar_position: 8
---

<span className="db-tier t-understand">Understand</span>

> Verified: 2026-08-14 against **React 19.2**, **RTL 16.x**, **`user-event` 14.x** and
> **MSW 2.x**, from documentation —
> [`useActionState`](https://react.dev/reference/react/useActionState) (the
> `[state, formAction, isPending]` tuple, the action receiving `(previousState, formData)`,
> automatic Transition wrapping when passed to `<form action>`, sequential queuing, and that
> a thrown error cancels queued actions and surfaces at the nearest Error Boundary) and
> [`useFormStatus`](https://react.dev/reference/react-dom/hooks/useFormStatus) (`pending`,
> `data`, `method`, `action`, and that it must be called from a component rendered *inside*
> the form).
> No sandbox script backs this page; claims are cited, not measured.

Forms are the most-tested thing in most applications, and the tests are usually the wrong
shape: they assert that `onChange` fired, or that state holds `"ada@example.com"`. **The
useful assertions are what was submitted, what the user sees while it is in flight, and what
they see when it fails.**

## The shape of a form test

```jsx
test("submits the invoice and confirms it", async () => {
  const user = userEvent.setup();
  let submitted;
  server.use(
    http.post("/api/invoices", async ({ request }) => {
      submitted = await request.json();
      return HttpResponse.json({ id: "INV-9" }, { status: 201 });
    }),
  );

  render(<NewInvoice />);

  await user.type(screen.getByRole("textbox", { name: /customer/i }), "Ada Lovelace");
  await user.type(screen.getByRole("spinbutton", { name: /amount/i }), "4200");
  await user.selectOptions(screen.getByRole("combobox", { name: /currency/i }), "GBP");
  await user.click(screen.getByRole("button", { name: /create invoice/i }));

  expect(await screen.findByText(/invoice INV-9 created/i)).toBeInTheDocument();
  expect(submitted).toEqual({ customer: "Ada Lovelace", amount: 4200, currency: "GBP" });
});
```

Everything load-bearing is in the last two lines. The user sees a confirmation, and the
server received the right payload — including that `amount` is a **number**, which is the
kind of bug that survives every state-based assertion ever written
([topic 06](06-mocking-the-api/README.md)).

## Filling fields, by control type

| Control | How |
|---|---|
| text, email, textarea | `await user.type(el, "…")` — `user.clear(el)` first if it has a value |
| number | `await user.type(el, "4200")` — the role is `spinbutton` |
| checkbox / radio | `await user.click(el)` — never set `checked` |
| `<select>` | `await user.selectOptions(el, "gbp")`, and `deselectOptions` for multiples |
| file input | `await user.upload(el, new File(["…"], "a.pdf", { type: "application/pdf" }))` |
| date input | `await user.type(el, "2026-08-14")` — the browser's picker is not testable in jsdom |
| custom combobox | drive it as a user would: click to open, then click or type the option |

⚠️ **`user.upload` respects the input's `accept` attribute** — `applyAccept` defaults to
`true`, so a `File` created with the wrong MIME type is silently discarded
([topic 04](04-user-event-over-fireevent/README.md)).

## Submitting

There are three ways a form is submitted, and they are different tests:

```jsx
await user.click(screen.getByRole("button", { name: /save/i }));   // the button
await user.keyboard("{Enter}");                                     // implicit submission
await user.tab();  await user.keyboard("{Enter}");                  // reached by keyboard
```

**Implicit submission — Enter from inside a text field — is worth one test per form.** It is
how a large share of users actually submit, and it breaks whenever someone changes the submit
control to a `<button type="button">` with an onClick handler. Nothing else catches that.

## Testing React 19 Actions

An Action-based form has no `onSubmit` and no manual pending state:

```jsx
function NewInvoice() {
  const [state, formAction, isPending] = useActionState(createInvoice, { error: null });
  return (
    <form action={formAction}>
      <input name="customer" />
      {state.error && <p role="alert">{state.error}</p>}
      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button disabled={pending}>{pending ? "Creating…" : "Create invoice"}</button>;
}
```

**Test it exactly as a user meets it** — nothing about `useActionState` changes the test:

```jsx
await user.click(screen.getByRole("button", { name: /create invoice/i }));

// pending state, while the request is in flight
expect(await screen.findByRole("button", { name: /creating/i })).toBeDisabled();

// resolved state
expect(await screen.findByText(/invoice INV-9 created/i)).toBeInTheDocument();
```

Three facts from the documentation make these tests predictable:

- **The action receives `(previousState, formData)`**, and passing it to `<form action>`
  wraps the submission in a Transition automatically. So the form does submit — there is no
  missing `preventDefault` to worry about.
- **`isPending` / `useFormStatus().pending` is the pending state**, which is why the assertion
  above is about a disabled button with changed text rather than about a boolean.
- **Multiple dispatches queue sequentially**, each receiving the previous return value — which
  is what makes the double-submit test below meaningful rather than racy.

⚠️ **`useFormStatus` must be called from a component rendered *inside* the form**, not from
the component rendering it. If a pending-state test fails and the button never disables, check
that first — it is a component-structure bug, and the test found it correctly.

⚠️ **Expected errors should be returned as state, not thrown.** The docs are explicit that a
throw cancels queued actions and surfaces at the nearest Error Boundary. So a validation
failure test asserts on a `role="alert"` message; if instead the whole tree is replaced by an
error boundary fallback, the component is throwing where it should return.

## The states worth asserting

**1 · Pending.** The submit button disables and the label changes. This is the double-submit
guard, and it is a real bug class — assert it, and assert that a second click while pending
does not produce a second request:

```jsx
const requests = [];
server.use(http.post("/api/invoices", async ({ request }) => {
  requests.push(await request.json());
  await delay(50);
  return HttpResponse.json({ id: "INV-9" }, { status: 201 });
}));

await user.click(submitButton);
await user.click(submitButton);          // ignored: the button is disabled
await screen.findByText(/created/i);
expect(requests).toHaveLength(1);
```

**2 · Server-side failure.** A `422` with field errors, asserted as a visible message with
`role="alert"` — plus that the form is still filled in, because losing the user's input on a
failure is the actual damage.

**3 · Client-side validation.** Submit with a required field empty; assert the message
appears **and** that no request was made.

**4 · Success.** The confirmation the user sees, and the payload the server received.

## What not to test

- **That typing updates state.** `user.type` followed by an assertion on `toHaveValue` tests
  the browser, not your component — unless the field is controlled with transformation
  (masking, uppercasing, currency formatting), where the transformation *is* the behaviour.
- **Every validation rule through the UI.** If validation is a schema, unit-test the schema
  directly and test through the form that *a* violation surfaces correctly. Twelve
  near-identical UI tests for twelve rules cost twelve times as much and prove roughly the
  same thing.
- **Library internals.** `react-hook-form` and `useActionState` are tested by their authors.
  Test the behaviour your form has, not the mechanism producing it.

## Gotchas

**Symptom:** typing into a pre-filled field gives "oldnew".
**Cause:** `type` appends at the cursor, exactly like typing.
**Fix:** `await user.clear(field)` first.

**Symptom:** the pending assertion never sees a disabled button.
**Cause:** either the response resolves instantly, so there is no observable pending window,
or `useFormStatus` is called in the component that renders the form rather than inside it.
**Fix:** add a `delay()` to the handler for that test; and check the `useFormStatus`
placement — the docs require a child component.

**Symptom:** a validation-failure test wipes the whole UI.
**Cause:** the action threw instead of returning error state, so React cancelled the queue
and the nearest Error Boundary rendered.
**Fix:** return the error as state for expected failures; keep throwing for genuinely
exceptional ones.

**Symptom:** the file-upload test uploads nothing.
**Cause:** `applyAccept` is `true` and the `File`'s MIME type does not match `accept`.
**Fix:** construct the `File` with a matching type.

**Symptom:** the form submits in the app but the test's Enter key does nothing.
**Cause:** there is no `type="submit"` control, so there is no implicit submission — the app
"works" only because people click.
**Fix:** the test is right; fix the form. This is the bug the Enter test exists to find.

**Symptom:** the payload assertion fails on `"4200"` vs `4200`.
**Cause:** `FormData` values are strings; the component is expected to coerce.
**Fix:** that is the test doing its job — coerce in the component (or the schema) rather than
loosening the assertion.

## Interview questions

**★ What should a form test actually assert?**
What was submitted, and what the user sees. The payload the server received — via an MSW
handler that reads `await request.json()` — plus the pending, error and success states.
Assertions about internal state or that `onChange` fired test the framework and the browser,
not the feature.

**★ How do you test a React 19 Action-based form?**
Exactly like any other form: fill it with `user-event`, submit it, assert the pending state
(the disabled button with its changed label), then the outcome. `useActionState` gives
`[state, formAction, isPending]` and passing `formAction` to `<form action>` wraps submission
in a Transition automatically, so there is no `onSubmit` or `preventDefault` in the picture.

**★ A pending-state test fails because the button never disables. What are the two likely
causes?**
The mocked response resolves immediately, so there is no observable pending window — fix with
a `delay()` in the handler for that test. Or `useFormStatus` is being called in the component
that renders the `<form>` rather than in a component inside it, which the docs say does not
work. The second is a real bug the test just caught.

**Why test submitting with Enter?**
Because implicit submission is how many users submit, and it silently breaks when the submit
control stops being a `type="submit"` button. Clicking still works, so nothing else in the
suite notices.

**How do you prove a form cannot be double-submitted?**
Delay the response, click submit twice, wait for the success state, and assert the handler
recorded exactly one request. Because Actions queue sequentially rather than running in
parallel, the assertion is stable rather than racy.

**Should validation errors be thrown or returned?**
Returned as state for expected failures. The docs say a thrown error cancels queued actions
and surfaces at the nearest Error Boundary — appropriate for something exceptional, not for
"the email address is missing".

---

← Prev: [Jest or Vitest](07-jest-or-vitest.md) ·
Index: [Phase 14](README.md) ·
Next → [Testing hooks](09-testing-hooks.md)
