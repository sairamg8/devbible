---
title: "useForm and the checkout form"
sidebar_label: "04 · useForm & checkout"
sidebar_position: 4
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-08 against react.dev (controlled inputs, forms) and the
> Phase 3 checkout contract. Concept home:
> [React — forms and actions](../../../react/pages/phase-9-forms-actions/README.md);
> the validation rules are shared with
> [chapter 3·02](../phase-3-express-api/02-the-validation-boundary.md).

## The problem

The checkout form: address fields, validation that reuses the server's zod
schema, errors surfaced at the right moment (not on first keystroke, not
only on submit), a submit that is idempotent across retries, and the
409/402 responses from [chapter 3·07](../phase-3-express-api/07-the-checkout-endpoint.md)
mapped onto fields. A form library earns its keep at 30 forms; this app has
four, and the hook below is ~60 lines the team fully owns — that trade is
the chapter's first lesson.

## The implementation

```jsx
// src/hooks/useForm.js
import {useCallback, useState} from 'react';

/** Controlled form state over a zod schema. Errors show per-field after
 *  that field blurs ("touched"), or all at once on a failed submit. */
export function useForm({schema, initial, onSubmit}) {
  const [values, setValues] = useState(initial);
  const [touched, setTouched] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const result = schema.safeParse(values);
  const fieldErrors = {};
  if (!result.success) {
    for (const issue of result.error.issues) {
      const key = issue.path.join('.');
      fieldErrors[key] ??= issue.message;         // first issue per field wins
    }
  }

  const field = useCallback((name) => ({
    name,
    value: values[name] ?? '',
    onChange: (e) => setValues((v) => ({...v, [name]: e.target.value})),
    onBlur: () => setTouched((t) => ({...t, [name]: true})),
    'aria-invalid': Boolean(touched[name] && fieldErrors[name]),
  }), [values, touched, fieldErrors]);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setTouched(Object.fromEntries(Object.keys(values).map((k) => [k, true])));
    setFormError(null);
    if (!result.success) return;
    setSubmitting(true);
    try {
      await onSubmit(result.data);                // the PARSED values
    } catch (err) {
      setFormError(err);
    } finally {
      setSubmitting(false);
    }
  }, [values, result, onSubmit]);

  return {
    field, handleSubmit, submitting, formError,
    errors: Object.fromEntries(
      Object.entries(fieldErrors).filter(([k]) => touched[k])),
    valid: result.success,
  };
}
```

```jsx
// src/components/CheckoutForm.jsx — the consumer, with the contract mapped
import {useMemo, useState} from 'react';
import {AddressSchema} from '../../shared/schemas.js';   // Phase 6's package
import {useForm} from '../hooks/useForm.js';
import {api, ApiClientError} from '../lib/api.js';

export function CheckoutForm({cart, onPlaced}) {
  // one idempotency key per checkout ATTEMPT — survives retries (ch. 3·07)
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);
  const [unavailable, setUnavailable] = useState([]);

  const form = useForm({
    schema: AddressSchema,
    initial: {name: '', line1: '', city: '', postcode: '', country: 'US'},
    onSubmit: async (address) => {
      try {
        const order = await api('/checkout', {
          method: 'POST',
          headers: {'idempotency-key': idempotencyKey},
          body: {address, card_token: cart.cardToken},
        });
        onPlaced(order);
      } catch (err) {
        if (err instanceof ApiClientError && err.code === 'OUT_OF_STOCK') {
          setUnavailable(err.body.product_ids);   // mark the cart lines
          return;
        }
        throw err;                                // useForm shows formError
      }
    },
  });

  return (
    <form onSubmit={form.handleSubmit} noValidate>
      <Field label="Full name"  error={form.errors.name}     input={form.field('name')} />
      <Field label="Address"    error={form.errors.line1}    input={form.field('line1')} />
      <Field label="City"       error={form.errors.city}     input={form.field('city')} />
      <Field label="Postcode"   error={form.errors.postcode} input={form.field('postcode')} />
      {unavailable.length > 0 && <UnavailableLines productIds={unavailable} />}
      {form.formError && <FormErrorPanel error={form.formError} />}
      <button disabled={form.submitting}>
        {form.submitting ? 'Placing order…' : 'Place order'}
      </button>
    </form>
  );
}
```

## The decisions

- **One schema, two runtimes.** `AddressSchema` is imported from the shared
  package ([Phase 6](../../syllabus/02-frontend.md)) — the same object the
  server parses with. Client validation is *courtesy* (instant feedback);
  server validation is *law*; sharing the schema means the courtesy never
  disagrees with the law.
- **Touched-based error display** is the standard UX compromise: errors
  appear per-field on blur (you finished the field — now it may speak) and
  everywhere on submit (you asked — everything speaks). Keystroke-time
  errors punish typing; submit-only errors waste a round trip of
  attention.
- **The idempotency key is minted with `useMemo` on mount** — one key per
  checkout *attempt*, stable across submit retries, regenerated only when
  the form remounts for a new attempt. This is the client half of the
  [3·07 contract](../phase-3-express-api/07-the-checkout-endpoint.md), and
  the double-charge gotcha there is exactly what this line prevents.
- **Domain failures are not form failures.** `OUT_OF_STOCK` doesn't belong
  in `formError` — it belongs on the cart lines it names. The submit
  handler catches what it can *place* (marked lines) and rethrows what it
  can't (declines, timeouts) for the generic panel. Error UX is routing,
  and the API's error codes are the routes.
- **`noValidate`** — the browser's native validation would race the
  schema's messages with its own bubbles. One validator, ours.

## Gotchas

- **Symptom:** the submit button "doesn't work" — nothing happens.
  **Cause:** invalid form; errors exist but every field is untouched (user
  clicked straight to submit… before the submit-touches-all line ran —
  i.e. the line was removed as "redundant"). **Fix:** the touch-all on
  submit is what turns silent invalidity into visible errors; it is the
  least redundant line in the hook.
- **Symptom:** double-click places… one order, but support asks why the
  provider shows two authorizations. **Cause:** submitting state guards
  the button, but a retry after a *timeout* re-submitted from fresh
  state — with the same key, so the DB deduped; if the provider shows two,
  the key regenerated (component remounted between attempts). **Fix:**
  the key's home is the *attempt* scope: it must survive error → retry
  within one form instance, and the remount boundary must equal the
  "new attempt" boundary — which the route structure guarantees here.
- **Symptom:** validation messages differ between the inline errors and
  the server's 400 issues. **Cause:** schema drift — the client bundled
  an older shared package. **Fix:** the shared package is a workspace
  dependency, not a copied file; version skew becomes a build error, not
  a UX inconsistency (Phase 6 wires it).

## Interview questions

1. **★ Why validate on the client at all when the server must validate
   anyway?** Latency and locality: instant feedback at the field, before
   the user's attention leaves it. But the client's copy is advisory —
   it can be bypassed, it can be stale — so the server re-parses
   everything. Sharing the literal schema object collapses the usual
   cost of that duplication (drift) to zero.
2. **★ Where does the idempotency key live and why exactly there?** In
   memory, scoped to the mounted form — created once per attempt via
   `useMemo`. Narrower (per submit) recreates it on retry and defeats
   dedup; wider (module scope, storage) reuses it across *different*
   checkouts and wrongly replays the first order. The correct scope is
   exactly "one user intention", and the component instance is its
   physical embodiment here.
3. **Why does the hook return parsed values to `onSubmit` instead of raw
   state?** The same parse-don't-validate rule as the server
   ([3·02](../phase-3-express-api/02-the-validation-boundary.md)):
   `result.data` is trimmed, coerced, defaulted — the submit path
   consumes what the schema *produced*, so client and server act on
   identical shapes. Submitting raw `values` reintroduces the gap the
   shared schema closed.
4. **When would you take react-hook-form over this?** Many forms, complex
   ones — field arrays, dependent fields, wizards — where its uncontrolled-
   input performance model and ecosystem (resolvers, devtools) repay the
   dependency. The judgment is the same shape as every build-vs-buy in
   this track: below some N, sixty owned lines beat an abstraction to
   learn; above it, they don't. Knowing your N is the skill.

---

← Prev: [The infinite product list](03-the-infinite-product-list.md) ·
Next → [`useLocalStorage` and the persisted cart](05-uselocalstorage-and-cart.md)
