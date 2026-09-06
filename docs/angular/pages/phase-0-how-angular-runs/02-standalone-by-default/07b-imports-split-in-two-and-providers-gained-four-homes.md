---
title: "One `@NgModule` field split into two and another gained four destinations — `imports` had always been doing template scope and providers at once, and `providers` now has a type system deciding which injector it is allowed to reach"
sidebar_label: "07b · `imports` split in two, `providers` gained four homes"
sidebar_position: 7.1
---

<span className="db-tier t-master">Master</span>

> Verified: 2026-09-06 against angular.dev — [NgModules overview](https://angular.dev/guide/ngmodules/overview),
> [NG0207](https://angular.dev/errors/NG0207) — and `angular/angular` at tag `v22.1.5`:
> [`goldens/public-api/core/index.api.md`](https://github.com/angular/angular/blob/v22.1.5/goldens/public-api/core/index.api.md),
> [`goldens/public-api/router/index.api.md`](https://github.com/angular/angular/blob/v22.1.5/goldens/public-api/router/index.api.md),
> [`packages/core/src/render3/standalone_service.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/standalone_service.ts),
> [`packages/core/src/render3/errors_di.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/core/src/render3/errors_di.ts),
> [`packages/compiler-cli/src/ngtsc/annotations/component/src/util.ts`](https://github.com/angular/angular/blob/v22.1.5/packages/compiler-cli/src/ngtsc/annotations/component/src/util.ts).
> Documentation-validated; **no sandbox run**.
> Version spine: **Angular 22.1.5** · CLI / `@angular/build` / `@angular/ssr` **22.1.7** · TypeScript peer `>=6.0 <6.1`.

**These are the two `@NgModule` rows that were genuinely relocated rather than deleted, and both relocations changed the shape of the thing, not just its address. `@NgModule.imports` had always been doing two unrelated jobs in one array — adding the imported module's exported directives and pipes to a compilation scope, *and* collecting its providers into an injector — so it split into `@Component.imports` for the first job and a `provide*()` call for the second. `@NgModule.providers` acquired four possible destinations, and the type system now decides which one is legal: `@Component.providers` is typed `Provider[]` with no `EnvironmentProviders` member, which is why `provideHttpClient()` in a component is a compile error before it is ever a runtime one. The trap that catches everybody is that a component's `imports` still carries providers — one environment injector per component class, cached, and duplicated the moment two components import the same module.** The full nine-row table is on [chunk 07](07-what-replaced-each-ngmodule-responsibility.md).

## `imports` → two fields, because it was always two jobs

**Before:**

```ts
@NgModule({
  declarations: [InvoiceListComponent],
  imports: [CommonModule, MatButtonModule, HttpClientModule],
})
export class BillingModule {}
```

`CommonModule` and `MatButtonModule` are there for the template. `HttpClientModule` is there only for its providers — it contributes nothing a template can reference. One array, two intentions, no way to tell them apart by reading.

**After** — template scope goes on the component, providers go in the app config:

```ts
// src/app/billing/invoice-list.component.ts
@Component({
  selector: 'app-invoice-list',
  imports: [MatButtonModule, DatePipe],
  template: `
    @for (inv of invoices(); track inv.id) {
      <button mat-button>{{ inv.issuedAt | date: 'mediumDate' }}</button>
    }
  `,
})
export class InvoiceListComponent {
  private readonly http = inject(HttpClient);
  readonly invoices = signal<Invoice[]>([]);
}
```

```ts
// src/app/app.config.ts
export const appConfig: ApplicationConfig = {
  providers: [provideHttpClient()],
};
```

`CommonModule` disappears entirely — `@if` and `@for` are built into the template language and need no import, and `DatePipe` is standalone and imported by name.

⚠️ **`provideHttpClient(withFetch())` is the v19-era spelling.** `withFetch` is deprecated in v22 — `FetchBackend` is the default and `withXhr()` is the opt-out. Also deprecated and not the modern path: `HttpClientModule`, `HttpClientXsrfModule` and `HttpClientJsonpModule`. Write `provideHttpClient()` and nothing else unless you need a feature.

**What you lost.** The ability to configure a whole feature by importing one module into one place. The provider half now has to be named explicitly at bootstrap, and if you forget it you find out at injection time rather than at compile time.

**What you gained.** You can read a component and know its template scope without opening another file. And the `forRoot()` convention — a static method whose entire purpose was to smuggle providers through an array meant for scope — becomes an ordinary function call.

## The surprise: `@Component.imports` still carries providers

This is the fact most write-ups miss. `packages/core/src/render3/standalone_service.ts`, class doc, verbatim:

> *"A service used by the framework to create instances of standalone injectors. Those injectors are created on demand in case of dynamic component instantiation and contain ambient providers collected from the imports graph rooted at a given standalone component."*

```ts
getOrCreateStandaloneInjector(componentDef: ComponentDef<unknown>): EnvironmentInjector | null {
  if (!componentDef.standalone) {
    return null;
  }

  if (!this.cachedInjectors.has(componentDef)) {
    const providers = internalImportProvidersFrom(false, componentDef.type);
    const standaloneInjector =
      providers.length > 0
        ? createEnvironmentInjector([providers], this._injector, /* debug name */ '')
        : null;
    this.cachedInjectors.set(componentDef, standaloneInjector);
  }

  return this.cachedInjectors.get(componentDef)!;
}
```

Three consequences, all readable straight off that code:

- The cache key is the `ComponentDef`, so the injector is **one per component class**, not per instance.
- **Two components importing the same providers-carrying module get two injectors**, each with its own instance of that module's services.
- Providers reached this way are **not** in the root injector, so a sibling component that did not import the module cannot inject them.

## `providers` → four destinations, and the type system picks

| Destination | Declared type at v22.1.5 | Lifetime |
|---|---|---|
| `ApplicationConfig.providers` | `Array<Provider \| EnvironmentProviders>` | The root environment injector, for the life of the app |
| `Route.providers` | `Array<Provider \| EnvironmentProviders>` | A new `EnvironmentInjector` for that route and its children |
| `@Component.providers` (inherited from `Directive`) | 🔴 `Provider[]` — **no `EnvironmentProviders`** | One per component instance |
| `@Injectable({providedIn: 'root'})` | n/a — the class provides itself | Root, and tree-shakable if nothing injects it |

🔴 **Read the third row again.** `@NgModule.providers` accepted `Array<Provider | EnvironmentProviders>`; `Directive.providers` — which `Component` inherits — accepts `Provider[]` only. That asymmetry is the whole fence, and `EnvironmentProviders` is a branded phantom type built to enforce it:

```ts
// goldens/public-api/core/index.api.md at v22.1.5
export type EnvironmentProviders = {
    ɵbrand: 'EnvironmentProviders';
};

export function makeEnvironmentProviders(providers: (Provider | EnvironmentProviders)[]): EnvironmentProviders;
```

whose doc comment states the intent verbatim:

> *"Wrap an array of `Provider`s into `EnvironmentProviders`, preventing them from being accidentally referenced in `@Component` in a component injector."*

TypeScript rejects it first; if you defeat the types with a cast, the runtime throws NG0207.

**What you lost.** The single obvious home. Under `NgModule` there was one array and one question — which module? Now there are four, and the question is which *scope*. That is a harder question honestly asked rather than an easy question wrongly answered.

**What you gained.** A boundary `NgModule` could not express. `Route.providers`' own doc comment, verbatim:

> *"A `Provider` array to use for this `Route` and its `children`. The `Router` will create a new `EnvironmentInjector` for this `Route` and use it for this `Route` and its `children`. If this route also has a `loadChildren` function which returns an `NgModuleRef`, this injector will be used as the parent of the lazy loaded module."*

Contrast angular.dev's description of the old rule — this is why module providers were so hard to reason about:

> *"An `NgModule` can specify `providers` for injected dependencies. These providers are available to: Any standalone component, directive, or pipe that imports the NgModule, and the `declarations` and `providers` of any _other_ NgModule that imports the NgModule."*

**The surprise.** Angular's own words for what `forRoot` costs, from the same page:

> *"Any providers included in this way are eagerly loaded, increasing the JavaScript bundle size of your initial page load."*

That is a documentation claim about `forRoot`, quotable as such — not a figure anyone measured here. The `provide*`-versus-`forRoot` argument in full is topic [03 · The provider array is the wiring](../03-the-provider-array/README.md).

## Gotchas

**★ Symptom: after moving a shared module's contents onto components, a stateful service has two instances and the second one is empty.** Cause: two components each wrote `imports: [LegacyCacheModule]`, and `getOrCreateStandaloneInjector` caches per `ComponentDef` — one environment injector per component *class*, each with its own copy of that module's providers. Fix: take the provider half up to the app config and leave only real template dependencies in `imports`:

```ts
// src/app/app.config.ts
export const appConfig: ApplicationConfig = {
  providers: [importProvidersFrom(LegacyCacheModule)],
};
```

Better still, if the service is yours, delete the module and let the class provide itself:

```ts
@Injectable({ providedIn: 'root' })
export class InvoiceCache {
  private readonly entries = new Map<string, Invoice>();
}
```

Then there is nothing to place and nothing to duplicate.

**★ Symptom: `Component imports contains a ModuleWithProviders value, likely the result of a 'Module.forRoot()'-style call.`** Cause: you translated `imports: [RouterModule.forRoot(routes)]` from a module onto a component verbatim. That is NG2012, and the message continues *"These calls are not used to configure components and are not valid in standalone component imports - consider importing them in the application bootstrap instead."* Fix: a `provide*` function in the provider array:

```ts
export const appConfig: ApplicationConfig = {
  providers: [provideRouter(routes)],
};
```

**★ Symptom: `Invalid providers present in a non-environment injector. 'EnvironmentProviders' can't be used for component providers.`** Cause: a `provide*()` call landed in `@Component.providers` — NG0207. TypeScript should have caught it first, because `Directive.providers` is typed `Provider[]` with no `EnvironmentProviders` member; if it did not, something in the chain is `any`. Fix: move it to an environment injector. If it must be scoped rather than global, `Route.providers` is the scoped one:

```ts
export const routes: Routes = [
  {
    path: 'reports',
    providers: [provideHttpClient()],
    loadComponent: () => import('./reports/reports.component').then(m => m.ReportsComponent),
  },
];
```

**★ Symptom: the same error, but the message says `Invalid providers from 'importProvidersFrom' present in a non-environment injector. 'importProvidersFrom' can't be used for component providers.`** Cause: same code NG0207, different branch — `importProvidersFrom` stamps `ɵfromNgModule: true` on its result so the runtime can name the specific culprit rather than saying "some environment providers". Fix is identical: it goes in `ApplicationConfig.providers` or `Route.providers`, never on a component. Chunk [08 · Interop, honestly](08-ngmodule-interop-importprovidersfrom.md) is that function in full.

**★ Symptom: a service moved from `AppModule.providers` into one feature route's `providers` is now missing everywhere else.** Cause: `Route.providers` creates an `EnvironmentInjector` *"for this `Route` and its `children`"* — it is a subtree, not the app. A sibling route, and anything injected above it, never see it. Fix: if it is genuinely app-wide it belongs in `ApplicationConfig.providers`; route scoping is for configuration that legitimately differs per feature:

```ts
export const routes: Routes = [
  { path: 'eu', providers: [{ provide: API_BASE, useValue: 'https://eu.api.example.com' }], children: euRoutes },
  { path: 'us', providers: [{ provide: API_BASE, useValue: 'https://us.api.example.com' }], children: usRoutes },
];
```

**★ Symptom: `The directive 'VendorGridDirective' appears in 'imports', but is not standalone and cannot be imported directly. It must be imported via an NgModule.` — with no hint about which module.** Cause: NG2011's helpful related-information branch only runs when the declaring `NgModule` is in the current compilation. Angular's own TODO says so: *"the above case handles directives/pipes in NgModules that are declared in the current compilation, but not those imported from .d.ts dependencies."* So a third-party library shipped as `.d.ts` gets the bare sentence. Fix: read the library's public API and import its module instead of the class:

```ts
@Component({
  selector: 'app-orders',
  imports: [VendorGridModule],
  template: `<vendor-grid [rows]="rows()" />`,
})
export class OrdersComponent {
  readonly rows = signal<Order[]>([]);
}
```

**Symptom: a directive you imported from an NgModule is still not visible in the template.** Cause: importing an NgModule flattens in that module's **exported** dependencies, not its `declarations` — the scope reader reads `ngModuleScope.exported.dependencies`. Whatever the module declares but does not export, you do not get. Fix: if it is your module, add the class to its `exports`; if it is a third party's, the class is deliberately internal and you should use whatever it does export.

**Symptom: `imports: [SOME_ARRAY]` fails to compile with a message about the value not being statically analysable.** Cause: `imports` is evaluated by `ngtsc`'s partial evaluator at build time, with only two special resolvers — one for `ModuleWithProviders` and one for `forwardRef`. A value produced by a function call, a computed key, or anything outside the compilation unit cannot be resolved. Fix: make it a plain exported array literal, or use `forwardRef` if the problem is a circular file reference:

```ts
@Component({
  selector: 'app-tree-node',
  imports: [forwardRef(() => TreeBranchComponent)],
  template: `<app-tree-branch [node]="node()" />`,
})
export class TreeNodeComponent {
  readonly node = input.required<TreeNode>();
}
```

## Interview questions

**★ Why did one `imports` field become two different things?**
Because it had always been two things. `@NgModule.imports` added the imported module's *exported* directives and pipes to this module's compilation scope, **and** collected the imported module's providers into the injector. Those are unrelated jobs that happened to share an array, and nothing in the syntax told you which one a given entry was for — `HttpClientModule` and `MatButtonModule` looked identical. The split sends template scope to `@Component.imports`, which is local and statically analysable, and providers to `ApplicationConfig.providers` or `Route.providers`, where the scope is chosen deliberately. A `forRoot()` call was the extreme case: an array entry whose entire purpose was the provider half, which is why it maps to a `provide*()` function and nothing else.

**★ What happens if you put `provideHttpClient()` in a component's `providers` array?**
TypeScript rejects it first: `@Component.providers` is inherited from `Directive` and typed `Provider[]`, with no `EnvironmentProviders` member, and `provideHttpClient()` returns `EnvironmentProviders` — a branded phantom type, `{ ɵbrand: 'EnvironmentProviders' }`, that exists precisely to fail this assignment. If you defeat the types with a cast, the runtime throws NG0207: `Invalid providers present in a non-environment injector. 'EnvironmentProviders' can't be used for component providers.` The `importProvidersFrom` case gets its own wording under the same code, because the result carries a `ɵfromNgModule` flag that lets the runtime name the culprit.

**★ Why does importing an NgModule into a component still create an injector?**
Because an `NgModule` in `imports` may carry providers, and Angular has to honour them. `StandaloneService.getOrCreateStandaloneInjector` walks the imports graph rooted at the component and, if it finds any providers, creates an `EnvironmentInjector` for them, cached against that component's `ComponentDef`. Two consequences follow directly: the injector is per component *class*, so two components importing the same module get two independent copies of its services; and those providers are invisible to a sibling component that did not import the module. It is also why the compiler's emit path filters unused *directives* out of the component definition but never filters an `NgModule` — the module reference has to survive so its providers can be collected.

**★ What can `Route.providers` express that `@NgModule.providers` never could?**
A subtree. Module providers were available to anything that imported the module and, transitively, to any module that imported *that* module — a scope whose boundary you could not see from either end. `Route.providers` creates a new `EnvironmentInjector` *"for this `Route` and its `children`"*, so a token can genuinely differ between two features without either of them being lazy-loaded and without a module existing at all. It also parents a lazily loaded `NgModule` reached through `loadChildren`, which is the one situation where keeping a legacy module beats hoisting its providers to the root.

**When is `@Component.providers` the right answer rather than a mistake?**
When you want one instance *per component instance* and the token is a plain `Provider`, not `EnvironmentProviders`. A form section that needs its own `FormGroupDirective`-adjacent state, a drag context shared only with a component's own children, a per-row edit buffer in a table — those are component-scoped by nature, and putting them in the root injector would make every instance share one object. The test is not "is this small" but "does a second instance of this component need a second instance of this service".

**Why is `CommonModule` almost never the right import in a v22 component?**
Because everything people import it for has moved. `@if`, `@for` and `@switch` are built into the template language and require no import at all — `NgIf`, `NgFor` and `NgSwitch` were deprecated in 20.0 with *"Use the `@if` block instead"*. The pipes and the remaining directives are standalone, so `DatePipe`, `AsyncPipe`, `NgClass` and the rest are imported by name. Importing the whole module still compiles and produces no NG8113 warning — the unused-imports rule only inspects directives and pipes, never NgModules — so it survives migrations silently, which is exactly why a separate schematic had to exist to strip it.

**How can `imports` fail at build time when it looks like an ordinary TypeScript array?**
Because it is not executed, it is *read*. `ngtsc` evaluates the array with its partial evaluator while compiling your `.ts` file, using two special resolvers — one that understands `ModuleWithProviders` and one that understands `forwardRef`. An entry it cannot resolve statically, such as a value returned by a function or read from a computed property, fails compilation with no runtime involved. That constraint is not incidental: it is what lets the compiler know a component's entire template scope from one file, which is the property the whole standalone design is built on.

---

← Prev: [What replaced each `NgModule` responsibility](07-what-replaced-each-ngmodule-responsibility.md) · Index: [Topic index](README.md) · Next → [The fields that moved, and the ones deleted](07c-the-fields-that-moved-and-the-ones-deleted.md)
