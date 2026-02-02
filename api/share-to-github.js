// Vercel serverless function to share conversation excerpts to GitHub
// Creates files directly in the repository (NOT issues) using GitHub API
// Uses GITHUB_TOKEN (github.com/vrnvrn account) to create files in:
//   - build_game/ideas/ for selected excerpts
//   - build_game/conversations/ for full chat history

const { Octokit } = require('@octokit/rest');

// Generate idea file template
function generateIdeaTemplate(excerpt, context) {
  const timestamp = new Date().toISOString();
  const date = new Date().toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });

  return `# Idea: [Auto-generated from conversation]

**Source:** Valley of the Commons Game Master Dialogue  
**Date:** ${date}  
**Excerpt:**

${excerpt}

---

**Context:** This idea emerged from a Socratic dialogue about game design in the Valley of the Commons.

**Next Steps:**
- [ ] Refine this idea
- [ ] Connect to other ideas
- [ ] Propose as a tool/rule/quest

---

*Generated from game master conversation*`;
}

// Generate unique filename based on timestamp
function generateFilename(isFullChat = false) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  
  const prefix = isFullChat ? 'conversation' : 'idea';
  return `${prefix}-${year}-${month}-${day}-${hours}${minutes}${seconds}.md`;
}

module.exports = async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('[share-to-github] Request received:', {
    method: req.method,
    hasBody: !!req.body,
    bodyKeys: req.body ? Object.keys(req.body) : [],
  });

  try {
    const { content, excerpt, context, isFullChat } = req.body;
    
    console.log('[share-to-github] Request data:', {
      hasContent: !!content,
      contentLength: content ? content.length : 0,
      hasExcerpt: !!excerpt,
      isFullChat: isFullChat,
    });

    // Prefer full content if provided, otherwise use excerpt for backwards compatibility
    let fileContent;
    if (content && typeof content === 'string') {
      // Use provided content (already includes template + chat history)
      fileContent = content.slice(0, 50000).trim(); // Allow larger content for full chat history
      if (fileContent.length === 0) {
        return res.status(400).json({ error: 'Content cannot be empty' });
      }
    } else if (excerpt && typeof excerpt === 'string') {
      // Fallback to generating template from excerpt (backwards compatibility)
      const sanitizedExcerpt = excerpt.slice(0, 5000).trim();
      if (sanitizedExcerpt.length === 0) {
        return res.status(400).json({ error: 'Excerpt cannot be empty' });
      }
      fileContent = generateIdeaTemplate(sanitizedExcerpt, context || {});
    } else {
      return res.status(400).json({ error: 'Content or excerpt is required' });
    }

    // Get GitHub configuration
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      console.error('[share-to-github] Missing GITHUB_TOKEN');
      return res.status(500).json({ error: 'Server configuration error: Missing GitHub token' });
    }

    const owner = process.env.GITHUB_OWNER || 'understories';
    const repo = process.env.GITHUB_REPO || 'votc';
    const branch = process.env.GITHUB_BRANCH || 'main';
    
    // Determine base path: conversations directory for full chats, ideas for excerpts
    const isFullChatShare = isFullChat === true;
    const basePath = isFullChatShare 
      ? (process.env.GITHUB_CONVERSATIONS_PATH || 'build_game/conversations')
      : (process.env.GITHUB_PATH || 'build_game/ideas');

    console.log('[share-to-github] GitHub config:', {
      owner,
      repo,
      branch,
      basePath,
      isFullChatShare,
      hasToken: !!token,
      tokenPrefix: token ? token.substring(0, 10) + '...' : 'none',
    });

    // Initialize Octokit
    const octokit = new Octokit({
      auth: token,
    });

    // Generate filename and path
    const filename = generateFilename(isFullChatShare);
    const path = `${basePath}/${filename}`;

    console.log('[share-to-github] Creating file:', {
      filename,
      path,
      contentLength: fileContent.length,
    });

    // fileContent is already set above (either from content param or generated from excerpt)

    // Create file in GitHub
    const commitMessage = isFullChatShare 
      ? 'Add full conversation from game master dialogue'
      : 'Add idea from game master conversation';
    
    // Ensure content is properly encoded as base64
    // GitHub API requires base64 encoding and the string must be valid
    let base64Content;
    try {
      base64Content = Buffer.from(fileContent, 'utf8').toString('base64');
      // Validate base64 encoding
      if (!base64Content || base64Content.length === 0) {
        throw new Error('Base64 encoding resulted in empty string');
      }
    } catch (encodeError) {
      console.error('[share-to-github] Base64 encoding error:', encodeError);
      return res.status(500).json({ 
        error: 'Failed to encode content. Please try again.' 
      });
    }

    console.log('[share-to-github] Base64 content length:', base64Content.length);

    const response = await octokit.repos.createOrUpdateFileContents({
      owner: owner,
      repo: repo,
      path: path,
      message: commitMessage,
      content: base64Content,
      branch: branch,
    });

    console.log('[share-to-github] File created successfully:', {
      path: response.data.content.path,
      sha: response.data.content.sha,
    });

    // Generate GitHub URL
    const githubUrl = `https://github.com/${owner}/${repo}/blob/${branch}/${path}`;

    return res.status(200).json({
      success: true,
      url: githubUrl,
      filename: filename,
      path: path,
    });

  } catch (error) {
    console.error('[share-to-github] Error:', {
      message: error.message,
      status: error.status,
      name: error.name,
      response: error.response ? {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
      } : null,
      stack: error.stack,
    });

    // Handle specific GitHub API errors
    if (error.status === 401) {
      return res.status(500).json({ 
        error: 'Authentication error. Please contact support.' 
      });
    }

    if (error.status === 403) {
      return res.status(429).json({ 
        error: 'Rate limit exceeded. Please try again later.' 
      });
    }

    if (error.status === 404) {
      return res.status(500).json({ 
        error: 'Repository not found. Please contact support.' 
      });
    }

    if (error.status === 422) {
      return res.status(400).json({ 
        error: 'Invalid file path. Please try again.' 
      });
    }

    // Generic error
    return res.status(500).json({ 
      error: 'Failed to share to GitHub. Please try again later.' 
    });
  }
};

