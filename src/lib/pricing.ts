// Fórmulas del Excel (ROADMAP §4). Deben dar exactamente lo mismo que las vistas
// v_order_items y v_orders:
//   costo_total = ROUND(USD × TRM × cantidad)
//   precio      = precio c/u × cantidad              si ella escribió el precio al cliente
//               = ROUND(costo_total × (1 + %), -2)   si no (a la centena, como el Excel)
//   ganancia    = precio − costo_total
//   incremento  = precio / costo − 1                 (informativo, 4 decimales)
//   total       = precio + envío cobrado
//   saldo       = total − abonos
//   incompleta  = USD > 0 y (TRM = 0 o faltan precio y %)
//
// Se calcula con BigInt sobre enteros (centavos de USD y TRM, diezmilésimas de %) para
// no arrastrar errores de punto flotante: 7,99 × 4123,45 = 32.946,3655 debe dar 32.946.
// El redondeo es "mitad hacia afuera", igual que round() de Postgres.

export type PaymentStatus = 'pendiente' | 'separado' | 'pagado'

export type LineInput = {
  /** USD por unidad, 2 decimales. 0 = producto sin costo para ella. */
  unitCostUsd: number
  /** COP por USD, 2 decimales. 0 = falta. */
  trm: number
  /** Entero > 0. */
  qty: number
  /** Fracción (0.40 = 40 %). null = no se usa (pedidos viejos o con precio escrito). */
  markupPct: number | null
  /** Precio c/u al cliente en COP. Si viene, manda sobre el %. null = falta. */
  unitPriceCop: number | null
  /** COP entero cobrado por envío/gestión en esta línea. */
  shippingChargedCop: number
}

export type LineTotals = {
  costCop: number
  priceCop: number
  profitCop: number
  shippingChargedCop: number
  /** precio + envío cobrado */
  totalCop: number
  incomplete: boolean
  /** Qué le falta a una línea incompleta. */
  missing: ('trm' | 'price')[]
}

export type OrderTotals = {
  itemsCostCop: number
  itemsPriceCop: number
  itemsProfitCop: number
  shippingChargedCop: number
  totalCop: number
  paidCop: number
  balanceCop: number
  paymentStatus: PaymentStatus
  incompleteItems: number
}

const toScaled = (value: number, scale: number) => BigInt(Math.round(value * scale))

/** n / d redondeado con la mitad hacia afuera (d es potencia de 10, positiva). */
function roundDiv(n: bigint, d: bigint): bigint {
  const half = d / 2n
  return n >= 0n ? (n + half) / d : -((-n + half) / d)
}

export function lineTotals(line: LineInput): LineTotals {
  const usdCents = toScaled(line.unitCostUsd, 100)
  const trmCents = toScaled(line.trm, 100)
  const cost = roundDiv(usdCents * trmCents * BigInt(line.qty), 10_000n)

  const markupTenThousandths = toScaled(line.markupPct ?? 0, 10_000)
  const price =
    line.unitPriceCop !== null
      ? BigInt(line.unitPriceCop) * BigInt(line.qty)
      : roundDiv(cost * (10_000n + markupTenThousandths), 1_000_000n) * 100n

  const missing: LineTotals['missing'] = []
  if (line.unitCostUsd > 0) {
    if (line.trm === 0) missing.push('trm')
    if (line.markupPct === null && line.unitPriceCop === null) missing.push('price')
  }

  const costCop = Number(cost)
  const priceCop = Number(price)
  return {
    costCop,
    priceCop,
    profitCop: priceCop - costCop,
    shippingChargedCop: line.shippingChargedCop,
    totalCop: priceCop + line.shippingChargedCop,
    incomplete: missing.length > 0,
    missing,
  }
}

/** Incremento sobre el costo (0.4 = 40 %), redondeado a 4 decimales como en la base. null si no hay costo. */
export function impliedMarkup(costCop: number, priceCop: number): number | null {
  if (costCop <= 0) return null
  return Number(roundDiv(BigInt(priceCop) * 10_000n, BigInt(costCop)) - 10_000n) / 10_000
}

export function paymentStatus(balanceCop: number, paidCop: number): PaymentStatus {
  if (balanceCop <= 0) return 'pagado'
  if (paidCop > 0) return 'separado'
  return 'pendiente'
}

export function orderTotals(lines: LineInput[], paidCop: number): OrderTotals {
  const totals = lines.map(lineTotals)
  const sum = (pick: (t: LineTotals) => number) => totals.reduce((acc, t) => acc + pick(t), 0)

  const itemsPriceCop = sum((t) => t.priceCop)
  const shippingChargedCop = sum((t) => t.shippingChargedCop)
  const totalCop = itemsPriceCop + shippingChargedCop
  const balanceCop = totalCop - paidCop
  return {
    itemsCostCop: sum((t) => t.costCop),
    itemsPriceCop,
    itemsProfitCop: sum((t) => t.profitCop),
    shippingChargedCop,
    totalCop,
    paidCop,
    balanceCop,
    paymentStatus: paymentStatus(balanceCop, paidCop),
    incompleteItems: totals.filter((t) => t.incomplete).length,
  }
}
