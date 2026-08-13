export interface Row191 { id: string; qty: number; tags: string[] }
export function total191(rows: Row191[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample191: Row191 = { id: 'r191', qty: 191, tags: ['a', 'b'] };
