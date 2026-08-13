export interface Row50 { id: string; qty: number; tags: string[] }
export function total50(rows: Row50[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample50: Row50 = { id: 'r50', qty: 50, tags: ['a', 'b'] };
