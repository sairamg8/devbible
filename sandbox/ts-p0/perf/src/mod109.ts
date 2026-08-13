export interface Row109 { id: string; qty: number; tags: string[] }
export function total109(rows: Row109[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample109: Row109 = { id: 'r109', qty: 109, tags: ['a', 'b'] };
