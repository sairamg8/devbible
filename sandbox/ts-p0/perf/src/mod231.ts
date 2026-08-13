export interface Row231 { id: string; qty: number; tags: string[] }
export function total231(rows: Row231[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample231: Row231 = { id: 'r231', qty: 231, tags: ['a', 'b'] };
