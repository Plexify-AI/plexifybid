import React, { useState, useRef, useEffect } from 'react';
import { Send, FileText, Clock, TrendingUp, Building } from 'lucide-react';

interface Message {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  documents?: string[];
  confidence?: number;
}

const AskPlexiInterface: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentQuery, setCurrentQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProject] = useState('Golden Triangle BID');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize with welcome message
  useEffect(() => {
    const welcomeMessage: Message = {
      id: 'welcome',
      content: `Welcome to Ask Plexi! I'm your AI BID operations assistant. I have access to your ${selectedProject} district documents including assessments, service contracts, board reports, and budget data. What would you like to know about your district?`,
      isUser: false,
      timestamp: new Date(),
      documents: ['District Overview'],
      confidence: 100
    };
    setMessages([welcomeMessage]);
  }, [selectedProject]);

  // Mock intelligent responses based on your actual documents
  const getIntelligentResponse = (query: string): Message => {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('status') || lowerQuery.includes('progress')) {
      return {
        id: Date.now().toString(),
        content: `**Current Project Status - Downtown Office Complex**

🏗️ **Overall Progress:** 65% Complete (On Schedule)

**Key Milestones:**
• Foundation & Structure: ✅ Complete
• Building Enclosure: 🟡 65% Complete (In Progress)
• Interior Systems: 🔵 Starting Nov 2024
• Final Inspections: 📅 Target Feb 2025

**Next 30 Days:**
- Complete curtain wall installation (Floors 8-12)
- Begin HVAC rough-in on floors 1-6
- Structural steel inspection (Nov 15)

**Current Challenges:**
- Weather delays on exterior work: 3 days behind
- Steel delivery delayed by 1 week (resolved)`,
        isUser: false,
        timestamp: new Date(),
        documents: ['Construction Schedule', 'Progress Reports'],
        confidence: 92
      };
    }
    
    // Default response for other queries
    return {
      id: Date.now().toString(),
      content: `I understand you're asking about "${query}". Based on your Downtown Office Complex project documents, I can help you with:

**Available Information:**
• Contract details and financial status
• Construction progress and schedules  
• Permit and inspection status
• Architectural specifications and plans

**Try asking:**
• "What is the current project status?"
• "Show me contract details"
• "Tell me about upcoming inspections"`,
      isUser: false,
      timestamp: new Date(),
      documents: ['Project Library'],
      confidence: 85
    };
  };

  const handleSendMessage = async () => {
    if (!currentQuery.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: currentQuery,
      isUser: true,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setCurrentQuery('');
    setIsLoading(true);

    // Simulate processing time
    setTimeout(() => {
      const response = getIntelligentResponse(currentQuery);
      setMessages(prev => [...prev, response]);
      setIsLoading(false);
    }, 1500);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 bg-opacity-50 backdrop-blur-sm border-b border-gray-700 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <img 
                src="/assets/logos/Gray Plexify P-only no bkgrd.png" 
                alt="Ask Plexi" 
                className="w-8 h-8 filter brightness-0 invert"
              />
              <h1 className="text-2xl font-bold text-white">Ask Plexi</h1>
            </div>
            <div className="flex items-center space-x-2 bg-blue-600 bg-opacity-20 px-3 py-1 rounded-full border border-blue-500">
              <Building size={16} />
              <span className="text-sm">{selectedProject}</span>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-gray-300">
              <FileText size={14} />
              <span className="text-sm">5 Documents</span>
            </div>
            <div className="flex items-center space-x-2 text-gray-300">
              <TrendingUp size={14} />
              <span className="text-sm">65% Complete</span>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-6 max-w-4xl mx-auto">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-3xl p-4 rounded-2xl ${
                message.isUser 
                  ? 'bg-blue-600 text-white ml-8'
                  : 'bg-gray-800 bg-opacity-50 backdrop-blur-sm border border-gray-700 mr-8'
              }`}>
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {message.content}
                </div>
                
                {!message.isUser && message.documents && (
                  <div className="mt-3 pt-3 border-t border-gray-600">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2 text-gray-400">
                        <FileText size={12} />
                        <span>Referenced: {message.documents.join(', ')}</span>
                      </div>
                      {message.confidence && (
                        <span className="text-blue-400">
                          Confidence: {message.confidence}%
                        </span>
                      )}
                    </div>
                  </div>
                )}
                
                <div className="mt-2 flex items-center space-x-2 text-xs text-gray-400">
                  <Clock size={10} />
                  <span>{message.timestamp.toLocaleTimeString()}</span>
                </div>
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="max-w-3xl p-4 rounded-2xl bg-gray-800 bg-opacity-50 backdrop-blur-sm border border-gray-700 mr-8">
                <div className="flex items-center space-x-3">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                  </div>
                  <span className="text-gray-300 text-sm">Processing your query...</span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Quick Suggestions */}
      <div className="px-6 py-3 border-t border-gray-700">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs text-gray-400 mb-2">Try asking:</p>
          <div className="flex flex-wrap gap-2">
            {[
              "What is the current project status?",
              "Show me contract details",
              "Tell me about upcoming inspections"
            ].map((suggestion, index) => (
              <button
                key={index}
                onClick={() => setCurrentQuery(suggestion)}
                className="px-3 py-1 text-xs bg-gray-800 bg-opacity-50 border border-gray-600 rounded-full hover:bg-gray-700 hover:border-gray-500 transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Input */}
      <div className="p-6 border-t border-gray-700">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center space-x-3">
            <div className="flex-1">
              <textarea
                value={currentQuery}
                onChange={(e) => setCurrentQuery(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Ask about your project status, contracts, inspections, or specifications..."
                className="w-full px-4 py-3 bg-gray-800 bg-opacity-50 backdrop-blur-sm border border-gray-600 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 resize-none"
                rows={1}
                disabled={isLoading}
              />
            </div>
            <button
              onClick={handleSendMessage}
              disabled={!currentQuery.trim() || isLoading}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-3 rounded-xl transition-colors"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AskPlexiInterface;
