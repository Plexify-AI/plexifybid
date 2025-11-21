// Quick test to verify Claude API key is working
// Run this with: node test-claude-api.js

import dotenv from 'dotenv';
import fetch from 'node-fetch';

// Load environment variables
dotenv.config();

const apiKey = process.env.VITE_ANTHROPIC_API_KEY;

console.log('🔧 Testing Claude API Connection...');
console.log('✓ API Key exists:', !!apiKey);
console.log('✓ API Key format valid:', apiKey?.startsWith('sk-ant-'));

if (!apiKey || !apiKey.startsWith('sk-ant-')) {
  console.error('❌ Invalid API key configuration');
  process.exit(1);
}

const testTranscript = "Today is sunny, we have 8 workers on site, completed concrete pour, no delays";

const requestBody = {
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 500,
  temperature: 0.3,
  messages: [{
    role: 'user',
    content: `Transform this construction transcript into a professional report: "${testTranscript}"`
  }]
};

console.log('📡 Making Claude API request...');

try {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(requestBody)
  });

  console.log('📡 Response Status:', response.status);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ API Error:', errorText);
    process.exit(1);
  }

  const data = await response.json();
  console.log('✅ Claude API Success!');
  console.log('📄 Enhanced Report:');
  console.log(data.content[0].text);

} catch (error) {
  console.error('❌ Network Error:', error.message);
  if (error.message.includes('fetch')) {
    console.log('💡 This might be a CORS issue in the browser - the API key itself appears valid');
  }
}