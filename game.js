// Game Terminal Chat Interface
// Implements Socratic game master moderator with text streaming

document.addEventListener('DOMContentLoaded', function() {
    const input = document.getElementById('terminal-input');
    const output = document.getElementById('output');
    const cursor = document.querySelector('.cursor');
    
    // Detect mobile device
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                     (window.matchMedia && window.matchMedia('(max-width: 768px)').matches);
    
    let messageHistory = [];
    let turnCount = 0;
    const MAX_TURNS = 12;
    let selectedText = null;
    let selectedMessages = [];
    
    // Auto-focus only on desktop (not mobile to avoid immediate keyboard)
    if (!isMobile) {
        input.focus();
    }

    // Initial question is set in HTML
    // After first response, Socratic game master moderator takes over

    async function sendMessage(userInput) {
        // Check turn limit
        if (turnCount >= MAX_TURNS) {
            displayMessage('system', 'Conversation limit reached. The game master has stepped away.');
            return;
        }

        // Add user message to history
        messageHistory.push({ role: 'user', content: userInput });
        turnCount++;
        
        // Display user message
        displayMessage('user', userInput);
        
        // Show loading indicator
        showLoadingIndicator('AI is thinking...');
        
        try {
            const response = await fetch('/api/game-chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: messageHistory })
            });

            if (!response.ok) {
                const errorText = await response.text().catch(() => '');
                let error;
                try {
                    error = JSON.parse(errorText);
                } catch {
                    error = { error: errorText || `API error: ${response.status}` };
                }
                throw new Error(error.error || `API error: ${response.status}`);
            }

            // Check if response body exists
            if (!response.body) {
                console.error('[game] No response body received');
                throw new Error('No response body received');
            }

            console.log('[game] Response received, starting to read stream');
            
            // Text stream (simple: just append chunks)
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let aiMessage = '';
            
            // Create streaming message element
            const streamingElement = createStreamingMessageElement();
            console.log('[game] Streaming element created');
            
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) {
                        console.log('[game] Stream complete, received', aiMessage.length, 'characters');
                        break;
                    }
                    
                    // Decode chunk and append directly (text stream, no parsing needed)
                    const chunk = decoder.decode(value, { stream: true });
                    console.log('[game] Chunk received:', chunk.substring(0, 50), 'length:', chunk.length);
                    if (chunk) {
                        aiMessage += chunk;
                        // Update UI (typewriter effect)
                        updateStreamingMessage(streamingElement, aiMessage);
                    }
                }
            } catch (streamError) {
                console.error('[game] Stream reading error:', streamError);
                throw streamError;
            }
            
            // Finalize streaming element
            finalizeStreamingMessage(streamingElement, 'assistant', aiMessage);
            
            // Add to history
            messageHistory.push({ role: 'assistant', content: aiMessage });
            hideLoadingIndicator();
            
            // Show full chat share button if we have conversation history
            if (messageHistory.length >= 2) {
                showFullChatShareButton();
            }
            
            // Check if approaching limit
            if (turnCount >= MAX_TURNS - 2) {
                displayMessage('system', `[${MAX_TURNS - turnCount} exchanges remaining]`);
            }
            
        } catch (error) {
            displayError('Connection error. Please try again.');
            hideLoadingIndicator();
            console.error('Chat error:', error);
        }
    }

    function displayMessage(role, content) {
        const output = document.getElementById('output');
        const line = document.createElement('div');
        line.className = 'terminal-line message-line';
        line.dataset.role = role;
        line.dataset.content = content;
        
        const prompt = document.createElement('span');
        prompt.className = 'prompt';
        prompt.textContent = role === 'user' ? '>' : '$';
        prompt.style.flexShrink = '0'; // Prevent prompt from shrinking
        
        const text = document.createElement('span');
        text.className = role === 'user' ? 'user-message' : 'ai-message';
        text.textContent = content;
        
        line.appendChild(prompt);
        line.appendChild(text);
        output.appendChild(line);
        output.scrollTop = output.scrollHeight;
        
        // Add click handler for selection
        line.addEventListener('click', function() {
            selectMessage(line, role, content);
        });
    }

    function createStreamingMessageElement() {
        const output = document.getElementById('output');
        const line = document.createElement('div');
        line.className = 'terminal-line';
        line.style.display = 'flex';
        line.style.alignItems = 'flex-start';
        line.style.gap = '0.5rem';
        
        const prompt = document.createElement('span');
        prompt.className = 'prompt';
        prompt.textContent = '$';
        prompt.style.flexShrink = '0';
        
        const text = document.createElement('span');
        text.className = 'ai-message ai-message-streaming';
        text.textContent = '';
        text.style.flex = '1';
        
        line.appendChild(prompt);
        line.appendChild(text);
        output.appendChild(line);
        
        return text;
    }

    function updateStreamingMessage(element, content) {
        if (!element) {
            console.error('[game] updateStreamingMessage: element is null');
            return;
        }
        element.textContent = content;
        const output = document.getElementById('output');
        if (output) {
            output.scrollTop = output.scrollHeight;
        }
        console.log('[game] Updated streaming message, length:', content.length);
    }

    function finalizeStreamingMessage(element, role, content) {
        element.classList.remove('ai-message-streaming');
        // Add dataset attributes for message selection
        const line = element.closest('.terminal-line');
        if (line) {
            line.classList.add('message-line');
            const finalRole = role || 'assistant';
            const finalContent = content || element.textContent;
            line.dataset.role = finalRole;
            line.dataset.content = finalContent;
            // Ensure proper layout (flexbox already set in createStreamingMessageElement)
            // Add click handler for selection
            line.addEventListener('click', function() {
                selectMessage(line, finalRole, finalContent);
            });
        }
    }

    function showLoadingIndicator(message) {
        const output = document.getElementById('output');
        const indicator = document.createElement('div');
        indicator.className = 'terminal-line loading-indicator';
        indicator.id = 'loading-indicator';
        
        const prompt = document.createElement('span');
        prompt.className = 'prompt';
        prompt.textContent = '$';
        
        const text = document.createElement('span');
        text.className = 'loading-text';
        text.textContent = message;
        
        indicator.appendChild(prompt);
        indicator.appendChild(text);
        output.appendChild(indicator);
        output.scrollTop = output.scrollHeight;
    }

    function hideLoadingIndicator() {
        const indicator = document.getElementById('loading-indicator');
        if (indicator) {
            indicator.remove();
        }
    }

    function displayError(message) {
        const output = document.getElementById('output');
        const line = document.createElement('div');
        line.className = 'terminal-line error-message';
        
        const prompt = document.createElement('span');
        prompt.className = 'prompt';
        prompt.textContent = '!';
        prompt.style.color = '#ff4444';
        
        const text = document.createElement('span');
        text.className = 'error-text';
        text.textContent = message;
        text.style.color = '#ff4444';
        
        line.appendChild(prompt);
        line.appendChild(text);
        output.appendChild(line);
        output.scrollTop = output.scrollHeight;
    }

    // Handle Enter key and submit button
    function handleSubmit() {
        const userInput = input.value.trim();
        if (userInput) {
            sendMessage(userInput);
            input.value = '';
            // Only auto-focus on desktop (not mobile)
            if (!isMobile) {
                input.focus();
            }
        }
    }
    
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSubmit();
        }
    });
    
    // Submit button for mobile
    const submitButton = document.getElementById('submit-button');
    if (submitButton) {
        submitButton.addEventListener('click', handleSubmit);
    }
    
    // Keep focus on input (only on desktop, not mobile to avoid interference)
    if (!isMobile) {
        input.addEventListener('blur', function() {
            if (turnCount < MAX_TURNS) {
                input.focus();
            }
        });
    }

    // Text selection functionality
    function selectMessage(line, role, content) {
        // Clear previous selection
        clearSelection();
        
        // Select this message
        line.classList.add('selected');
        selectedText = `${role === 'user' ? '>' : '$'} ${content}`;
        selectedMessages = [{ role, content }];
        
        // Show share button
        showShareButton();
    }

    function clearSelection() {
        document.querySelectorAll('.message-line.selected').forEach(line => {
            line.classList.remove('selected');
        });
        selectedText = null;
        selectedMessages = [];
        hideShareButton();
    }

    function showShareButton() {
        // Remove existing buttons if any
        hideShareButton();
        
        const output = document.getElementById('output');
        const buttonContainer = document.createElement('div');
        buttonContainer.id = 'share-buttons-container';
        buttonContainer.className = 'share-buttons-container';
        
        // Share button (opens modal)
        const shareButton = document.createElement('button');
        shareButton.id = 'share-btn';
        shareButton.className = 'share-button share-button-default';
        shareButton.textContent = 'share on github repo';
        shareButton.addEventListener('click', () => showShareModal());
        
        buttonContainer.appendChild(shareButton);
        output.appendChild(buttonContainer);
    }

    function hideShareButton() {
        const container = document.getElementById('share-buttons-container');
        if (container) {
            container.remove();
        }
    }

    function showFullChatShareButton() {
        // Remove existing button if any
        hideFullChatShareButton();
        
        const container = document.getElementById('full-chat-share-container');
        if (!container) return;
        
        const button = document.createElement('button');
        button.id = 'full-chat-share-btn';
        button.className = 'share-button share-button-own';
        button.textContent = 'add whole chat history to github repo';
        button.addEventListener('click', () => showShareFullChatModal());
        
        container.appendChild(button);
    }

    function hideFullChatShareButton() {
        const container = document.getElementById('full-chat-share-container');
        if (container) {
            container.innerHTML = '';
        }
    }

    function generateIdeaTemplate(selectedText, selectedMessages, fullHistory) {
        const timestamp = new Date().toISOString();
        const date = new Date().toLocaleString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short'
        });

        // Extract key themes from conversation context
        const assistantMessages = fullHistory.filter(m => m.role === 'assistant').map(m => m.content);
        
        // Generate a title suggestion from selected text (first line or first 60 chars)
        const firstLine = selectedText.split('\n')[0];
        const titleSuggestion = firstLine.length > 60 
            ? firstLine.substring(0, 60).trim() + '...'
            : firstLine.trim();

        // Extract key themes from recent assistant messages
        const keyThemes = assistantMessages.length > 0 
            ? assistantMessages.slice(-3).map(msg => {
                // Extract first question or key phrase (first sentence or first 100 chars)
                const firstSentence = msg.split(/[.!?]/)[0] || msg.substring(0, 100);
                return firstSentence.trim();
            }).filter(t => t.length > 0)
            : ['Emerging from dialogue'];

        return `# Idea: ${titleSuggestion}

**Source:** Valley of the Commons Game Master Dialogue  
**Date:** ${date}  
**Selected Excerpt:**

${selectedText}

---

## Context

This idea emerged from a Socratic dialogue about game design in the Valley of the Commons.

**Key Themes:**
${keyThemes.map(theme => `- ${theme}`).join('\n')}

---

## Next Steps

- [ ] Refine this idea
- [ ] Connect to other ideas
- [ ] Propose as a tool/rule/quest/place
- [ ] Document implementation approach

---

## Full Conversation History

${formatChatHistory(fullHistory)}

---

*Generated from game master conversation*`;
    }

    function generateFullChatTemplate(fullHistory) {
        const timestamp = new Date().toISOString();
        const date = new Date().toLocaleString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short'
        });

        // Generate title from first user message or first AI response
        const firstUserMessage = fullHistory.find(m => m.role === 'user');
        const firstAIMessage = fullHistory.find(m => m.role === 'assistant');
        const titleSource = firstUserMessage?.content || firstAIMessage?.content || 'Conversation';
        const titleSuggestion = titleSource.length > 60 
            ? titleSource.substring(0, 60).trim() + '...'
            : titleSource.trim();

        // Extract key themes from assistant messages
        const assistantMessages = fullHistory.filter(m => m.role === 'assistant').map(m => m.content);
        const keyThemes = assistantMessages.length > 0 
            ? assistantMessages.slice(0, 5).map(msg => {
                const firstSentence = msg.split(/[.!?]/)[0] || msg.substring(0, 100);
                return firstSentence.trim();
            }).filter(t => t.length > 0)
            : ['Emerging from dialogue'];

        return `# Conversation: ${titleSuggestion}

**Source:** Valley of the Commons Game Master Dialogue  
**Date:** ${date}  
**Message Count:** ${fullHistory.length} exchanges

---

## Context

This is a complete Socratic dialogue about game design in the Valley of the Commons.

**Key Themes:**
${keyThemes.map(theme => `- ${theme}`).join('\n')}

---

## Full Conversation History

${formatChatHistory(fullHistory)}

---

## Next Steps

- [ ] Extract specific ideas from this conversation
- [ ] Connect themes to other conversations
- [ ] Propose tools/rules/quests/places based on insights
- [ ] Document implementation approaches

---

*Generated from complete game master conversation*`;
    }

    function formatChatHistory(history) {
        if (!history || history.length === 0) return 'No conversation history available.';
        
        return history.map((msg, index) => {
            const prefix = msg.role === 'user' ? '>' : '$';
            const roleLabel = msg.role === 'user' ? 'User' : 'Game Master';
            return `### ${roleLabel} (${index + 1})

${prefix} ${msg.content}`;
        }).join('\n\n---\n\n');
    }

    function showShareFullChatModal() {
        if (!messageHistory || messageHistory.length === 0) {
            displayError('No conversation history to share');
            return;
        }

        // Get full conversation history
        const fullHistory = messageHistory;

        // Generate template for full chat
        const template = generateFullChatTemplate(fullHistory);

        // Create modal
        const modal = document.createElement('div');
        modal.id = 'share-modal';
        modal.className = 'share-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'share-modal-title-full');
        
        modal.innerHTML = `
            <div class="share-modal-content">
                <div class="share-modal-header">
                    <h2 id="share-modal-title-full">Share Full Chat History to GitHub</h2>
                    <button class="share-modal-close" id="share-modal-close" aria-label="Close dialog">&times;</button>
                </div>
                <div class="share-modal-body">
                    <div class="share-template-section">
                        <label>Full Conversation Template (editable):</label>
                        <textarea id="share-template-editor" class="share-template-editor">${escapeHtml(template)}</textarea>
                    </div>
                    <div class="share-history-section">
                        <label>Conversation Summary:</label>
                        <div class="share-history-viewer" id="share-history-viewer">
                            <div class="terminal-line">Total messages: ${fullHistory.length}</div>
                            <div class="terminal-line">User messages: ${fullHistory.filter(m => m.role === 'user').length}</div>
                            <div class="terminal-line">AI messages: ${fullHistory.filter(m => m.role === 'assistant').length}</div>
                        </div>
                    </div>
                </div>
                <div class="share-modal-footer">
                    <button class="share-button share-button-own" id="share-modal-cancel">Cancel</button>
                    <button class="share-button share-button-default" id="share-modal-share-default">Share (directly with dev github vrnvrn)</button>
                    <button class="share-button share-button-own" id="share-modal-share-own">Share (open github in new tab)</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Focus management for accessibility
        const closeButton = document.getElementById('share-modal-close');
        
        // Focus the close button first (for keyboard navigation)
        setTimeout(() => {
            closeButton.focus();
        }, 100);

        // Event listeners
        closeButton.addEventListener('click', () => hideShareModal());
        document.getElementById('share-modal-cancel').addEventListener('click', () => hideShareModal());
        document.getElementById('share-modal-share-default').addEventListener('click', () => {
            const content = document.getElementById('share-template-editor').value;
            shareToGitHub('default', content, fullHistory, true); // Full chat, save to conversations directory
        });
        document.getElementById('share-modal-share-own').addEventListener('click', () => {
            const content = document.getElementById('share-template-editor').value;
            shareToGitHub('own', content, fullHistory, true); // Full chat, save to conversations directory
        });

        // Close on outside click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                hideShareModal();
            }
        });
        
        // Close on Escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                hideShareModal();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    }

    function showShareModal() {
        if (!selectedText || selectedMessages.length === 0) {
            displayError('No text selected');
            return;
        }

        // Get full conversation history
        const fullHistory = messageHistory;

        // Generate template
        const template = generateIdeaTemplate(selectedText, selectedMessages, fullHistory);

        // Create modal
        const modal = document.createElement('div');
        modal.id = 'share-modal';
        modal.className = 'share-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'share-modal-title-idea');
        
        modal.innerHTML = `
            <div class="share-modal-content">
                <div class="share-modal-header">
                    <h2 id="share-modal-title-idea">Share Idea to GitHub</h2>
                    <button class="share-modal-close" id="share-modal-close" aria-label="Close dialog">&times;</button>
                </div>
                <div class="share-modal-body">
                    <div class="share-template-section">
                        <label>Idea Template (editable):</label>
                        <textarea id="share-template-editor" class="share-template-editor">${escapeHtml(template)}</textarea>
                    </div>
                    <div class="share-history-section">
                        <label>Full Conversation History:</label>
                        <div class="share-history-viewer" id="share-history-viewer">
                            ${formatChatHistoryForDisplay(fullHistory)}
                        </div>
                    </div>
                </div>
                <div class="share-modal-footer">
                    <button class="share-button share-button-own" id="share-modal-cancel">Cancel</button>
                    <button class="share-button share-button-default" id="share-modal-share-default">Share (directly with dev github vrnvrn)</button>
                    <button class="share-button share-button-own" id="share-modal-share-own">Share (open github in new tab)</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Focus management for accessibility
        const closeButton = document.getElementById('share-modal-close');
        const textarea = document.getElementById('share-template-editor');
        
        // Focus the close button first (for keyboard navigation)
        setTimeout(() => {
            closeButton.focus();
        }, 100);

        // Event listeners
        closeButton.addEventListener('click', () => hideShareModal());
        document.getElementById('share-modal-cancel').addEventListener('click', () => hideShareModal());
        document.getElementById('share-modal-share-default').addEventListener('click', () => {
            const content = document.getElementById('share-template-editor').value;
            shareToGitHub('default', content, fullHistory, false); // Selected excerpt, not full chat
        });
        document.getElementById('share-modal-share-own').addEventListener('click', () => {
            const content = document.getElementById('share-template-editor').value;
            shareToGitHub('own', content, fullHistory, false); // Selected excerpt, not full chat
        });

        // Close on outside click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                hideShareModal();
            }
        });
        
        // Close on Escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                hideShareModal();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    }

    function formatChatHistoryForDisplay(history) {
        if (!history || history.length === 0) return '<div class="terminal-line">No conversation history available.</div>';
        
        return history.map((msg) => {
            const prefix = msg.role === 'user' ? '>' : '$';
            const roleClass = msg.role === 'user' ? 'user-message' : 'assistant-message';
            return `<div class="terminal-line ${roleClass}">${prefix} ${escapeHtml(msg.content)}</div>`;
        }).join('');
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function hideShareModal() {
        const modal = document.getElementById('share-modal');
        if (modal) {
            // Return focus to the element that opened the modal (if available)
            const previouslyFocused = document.activeElement;
            modal.remove();
            // Focus back to input if it was previously focused
            if (input && document.activeElement === document.body) {
                input.focus();
            }
        }
    }

    async function shareToGitHub(method, content, fullHistory, isFullChat = false) {
        if (!content) {
            displayError('No content to share');
            return;
        }

        const shareButton = document.getElementById(`share-modal-share-${method === 'default' ? 'default' : 'own'}`);
        const cancelButton = document.getElementById('share-modal-cancel');
        
        if (shareButton) {
            shareButton.disabled = true;
            shareButton.textContent = 'Sharing...';
        }
        if (cancelButton) {
            cancelButton.disabled = true;
        }

        if (method === 'own') {
            // Redirect to GitHub to create file directly with user's account
            shareWithOwnAccount(content, isFullChat);
            hideShareModal();
            return;
        }

        // Default: Use API with default account
        try {
            const response = await fetch('/api/share-to-github', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: content, // Full template with chat history
                    excerpt: selectedText, // Keep for backwards compatibility
                    isFullChat: isFullChat, // Flag to save to conversations directory
                    context: {
                        messages: selectedMessages,
                        fullHistory: fullHistory
                    }
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to share');
            }

            // Show success message
            displaySuccess(data.url, data.filename);
            
            // Clear selection and close modal
            hideShareModal();
            clearSelection();

        } catch (error) {
            displayError(`Failed to share: ${error.message}`);
            if (shareButton) {
                shareButton.disabled = false;
                shareButton.textContent = method === 'default' ? 'Share (directly with dev github vrnvrn)' : 'Share (open github in new tab)';
            }
            if (cancelButton) {
                cancelButton.disabled = false;
            }
        }
    }

    async function shareWithOwnAccount(content, isFullChat = false) {
        // Determine directory and filename based on whether it's a full chat or excerpt
        const basePath = isFullChat ? 'build_game/conversations' : 'build_game/ideas';
        const prefix = isFullChat ? 'conversation' : 'idea';
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const filename = `${prefix}-${year}-${month}-${day}-${hours}${minutes}${seconds}.md`;
        const filePath = `${basePath}/${filename}`;
        
        const owner = 'understories';
        const repo = 'votc';
        const branch = 'main';
        
        // Open GitHub's "Create new file" interface
        // This will prompt user to fork if they don't have write access
        // The filename is pre-filled, user just needs to paste content
        const createFileUrl = `https://github.com/${owner}/${repo}/new/${branch}?filename=${encodeURIComponent(filePath)}`;
        
        // Copy content to clipboard
        let clipboardSuccess = false;
        try {
            await navigator.clipboard.writeText(content);
            clipboardSuccess = true;
        } catch (clipboardError) {
            console.error('Clipboard API failed:', clipboardError);
        }
        
        // Open GitHub in new tab
        window.open(createFileUrl, '_blank', 'noopener,noreferrer');
        
        // Always show content in a copyable box for easy access
        const output = document.getElementById('output');
        const fileType = isFullChat ? 'conversation' : 'idea';
        
        // Show message
        if (clipboardSuccess) {
            displayMessage('system', `Opened GitHub file creation page. Content copied to clipboard! Paste (Cmd/Ctrl+V) into the editor. If clipboard didn't work, copy from the box below:`);
        } else {
            displayMessage('system', `Opened GitHub file creation page. Copy the content from the box below and paste it into GitHub's editor:`);
        }
        
        // Display content in a copyable format
        const contentBox = document.createElement('div');
        contentBox.className = 'terminal-line';
        contentBox.style.marginTop = '1rem';
        contentBox.style.padding = '1rem';
        contentBox.style.backgroundColor = '#111';
        contentBox.style.border = '2px solid #00ff00';
        contentBox.style.borderRadius = '4px';
        contentBox.style.maxHeight = '400px';
        contentBox.style.overflowY = 'auto';
        contentBox.style.whiteSpace = 'pre-wrap';
        contentBox.style.fontSize = '0.85rem';
        contentBox.style.color = '#00ff00';
        contentBox.style.fontFamily = 'Courier New, Monaco, Menlo, monospace';
        contentBox.style.lineHeight = '1.6';
        contentBox.textContent = content;
        contentBox.style.cursor = 'text';
        contentBox.setAttribute('contenteditable', 'true');
        contentBox.setAttribute('spellcheck', 'false');
        
        // Add a "Select All" button
        const selectAllBtn = document.createElement('button');
        selectAllBtn.textContent = 'Select All';
        selectAllBtn.className = 'share-button share-button-default';
        selectAllBtn.style.marginTop = '0.5rem';
        selectAllBtn.style.fontSize = '0.8rem';
        selectAllBtn.style.padding = '0.4rem 0.8rem';
        selectAllBtn.addEventListener('click', () => {
            const range = document.createRange();
            range.selectNodeContents(contentBox);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
        });
        
        const container = document.createElement('div');
        container.style.marginTop = '0.5rem';
        container.appendChild(contentBox);
        container.appendChild(selectAllBtn);
        
        output.appendChild(container);
        output.scrollTop = output.scrollHeight;
    }

    function displaySuccess(url, filename, accountInfo = '') {
        const output = document.getElementById('output');
        const line = document.createElement('div');
        line.className = 'terminal-line success-message';
        
        const prompt = document.createElement('span');
        prompt.className = 'prompt';
        prompt.textContent = '✓';
        prompt.style.color = '#00ff00';
        
        const text = document.createElement('span');
        text.className = 'success-text';
        const accountNote = accountInfo ? ` (${accountInfo})` : '';
        text.innerHTML = `Shared! <a href="${url}" target="_blank" rel="noopener" style="color: #00ff00; text-decoration: underline;">View on GitHub</a>${accountNote}`;
        text.style.color = '#00ff00';
        
        line.appendChild(prompt);
        line.appendChild(text);
        output.appendChild(line);
        output.scrollTop = output.scrollHeight;
        
        // Auto-dismiss after 5 seconds
        setTimeout(() => {
            line.remove();
        }, 5000);
    }

    // Click outside to deselect
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.message-line') && !e.target.closest('.share-button')) {
            clearSelection();
        }
    });
});
