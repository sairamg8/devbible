export interface Row27 { id: string; qty: number; tags: string[] }
export function total27(rows: Row27[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample27: Row27 = { id: 'r27', qty: 27, tags: ['a', 'b'] };
