import { z } from 'zod';
// The contract the FRONTEND depends on. Owned by the consumer, verified by the provider.
export const UserResponse = z.object({
  id: z.number().int(),
  name: z.string(),
  email: z.string(),
  createdAt: z.string(),
});
