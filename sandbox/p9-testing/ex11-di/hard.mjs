import { config } from './config.mjs';
const clock = () => new Date();                 // hidden dependency
export function receiptId(orderId) {
  return `${config.region}-${clock().getFullYear()}-${orderId}`;
}
