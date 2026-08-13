export interface Row264 { id: string; qty: number; tags: string[] }
export function total264(rows: Row264[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample264: Row264 = { id: 'r264', qty: 264, tags: ['a', 'b'] };
