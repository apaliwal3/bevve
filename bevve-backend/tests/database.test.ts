import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const migration = readFileSync(new URL('../supabase/migrations/001_backend.sql', import.meta.url), 'utf8');
const seed = readFileSync(new URL('../supabase/seed.sql', import.meta.url), 'utf8');
const accessChecks = readFileSync(new URL('../supabase/tests/access.sql', import.meta.url), 'utf8');

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
  await db.exec(seed);
  return db;
}

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

test('the access check detects a broken ownership policy and rolls back failed fixtures too', async () => {
  const db = await database();
  try {
    await db.exec('alter policy profile_read on public.profiles using (true)');
    await assert.rejects(db.exec(accessChecks), /FAIL: other profiles are private/);
    assert.deepEqual((await db.query('select count(*)::int n from auth.users')).rows, [{ n: 0 }]);
  } finally { await db.close(); }
});
