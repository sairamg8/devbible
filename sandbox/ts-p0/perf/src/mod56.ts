export interface Row56 { id: string; qty: number; tags: string[] }
export function total56(rows: Row56[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample56: Row56 = { id: 'r56', qty: 56, tags: ['a', 'b'] };
