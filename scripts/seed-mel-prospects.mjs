#!/usr/bin/env node
/**
 * Seed Mel Wallace's Hexagon/Multivista tenant with 7 fictional AEC prospects.
 *
 * Usage: node scripts/seed-mel-prospects.mjs
 *
 * Requires .env.local with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 * Safe to re-run — uses upsert on (tenant_id, account_name, contact_name).
 * Reusable for tenant reset.
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const MEL_TENANT_ID = '00000000-0000-0000-0000-000000000001';

const prospects = [
  {
    tenant_id: MEL_TENANT_ID,
    account_name: 'Turner Construction',
    contact_name: 'Marcus Webb',
    contact_email: 'marcus.webb@turnerconstruction.com',
    contact_title: 'VP Preconstruction',
    stage: 'prospecting',
    warmth_score: 35,
    promoted_to_home: true,
    deal_hypothesis:
      'Reality capture deployment across Houston megaprojects — $2.1B annual revenue, documentation compliance gap on federal work',
    enrichment_data: {
      industry: 'Commercial GC',
      region: 'Houston, TX',
      annual_revenue: '$2.1B',
      employee_count: 10000,
      vertical: 'Commercial Construction',
      notes:
        "Turner's Houston office manages 12+ active megaprojects. Marcus oversees preconstruction technology adoption — prime entry point for Multivista reality capture platform.",
    },
  },
  {
    tenant_id: MEL_TENANT_ID,
    account_name: 'Skanska USA Building',
    contact_name: 'Diana Torres',
    contact_email: 'diana.torres@skanska.com',
    contact_title: 'Director of Innovation',
    stage: 'warming',
    warmth_score: 58,
    promoted_to_home: true,
    deal_hypothesis:
      'Active competitive evaluation for construction documentation platform — innovation team benchmarking Multivista against Autodesk',
    enrichment_data: {
      industry: 'Commercial GC',
      region: 'New York, NY',
      annual_revenue: '$7.3B',
      employee_count: 7500,
      vertical: 'Commercial Construction',
      notes:
        'Skanska innovation team is actively evaluating construction documentation platforms. Diana is leading the vendor comparison — Multivista vs. Autodesk BIM 360 vs. OpenSpace.',
    },
  },
  {
    tenant_id: MEL_TENANT_ID,
    account_name: 'Brasfield & Gorrie',
    contact_name: 'James Okonkwo',
    contact_email: 'james.okonkwo@brasfieldgorrie.com',
    contact_title: 'Regional Director',
    stage: 'takeover_ready',
    warmth_score: 78,
    promoted_to_home: true,
    deal_hypothesis:
      'Southeast market leader with 40+ active sites — scale play for reality capture rollout across regional portfolio',
    enrichment_data: {
      industry: 'Commercial GC',
      region: 'Birmingham, AL',
      annual_revenue: '$4.8B',
      employee_count: 3500,
      vertical: 'Commercial Construction',
      notes:
        'Brasfield & Gorrie is the largest privately held construction firm in the Southeast. James manages 40+ active sites across AL, GA, FL, TN — ideal scale customer for Multivista rollout.',
    },
  },
  {
    tenant_id: MEL_TENANT_ID,
    account_name: 'Clark Construction',
    contact_name: 'Rachel Abrams',
    contact_email: 'rachel.abrams@clarkconstruction.com',
    contact_title: 'SVP Operations',
    stage: 'prospecting',
    warmth_score: 30,
    promoted_to_home: true,
    deal_hypothesis:
      'Federal project documentation compliance — post-9/11 security requirements create mandatory documentation workflows',
    enrichment_data: {
      industry: 'Federal/Commercial GC',
      region: 'Bethesda, MD',
      annual_revenue: '$6.0B',
      employee_count: 4200,
      vertical: 'Federal Construction',
      notes:
        'Clark handles sensitive federal projects (DoD, GSA, VA) with strict documentation requirements. Rachel oversees operational compliance — documentation gaps are a known pain point on classified sites.',
    },
  },
  {
    tenant_id: MEL_TENANT_ID,
    account_name: 'Holder Construction',
    contact_name: 'David Kim',
    contact_email: 'david.kim@holderconstruction.com',
    contact_title: 'Chief Technology Officer',
    stage: 'warming',
    warmth_score: 62,
    promoted_to_home: true,
    deal_hypothesis:
      'CTO-led innovation initiative — attending ENR FutureTech, evaluating digital twin and reality capture vendors',
    enrichment_data: {
      industry: 'Commercial GC',
      region: 'Atlanta, GA',
      annual_revenue: '$3.2B',
      employee_count: 2200,
      vertical: 'Commercial Construction',
      notes:
        "David is presenting at ENR FutureTech on digital twin adoption. Holder's innovation budget is committed through 2027 — CTO buy-in means fast procurement if we demo well.",
    },
  },
  {
    tenant_id: MEL_TENANT_ID,
    account_name: 'Whiting-Turner',
    contact_name: 'Sarah Morales',
    contact_email: 'sarah.morales@whiting-turner.com',
    contact_title: 'VP of Quality',
    stage: 'prospecting',
    warmth_score: 38,
    promoted_to_home: true,
    deal_hypothesis:
      'Quality documentation pain point — VP Quality actively looking for automated site documentation to reduce rework',
    enrichment_data: {
      industry: 'Commercial GC',
      region: 'Baltimore, MD',
      annual_revenue: '$9.5B',
      employee_count: 6000,
      vertical: 'Commercial Construction',
      notes:
        "Whiting-Turner's quality team tracks rework costs at 4-6% of project value. Sarah is searching for automated documentation to catch defects earlier — Multivista's photo documentation addresses this directly.",
    },
  },
  {
    tenant_id: MEL_TENANT_ID,
    account_name: 'DPR Construction',
    contact_name: 'Amit Patel',
    contact_email: 'amit.patel@dpr.com',
    contact_title: 'Director Digital Delivery',
    stage: 'takeover_ready',
    warmth_score: 82,
    promoted_to_home: true,
    deal_hypothesis:
      'Lean construction leader with VDC focus — digital delivery team wants reality capture integrated into existing BIM workflows',
    enrichment_data: {
      industry: 'Commercial/Tech GC',
      region: 'San Francisco, CA',
      annual_revenue: '$7.9B',
      employee_count: 9000,
      vertical: 'Technology Construction',
      notes:
        "DPR is an industry leader in virtual design & construction. Amit's team already uses Matterport and wants to consolidate on a single reality capture platform — Multivista's API integration is the differentiator.",
    },
  },
];

async function seed() {
  console.log(`Seeding ${prospects.length} prospects for Mel Wallace (${MEL_TENANT_ID})...\n`);

  let inserted = 0;
  let skipped = 0;

  for (const p of prospects) {
    // Check if this contact already exists for this tenant+account
    const { data: existing } = await sb
      .from('opportunities')
      .select('id')
      .eq('tenant_id', MEL_TENANT_ID)
      .eq('account_name', p.account_name)
      .eq('contact_name', p.contact_name)
      .limit(1);

    if (existing && existing.length > 0) {
      console.log(`  SKIP  ${p.account_name} — ${p.contact_name} (already exists)`);
      skipped++;
      continue;
    }

    const { error } = await sb.from('opportunities').insert(p);
    if (error) {
      console.error(`  FAIL  ${p.account_name} — ${p.contact_name}:`, error.message);
    } else {
      console.log(`  ✅    ${p.warmth_score}/100  ${p.account_name} — ${p.contact_name} (${p.stage})`);
      inserted++;
    }
  }

  console.log(`\nDone. ${inserted} inserted, ${skipped} skipped.`);
  console.log('Verify at Mel\'s sandbox → Home page.');
}

seed();
