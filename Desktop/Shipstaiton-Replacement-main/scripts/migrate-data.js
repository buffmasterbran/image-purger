/**
 * Migrate all data from Supabase → Coolify Postgres.
 *
 * Uses raw SQL (via pg) to avoid Prisma model limitations.
 * Reads every row from the source, writes to the destination.
 *
 * Usage:  node scripts/migrate-data.js
 */

const { Client } = require('pg')

// ── Connection configs ──────────────────────────────────────────────────────
// Supabase session-mode pooler (port 5432) — explicit params to avoid username parsing issues
const SOURCE_CONFIG = {
  user: 'postgres.uyttgplosotxrvlfktsu',
  password: '7Kc7TLHLJ0ClxqX3',
  host: 'aws-0-us-west-2.pooler.supabase.com',
  port: 5432,
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
}

// Coolify self-hosted
const DEST_URL =
  'postgres://postgres:LVMkZTAKOOKSdLT4Y50ed4KAyat5sNgR1BALRVx62f9SCYp74MD4Po1HVvihRUxQ@95.217.1.182:5436/postgres'

// Tables in dependency order (parents before children)
const TABLES = [
  'app_settings',
  'boxes',
  'product_sizes',
  'product_sku_patterns',
  'product_skus',
  'box_feedback_rules',
  'unmatched_skus',
  'locations',
  'printer_configs',
  'scale_configs',
  'rate_shoppers',
  'weight_rules',
  'shipping_method_mappings',
  'permission_groups',
  'group_page_access',
  'users',
  'pick_cells',
  'pick_carts',
  'pick_batches',
  'batch_cell_assignments',
  'bulk_batches',
  'bulk_queue_items',
  'pick_chunks',
  'chunk_bulk_batch_assignments',
  'order_logs',
  'shipment_logs',
]

async function migrate() {
  const src = new Client(SOURCE_CONFIG)
  const dst = new Client({ connectionString: DEST_URL })

  try {
    console.log('Connecting to source (Supabase)...')
    console.log('  Host:', SOURCE_CONFIG.host, 'Port:', SOURCE_CONFIG.port, 'User:', SOURCE_CONFIG.user)
    await src.connect()
    console.log('Connecting to destination (Coolify)...')
    await dst.connect()

    // Disable FK checks during migration
    await dst.query('SET session_replication_role = replica;')

    let totalRows = 0

    for (const table of TABLES) {
      // Check if table exists in source
      const existsCheck = await src.query(
        `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1)`,
        [table]
      )
      if (!existsCheck.rows[0].exists) {
        console.log(`  ⏭  ${table} — not found in source, skipping`)
        continue
      }

      // Read all rows
      const { rows } = await src.query(`SELECT * FROM "${table}"`)
      if (rows.length === 0) {
        console.log(`  ⏭  ${table} — 0 rows`)
        continue
      }

      // Clear destination table
      await dst.query(`DELETE FROM "${table}"`)

      // Get destination columns so we only insert matching ones
      const destColsResult = await dst.query(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
        [table]
      )
      const destCols = new Set(destColsResult.rows.map(r => r.column_name))

      // Insert in batches of 500
      const batchSize = 500
      let inserted = 0
      const columns = Object.keys(rows[0]).filter(c => destCols.has(c))
      const skippedCols = Object.keys(rows[0]).filter(c => !destCols.has(c))
      if (skippedCols.length > 0) {
        console.log(`     ⚠ Skipping source-only columns: ${skippedCols.join(', ')}`)
      }
      const colList = columns.map(c => `"${c}"`).join(', ')

      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize)
        const values = []
        const placeholders = []

        batch.forEach((row, batchIdx) => {
          const rowPlaceholders = columns.map((col, colIdx) => {
            let v = row[col]
            if (v !== null && typeof v === 'object') v = JSON.stringify(v)
            values.push(v)
            return `$${batchIdx * columns.length + colIdx + 1}`
          })
          placeholders.push(`(${rowPlaceholders.join(', ')})`)
        })

        try {
          await dst.query(
            `INSERT INTO "${table}" (${colList}) VALUES ${placeholders.join(', ')} ON CONFLICT DO NOTHING`,
            values
          )
        } catch (batchErr) {
          // Fall back to row-by-row insert to skip bad rows
          console.log(`     ⚠ Batch insert failed on ${table}, trying row-by-row...`)
          for (const row of batch) {
            const rowValues = columns.map(c => {
              const v = row[c]
              // Ensure JSON columns are stringified
              if (v !== null && typeof v === 'object') return JSON.stringify(v)
              return v
            })
            const rowPlaceholders = columns.map((_, idx) => `$${idx + 1}`)
            try {
              await dst.query(
                `INSERT INTO "${table}" (${colList}) VALUES (${rowPlaceholders.join(', ')}) ON CONFLICT DO NOTHING`,
                rowValues
              )
            } catch (rowErr) {
              console.log(`     ✗ Skipping row in ${table}: ${rowErr.message.slice(0, 80)}`)
            }
          }
        }
        inserted += batch.length
      }

      totalRows += inserted
      console.log(`  ✓  ${table} — ${inserted} rows`)
    }

    // Re-enable FK checks
    await dst.query('SET session_replication_role = DEFAULT;')

    console.log(`\nDone! Migrated ${totalRows} rows across ${TABLES.length} tables.`)
  } catch (err) {
    console.error('\nMigration failed:', err.message)
    if (err.message.includes('no pg_hba.conf entry')) {
      console.error('\nHint: The source DB may not allow connections from this IP.')
      console.error('Try using the Supabase direct connection (port 5432) or check your Supabase network settings.')
    }
    process.exit(1)
  } finally {
    await src.end().catch(() => {})
    await dst.end().catch(() => {})
  }
}

migrate()
