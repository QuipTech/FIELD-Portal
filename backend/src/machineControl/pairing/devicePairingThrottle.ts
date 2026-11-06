// Per client IP, on the signed-out route a tablet sends its code to. A code is
// only 6 digits, so guessing has to stay far slower than its 15-minute life.
export const DEVICE_PAIRING_THROTTLER = {
  name: 'devicePairing',
  ttl: 60 * 1000,
  limit: 5,
};
