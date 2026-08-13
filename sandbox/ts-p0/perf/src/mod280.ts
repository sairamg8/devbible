export interface Row280 { id: string; qty: number; tags: string[] }
export function total280(rows: Row280[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample280: Row280 = { id: 'r280', qty: 280, tags: ['a', 'b'] };
