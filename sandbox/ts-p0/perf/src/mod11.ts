export interface Row11 { id: string; qty: number; tags: string[] }
export function total11(rows: Row11[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample11: Row11 = { id: 'r11', qty: 11, tags: ['a', 'b'] };
