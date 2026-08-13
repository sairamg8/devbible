export interface Row34 { id: string; qty: number; tags: string[] }
export function total34(rows: Row34[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample34: Row34 = { id: 'r34', qty: 34, tags: ['a', 'b'] };
