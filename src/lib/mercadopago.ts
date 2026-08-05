/**
 * MercadoPago integration (REST API).
 *
 * Supports two modes:
 *  - SANDBOX: when MP_ACCESS_TOKEN is not set, simulates the full flow
 *    locally so the UI/UX can be tested end-to-end without credentials.
 *  - LIVE: when MP_ACCESS_TOKEN is provided, calls the real MercadoPago API.
 *
 * Docs: https://www.mercadopago.com.ar/developers/en/docs/checkout-api/integration-configuration
 */

const MP_API_BASE = 'https://api.mercadopago.com'

export interface MPPreferenceItem {
  id: string
  title: string
  description?: string
  quantity: number
  unit_price: number
  currency_id: string // ARS | USD | ...
}

export interface MPPreferencePayer {
  email: string
  name?: string
}

export interface MPPreferenceResponse {
  id: string
  init_point: string
  sandbox_init_point: string
}

export interface MPPaymentInfo {
  id: number
  status: 'approved' | 'pending' | 'rejected' | 'in_process' | 'cancelled' | 'refunded'
  status_detail: string
  transaction_amount: number
  currency_id: string
  payment_method_id?: string
  payer?: { email?: string; id?: string }
  external_reference?: string
  date_approved?: string | null
}

export const isSandbox = !process.env.MP_ACCESS_TOKEN

function getAccessToken(): string {
  return process.env.MP_ACCESS_TOKEN || 'SANDBOX_TOKEN'
}

/**
 * Create a checkout preference.
 */
export async function createPreference(params: {
  items: MPPreferenceItem[]
  payer: MPPreferencePayer
  externalReference: string
  backUrls?: { success: string; pending: string; failure: string }
  autoRecurring?: {
    frequency: number
    frequencyType: 'days' | 'months'
    transactionAmount: number
  }
}): Promise<MPPreferenceResponse> {
  if (isSandbox) {
    // ─── SANDBOX MODE ───────────────────────────────────────
    const fakeId = 'SANDBOX-' + Math.random().toString(36).slice(2, 12)
    const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    return {
      id: fakeId,
      init_point: `${base}/subscription/return?status=approved&pref=${fakeId}&sandbox=1`,
      sandbox_init_point: `${base}/subscription/return?status=approved&pref=${fakeId}&sandbox=1`,
    }
  }

  const body: Record<string, unknown> = {
    items: params.items,
    payer: params.payer,
    external_reference: params.externalReference,
    back_urls: params.backUrls || {
      success: `${process.env.NEXT_PUBLIC_APP_URL || ''}/subscription/return?status=approved`,
      pending: `${process.env.NEXT_PUBLIC_APP_URL || ''}/subscription/return?status=pending`,
      failure: `${process.env.NEXT_PUBLIC_APP_URL || ''}/subscription/return?status=failure`,
    },
    auto_return: 'approved',
    notification_url: `${process.env.NEXT_PUBLIC_APP_URL || ''}/api/payments/webhook`,
  }

  if (params.autoRecurring) {
    // For recurring subscriptions, use preapproval approach
    return createPreapproval({
      reason: params.items[0]?.title || 'Suscripción E-TARGET',
      externalReference: params.externalReference,
      payerEmail: params.payer.email,
      frequency: params.autoRecurring.frequency,
      frequencyType: params.autoRecurring.frequencyType,
      transactionAmount: params.autoRecurring.transactionAmount,
    })
  }

  const res = await fetch(`${MP_API_BASE}/checkout/preferences?access_token=${getAccessToken()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`MP preference error: ${res.status} ${text}`)
  }
  return res.json()
}

/**
 * Create a recurring subscription (preapproval).
 */
async function createPreapproval(params: {
  reason: string
  externalReference: string
  payerEmail: string
  frequency: number
  frequencyType: 'days' | 'months'
  transactionAmount: number
}): Promise<MPPreferenceResponse> {
  const res = await fetch(`${MP_API_BASE}/preapproval?access_token=${getAccessToken()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      reason: params.reason,
      external_reference: params.externalReference,
      payer_email: params.payerEmail,
      auto_recurring: {
        frequency: params.frequency,
        frequency_type: params.frequencyType,
        transaction_amount: params.transactionAmount,
        currency_id: 'ARS',
      },
      back_url: `${process.env.NEXT_PUBLIC_APP_URL || ''}/subscription/return`,
      status: 'pending',
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`MP preapproval error: ${res.status} ${text}`)
  }
  const data = await res.json()
  return {
    id: data.id,
    init_point: data.init_point,
    sandbox_init_point: data.sandbox_init_point,
  }
}

/**
 * Fetch a payment by its MercadoPago id (used by webhook).
 */
export async function getPayment(paymentId: string | number): Promise<MPPaymentInfo> {
  if (isSandbox) {
    // Simulate an approved payment
    return {
      id: typeof paymentId === 'string' ? parseInt(paymentId) || 0 : paymentId,
      status: 'approved',
      status_detail: 'accredited',
      transaction_amount: 0,
      currency_id: 'ARS',
      external_reference: '',
      date_approved: new Date().toISOString(),
    }
  }

  const res = await fetch(`${MP_API_BASE}/v1/payments/${paymentId}?access_token=${getAccessToken()}`)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`MP get payment error: ${res.status} ${text}`)
  }
  return res.json()
}

/**
 * Process a webhook notification.
 * Returns the external_reference and the payment info.
 */
export async function processWebhook(type: string, dataId: string): Promise<{
  payment?: MPPaymentInfo
  externalReference?: string
}> {
  if (type === 'payment') {
    const payment = await getPayment(dataId)
    return { payment, externalReference: payment.external_reference }
  }
  return {}
}
