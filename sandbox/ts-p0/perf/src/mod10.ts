export interface Row10 { id: string; qty: number; tags: string[] }
export function total10(rows: Row10[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample10: Row10 = { id: 'r10', qty: 10, tags: ['a', 'b'] };
