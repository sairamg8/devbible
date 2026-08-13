export interface Row20 { id: string; qty: number; tags: string[] }
export function total20(rows: Row20[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample20: Row20 = { id: 'r20', qty: 20, tags: ['a', 'b'] };
