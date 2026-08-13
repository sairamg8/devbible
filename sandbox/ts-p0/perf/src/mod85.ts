export interface Row85 { id: string; qty: number; tags: string[] }
export function total85(rows: Row85[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample85: Row85 = { id: 'r85', qty: 85, tags: ['a', 'b'] };
