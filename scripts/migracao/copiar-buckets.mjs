#!/usr/bin/env node
/**
 * Copia os buckets rdo-anexos, empresa-logos e obra-fotos
 * do Supabase ANTIGO para o NOVO, preservando storage_path.
 *
 * Uso:
 *   SRC_URL=https://old.supabase.co  SRC_KEY=<service_role_antigo> \
 *   DST_URL=https://new.supabase.co  DST_KEY=<service_role_novo>   \
 *   node scripts/migracao/copiar-buckets.mjs
 *
 * Opcional:
 *   BUCKETS="rdo-anexos,obra-fotos"   (default: os 3)
 *   CONCURRENCY=8                     (default: 6)
 *   DRY_RUN=1                         (só lista, não copia)
 */
import { createClient } from "@supabase/supabase-js";

const {
  SRC_URL, SRC_KEY, DST_URL, DST_KEY,
  BUCKETS = "rdo-anexos,empresa-logos,obra-fotos",
  CONCURRENCY = "6",
  DRY_RUN = "",
} = process.env;

if (!SRC_URL || !SRC_KEY || !DST_URL || !DST_KEY) {
  console.error("Faltam envs: SRC_URL, SRC_KEY, DST_URL, DST_KEY");
  process.exit(1);
}

const src = createClient(SRC_URL, SRC_KEY, { auth: { persistSession: false } });
const dst = createClient(DST_URL, DST_KEY, { auth: { persistSession: false } });
const dry = DRY_RUN === "1" || DRY_RUN.toLowerCase() === "true";
const concurrency = Math.max(1, parseInt(CONCURRENCY, 10) || 6);
const buckets = BUCKETS.split(",").map(s => s.trim()).filter(Boolean);

const stats = {};

async function ensureBucket(name) {
  const { data } = await dst.storage.getBucket(name);
  if (data) return;
  console.log(`  [+] criando bucket "${name}" no destino (privado)`);
  const { error } = await dst.storage.createBucket(name, { public: false });
  if (error && !/already exists/i.test(error.message)) throw error;
}

async function listAll(client, bucket, prefix = "") {
  const out = [];
  const pageSize = 1000;
  async function walk(pfx) {
    let offset = 0;
    while (true) {
      const { data, error } = await client.storage.from(bucket).list(pfx, {
        limit: pageSize, offset, sortBy: { column: "name", order: "asc" },
      });
      if (error) throw error;
      if (!data || data.length === 0) break;
      for (const item of data) {
        const path = pfx ? `${pfx}/${item.name}` : item.name;
        if (item.id === null || item.metadata === null) {
          // pasta
          await walk(path);
        } else {
          out.push({ path, size: item.metadata?.size ?? 0 });
        }
      }
      if (data.length < pageSize) break;
      offset += pageSize;
    }
  }
  await walk(prefix);
  return out;
}

async function copyOne(bucket, path) {
  const { data: blob, error: dErr } = await src.storage.from(bucket).download(path);
  if (dErr) throw new Error(`download ${bucket}/${path}: ${dErr.message}`);
  const buf = Buffer.from(await blob.arrayBuffer());
  const contentType = blob.type || "application/octet-stream";
  const { error: uErr } = await dst.storage.from(bucket).upload(path, buf, {
    contentType, upsert: true,
  });
  if (uErr) throw new Error(`upload ${bucket}/${path}: ${uErr.message}`);
  return buf.length;
}

async function runPool(items, worker) {
  let i = 0, ok = 0, fail = 0;
  const errs = [];
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (i < items.length) {
      const idx = i++;
      const it = items[idx];
      try {
        await worker(it);
        ok++;
        if (ok % 25 === 0) process.stdout.write(`    ${ok}/${items.length}\r`);
      } catch (e) {
        fail++;
        errs.push({ path: it.path, error: e.message });
        console.warn(`\n  [!] ${it.path}: ${e.message}`);
      }
    }
  }));
  return { ok, fail, errs };
}

for (const bucket of buckets) {
  console.log(`\n=== ${bucket} ===`);
  const t0 = Date.now();

  await ensureBucket(bucket);

  const srcList = await listAll(src, bucket);
  console.log(`  origem: ${srcList.length} objetos`);

  if (dry) {
    stats[bucket] = { src: srcList.length, copied: 0, failed: 0, dry: true };
    continue;
  }

  const { ok, fail, errs } = await runPool(srcList, (it) => copyOne(bucket, it.path));

  const dstList = await listAll(dst, bucket);
  const missing = srcList.filter(s => !dstList.find(d => d.path === s.path));

  stats[bucket] = {
    src: srcList.length,
    dst: dstList.length,
    copied: ok,
    failed: fail,
    missing: missing.length,
    seconds: Math.round((Date.now() - t0) / 1000),
    errors: errs.slice(0, 20),
  };

  console.log(`  destino: ${dstList.length} objetos | copiados=${ok} falhas=${fail} faltando=${missing.length} (${stats[bucket].seconds}s)`);
}

console.log("\n===== RESUMO =====");
console.log(JSON.stringify(stats, null, 2));

const anyFail = Object.values(stats).some(s => (s.failed || 0) > 0 || (s.missing || 0) > 0);
process.exit(anyFail ? 2 : 0);
