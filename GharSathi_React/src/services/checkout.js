import api from './api.js';

// Only persisted bookings and server-confirmed payment state reach the UI.
export async function prepareCheckout(bookingPayload, createBooking) {
  const booking = await createBooking({ ...bookingPayload, payment: 'Online / Razorpay UPI' });
  if (!booking?.pk || !booking?.id) throw new Error('Booking could not be saved. Payment was not started.');
  let order;
  try {
    order = await api.createRazorpayOrder({
      amount: booking.price, bookingId: booking.id, serviceName: booking.serviceName,
    });
  } catch (error) {
    error.booking = booking;
    throw error;
  }
  if (!order?.order_id || !/^rzp_(test|live)_/.test(order.key_id || '') || order.key_id.includes('demo')) {
    throw new Error('Payment gateway did not return a valid checkout order.');
  }
  return { booking, order };
}

export async function confirmCheckout(booking, response) {
  const result = await api.verifyRazorpayPayment({ ...response, booking_id: booking.id });
  if (result?.success !== true || result.payment_status !== 'Paid') {
    throw new Error('Payment has not been confirmed by the server.');
  }
  return result;
}
