// Importa la hoja "Inventario" del Excel a products + stock_movements (tipo ingreso).
//
//   npm run import:inventario                     → solo reporte, no toca la BD
//   npm run import:inventario -- --apply          → inicia sesión, muestra el plan y pide confirmación
//   npm run import:inventario -- --file otra.xlsx → otra ruta del Excel
//
// Inicia sesión con la cuenta dueña de los datos (anon key + RLS: owner_id = auth.uid()).
// Nunca usa la service_role. Las credenciales se piden por consola o vienen de
// IMPORT_EMAIL / IMPORT_PASSWORD.
//
// Si el reporte muestra posibles duplicados que sí son el mismo producto (o un nombre mal
// escrito), agrégalos a scripts/inventario-alias.json como {"nombre en Excel": "nombre final"}
// y vuelve a correrlo: los nombres que terminan con la misma llave se fusionan sumando cantidades.
//
// Re-ejecutarlo es seguro: omite productos que ya existen y los que ya tienen su ingreso importado.

import { readFileSync } from 'node:fs'
import { stdin, stdout } from 'node:process'
import { createInterface } from 'node:readline/promises'
import { parseArgs } from 'node:util'
import { createClient } from '@supabase/supabase-js'
import { readSheet, type SheetData } from 'read-excel-file/node'
import { findDuplicates, normalizeProductName, productKey } from '../src/lib/product-name.ts'
import type { Database } from '../src/types/database.ts'

const DEFAULT_FILE = 'docs/Tu_Shopper_USA_Contabilidad.xlsx'
const ALIAS_FILE = 'scripts/inventario-alias.json'
const SHEET = 'Inventario'
const NAME_HEADER = 'Producto'
const QTY_HEADER = 'Cantidad ingresada'
const IMPORT_NOTE = 'Importación inicial Excel'
// Límite de filas por consulta en Supabase (api.max_rows).
const MAX_ROWS = 1000

type SheetRow = { row: number; raw: string; name: string; qty: number }
type Product = { name: string; qty: number; rows: number[] }

function fail(message: string): never {
  console.error(`\n✖ ${message}`)
  process.exit(1)
}

const units = (n: number) => `${n.toLocaleString('es-CO')} ${n === 1 ? 'unidad' : 'unidades'}`

// ---------- Lectura del Excel ------------------------------------------------

async function readInventory(file: string, aliases: Map<string, string>): Promise<SheetRow[]> {
  let data: SheetData
  try {
    data = await readSheet(file, SHEET, { trim: false })
  } catch (error) {
    fail(`No se pudo leer la hoja "${SHEET}" de ${file}: ${(error as Error).message}`)
  }

  const [header = [], ...body] = data
  const column = (title: string) =>
    header.findIndex((cell) => typeof cell === 'string' && productKey(cell) === productKey(title))
  const nameCol = column(NAME_HEADER)
  const qtyCol = column(QTY_HEADER)
  if (nameCol < 0 || qtyCol < 0) {
    fail(`La hoja "${SHEET}" debe tener las columnas "${NAME_HEADER}" y "${QTY_HEADER}" en la fila 1.`)
  }

  const rows: SheetRow[] = []
  const errors: string[] = []
  body.forEach((cells, index) => {
    const row = index + 2
    const rawName = cells[nameCol]
    if (rawName === null || rawName === undefined || String(rawName).trim() === '') return

    const raw = String(rawName)
    const qty = cells[qtyCol]
    if (typeof qty !== 'number' || !Number.isInteger(qty) || qty <= 0) {
      errors.push(`fila ${row} "${raw.trim()}": cantidad ingresada inválida (${JSON.stringify(qty)})`)
      return
    }
    const name = aliases.get(productKey(raw)) ?? normalizeProductName(raw)
    rows.push({ row, raw, name, qty })
  })

  if (errors.length > 0) {
    fail(`Corrige estas filas en el Excel y vuelve a correr el script:\n  ${errors.join('\n  ')}`)
  }
  return rows
}

function loadAliases(): Map<string, string> {
  let json: Record<string, string>
  try {
    json = JSON.parse(readFileSync(ALIAS_FILE, 'utf8')) as Record<string, string>
  } catch (error) {
    fail(`No se pudo leer ${ALIAS_FILE}: ${(error as Error).message}`)
  }
  return new Map(Object.entries(json).map(([from, to]) => [productKey(from), normalizeProductName(to)]))
}

// ---------- Reporte ----------------------------------------------------------

function buildProducts(rows: SheetRow[]): Product[] {
  const byKey = new Map<string, Product>()
  for (const { row, name, qty } of rows) {
    const key = productKey(name)
    const product = byKey.get(key)
    if (product) {
      product.qty += qty
      product.rows.push(row)
    } else {
      byKey.set(key, { name, qty, rows: [row] })
    }
  }
  return [...byKey.values()]
}

function printReport(file: string, rows: SheetRow[], products: Product[]) {
  const totalUnits = rows.reduce((sum, r) => sum + r.qty, 0)
  console.log(`\nExcel: ${file} · hoja "${SHEET}"`)
  console.log(`  ${rows.length} filas con producto · ${units(totalUnits)}`)

  const renamed = rows.filter((r) => r.raw !== r.name)
  console.log(`\nNombres corregidos (${renamed.length}):`)
  for (const r of renamed) {
    const viaAlias = normalizeProductName(r.raw) !== r.name ? '  (alias)' : ''
    console.log(`  fila ${String(r.row).padStart(3)}  ${JSON.stringify(r.raw)} → ${JSON.stringify(r.name)}${viaAlias}`)
  }

  const { exact, possible } = findDuplicates(rows)
  console.log(`\nDuplicados exactos, se fusionan sumando cantidades (${exact.length}):`)
  for (const group of exact) {
    const total = group.reduce((sum, r) => sum + r.qty, 0)
    const list = group.map((r) => `fila ${r.row} ${JSON.stringify(r.raw)} (${r.qty})`).join(' + ')
    console.log(`  ${list} → "${group[0].name}" (${units(total)})`)
  }

  const qtyOf = (name: string) => products.find((p) => productKey(p.name) === productKey(name))?.qty ?? 0
  console.log(`\nPosibles duplicados, revisar (${possible.length}):`)
  for (const [a, b] of possible) {
    console.log(`  fila ${String(a.row).padStart(3)} "${a.name}" (${qtyOf(a.name)})`)
    console.log(`     ↔ fila ${String(b.row).padStart(3)} "${b.name}" (${qtyOf(b.name)})`)
  }
  if (possible.length > 0) {
    console.log(`  Si alguno es el mismo producto, agrégalo a ${ALIAS_FILE} y vuelve a correr.`)
  }

  const productUnits = products.reduce((sum, p) => sum + p.qty, 0)
  console.log(`\nResultado: ${products.length} productos · ${units(productUnits)}`)
}

// ---------- Consola ----------------------------------------------------------

async function ask(question: string): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout })
  try {
    return (await rl.question(question)).trim()
  } finally {
    rl.close()
  }
}

/** Como `ask`, pero sin mostrar lo que se escribe (para la contraseña). */
function askHidden(question: string): Promise<string> {
  if (!stdin.isTTY) return ask(question)
  return new Promise((resolve) => {
    let value = ''
    const done = () => {
      stdin.off('data', onData)
      stdin.setRawMode(false)
      stdin.pause()
      stdout.write('\n')
    }
    const onData = (chunk: Buffer) => {
      for (const char of chunk.toString('utf8')) {
        if (char === '\r' || char === '\n') {
          done()
          resolve(value)
          return
        }
        if (char === '\u0003') {
          done()
          process.exit(130)
        }
        if (char === '\u007f' || char === '\b') value = value.slice(0, -1)
        else value += char
      }
    }
    stdout.write(question)
    stdin.setRawMode(true)
    stdin.resume()
    stdin.on('data', onData)
  })
}

// ---------- Inserción --------------------------------------------------------

async function apply(products: Product[]) {
  try {
    process.loadEnvFile('.env.local')
  } catch {
    fail('No se encontró .env.local con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.')
  }
  const url = process.env.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anonKey) fail('Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY en .env.local.')

  const supabase = createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  console.log('\nLos productos quedan a nombre de la cuenta con la que inicies sesión (RLS).')
  const email = process.env.IMPORT_EMAIL || (await ask('Correo: '))
  const password = process.env.IMPORT_PASSWORD || (await askHidden('Contraseña: '))
  const { data: auth, error: authError } = await supabase.auth.signInWithPassword({ email, password })
  if (authError) fail(`No se pudo iniciar sesión: ${authError.message}`)
  console.log(`Sesión iniciada como ${auth.user.email}`)

  try {
    const { data: existing, error: existingError } = await supabase.from('products').select('id, name')
    if (existingError) fail(`No se pudieron leer los productos: ${existingError.message}`)
    const { data: imported, error: importedError } = await supabase
      .from('stock_movements')
      .select('product_id')
      .like('note', `${IMPORT_NOTE}%`)
    if (importedError) fail(`No se pudieron leer los movimientos: ${importedError.message}`)
    if (existing.length >= MAX_ROWS || imported.length >= MAX_ROWS) {
      fail(`Hay ${MAX_ROWS} filas o más en la base; este script es solo para la carga inicial.`)
    }

    const idByKey = new Map(existing.map((p) => [productKey(p.name), p.id]))
    const alreadyImported = new Set(imported.map((m) => m.product_id))
    const toCreate = products.filter((p) => !idByKey.has(productKey(p.name)))
    const toStock = products.filter((p) => {
      const id = idByKey.get(productKey(p.name))
      return !id || !alreadyImported.has(id)
    })
    const skipped = products.length - toCreate.length

    console.log(`\nEn la base ya hay ${existing.length} productos.`)
    if (skipped > 0) console.log(`  ${skipped} del Excel ya existen y no se vuelven a crear.`)
    if (toCreate.length === 0 && toStock.length === 0) {
      console.log('\nNada que importar: todo el inventario del Excel ya está en la base.')
      return
    }

    const stockUnits = toStock.reduce((sum, p) => sum + p.qty, 0)
    const answer = await ask(
      `\nSe crearán ${toCreate.length} productos y ${toStock.length} ingresos de stock (${units(stockUnits)}). ¿Continuar? (s/N) `,
    )
    if (!['s', 'si', 'sí'].includes(answer.toLowerCase())) {
      console.log('Cancelado. No se insertó nada.')
      return
    }

    if (toCreate.length > 0) {
      const { data: created, error } = await supabase
        .from('products')
        .insert(toCreate.map((p) => ({ name: p.name })))
        .select('id, name')
      if (error) fail(`No se pudieron crear los productos: ${error.message}`)
      for (const p of created) idByKey.set(productKey(p.name), p.id)
      console.log(`✔ ${created.length} productos creados.`)
    }

    const movements = toStock.map((p) => {
      const productId = idByKey.get(productKey(p.name))
      if (!productId) fail(`No se encontró el id de "${p.name}" después de crearlo.`)
      return {
        product_id: productId,
        kind: 'ingreso',
        qty: p.qty,
        note: `${IMPORT_NOTE} (fila ${p.rows.join(', ')})`,
      }
    })
    const { error: movementsError } = await supabase.from('stock_movements').insert(movements)
    if (movementsError) {
      fail(`No se pudieron crear los ingresos de stock: ${movementsError.message}\n  Vuelve a correr el script: solo completará lo que falta.`)
    }
    console.log(`✔ ${movements.length} ingresos de stock creados (${units(stockUnits)}).`)

    const { data: stock, error: stockError } = await supabase.from('v_stock').select('available_qty')
    if (stockError) fail(`No se pudo verificar v_stock: ${stockError.message}`)
    const available = stock.reduce((sum, s) => sum + (s.available_qty ?? 0), 0)
    console.log(`\nv_stock: ${stock.length} productos · ${units(available)} disponibles.`)
  } finally {
    await supabase.auth.signOut()
  }
}

// ---------- Main -------------------------------------------------------------

const { values: args } = parseArgs({
  options: {
    apply: { type: 'boolean', default: false },
    file: { type: 'string', default: DEFAULT_FILE },
  },
})

const rows = await readInventory(args.file, loadAliases())
const products = buildProducts(rows)
printReport(args.file, rows, products)

if (args.apply) {
  await apply(products)
} else {
  console.log('\nSolo reporte: no se insertó nada. Para importar: npm run import:inventario -- --apply')
}
