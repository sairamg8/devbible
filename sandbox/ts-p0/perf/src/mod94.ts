export interface Row94 { id: string; qty: number; tags: string[] }
export function total94(rows: Row94[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample94: Row94 = { id: 'r94', qty: 94, tags: ['a', 'b'] };
