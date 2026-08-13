export interface Row152 { id: string; qty: number; tags: string[] }
export function total152(rows: Row152[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample152: Row152 = { id: 'r152', qty: 152, tags: ['a', 'b'] };
