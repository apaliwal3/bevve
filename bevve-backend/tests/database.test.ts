import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const migration = readFileSync(new URL('../supabase/migrations/001_backend.sql', import.meta.url), 'utf8');
const seed = readFileSync(new URL('../supabase/seed.sql', import.meta.url), 'utf8');
const accessChecks = readFileSync(new URL('../supabase/tests/access.sql', import.meta.url), 'utf8');
const catalogMigration = readFileSync(new URL('../supabase/migrations/002_catalog_impressions.sql', import.meta.url), 'utf8');
const catalogChecks = readFileSync(new URL('../supabase/tests/catalog-impressions.sql', import.meta.url), 'utf8');
const comparisonMigration = readFileSync(new URL('../supabase/migrations/003_personal_comparisons.sql', import.meta.url), 'utf8');
const comparisonChecks = readFileSync(new URL('../supabase/tests/personal-comparisons.sql', import.meta.url), 'utf8');

async function database() {
  const db = new PGlite();
  // Supabase supplies these roles, auth table, and JWT helper in hosted projects.
  // This minimal shim exercises PostgreSQL RLS and RPCs, not GoTrue/PostgREST.
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$
      select (nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'sub')::uuid;
    $$;
    grant usage on schema auth to anon, authenticated;
  `);
  await db.exec(migration);
  await db.exec(catalogMigration);
  await db.exec(comparisonMigration);
  await db.exec(seed);
  return db;
}

test('personal comparison requests are private, immutable and retry-safe, with rollback on repeat checks', async () => {
  const db = await database();
  try {
    for (let run = 0; run < 2; run++) {
      const results = await db.exec(comparisonChecks);
      assert.deepEqual(results.at(-1)?.rows, [{ result: 'Personal comparison checks passed. All test data was rolled back.' }]);
      assert.deepEqual((await db.query('select count(*)::int n from public.bar_comparisons')).rows, [{ n: 0 }]);
      assert.deepEqual((await db.query('select count(*)::int n from auth.users')).rows, [{ n: 0 }]);
    }
  } finally { await db.close(); }
});

test('the database migration, seed, and access checks run repeatedly without leaving test data', async () => {
  const db = await database();
  try {
    const before = await db.query('select count(*)::int n from public.bars');
    for (let run = 0; run < 2; run++) {
      const results = await db.exec(accessChecks);
      assert.deepEqual(results.at(-1)?.rows, [{ result: 'All access checks passed. Temporary users, records, and helpers were rolled back.' }]);
      assert.deepEqual((await db.query('select count(*)::int n from public.bars')).rows, before.rows);
      assert.deepEqual((await db.query('select count(*)::int n from auth.users')).rows, [{ n: 0 }]);
      assert.deepEqual((await db.query('select count(*)::int n from public.incident_reports')).rows, [{ n: 0 }]);
      assert.deepEqual((await db.query('select count(*)::int n from public.published_incidents')).rows, [{ n: 0 }]);
    }
  } finally { await db.close(); }
});

test('catalog and impression permissions, edits, aggregation and serving identity pass without retained fixtures', async () => {
  const db = await database();
  try {
    for (let run=0; run<2; run++) {
      const results = await db.exec(catalogChecks);
      assert.deepEqual(results.at(-1)?.rows,[{ result: 'Catalog and impression checks passed. All test data was rolled back.' }]);
      assert.deepEqual((await db.query('select count(*)::int n from public.venue_impressions')).rows,[{ n: 0 }]);
      assert.deepEqual((await db.query('select count(*)::int n from auth.users')).rows,[{ n: 0 }]);
    }
  } finally { await db.close(); }
});

test('catalog pages cover more than fifty venues without duplicates and keep a stable order', async () => {
  const db=await database();
  try {
    await db.exec("insert into public.bars(name,address,latitude,longitude,is_demo) select 'Page venue '||n,'Test address',0,0,true from generate_series(1,55) n; set role authenticated;");
    const first=await db.query<{venue:{id:string}}>('select * from public.get_venue_catalog(0)');
    const second=await db.query<{venue:{id:string}}>('select * from public.get_venue_catalog(50)');
    assert.equal(first.rows.length,50);assert.equal(second.rows.length,8);
    assert.equal(new Set([...first.rows,...second.rows].map(row=>row.venue.id)).size,58);
    assert.deepEqual((await db.query('select * from public.get_venue_catalog(0)')).rows,first.rows);
    assert.deepEqual((await db.query('select * from public.get_venue_catalog(100)')).rows,[]);
  } finally {await db.close();}
});

test('the access check detects a broken ownership policy and rolls back failed fixtures too', async () => {
  const db = await database();
  try {
    await db.exec('alter policy profile_read on public.profiles using (true)');
    await assert.rejects(db.exec(accessChecks), /FAIL: other profiles are private/);
    assert.deepEqual((await db.query('select count(*)::int n from auth.users')).rows, [{ n: 0 }]);
  } finally { await db.close(); }
});
