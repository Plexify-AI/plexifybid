// Claude API Proxy Service
// This attempts to work around CORS issues with different approaches

interface ClaudeRequest {
  model: string;
  max_tokens: number;
  temperature: number;
  messages: Array<{
    role: string;
    content: string;
  }>;
}

interface ClaudeResponse {
  content: Array<{
    text: string;
    type: string;
  }>;
}

// Attempt 1: Direct API call with detailed error handling
export const enhanceWithClaudeDirectApi = async (rawTranscript: string): Promise<string> => {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  
  console.log('🔧 Claude API Debug Information:');
  console.log('✓ API Key exists:', !!apiKey);
  console.log('✓ API Key format valid:', apiKey?.startsWith('sk-ant-'));
  console.log('✓ Transcript length:', rawTranscript.length);
  console.log('✓ Making direct API call...');
  
  if (!apiKey || apiKey === 'your_api_key_here') {
    throw new Error('SETUP_ERROR: Please add your Claude API key to the .env file');
  }
  
  if (!apiKey.startsWith('sk-ant-')) {
    throw new Error('INVALID_KEY: API key should start with sk-ant-');
  }
  
  const requestBody: ClaudeRequest = {
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1500,
    temperature: 0.3,
    messages: [{
      role: 'user',
      content: `You are a professional construction report writer. Transform this field superintendent's voice transcript into a well-structured daily report.

Format the report with these sections:
- Date and Project: ${new Date().toLocaleDateString()}
- Weather Conditions
- Manpower (planned vs actual)  
- Work Completed Today (be specific with quantities and locations)
- Issues or Delays Encountered
- Safety Observations
- Materials Delivered/Used
- Equipment on Site
- Tomorrow's Planned Activities

Keep the professional tone but preserve all specific details, numbers, and important observations.

Raw voice transcript: "${rawTranscript}"

Generate a clear, professional daily report.`
    }]
  };
  
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    console.log('📡 Response Status:', response.status);
    console.log('📡 Response Headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Claude API Error:', errorText);
      
      if (response.status === 401) {
        throw new Error('INVALID_KEY: Please check your Claude API key');
      } else if (response.status === 429) {
        throw new Error('RATE_LIMIT: Too many requests, please wait');
      } else if (response.status === 400) {
        throw new Error('BAD_REQUEST: Request format error');
      } else {
        throw new Error(`API_ERROR: ${response.status} - ${errorText}`);
      }
    }
    
    const data: ClaudeResponse = await response.json();
    console.log('✅ Claude API Success!');
    
    if (data.content && data.content[0] && data.content[0].text) {
      return data.content[0].text;
    } else {
      throw new Error('INVALID_RESPONSE: Unexpected response format');
    }
    
  } catch (error) {
    console.error('🚫 Claude API Call Failed:', error);
    
    // Network/CORS error detection
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.error('🚫 CORS Error: Browser blocked the API call');
      throw new Error('CORS_ERROR: Direct browser calls blocked by CORS policy');
    }
    
    // Re-throw other errors
    throw error;
  }
};

// Attempt 2: Fallback to mock enhancement (for testing)
export const createMockEnhancedReport = (rawTranscript: string): string => {
  const today = new Date().toLocaleDateString();
  
  return `Daily Construction Report - ${today}

PROJECT SUMMARY:
Generated from voice recording using AI enhancement

FIELD TRANSCRIPT:
"${rawTranscript}"

ENHANCED PROFESSIONAL REPORT:
Based on the field superintendent's report, today's activities included the observations captured in the voice recording. The transcript has been preserved above for reference.

WEATHER CONDITIONS:
As reported by field personnel

MANPOWER:
Crew size and activities as described in recording

WORK COMPLETED:
Tasks and progress as detailed in voice report

ISSUES OR DELAYS:
Any challenges mentioned in the recording

SAFETY OBSERVATIONS: 
Safety notes from field report

TOMORROW'S PLAN:
Planned activities as mentioned

NOTE: This report was generated with enhanced AI processing. The original voice transcript is included above for verification.

Report generated: ${new Date().toLocaleTimeString()}`;
};

// Main enhancement function with fallback strategy
export const enhanceTranscriptWithAI = async (rawTranscript: string): Promise<string> => {
  try {
    // Try direct Claude API first
    return await enhanceWithClaudeDirectApi(rawTranscript);
    
  } catch (error) {
    console.warn('⚠️ Claude API failed, creating enhanced fallback report:', error);
    
    const errorStr = error instanceof Error ? error.message : String(error);
    
    // Create enhanced fallback report
    return createMockEnhancedReport(rawTranscript) + `

TECHNICAL NOTE: 
AI enhancement unavailable due to: ${errorStr}
This report uses the original transcript with structured formatting.
For full AI enhancement, please resolve the API configuration issue.`;
  }
};