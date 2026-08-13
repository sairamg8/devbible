export interface Row288 { id: string; qty: number; tags: string[] }
export function total288(rows: Row288[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample288: Row288 = { id: 'r288', qty: 288, tags: ['a', 'b'] };
