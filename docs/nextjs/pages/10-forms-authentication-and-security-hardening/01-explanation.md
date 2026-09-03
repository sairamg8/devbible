---
sidebar_position: 0
title: "Overview"
sidebar_label: "Overview"
description: "Chapter 10 overview"
---

# ▲ Forms, Authentication, and Security Hardening

> **Page priority:** 🟢 `[D]` **Daily driver / Must Master**

> **Priority Badges Legend:**  
> 🟢 `[D]` **Daily driver / Must Master** — expect to use weekly or more; own this cold  
> 🟡 `[O]` **Occasional / Must Learn** — monthly-ish, situational but expected  
> 🔴 `[R]` **Rare-but-critical / Must Understand** — rarely touch it, but it saves you when things break  

> **Source:** authored for exact devbible syllabus Chapter 10

Mutations, auth, and RSC serialization are the high-risk surface of a Next app. **Server Actions** + shared **Zod** schemas + **data-access-layer authorization** (not middleware alone) are the durable pattern. Treat serialization boundaries as an attack surface.

## 1. Under-The-Hood Mechanics

### Server Actions as the mutation path

```tsx
// app/tasks/actions.ts
'use server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { auth } from '@/auth'
import { db } from '@/db'

const CreateTask = z.object({ title: z.string().min(1).max(200) })

export async function createTask(formData: FormData) {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')

  const parsed = CreateTask.safeParse({ title: formData.get('title') })
  if (!parsed.success) return { ok: false, error: parsed.error.flatten() }

  await db.task.create({
    data: { title: parsed.data.title, teamId: session.user.teamId },
  })
  revalidatePath('/board')
  return { ok: true }
}
```

```tsx
// progressive enhancement
<form action={createTask}>
  <input name="title" required />
  <button type="submit">Add</button>
</form>
```

Use `useActionState` / `useOptimistic` for pending and optimistic UX.

### Auth patterns (choose deliberately)

| Approach | Notes |
| :--- | :--- |
| Auth.js | Flexible, self-host friendly |
| Clerk / Supabase Auth | Hosted UX + sessions |
| Custom JWT | Easy to get wrong; prefer battle-tested libraries |

**Defense in depth:**

1. `proxy.ts` / middleware — coarse filter (logged-in cookie present)  
2. **Data access layer** — real authorization (`teamId` checks on every query)  
3. UI — hide buttons (never the only control)  

### RSC serialization hardening

- Never pass secrets or rich internal objects to Client Components  
- Keep DTOs serializable and minimal  
- Patch aggressively for RSC protocol CVEs; track KEV catalog for framework issues  
- Prefer `server-only` on modules that touch secrets  

```ts
import 'server-only'
export function getSecret() {
  return process.env.API_SECRET
}
```

## 2. Real-World Engineering Scenario

SprintDesk used middleware-only “auth.” A misconfigured matcher left a Server Action callable without a session for a week. Moving **authorization into the DAL** (`assertTeamMember(userId, teamId)` before every query) closed the hole even when middleware regressed.

## 3. Production-Grade Code Example

```ts
// dal/tasks.ts
import 'server-only'
import { auth } from '@/auth'
import { db } from '@/db'

export async function listTasksForTeam(teamId: string) {
  const session = await auth()
  if (!session?.user || session.user.teamId !== teamId) {
    throw new Error('Forbidden')
  }
  return db.task.findMany({ where: { teamId } })
}
```

## 4. Senior Engineer Edge Cases & Pitfalls

### ⚠️ Pitfall 1: Middleware as sole auth gate

Bypass via direct Server Action / route handler calls. Authorize in DAL.

### ⚠️ Pitfall 2: Trusting client-sent `teamId`

Always bind to session identity server-side.

### ⚠️ Pitfall 3: Duplicate Zod schemas drifting

Share one schema package between client forms and server actions.

### ⚠️ Pitfall 4: Logging PII/secrets from actions

Redact; never log tokens or raw passwords.
