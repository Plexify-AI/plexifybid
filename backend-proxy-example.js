// Simple Express.js backend proxy for Claude API
// This resolves CORS issues by making API calls from server-side

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for frontend
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3002']
}));

app.use(express.json());

// Claude API proxy endpoint
app.post('/api/enhance-transcript', async (req, res) => {
  try {
    const { transcript } = req.body;
    
    if (!transcript) {
      return res.status(400).json({ error: 'Transcript is required' });
    }
    
    const apiKey = process.env.VITE_ANTHROPIC_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ error: 'API key not configured' });
    }
    
    console.log('📡 Proxying request to Claude API...');
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1500,
        temperature: 0.3,
        messages: [{
          role: 'user',
          content: `Transform this construction transcript into a professional daily report:

Format with these sections:
- Date and Project: ${new Date().toLocaleDateString()}
- Weather Conditions
- Manpower (planned vs actual)
- Work Completed Today (be specific with quantities and locations)
- Issues or Delays Encountered
- Safety Observations
- Materials Delivered/Used
- Equipment on Site
- Tomorrow's Planned Activities

Raw transcript: "${transcript}"

Generate a clear, professional daily report.`
        }]
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Claude API error:', response.status, errorText);
      return res.status(response.status).json({ error: errorText });
    }
    
    const data = await response.json();
    console.log('✅ Claude API success via proxy');
    
    res.json({
      enhancedReport: data.content[0].text,
      success: true
    });
    
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ 
      error: 'Failed to enhance transcript',
      details: error.message 
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Claude proxy server running on http://localhost:${PORT}`);
  console.log(`🔧 Health check: http://localhost:${PORT}/api/health`);
});

// Instructions to run:
// 1. npm install express cors node-fetch dotenv
// 2. node backend-proxy-example.js
// 3. Update frontend to call http://localhost:3001/api/enhance-transcript