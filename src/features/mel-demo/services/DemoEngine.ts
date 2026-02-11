import type {
  DodgeProject,
  ProjectContact,
  MutualConnection,
  CaseStudy,
  ICPConfig,
  EnrichedProspect,
  ProspectQueryResponse,
  OutreachResponse,
  WinProbabilityResponse,
} from '../MelDemo.types';

import projectsData from '../data/projects.json';
import contactsData from '../data/contacts.json';
import connectionsData from '../data/connections.json';
import caseStudiesData from '../data/case-studies.json';
import icpConfigData from '../data/icp-config.json';

// ─── Simulated Delay ─────────────────────────────────────────────────────────

function simulateDelay(minMs = 800, maxMs = 1200): Promise<void> {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Data Lookups ────────────────────────────────────────────────────────────

const projects = projectsData as DodgeProject[];
const contacts = contactsData as ProjectContact[];
const connections = connectionsData as MutualConnection[];
const caseStudies = caseStudiesData as CaseStudy[];
const icpConfig = icpConfigData as ICPConfig;

function findContact(id: string): ProjectContact {
  return contacts.find((c) => c.id === id)!;
}

function findCaseStudy(id: string): CaseStudy {
  return caseStudies.find((cs) => cs.id === id)!;
}

function findConnectionForContact(contactId: string): MutualConnection | null {
  return connections.find((conn) => conn.canIntroTo.includes(contactId)) ?? null;
}

function enrichProspect(project: DodgeProject): EnrichedProspect {
  return {
    project,
    contact: findContact(project.primaryContactId),
    connection: findConnectionForContact(project.primaryContactId),
    caseStudy: findCaseStudy(project.relevantCaseStudyId),
  };
}

// ─── Top 3 (hardcoded order for demo) ────────────────────────────────────────

const TOP_3_IDS = ['proj-001', 'proj-002', 'proj-003'];

function getTop3(): EnrichedProspect[] {
  return TOP_3_IDS.map((id) => {
    const project = projects.find((p) => p.id === id)!;
    return enrichProspect(project);
  });
}

// ─── Hardcoded Outreach Email (from spec) ────────────────────────────────────

function buildOutreachForHudson(prospect: EnrichedProspect): OutreachResponse {
  const body = `Hi Sarah,

Congrats on the 3 Hudson Boulevard kickoff — what a landmark project for Midtown West. 56 floors of Class A office is no small feat.

Having supported Tishman on several towers, I know the MEP coordination complexity you're facing, especially across 18 floors with 12 different mechanical trades. Hidden conditions behind drywall become expensive surprises.

We recently helped Brookfield on Manhattan West avoid $127K in MEP rework using our Exact-Built® documentation — capturing every installation before walls close. Mike Rodriguez at Turner suggested I reach out; he mentioned you're always looking for ways to de-risk coordination.

Would a 15-minute call next week work to show you how this applies to 3 Hudson? I can share the Manhattan West case study.`;

  const signature = `Best,
Mel Wallace
Director of Sales | Hexagon Multivista
mel.wallace@hexagon.com | Book time: calendly.com/melwallace`;

  return {
    prospect,
    email: {
      to: 'sarah.chen@tishman.com',
      subject: 'MEP Documentation for 3 Hudson Boulevard',
      preheader: 'How we saved Brookfield $127K on Manhattan West',
      body,
      signature,
    },
    stats: {
      wordCount: 142,
      readingTime: '35 sec',
      personalizationScore: 94,
    },
  };
}

function buildOutreachForPennStation(prospect: EnrichedProspect): OutreachResponse {
  const body = `Hi James,

The Penn Station Redevelopment is one of the most ambitious transit projects New York has seen in decades. Managing documentation across MTA, Amtrak, and Empire State Development is no small challenge.

With three owners come three sets of reporting requirements — and three opportunities for documentation gaps to create disputes. We helped Related Companies solve exactly this problem at Hudson Yards with a stakeholder portal that gave each owner real-time 360° documentation access.

I noticed you've been researching forensic documentation approaches — our team has deep experience with multi-stakeholder transit projects, including LaGuardia Terminal B with Skanska.

Could we schedule a brief call to discuss how this applies to Penn Station? I'd love to share the Hudson Yards stakeholder portal case study.`;

  const signature = `Best,
Mel Wallace
Director of Sales | Hexagon Multivista
mel.wallace@hexagon.com | Book time: calendly.com/melwallace`;

  return {
    prospect,
    email: {
      to: 'james.obrien@skanska.com',
      subject: '360° Documentation for Penn Station Redevelopment',
      preheader: 'How Hudson Yards solved multi-stakeholder documentation',
      body,
      signature,
    },
    stats: {
      wordCount: 148,
      readingTime: '37 sec',
      personalizationScore: 89,
    },
  };
}

function buildOutreachForOneMadison(prospect: EnrichedProspect): OutreachResponse {
  const body = `Hi David,

Great to reconnect — I've been following One Madison Tower's progress. 62 floors of luxury residential with KPF designing is going to be stunning.

With high-end residential, the biggest risk isn't construction delays — it's post-closing disputes over finish quality. We saw this play out at 432 Park, where forensic documentation of every unit's installed finishes provided definitive evidence that resolved $12M in owner claims.

At Month 6, you're approaching the window where finish installations start and change order disputes spike. Pre-documenting conditions now protects Turner from costly claims later.

Since we connected at ENR last year, I've been meaning to share the 432 Park case study. Would a quick 15-minute call work next week?`;

  const signature = `Best,
Mel Wallace
Director of Sales | Hexagon Multivista
mel.wallace@hexagon.com | Book time: calendly.com/melwallace`;

  return {
    prospect,
    email: {
      to: 'david.park@tcco.com',
      subject: 'Forensic Documentation for One Madison Tower',
      preheader: 'How 432 Park resolved $12M in finish disputes',
      body,
      signature,
    },
    stats: {
      wordCount: 151,
      readingTime: '38 sec',
      personalizationScore: 91,
    },
  };
}

// ─── Hardcoded Win Probability (from spec) ───────────────────────────────────

function buildWinProbForHudson(prospect: EnrichedProspect): WinProbabilityResponse {
  return {
    prospect,
    probability: 73,
    positiveFactors: [
      {
        label: 'Warm intro via Mike Rodriguez',
        impact: '+25%',
        explanation: 'Your close rate is 3.2x higher with warm intros',
        positive: true,
      },
      {
        label: 'Similar past win (Brookfield Manhattan West)',
        impact: '+20%',
        explanation: 'Same GC (Tishman), same service (MEP Exact-Built\u00AE)',
        positive: true,
      },
      {
        label: 'Optimal timing (Month 2 of construction)',
        impact: '+15%',
        explanation: 'MEP rough-in starts Month 3 \u2014 perfect entry window',
        positive: true,
      },
      {
        label: 'Decision maker identified (Sarah = Project Exec)',
        impact: '+13%',
        explanation: 'Budget authority confirmed via org chart',
        positive: true,
      },
    ],
    riskFactors: [
      {
        label: 'Incumbent unknown',
        impact: '-10%',
        explanation: 'No intel on current documentation vendor',
        positive: false,
      },
      {
        label: 'No prior Tishman corporate relationship',
        impact: '-5%',
        explanation: 'Win was via Brookfield, not Tishman direct',
        positive: false,
      },
    ],
    recommendation: {
      summary:
        'Lead with the Mike Rodriguez intro \u2014 your historical data shows 68% close rate with his referrals vs. 21% cold outreach.',
      nextSteps: [
        'Ask Mike Rodriguez for a warm intro to Sarah Chen this week',
        'Offer an on-site demo within 2 weeks to establish presence before incumbent can respond',
        'Bring the Manhattan West case study binder showing the actual $127K rework avoided',
      ],
      timeline:
        'MEP rough-in starts Month 3. You have 4 weeks to close before they\'re committed to a documentation workflow.',
    },
  };
}

function buildWinProbForPennStation(prospect: EnrichedProspect): WinProbabilityResponse {
  return {
    prospect,
    probability: 61,
    positiveFactors: [
      {
        label: 'Engagement history (whitepaper 3x)',
        impact: '+12%',
        explanation: 'Active interest in forensic documentation solutions',
        positive: true,
      },
      {
        label: 'Similar past win (Hudson Yards stakeholder portal)',
        impact: '+20%',
        explanation: 'Multi-stakeholder documentation expertise proven',
        positive: true,
      },
      {
        label: 'Optimal timing (Design phase)',
        impact: '+15%',
        explanation: 'Documentation spec can be written into bid requirements',
        positive: true,
      },
      {
        label: 'GC relationship (Skanska via LaGuardia)',
        impact: '+7%',
        explanation: 'Existing Skanska relationship through aviation projects',
        positive: true,
      },
    ],
    riskFactors: [
      {
        label: 'Public procurement complexity',
        impact: '-8%',
        explanation: 'MTA/ESD procurement rules may require formal RFP process',
        positive: false,
      },
      {
        label: 'Not LinkedIn connected',
        impact: '-5%',
        explanation: 'Cold outreach required \u2014 lower response rate expected',
        positive: false,
      },
    ],
    recommendation: {
      summary:
        'Leverage the whitepaper engagement as an opener \u2014 O\'Brien has downloaded the forensic documentation guide 3 times, indicating active evaluation.',
      nextSteps: [
        'Reference his whitepaper downloads in outreach as a personalization hook',
        'Position Multivista as design-phase documentation consultant, not just construction vendor',
        'Request a meeting to present the Hudson Yards stakeholder portal case study',
      ],
      timeline:
        'Design phase gives you 6+ months before construction starts. Build the relationship now to be spec\'d into bid documents.',
    },
  };
}

function buildWinProbForOneMadison(prospect: EnrichedProspect): WinProbabilityResponse {
  return {
    prospect,
    probability: 58,
    positiveFactors: [
      {
        label: 'LinkedIn 1st degree (David Park)',
        impact: '+10%',
        explanation: 'Direct outreach will get a response',
        positive: true,
      },
      {
        label: 'Prior meeting (ENR Awards 2025)',
        impact: '+12%',
        explanation: 'Personal rapport already established',
        positive: true,
      },
      {
        label: 'Similar past win (432 Park Avenue)',
        impact: '+20%',
        explanation: 'Identical use case \u2014 luxury residential finish disputes',
        positive: true,
      },
      {
        label: 'Strong Turner relationship',
        impact: '+7%',
        explanation: 'Multiple prior projects with Turner via Mike Rodriguez',
        positive: true,
      },
    ],
    riskFactors: [
      {
        label: 'Late timing (Month 6)',
        impact: '-8%',
        explanation: 'Finishes starting soon \u2014 narrower documentation window',
        positive: false,
      },
      {
        label: 'No budget authority (Sr PM, not PE)',
        impact: '-5%',
        explanation: 'David Park may need to escalate for budget approval',
        positive: false,
      },
      {
        label: 'Incumbent possible',
        impact: '-7%',
        explanation: 'Month 6 \u2014 Turner may already have documentation vendor',
        positive: false,
      },
    ],
    recommendation: {
      summary:
        'Leverage the personal connection from ENR Awards \u2014 David asked to reconnect in Q1. This is a warm follow-up, not a cold outreach.',
      nextSteps: [
        'Send a personal follow-up referencing your ENR conversation',
        'Ask Mike Rodriguez to reinforce the intro internally at Turner',
        'Offer a site visit to demonstrate forensic documentation on active floors',
      ],
      timeline:
        'Finish installations start Month 7-8. You have 4-6 weeks to close before the documentation window narrows significantly.',
    },
  };
}

// ─── DemoEngine Class ────────────────────────────────────────────────────────

export class DemoEngine {
  private top3: EnrichedProspect[];

  constructor() {
    this.top3 = getTop3();
  }

  getICPConfig(): ICPConfig {
    return icpConfig;
  }

  getAllProjects(): DodgeProject[] {
    return projects;
  }

  getTop3Prospects(): EnrichedProspect[] {
    return this.top3;
  }

  async queryProspects(_query: string): Promise<ProspectQueryResponse> {
    await simulateDelay(1000, 1200);
    return {
      totalMatches: projects.length,
      topProspects: this.top3,
    };
  }

  async generateOutreach(prospectIndex: number): Promise<OutreachResponse> {
    await simulateDelay(800, 1000);
    const prospect = this.top3[prospectIndex] ?? this.top3[0];
    switch (prospect.project.id) {
      case 'proj-002':
        return buildOutreachForPennStation(prospect);
      case 'proj-003':
        return buildOutreachForOneMadison(prospect);
      default:
        return buildOutreachForHudson(prospect);
    }
  }

  async scoreWinProbability(prospectIndex: number): Promise<WinProbabilityResponse> {
    await simulateDelay(800, 1000);
    const prospect = this.top3[prospectIndex] ?? this.top3[0];
    switch (prospect.project.id) {
      case 'proj-002':
        return buildWinProbForPennStation(prospect);
      case 'proj-003':
        return buildWinProbForOneMadison(prospect);
      default:
        return buildWinProbForHudson(prospect);
    }
  }

  reset(): void {
    this.top3 = getTop3();
  }
}

export const demoEngine = new DemoEngine();
