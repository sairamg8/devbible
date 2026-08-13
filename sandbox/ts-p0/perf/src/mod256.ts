export interface Row256 { id: string; qty: number; tags: string[] }
export function total256(rows: Row256[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample256: Row256 = { id: 'r256', qty: 256, tags: ['a', 'b'] };
