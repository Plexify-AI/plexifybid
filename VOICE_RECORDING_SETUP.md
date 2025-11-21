# Voice Recording Setup Guide

## Quick Setup (Required for Voice Recording)

### 1. Create API Key Environment File

Copy the example environment file and add your Claude API key:

```bash
# Copy the example file
cp .env.example .env
```

Then edit `.env` and replace `your_api_key_here` with your actual Claude API key:

```bash
# Get your API key from: https://console.anthropic.com/
VITE_ANTHROPIC_API_KEY=sk-ant-api03-your-actual-key-here
```

### 2. Restart Development Server

After adding your API key, restart the development server:

```bash
npm run dev
```

## Testing Voice Recording

### 1. Navigate to Field View
- Go to: `http://localhost:3001/field`
- Or click the blue "Field Report" button in the Executive Feed

### 2. Grant Microphone Permission
- Select a project from the dropdown
- Click the large red microphone button
- Allow microphone access when prompted by browser

### 3. Record Your Report (30-60 seconds)
- Speak clearly about:
  - Weather conditions
  - Work completed today
  - Crew size and manpower
  - Any issues or delays
  - Safety observations
  - Tomorrow's planned work

### 4. Watch the Magic Happen
- Live transcript appears as you speak
- Stop recording when finished
- AI processes and enhances your transcript
- Professional report is generated
- Submit to Executive Feed

## Complete Flow Example

```
1. Select "Memorial Regional Medical Center"
2. Click record button → Allow microphone access
3. Speak: "Today is sunny, 75 degrees. We have 12 workers on site. We completed the concrete pour for the north foundation, about 500 cubic yards. The concrete truck was 1 hour late which delayed our start. No safety incidents. Tomorrow we'll start the steel erection for the second floor."
4. Click "Stop Recording"
5. Watch AI processing (15-30 seconds)
6. Review enhanced professional report
7. Click "Submit to Executive Feed"
8. See report appear in main dashboard
```

## Browser Requirements

- **Chrome** (Recommended) - Full support for voice recording and speech recognition
- **Edge** - Good support
- **Safari** - Basic support
- **Firefox** - Limited speech recognition support

## Troubleshooting

### Microphone Not Working
- Check browser permissions: `chrome://settings/content/microphone`
- Ensure you're using HTTPS or localhost
- Try refreshing the page
- Use a different browser (preferably Chrome)

### No Transcript Appearing
- Speak louder and more clearly
- Check console for errors (F12)
- Ensure stable internet connection
- Verify Web Speech API support

### Claude API Errors
- Verify API key is correctly set in `.env`
- Check API key has necessary permissions
- Monitor rate limits
- Check network connectivity

### Report Not Appearing in Executive Feed
- Check browser console for storage errors
- Verify localStorage is enabled
- Try refreshing the Executive Feed page

## Security Notes

- Never commit your `.env` file to version control
- API key is only used client-side (not recommended for production)
- For production, implement proper API key management on backend
- Rotate API keys regularly

## What's Working

✅ Real audio recording with MediaRecorder API  
✅ Live speech-to-text transcription  
✅ Claude AI report enhancement  
✅ localStorage persistence  
✅ Executive Feed integration  
✅ Comprehensive error handling  
✅ Mobile-responsive design  
✅ Professional report generation  

## Next Steps

- Test with different project types
- Experiment with various speaking styles
- Try different recording durations
- Test error scenarios (no mic, no network, etc.)
- Verify reports appear correctly in Executive Feed

The voice recording system is now fully functional and ready for field use!