export interface Row7 { id: string; qty: number; tags: string[] }
export function total7(rows: Row7[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample7: Row7 = { id: 'r7', qty: 7, tags: ['a', 'b'] };
