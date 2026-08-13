export interface Row135 { id: string; qty: number; tags: string[] }
export function total135(rows: Row135[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample135: Row135 = { id: 'r135', qty: 135, tags: ['a', 'b'] };
