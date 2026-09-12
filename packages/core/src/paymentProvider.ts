/**
 * Payment-provider boundary. This is the only module that should contain
 * provider-specific payment behavior. The app calls these stable functions;
 * only their internals change when real Razorpay Checkout/Route is connected.
 */

export interface PaymentProviderClient {
  rpc<T = unknown>(name: string, args?: Record<string, unknown>): Promise<{ data: T | null; error: { message: string } | null }>;
}

let client: PaymentProviderClient | null = null;

export function configurePaymentProvider(nextClient: PaymentProviderClient) {
  client = nextClient;
}

function requireClient() {
  if (!client) throw new Error('Payment provider is not configured');
  return client;
}

export async function createPayment(customerId: string, amount: number, description: string): Promise<{ paymentId: string }> {
  // MOCK: records a payment row. REAL LATER: create Razorpay Checkout order and verify its signature server-side.
  const { data, error } = await requireClient().rpc<{ id: string }>('mock_create_payment', { customer: customerId, payment_amount: amount, payment_description: description });
  if (error || !data) throw new Error(error?.message || 'Unable to create payment');
  return { paymentId: data.id };
}

export async function createTransfer(paymentId: string, cookAccountId: string, amount: number, holdUntil?: string, orderId?: string): Promise<{ transferId: string }> {
  // MOCK: records an on-hold transfer. REAL LATER: call Razorpay Route create transfer with on_hold=true.
  const { data, error } = await requireClient().rpc<{ id: string }>('mock_create_transfer', { payment: paymentId, cook: cookAccountId, transfer_amount: amount, transfer_hold_until: holdUntil ?? null, transfer_order: orderId ?? null });
  if (error || !data) throw new Error(error?.message || 'Unable to create transfer');
  return { transferId: data.id };
}

export async function releaseTransfer(transferId: string): Promise<{ status: 'released' }> {
  // MOCK: releases the database row. REAL LATER: PATCH Razorpay transfer with on_hold=false.
  const { error } = await requireClient().rpc('mock_release_transfer', { transfer: transferId });
  if (error) throw new Error(error.message);
  return { status: 'released' };
}

export async function refundPayment(paymentId: string, amount: number, reason: string): Promise<{ refundId: string }> {
  // MOCK: records an audit row. REAL LATER: call Razorpay Refund against the original payment.
  const { data, error } = await requireClient().rpc<{ id: string }>('mock_refund_payment', { payment: paymentId, refund_amount: amount, refund_reason: reason });
  if (error || !data) throw new Error(error?.message || 'Unable to record refund');
  return { refundId: data.id };
}

export async function registerCookPayoutAccount(cookId: string, details: { upiId?: string; accountNumber?: string; ifsc?: string }): Promise<{ accountId: string }> {
  // MOCK: stores a payout reference. REAL LATER: create a Razorpay Route linked account and store its account ID.
  const { data, error } = await requireClient().rpc<{ id: string }>('mock_register_cook_payout_account', { cook: cookId, payout: details });
  if (error || !data) throw new Error(error?.message || 'Unable to save payout account');
  return { accountId: data.id };
}

export async function cancelSubscription(subscriptionId: string, refundAmount: number): Promise<{ refundId: string }> {
  // MOCK: refunds remaining held days. REAL LATER: call the real Razorpay refund API for the original payment.
  const { data, error } = await requireClient().rpc<{ id: string }>('mock_cancel_subscription', { subscription: subscriptionId, refund_amount: refundAmount });
  if (error || !data) throw new Error(error?.message || 'Unable to cancel subscription');
  return { refundId: data.id };
}
