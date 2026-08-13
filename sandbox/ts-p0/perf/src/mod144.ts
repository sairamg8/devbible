export interface Row144 { id: string; qty: number; tags: string[] }
export function total144(rows: Row144[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample144: Row144 = { id: 'r144', qty: 144, tags: ['a', 'b'] };
