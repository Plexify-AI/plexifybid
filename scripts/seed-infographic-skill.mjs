#!/usr/bin/env node
/**
 * Seed the global "Infographic" skill into deal_room_skills.
 *
 * Usage: node scripts/seed-infographic-skill.mjs
 * Safe to re-run — checks for existing skill before inserting.
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SKILL_KEY = 'infographic';

const systemPrompt = `You are a data visualization specialist for AEC (Architecture, Engineering, Construction) business development. Your job is to analyze source documents and produce a structured JSON object that will be rendered as a visual infographic one-pager.

{voice_dna_block}

DOMAIN CONTEXT:
Construction industry business development, reality capture, documentation compliance, project intelligence, preconstruction, digital twins, general contractors, subcontractors, MEP engineering.

OUTPUT FORMAT:
Return ONLY valid JSON with this exact structure. Do not wrap in markdown code fences.

{
  "title": "Short title for the infographic (company or deal name)",
  "subtitle": "One-line context (opportunity type, industry vertical)",
  "metrics": [
    {
      "label": "Short metric name (2-4 words)",
      "value": "Display value ($2.1B, 40+, 78/100, etc.)",
      "icon": "dollar|flame|building|users|clock|chart|shield|target"
    }
  ],
  "timeline": [
    {
      "date": "Month Year or Quarter",
      "event": "What happened or is planned",
      "status": "complete|in_progress|upcoming"
    }
  ],
  "key_contacts": [
    {
      "name": "Full name",
      "title": "Job title",
      "warmth": 0-100 or null if unknown
    }
  ],
  "strengths": ["Strength 1", "Strength 2", "Strength 3"],
  "risks": ["Risk 1", "Risk 2", "Risk 3"],
  "recommendation": "One clear, actionable next step (2-3 sentences max)"
}

RULES:
- Include 3-6 metrics (pick the most impactful numbers from the sources)
- Include 3-5 timeline events (past milestones + upcoming deadlines)
- Include 1-4 key contacts mentioned in the sources
- Include 2-4 strengths and 2-4 risks
- The recommendation must be specific and actionable — not generic advice
- All data must come from the provided source documents — never fabricate
- If a section has no data in the sources, use an empty array [] rather than inventing content
- Icon choices: dollar (financial), flame (warmth/priority), building (project/site), users (team/contacts), clock (timeline), chart (metrics/data), shield (risk/compliance), target (opportunity/goal)`;

async function seed() {
  console.log('Seeding infographic skill...\n');

  // Check if already exists (global)
  const { data: existing } = await sb
    .from('deal_room_skills')
    .select('id, skill_key')
    .is('tenant_id', null)
    .eq('skill_key', SKILL_KEY)
    .limit(1);

  if (existing && existing.length > 0) {
    console.log(`  SKIP — Global "${SKILL_KEY}" skill already exists (${existing[0].id})`);
    console.log('  To update, delete the existing row first.');
    return;
  }

  const { data, error } = await sb
    .from('deal_room_skills')
    .insert({
      tenant_id: null, // Global
      skill_key: SKILL_KEY,
      skill_name: 'Infographic',
      system_prompt: systemPrompt,
      is_active: true,
    })
    .select('id, skill_key, skill_name')
    .single();

  if (error) {
    console.error('Insert failed:', error);
    process.exit(1);
  }

  console.log(`  ✅ Skill created: ${data.skill_name} (${data.skill_key})`);
  console.log(`     ID: ${data.id}`);
  console.log(`     Scope: Global (all tenants)`);
  console.log('\nDone. Add "Generate Infographic" chip to AssistantPanel.tsx.');
}

seed();
