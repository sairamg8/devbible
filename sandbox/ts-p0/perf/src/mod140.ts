export interface Row140 { id: string; qty: number; tags: string[] }
export function total140(rows: Row140[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample140: Row140 = { id: 'r140', qty: 140, tags: ['a', 'b'] };
