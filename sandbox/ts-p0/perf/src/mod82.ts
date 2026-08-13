export interface Row82 { id: string; qty: number; tags: string[] }
export function total82(rows: Row82[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample82: Row82 = { id: 'r82', qty: 82, tags: ['a', 'b'] };
