export interface Row70 { id: string; qty: number; tags: string[] }
export function total70(rows: Row70[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample70: Row70 = { id: 'r70', qty: 70, tags: ['a', 'b'] };
