export interface Row262 { id: string; qty: number; tags: string[] }
export function total262(rows: Row262[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample262: Row262 = { id: 'r262', qty: 262, tags: ['a', 'b'] };
