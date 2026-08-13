export interface Row52 { id: string; qty: number; tags: string[] }
export function total52(rows: Row52[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample52: Row52 = { id: 'r52', qty: 52, tags: ['a', 'b'] };
