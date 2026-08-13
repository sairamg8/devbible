export interface Row4 { id: string; qty: number; tags: string[] }
export function total4(rows: Row4[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample4: Row4 = { id: 'r4', qty: 4, tags: ['a', 'b'] };
