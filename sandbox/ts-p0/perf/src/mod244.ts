export interface Row244 { id: string; qty: number; tags: string[] }
export function total244(rows: Row244[]): number {
  return rows.reduce((sum, r) => sum + r.qty, 0);
}
export const sample244: Row244 = { id: 'r244', qty: 244, tags: ['a', 'b'] };
