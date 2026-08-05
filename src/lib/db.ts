// ═══════════════════════════════════════════════════════════
//  db.ts — Legacy compatibility shim.
//  ───────────────────────────────────────────────────────────
//  This project NO LONGER uses Prisma at runtime. Prisma +
//  @prisma/adapter-libsql fails on Vercel serverless with
//  `URL_INVALID: The URL 'undefined'`. All data access now goes
//  through @libsql/client directly (see db-direct.ts).
//
//  This file re-exports the direct client so any leftover
//  `import { ... } from '@/lib/db'` keeps working, and ensures
//  NO Prisma client is ever loaded at runtime.
// ═══════════════════════════════════════════════════════════
export {
  getClient,
  query,
  queryFirst,
  execute,
  batch,
  generateId,
  nowISO,
  isoFromNow,
  toDate,
  toISO,
  toBool,
  fromBool,
} from './db-direct'
