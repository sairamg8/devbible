export interface Row180 { id: string; qty: number; tags: string[] }
export function total180(rows: Row180[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample180: Row180 = { id: 'r180', qty: 180, tags: ['a', 'b'] };
