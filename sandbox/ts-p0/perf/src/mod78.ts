export interface Row78 { id: string; qty: number; tags: string[] }
export function total78(rows: Row78[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample78: Row78 = { id: 'r78', qty: 78, tags: ['a', 'b'] };
