export interface Row111 { id: string; qty: number; tags: string[] }
export function total111(rows: Row111[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample111: Row111 = { id: 'r111', qty: 111, tags: ['a', 'b'] };
