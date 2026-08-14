---
title: "Data Layer & API Architecture: BFF, Client Abstraction & Generated Types"
sidebar_label: "Data Layer & API Architecture"
sidebar_position: 1
---

# 🏛️ Data Layer & API Architecture: BFF, Client Abstraction & Generated Types

## 1. The Decision Framework

The boundary between frontend and backend is an architectural surface with real decisions — how much shaping/aggregation happens where, how types stay in sync, and how every screen handles the same three inevitable states (loading/error/success) consistently.

```
Direct backend calls                    BFF (Backend-for-Frontend) pattern
  Frontend ──► Backend Service A              Frontend ──► BFF (thin, frontend-specific layer)
  Frontend ──► Backend Service B                              │
  Frontend ──► Backend Service C                    ┌─────────┼─────────┐
  ── frontend must aggregate/shape                  ▼         ▼         ▼
     3 responses itself, on EVERY screen      Backend A  Backend B  Backend C
     that needs data from all three          ── ONE call from frontend; the BFF aggregates/
                                                 shapes exactly what THIS frontend needs
```

### API Client Abstraction: One Module, Not Scattered `fetch()` Calls
```typescript
// api/client.ts — auth headers, base URL, error shape all live in ONE place
export const apiClient = {
  get: (path: string) => fetch(`${BASE_URL}${path}`, { headers: authHeaders() }).then(handleResponse),
};
```
Without this abstraction, auth header logic, base URL configuration, and error-response parsing get duplicated (and inevitably drift inconsistently) across every individual `fetch()` call site in the codebase — a single change (a new required header, a changed error response shape) requires hunting down every scattered call site instead of updating one module.

### Generated Types: Eliminating Hand-Written Drift
OpenAPI/GraphQL codegen produces TypeScript types (and often hooks) **directly from the actual backend schema** — hand-written request/response interfaces inevitably drift from what the backend actually returns the moment either side changes without the other being updated in lockstep; generated types make that drift a compile error instead of a silent runtime mismatch.

### Standardized Error/Loading Contracts
Every screen handling server data independently reinventing its own `{ data, error, loading }` shape (one screen using `isLoading`, another `pending`, a third checking `data === null`) produces inconsistent, harder-to-reason-about code across the app — a single, standardized contract (which TanStack Query's own status model, covered in its [query states doc](../../../tanstack-query/pages/03-query-states/01-status-flags.md), effectively provides) means every screen handles the same three states the same way.

---

## 2. Real-World Engineering Scenario

**Scenario**: A Mobile App and Web App Both Needing Differently-Shaped Data From the Same Backend, Solved With a BFF.
A backend's REST API returned verbose, deeply-nested responses designed around the backend's own internal data model — both a web app and a mobile app consumed this API, but each needed genuinely different shapes/subsets (the mobile app needed a much smaller payload for bandwidth reasons; the web app needed additional aggregated fields the backend didn't naturally group together). Rather than each frontend independently reshaping the same verbose backend response client-side (duplicating that reshaping logic across two codebases, and both paying the bandwidth cost of the full verbose payload), a BFF layer sat between each frontend and the backend, exposing a purpose-shaped endpoint per frontend — the web BFF endpoint aggregated exactly what the web app needed; the mobile BFF endpoint returned a minimal payload — with the actual reshaping logic living in one place per frontend, not duplicated inside each frontend's own client-side code.

---

## 3. Reference Implementation

```typescript
// api/client.ts — ONE abstraction, auth/base URL/error handling centralized
class ApiClient {
  constructor(private baseUrl: string) {}

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: { ...options?.headers, Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) throw new ApiError(res.status, await res.json());
    return res.json();
  }

  get<T>(path: string) { return this.request<T>(path); }
  post<T>(path: string, body: unknown) { return this.request<T>(path, { method: 'POST', body: JSON.stringify(body) }); }
}

export const apiClient = new ApiClient(process.env.NEXT_PUBLIC_API_URL!);
```

```typescript
// Generated types (from an OpenAPI schema) — the SOURCE of request/response shapes, never hand-written
import type { components } from './generated/api-types'; // auto-generated from the backend's OpenAPI spec

type User = components['schemas']['User']; // stays in sync automatically when the backend schema changes
```

```typescript
// A standardized data-fetching contract every screen follows identically
function useApiResource<T>(key: string[], fetcher: () => Promise<T>) {
  return useQuery({ queryKey: key, queryFn: fetcher });
  // every consumer gets the SAME { data, isLoading, isError, error } shape — no per-screen reinvention
}
```

---

## 4. Senior Engineer Anti-Patterns & Lessons

### ⚠️ Anti-Pattern 1: Scattering Raw `fetch()` Calls Throughout Component Code
Calling `fetch()` directly inside individual components (rather than through a centralized client abstraction) means auth token attachment, base URL configuration, and error-shape handling are each reimplemented (and inevitably inconsistently) at every call site — a single backend contract change (a renamed error field, a new required header) requires auditing every scattered fetch call rather than updating one client module.

### ⚠️ Anti-Pattern 2: Introducing a BFF Layer Prematurely, for a Single Frontend With No Aggregation Need
A BFF's value comes from genuinely needing to aggregate/shape data differently per-frontend, or shield multiple frontends from backend complexity — introducing one for a single, simple frontend with no aggregation need adds a whole additional service to build, deploy, and maintain for no corresponding architectural benefit. Reserve BFFs for the scenario that actually motivates them (multiple frontend consumers with genuinely different data needs from the same backend), not as a default "best practice" applied unconditionally.

### ⚠️ Anti-Pattern 3: Hand-Maintaining Request/Response Types Alongside a Schema-Having Backend
If the backend already has an OpenAPI/GraphQL schema, hand-writing parallel TypeScript interfaces describing the "same" shapes creates two sources of truth that can drift — a backend field rename updates the schema but not the hand-written frontend type, producing a type that confidently, silently lies about the actual runtime shape. Generate types from the schema whenever one already exists, rather than hand-duplicating it.
