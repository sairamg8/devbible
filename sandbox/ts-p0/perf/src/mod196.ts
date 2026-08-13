export interface Row196 { id: string; qty: number; tags: string[] }
export function total196(rows: Row196[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample196: Row196 = { id: 'r196', qty: 196, tags: ['a', 'b'] };
