export interface Row179 { id: string; qty: number; tags: string[] }
export function total179(rows: Row179[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample179: Row179 = { id: 'r179', qty: 179, tags: ['a', 'b'] };
