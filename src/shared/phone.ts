export function maskPhone(phoneDigits: string, phoneIsFull: boolean): string {
  const last4 = phoneDigits.slice(-4);
  return phoneIsFull ? `${phoneDigits.slice(0, 3)}****${last4}` : `****${last4}`;
}
