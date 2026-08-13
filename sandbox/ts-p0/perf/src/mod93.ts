export interface Row93 { id: string; qty: number; tags: string[] }
export function total93(rows: Row93[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample93: Row93 = { id: 'r93', qty: 93, tags: ['a', 'b'] };
