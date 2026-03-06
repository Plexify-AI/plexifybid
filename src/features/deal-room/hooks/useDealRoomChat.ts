import { useState, useCallback } from 'react';
import { useSandbox } from '../../../contexts/SandboxContext';
import type { DealRoomMessage } from '../../../types/dealRoom';
import { GOLDEN_TRIANGLE_ROOM_ID } from '../../../types/dealRoom';

// Pre-built responses for Golden Triangle demo room
const GOLDEN_TRIANGLE_RESPONSES: Record<string, string> = {
  'Generate Board Brief': `Based on the source documents, here is the Board Brief for Q1 2026:

**Financial Health:** Assessment collections are on track with the semi-annual billing cycle proceeding normally. Rate increases for FY2024 have been fully implemented — commercial at $0.19/sqft, hotels at $0.16/sqft, and residential at $163/unit. [Source: GT_Assessment_Collection_Q4_2025.txt, Chunk 0]

**Strategic Initiatives:** The Penn West Innovation District has secured grant funding and the action plan is in the implementation phase. Office retention efforts continue with a focus on broadening the tenant mix. [Source: GoldenTriangleBID_BusinessPlanFY2428.pdf, Chunk 5]

**Recommendations:**
1. Approve spring event calendar and associated budget allocation
2. Review Innovation District partnership agreements for board vote
3. Authorize boundary expansion feasibility study`,

  'Extract Assessment Trends': `Based on the assessment data, here are the key trends:

1. **Revenue Growth:** Assessment revenue has grown from $5.1M to $5.5M+ annually, driven by rate increases approved in FY2024. [Source: GT_Assessment_Collection_Q4_2025.txt, Chunk 1]

2. **Rate Structure:** Commercial rates increased to $0.19/sqft (+$0.02), hotel rates to $0.16/sqft (+$0.02), and residential to $163/unit. [Source: GoldenTriangleBID_BusinessPlanFY2428.pdf, Chunk 8]

3. **Risk Factor:** Without rate increases, cashflow projections show the BID ending FY2028 with a negative fund balance exceeding $5 million. The approved increases mitigate but don't eliminate this risk. [Source: GoldenTriangleBID_BusinessPlanFY2428.pdf, Chunk 12]

4. **Collection Rate:** Q4 2025 shows 94% on-time collection, consistent with historical averages. [Source: GT_Assessment_Collection_Q4_2025.txt, Chunk 2]`,

  'Draft OZRF Section': `Here is the draft OZRF (Opportunity Zone Reporting Framework) section:

**Census Tract Overlap:** The Golden Triangle BID boundaries overlap with designated Opportunity Zone census tracts in the DC metro area, creating dual-incentive potential for qualifying investments. [Source: GoldenTriangle2024NeighborhoodProfile.pdf, Chunk 3]

**Active QOF Investment:** Three Qualified Opportunity Funds have been identified with combined estimated investment of $45M+ in mixed-use and commercial renovation projects within or adjacent to district boundaries. [Source: GoldenTriangle2024NeighborhoodProfile.pdf, Chunk 7]

**Community Impact:**
- Job creation: 850+ positions projected
- Affordable housing: 120 units planned
- Small business support: 15 district businesses connected to OZ-funded tenant improvement programs

**Compliance:** All tracked investments meeting 90% asset test requirements. Annual reporting current through FY2025.`,
};

// Keyword-matched default response for free-form questions
function getDefaultResponse(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes('risk') || lower.includes('challenge')) {
    return `Based on the source documents, the three primary risks are:

1) **Cashflow risk** — Without rate increases, the BID ends FY2028 with a negative fund balance exceeding $5M. Rate increases have been approved but execution must be monitored. [Source: GoldenTriangleBID_BusinessPlanFY2428.pdf, Chunk 12]

2) **Office vacancy** — Post-COVID return-to-office trends remain uncertain. The BID is actively working on tenant retention and mix diversification. [Source: GoldenTriangle2024NeighborhoodProfile.pdf, Chunk 5]

3) **Innovation District execution** — The Penn West Equity initiative is ambitious and requires sustained grant funding and stakeholder alignment. [Source: GoldenTriangleBID_BusinessPlanFY2428.pdf, Chunk 15]`;
  }

  if (lower.includes('competitor') || lower.includes('competitive') || lower.includes('landscape')) {
    return `The competitive landscape in DC's BID market includes three primary comparables:

**DowntownDC BID** — Larger geographic footprint, established 1997. Higher assessment base but less innovation-focused. [Source: GoldenTriangle2024NeighborhoodProfile.pdf, Chunk 4]

**Capitol Riverfront BID** — Newer district with rapid residential growth. Competing for mixed-use development investment.

**Georgetown BID** — Historic district focus, strong retail/tourism base. Different positioning but competes for city resources.

Golden Triangle's differentiators: World's first LEED Platinum BID, strongest metro access (4 lines), White House adjacency, and Penn West Innovation District. [Source: GoldenTriangleBID_BusinessPlanFY2428.pdf, Chunk 9]`;
  }

  if (lower.includes('meeting') || lower.includes('agenda') || lower.includes('prepare')) {
    return `For the upcoming board meeting, I recommend focusing on these key agenda items:

1. **Rate Increase Implementation** — Commercial rates now at $0.19/sqft. Prepare talking points on inflation pressure and fund balance projections. [Source: GT_Assessment_Collection_Q4_2025.txt, Chunk 1]

2. **Innovation District Update** — DMPED grant progress report and Penn West Equity initiative milestones. [Source: GoldenTriangleBID_BusinessPlanFY2428.pdf, Chunk 5]

3. **COVID Recovery Metrics** — Foot traffic recovery data and office tenancy rate trends.

Key talking point: The $2,680 annual increase for a typical 134,000 sqft building is the critical number for property owner discussions.`;
  }

  return `Based on the source documents for the Golden Triangle BID:

The district covers a 44-square-block area of Washington DC's central business district, from the White House to Dupont Circle. Key facts:

- **34M sqft** of commercial office space
- **$5.5M+** in annual assessment revenue
- **LEED Platinum** certified — first BID in the world
- **Penn West Innovation District** is the flagship strategic initiative
- **$3M+** in grants secured from DC Office of Planning + DMPED

[Source: GoldenTriangleBID_BusinessPlanFY2428.pdf, Chunk 1]

What specific aspect would you like me to dig into? I can analyze risks, competitive positioning, stakeholder prep, or financial projections.`;
}

interface UseDealRoomChatReturn {
  sending: boolean;
  sendMessage: (message: string, actionChip?: string) => Promise<DealRoomMessage | null>;
  addMessage: (msg: DealRoomMessage) => void;
}

export function useDealRoomChat(
  dealRoomId: string | undefined,
  onNewMessages?: (userMsg: DealRoomMessage, aiMsg: DealRoomMessage) => void,
): UseDealRoomChatReturn {
  const { token } = useSandbox();
  const [sending, setSending] = useState(false);

  const sendMessage = useCallback(async (message: string, actionChip?: string): Promise<DealRoomMessage | null> => {
    if (!dealRoomId || !token || !message.trim()) return null;

    setSending(true);

    // Create optimistic user message
    const userMsg: DealRoomMessage = {
      id: `temp-${Date.now()}`,
      deal_room_id: dealRoomId,
      tenant_id: '',
      role: 'user',
      content: actionChip || message,
      citations: [],
      created_at: new Date().toISOString(),
    };

    try {
      // Golden Triangle demo: return pre-built responses
      if (dealRoomId === GOLDEN_TRIANGLE_ROOM_ID) {
        const responseContent = actionChip
          ? GOLDEN_TRIANGLE_RESPONSES[actionChip] || getDefaultResponse(actionChip)
          : getDefaultResponse(message);

        const aiMsg: DealRoomMessage = {
          id: `demo-${Date.now()}`,
          deal_room_id: dealRoomId,
          tenant_id: '',
          role: 'assistant',
          content: responseContent,
          citations: [],
          created_at: new Date().toISOString(),
        };

        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 800));
        onNewMessages?.(userMsg, aiMsg);
        return aiMsg;
      }

      // Real rooms: call API
      const res = await fetch(`/api/deal-rooms/${dealRoomId}/chat`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: actionChip || message }),
      });

      if (!res.ok) throw new Error('Chat failed');
      const data = await res.json();

      const aiMsg: DealRoomMessage = {
        id: `ai-${Date.now()}`,
        deal_room_id: dealRoomId,
        tenant_id: '',
        role: 'assistant',
        content: data.reply,
        citations: data.citations || [],
        created_at: new Date().toISOString(),
      };

      onNewMessages?.(userMsg, aiMsg);
      return aiMsg;
    } catch (err: any) {
      console.error('[useDealRoomChat] Send error:', err);
      return null;
    } finally {
      setSending(false);
    }
  }, [dealRoomId, token, onNewMessages]);

  const addMessage = useCallback((msg: DealRoomMessage) => {
    // No-op placeholder for external message injection
  }, []);

  return { sending, sendMessage, addMessage };
}
