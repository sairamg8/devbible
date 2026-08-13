export interface Row74 { id: string; qty: number; tags: string[] }
export function total74(rows: Row74[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample74: Row74 = { id: 'r74', qty: 74, tags: ['a', 'b'] };
