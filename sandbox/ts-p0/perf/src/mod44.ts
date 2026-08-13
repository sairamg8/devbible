export interface Row44 { id: string; qty: number; tags: string[] }
export function total44(rows: Row44[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample44: Row44 = { id: 'r44', qty: 44, tags: ['a', 'b'] };
