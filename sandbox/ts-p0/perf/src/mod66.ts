export interface Row66 { id: string; qty: number; tags: string[] }
export function total66(rows: Row66[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample66: Row66 = { id: 'r66', qty: 66, tags: ['a', 'b'] };
