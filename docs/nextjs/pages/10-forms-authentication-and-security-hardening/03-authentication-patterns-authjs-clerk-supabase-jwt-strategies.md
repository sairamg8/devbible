---
sidebar_position: 3
title: "Authentication patterns: Auth.js, Clerk, Supabase, JWT strategies, edge-native sessions."
sidebar_label: "Authentication patterns: Auth.js, Clerk, Supabase, JWT strategies, edge-native sessions."
description: "Authentication patterns: Auth.js, Clerk, Supabase, JWT strategies, edge-native sessions."
---

# ▲ Authentication patterns: Auth.js, Clerk, Supabase, JWT strategies, edge-native sessions.

> **Syllabus chapter:** 10. Forms, Authentication, and Security Hardening  
> **Exact concept:** Authentication patterns: Auth.js, Clerk, Supabase, JWT strategies, edge-native sessions.  
> **Source:** adapted from existing chapter overview content

> **Priority Badges Legend:**  
> 🟢 `[D]` **Daily driver / Must Master** — expect to use weekly or more; own this cold  
> 🟡 `[O]` **Occasional / Must Learn** — monthly-ish, situational but expected  
> 🔴 `[R]` **Rare-but-critical / Must Understand** — rarely touch it, but it saves you when things break  

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
