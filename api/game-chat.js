// Vercel serverless function for game chat
// Uses Vercel AI Gateway with string model names
// Implements Socratic game master moderator

// CRITICAL: Set AI_GATEWAY_API_KEY before requiring 'ai' SDK
// The SDK reads this at initialization time
// Prefer GAME_INTELLIGENCE if it exists and is a valid key (starts with vck_)
// Otherwise use AI_GATEWAY_API_KEY if it's a valid key
const gatewayKey = process.env.GAME_INTELLIGENCE || process.env.AI_GATEWAY_API_KEY;
if (gatewayKey && gatewayKey.startsWith('vck_')) {
  process.env.AI_GATEWAY_API_KEY = gatewayKey;
} else if (process.env.GAME_INTELLIGENCE && process.env.GAME_INTELLIGENCE.startsWith('vck_')) {
  process.env.AI_GATEWAY_API_KEY = process.env.GAME_INTELLIGENCE;
}

const { streamText } = require('ai');
const fs = require('fs');
const path = require('path');

// Load internal thoughts for context
function loadInternalThoughts() {
  try {
    const thoughtsPath = path.join(process.cwd(), 'internal_thought.md');
    if (fs.existsSync(thoughtsPath)) {
      return fs.readFileSync(thoughtsPath, 'utf8');
    }
  } catch (error) {
    console.warn('Could not load internal_thought.md:', error.message);
  }
  return '';
}

const INTERNAL_THOUGHTS = loadInternalThoughts();

// Base system prompt for ongoing Socratic dialogue
const SYSTEM_PROMPT = `You are a Socratic game master moderator at the Valley of the Commons.

ROLE:
- Ask ONE brief, open-ended question (1-2 sentences MAX)
- NEVER provide answers, definitions, or solutions
- If asked for a definition, respond with a question about meaning or context
- Build on previous exchanges
- Keep responses SHORT and terminal-friendly

CONTEXT: "Valley of the Commons" is a decade-long game becoming a real village. Participants can propose tools, add rules, name places, create quests, document paths, bind myth to reality.

DESIGN PRINCIPLES (reference subtly, never lecture):
- Game as instrument for generating new operations
- Physical-digital bridge: map, cards, projections
- Community-driven: people mark places, add quests, surface tools
- Ritualistic elements: mix of mythology and real life
- Out of the box thinking: generate unconventional approaches
- Commonalization: game becomes shared resource

${INTERNAL_THOUGHTS ? `\nINTERNAL NOTES (inform questions, help participants discover):\n${INTERNAL_THOUGHTS}\n` : ''}

CRITICAL: Be BRIEF. One question per response. Maximum 2 sentences. Probe, don't lecture.`;

// Context-setting prompt for first response
const FIRST_RESPONSE_PROMPT = `You are a game master moderator welcoming someone to the Valley of the Commons.

This is the FIRST response after the user agreed to help create a game that shapes reality.

TASK:
- Brief context-setting (2-3 sentences) introducing the Valley
- Use internal notes to paint what this game-village is becoming
- End with ONE open-ended question inviting exploration
- Do NOT respond to "yes" or "sure" - set context instead

CONTEXT: "Valley of the Commons" is a decade-long game becoming a real village in the Austrian Alps. Participants can propose tools, add rules, name places, create quests, document paths, bind myth to reality.

${INTERNAL_THOUGHTS ? `\nINTERNAL NOTES (inform context and question):\n${INTERNAL_THOUGHTS}\n` : ''}

CRITICAL: Be BRIEF. Maximum 3-4 sentences total. One question at the end.`;

module.exports = async function handler(req, res) {
  console.log('[game-chat] Request received:', req.method, req.url);
  
  // Only allow POST requests
  if (req.method !== 'POST') {
    console.log('[game-chat] Method not allowed:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // No CORS headers needed (same-origin only)
  // If cross-origin needed later, restrict to specific domains

  try {
    const { messages } = req.body;
    console.log('[game-chat] Messages received:', messages?.length || 0);
    if (messages && messages.length > 0) {
      console.log('[game-chat] First message:', {
        role: messages[0]?.role,
        content: messages[0]?.content?.substring(0, 100),
      });
      if (messages.length > 1) {
        console.log('[game-chat] Last message:', {
          role: messages[messages.length - 1]?.role,
          content: messages[messages.length - 1]?.content?.substring(0, 100),
        });
      }
    }

    // Validate input
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid request format' });
    }

    // Sanitize and whitelist roles (CRITICAL: prevent system injection)
    const sanitizedMessages = messages
      .filter(msg => msg && typeof msg.content === 'string')
      .map(msg => {
        // Whitelist: only 'user' or 'assistant' roles allowed
        const role = msg.role === 'assistant' ? 'assistant' : 'user';
        return {
          role: role,
          content: msg.content.slice(0, 500), // Max 500 chars per message
        };
      })
      .filter(msg => msg.content.length > 0); // Drop empty messages
    
    console.log('[game-chat] Sanitized messages:', sanitizedMessages.length);
    if (sanitizedMessages.length > 0) {
      console.log('[game-chat] Sanitized first message:', {
        role: sanitizedMessages[0]?.role,
        content: sanitizedMessages[0]?.content?.substring(0, 100),
      });
    }

    // Count user turns server-side (prevent gaming)
    const userTurns = sanitizedMessages.filter(m => m.role === 'user').length;
    if (userTurns > 12) {
      return res.status(429).json({ 
        error: 'Conversation limit reached. Please start a new session.' 
      });
    }

    // Detect if this is the first user response (context-setting phase)
    const isFirstResponse = userTurns === 1 && sanitizedMessages.length === 1;

    // Get API key (support both GAME_INTELLIGENCE and AI_GATEWAY_API_KEY)
    // Vercel AI SDK automatically reads AI_GATEWAY_API_KEY from environment
    // If GAME_INTELLIGENCE is set, use it as the API key
    const apiKey = process.env.GAME_INTELLIGENCE || process.env.AI_GATEWAY_API_KEY;
    console.log('[game-chat] API key check:', {
      hasGAME_INTELLIGENCE: !!process.env.GAME_INTELLIGENCE,
      hasAI_GATEWAY_API_KEY: !!process.env.AI_GATEWAY_API_KEY,
      hasApiKey: !!apiKey,
      apiKeyPrefix: apiKey ? apiKey.substring(0, 15) + '...' : 'none',
    });
    
    if (!apiKey) {
      console.error('[game-chat] Missing GAME_INTELLIGENCE or AI_GATEWAY_API_KEY');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Ensure AI_GATEWAY_API_KEY is set for AI SDK (supports GAME_INTELLIGENCE alias)
    // AI SDK reads AI_GATEWAY_API_KEY automatically when using string model names
    // Must be set before streamText is called
    if (!process.env.AI_GATEWAY_API_KEY) {
      process.env.AI_GATEWAY_API_KEY = apiKey;
    }

    // Model selection - use string format for Vercel AI Gateway
    // String format "provider/model" automatically routes through AI Gateway
    // CRITICAL: AI_GATEWAY_API_KEY must be set in environment for this to work
    const modelName = process.env.GAME_MODEL || 'mistral/devstral-2';
    // Examples:
    // - "mistral/devstral-2" (current - free tier)
    // - "mistral/ministral-3b" (cost-effective)
    // - "mistral/mistral-large-latest"
    // - "anthropic/claude-3-5-sonnet-20241022"

    console.log('[game-chat] Calling AI Gateway with string model:', modelName);
    console.log('[game-chat] Message count:', sanitizedMessages.length);
    console.log('[game-chat] AI_GATEWAY_API_KEY set:', !!process.env.AI_GATEWAY_API_KEY);
    
    try {
      // Use string model name - SDK automatically routes through AI Gateway
      // when it sees the "provider/model" format and AI_GATEWAY_API_KEY is set
      
      // Choose prompt based on whether this is the first response
      const activePrompt = isFirstResponse ? FIRST_RESPONSE_PROMPT : SYSTEM_PROMPT;
      console.log('[game-chat] Creating streamText with model:', modelName);
      console.log('[game-chat] Using prompt type:', isFirstResponse ? 'FIRST_RESPONSE' : 'SOCRATIC');
      
      const result = streamText({
        model: modelName, // String format routes through Gateway
        system: activePrompt, // System prompt (NOT in messages array)
        messages: sanitizedMessages, // Only user/assistant messages
        maxTokens: isFirstResponse ? 120 : 80, // Enforce brevity
        temperature: 0.7,
      });

      console.log('[game-chat] StreamText result created');
      
      // Set headers for streaming text response
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Transfer-Encoding', 'chunked');
      
      // Stream text chunks directly to client
      console.log('[game-chat] Starting to stream text to client');
      try {
        for await (const textPart of result.textStream) {
          res.write(textPart);
        }
        res.end();
        console.log('[game-chat] Stream completed and sent to client');
      } catch (streamError) {
        console.error('[game-chat] Error during streaming:', streamError.message);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Stream error' });
        } else {
          res.end();
        }
      }
    } catch (streamError) {
      console.error('[game-chat] Error in streamText call:', {
        message: streamError.message,
        stack: streamError.stack,
      });
      throw streamError;
    }

  } catch (error) {
    console.error('AI Gateway error:', {
      message: error.message,
      stack: error.stack,
      model: modelName,
      hasApiKey: !!apiKey,
      apiKeyPrefix: apiKey ? apiKey.substring(0, 10) : 'none',
    });
    
    // Return more detailed error in development
    const isDev = process.env.NODE_ENV !== 'production';
    return res.status(500).json({ 
      error: isDev 
        ? `AI Gateway error: ${error.message}` 
        : 'AI service temporarily unavailable. Please try again.',
      ...(isDev && { details: error.stack })
    });
  }
};

