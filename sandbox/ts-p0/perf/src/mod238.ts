export interface Row238 { id: string; qty: number; tags: string[] }
export function total238(rows: Row238[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample238: Row238 = { id: 'r238', qty: 238, tags: ['a', 'b'] };
