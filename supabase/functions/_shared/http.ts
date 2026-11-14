// Bound the actual streamed bytes; Content-Length is optional and untrusted.
export class RequestError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export async function readJsonBody(req: Request, maxBytes = 25000): Promise<Record<string, any>> {
  if (req.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new RequestError('Content-Type must be application/json', 415);
  }
  const declared = Number(req.headers.get('Content-Length'));
  if (Number.isFinite(declared) && declared > maxBytes) throw new RequestError('Request too large', 413);
  if (!req.body) throw new RequestError('Invalid JSON body');
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new RequestError('Request too large', 413);
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let body;
  try { body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { throw new RequestError('Invalid JSON body'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new RequestError('JSON object required');
  return body;
}

export function requireUUID(value: unknown, label = 'order ID'): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new RequestError('Invalid ' + label);
  }
  return value;
}

export function validateStoreRequest(body: Record<string, any>): void {
  const actions = ['payment_methods', 'zelle_evidence', 'place_order', 'zelle_reference', 'zelle_instructions', 'paypal_create', 'paypal_capture', 'paypal_reconcile'];
  if (!actions.includes(body.action)) throw new RequestError('Unsupported action');
  if (body.action === 'payment_methods') return;
  if (body.action === 'place_order') {
    requireUUID(body.request, 'request ID');
    requireUUID(body.shipping, 'shipping option');
    if (!['paypal', 'zelle'].includes(body.method)) throw new RequestError('Invalid payment method');
    if (!Array.isArray(body.items) || !body.items.length || body.items.length > 100) throw new RequestError('Invalid cart');
    for (const item of body.items) {
      requireUUID(item?.variant_id, 'variant ID');
      if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) throw new RequestError('Invalid quantity');
    }
    if (!body.address || typeof body.address !== 'object' || Array.isArray(body.address)) throw new RequestError('Invalid shipping address');
  } else {
    requireUUID(body.id);
    if (body.action === 'zelle_reference') {
      if (typeof body.reference !== 'string' || body.reference.trim().length < 3 || body.reference.length > 200) throw new RequestError('Invalid payment reference');
      body.reference = body.reference.trim();
    }
  }
}
