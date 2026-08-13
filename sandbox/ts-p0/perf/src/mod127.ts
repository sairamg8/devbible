export interface Row127 { id: string; qty: number; tags: string[] }
export function total127(rows: Row127[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample127: Row127 = { id: 'r127', qty: 127, tags: ['a', 'b'] };
