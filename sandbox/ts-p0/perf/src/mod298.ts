export interface Row298 { id: string; qty: number; tags: string[] }
export function total298(rows: Row298[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample298: Row298 = { id: 'r298', qty: 298, tags: ['a', 'b'] };
