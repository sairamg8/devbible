export interface Row250 { id: string; qty: number; tags: string[] }
export function total250(rows: Row250[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample250: Row250 = { id: 'r250', qty: 250, tags: ['a', 'b'] };
