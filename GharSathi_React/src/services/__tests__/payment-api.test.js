import { afterEach, describe, expect, it, vi } from 'vitest';
import api, { normalizeBookingFromDjango } from '../api.js';

afterEach(() => vi.unstubAllGlobals());

describe('payment API fails closed', () => {
  it('does not infer Paid from an online payment selection', () => {
    const booking = normalizeBookingFromDjango({ id:1, payment_method:'Online / Razorpay UPI' });
    expect(booking.paymentStatus).toBe('Pending');
  });
  it.each(['createRazorpayOrder','verifyRazorpayPayment'])('propagates a failed backend %s request', async (method) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok:false, status:400, json:async()=>({error:'Backend rejected payment'}),
    }));
    await expect(api[method]({amount:499,bookingId:'GS-1'})).rejects.toThrow('Backend rejected payment');
  });
});
