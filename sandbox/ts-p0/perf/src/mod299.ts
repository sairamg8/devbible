export interface Row299 { id: string; qty: number; tags: string[] }
export function total299(rows: Row299[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample299: Row299 = { id: 'r299', qty: 299, tags: ['a', 'b'] };
