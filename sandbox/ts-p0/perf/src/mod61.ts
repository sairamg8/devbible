export interface Row61 { id: string; qty: number; tags: string[] }
export function total61(rows: Row61[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample61: Row61 = { id: 'r61', qty: 61, tags: ['a', 'b'] };
