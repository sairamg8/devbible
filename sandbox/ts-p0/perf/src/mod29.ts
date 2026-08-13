export interface Row29 { id: string; qty: number; tags: string[] }
export function total29(rows: Row29[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample29: Row29 = { id: 'r29', qty: 29, tags: ['a', 'b'] };
