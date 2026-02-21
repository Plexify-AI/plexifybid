#!/usr/bin/env node
/**
 * /plexi-scaffold [type] [name]
 *
 * Generates boilerplate files for: agent, route, component, migration, tenant
 * Usage: node scripts/superpowers/scaffold.js component MyWidget
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..', '..');

const [, , type, name] = process.argv;

if (!type || !name) {
  console.log('Usage: node scripts/superpowers/scaffold.js <type> <name>');
  console.log('Types: agent, route, component, migration, tenant');
  process.exit(1);
}

const templates = {
  component: () => {
    const path = resolve(ROOT, `src/components/${name}.tsx`);
    const content = `import React from 'react';

export default function ${name}() {
  return (
    <div>
      <h2>${name}</h2>
    </div>
  );
}
`;
    return { path, content };
  },

  route: () => {
    const kebab = name.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
    const path = resolve(ROOT, `server/routes/${kebab}.js`);
    const content = `/**
 * PlexifySOLO — ${name} routes
 * Auth: sandboxAuth middleware sets req.tenant before these handlers run.
 */

import { logUsageEvent } from '../lib/supabase.js';

export async function handleGet${name}(req, res) {
  const tenant = req.tenant;
  if (!tenant) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Not authenticated' }));
  }

  try {
    // TODO: implement
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ message: '${name} route stub' }));
  } catch (err) {
    console.error('[${kebab}] error:', err.message);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Internal error' }));
  }
}
`;
    return { path, content };
  },

  migration: () => {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const kebab = name.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
    const path = resolve(ROOT, `supabase/migrations/${date}_${kebab}.sql`);
    const content = `-- PlexifySOLO Migration: ${name}
-- Created: ${new Date().toISOString()}

-- TODO: Add table definitions here

-- RLS (non-negotiable)
-- ALTER TABLE public.${kebab} ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Service role full access on ${kebab}"
--   ON public.${kebab} FOR ALL USING (true) WITH CHECK (true);
`;
    return { path, content };
  },

  agent: () => {
    const path = resolve(ROOT, `server/tools/${name.toLowerCase()}.js`);
    const content = `/**
 * PlexifySOLO Agent Tool: ${name}
 */

export const definition = {
  name: '${name.toLowerCase()}',
  description: 'TODO: describe what this agent tool does',
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'The query to process' },
    },
    required: ['query'],
  },
};

export async function execute({ query }, tenantId) {
  // TODO: implement agent logic
  return { result: \`${name} processed: \${query}\` };
}
`;
    return { path, content };
  },

  tenant: () => {
    const slug = name.toLowerCase().replace(/\s+/g, '-');
    const path = resolve(ROOT, `supabase/seeds/tenant_${slug}.sql`);
    const content = `-- Tenant seed: ${name}
INSERT INTO public.tenants (
  id, slug, name, company, role, sandbox_token,
  persona_code, tyranny, timezone, maslow_entry,
  features, system_prompt_override, vocab_skin, expires_at
) VALUES (
  gen_random_uuid(),
  '${slug}',
  '${name}',
  'TODO: Company Name',
  'TODO: Role',
  'pxs_' || encode(gen_random_bytes(24), 'hex'),
  'P1',
  'Execution',
  'America/New_York',
  1,
  '{"ask_plexi": true, "deal_room": true, "plexicos": false, "powerflow": true}'::jsonb,
  '{"context": "TODO: Add system prompt context for ${name}"}'::jsonb,
  '{}'::jsonb,
  NOW() + INTERVAL '30 days'
);
`;
    return { path, content };
  },
};

const generator = templates[type];
if (!generator) {
  console.error(`Unknown type: ${type}. Use: agent, route, component, migration, tenant`);
  process.exit(1);
}

const { path, content } = generator();

if (existsSync(path)) {
  console.error(`File already exists: ${path}`);
  process.exit(1);
}

const dir = dirname(path);
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

writeFileSync(path, content, 'utf-8');
console.log(`Created: ${path}`);
