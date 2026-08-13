export interface Row210 { id: string; qty: number; tags: string[] }
export function total210(rows: Row210[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample210: Row210 = { id: 'r210', qty: 210, tags: ['a', 'b'] };
