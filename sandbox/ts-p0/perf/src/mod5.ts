export interface Row5 { id: string; qty: number; tags: string[] }
export function total5(rows: Row5[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample5: Row5 = { id: 'r5', qty: 5, tags: ['a', 'b'] };
