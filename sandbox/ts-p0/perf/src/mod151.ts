export interface Row151 { id: string; qty: number; tags: string[] }
export function total151(rows: Row151[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample151: Row151 = { id: 'r151', qty: 151, tags: ['a', 'b'] };
