export interface Row101 { id: string; qty: number; tags: string[] }
export function total101(rows: Row101[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample101: Row101 = { id: 'r101', qty: 101, tags: ['a', 'b'] };
