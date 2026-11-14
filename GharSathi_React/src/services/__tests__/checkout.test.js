import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '../api.js';
import { prepareCheckout, confirmCheckout } from '../checkout.js';

vi.mock('../api.js', () => ({ default: { createRazorpayOrder: vi.fn(), verifyRazorpayPayment: vi.fn() } }));
const booking = { pk: 12, id: 'GS-1234567', price: 499, serviceName: 'AC Service' };
beforeEach(() => vi.clearAllMocks());

describe('persisted booking checkout', () => {
  it('saves first and uses the returned booking reference and amount', async () => {
    const save = vi.fn().mockResolvedValue(booking);
    api.createRazorpayOrder.mockImplementation(async () => {
      expect(save).toHaveBeenCalledOnce();
      return { order_id: 'order_test', key_id: 'rzp_test_local' };
    });
    await prepareCheckout({ price: 1 }, save);
    expect(api.createRazorpayOrder).toHaveBeenCalledWith({ amount: 499, bookingId: booking.id, serviceName: booking.serviceName });
  });
  it('does not contact the gateway when persistence fails', async () => {
    await expect(prepareCheckout({}, vi.fn().mockResolvedValue(null))).rejects.toThrow('saved');
    expect(api.createRazorpayOrder).not.toHaveBeenCalled();
  });
  it('propagates gateway errors instead of creating a demo order', async () => {
    api.createRazorpayOrder.mockRejectedValueOnce(new Error('Gateway unavailable'));
    await expect(prepareCheckout({}, vi.fn().mockResolvedValue(booking))).rejects.toThrow('Gateway unavailable');
  });
  it('rejects a verification error without claiming paid', async () => {
    api.verifyRazorpayPayment.mockRejectedValueOnce(new Error('Invalid signature'));
    await expect(confirmCheckout(booking, {})).rejects.toThrow('Invalid signature');
  });
  it('requires an explicit server-confirmed Paid response', async () => {
    api.verifyRazorpayPayment.mockResolvedValueOnce({ success: true, payment_status: 'Pending' });
    await expect(confirmCheckout(booking, {})).rejects.toThrow('not been confirmed');
    api.verifyRazorpayPayment.mockResolvedValueOnce({ success: true, payment_status: 'Paid' });
    await expect(confirmCheckout(booking, { razorpay_payment_id: 'pay_test' })).resolves.toMatchObject({ payment_status: 'Paid' });
    expect(api.verifyRazorpayPayment).toHaveBeenLastCalledWith({ razorpay_payment_id: 'pay_test', booking_id: booking.id });
  });
});
