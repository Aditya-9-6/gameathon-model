// ════════════════════════════════════════════════════════════════════════════
// IRONWALL+ LOCAL AI CONSULTANT (TINYLLAMA / OLLAMA / LM STUDIO INTEGRATION)
// ════════════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    const aiToggleBtn = document.getElementById('ai-chat-toggle-btn');
    const aiPanel = document.getElementById('ai-chat-panel');
    const aiCloseBtn = document.getElementById('ai-chat-close');
    const aiInput = document.getElementById('ai-chat-input');
    const aiSendBtn = document.getElementById('ai-chat-send');
    const aiHistory = document.getElementById('ai-chat-history');

    // Config fields
    const epUrlInput = document.getElementById('ai-endpoint-url');
    const modelNameInput = document.getElementById('ai-model-name');
    // Default to Ollama's /api/chat endpoint which accepts messages[] array
    if (epUrlInput && epUrlInput.value.includes('/api/generate')) {
        epUrlInput.value = 'http://localhost:11434/api/chat';
    }

    if (!aiToggleBtn || !aiPanel) return;

    // ── Pre-defined Cyberpunk System Prompt ──
    let chatHistoryLog = [
        {
            role: "system",
            content: "You are the IronWall+ AI Consultant (Powered by TinyLlama), a highly advanced cybersecurity defensive AI built into a cyberpunk Web Application Firewall. Answer EXTREMELY concisely. Explain cyber attacks (SQLi, XSS, DDoS) and mitigations in just 1 or 2 sentences max. Keep your tone professional, authoritative, and slightly robotic. Do not hallucinate."
        }
    ];

    // Toggle Panel
    aiToggleBtn.addEventListener('click', () => {
        aiPanel.classList.toggle('open');
        if (aiPanel.classList.contains('open')) {
            aiInput.focus();
        }
    });

    aiCloseBtn.addEventListener('click', () => {
        aiPanel.classList.remove('open');
    });

    // Send Message
    async function handleSend() {
        const text = aiInput.value.trim();
        if (!text) return;

        // 1. Add User Message to UI & Log
        appendMessage('user', text);
        chatHistoryLog.push({ role: "user", content: text });
        aiInput.value = '';
        aiSendBtn.disabled = true;
        aiInput.disabled = true;

        // 2. Add empty AI Message to UI to stream into
        const aiMsgDiv = appendMessage('ai', '<strong>SYSTEM:</strong> <span class="typing">...</span>');
        const contentSpan = aiMsgDiv.querySelector('.typing');

        const endpoint = epUrlInput.value.trim();
        const model = modelNameInput.value.trim();

        // 3. Make API Call — detect endpoint type from URL and send correct payload
        try {
            let response;
            const isOllamaGenerate = endpoint.includes('/api/generate');
            const isOllamaChat = endpoint.includes('/api/chat');
            const isOpenAI = endpoint.includes('/v1/chat');

            if (isOllamaGenerate) {
                // Ollama /api/generate  expects: { model, prompt, stream:false }
                const fullPrompt = chatHistoryLog
                    .filter(m => m.role !== 'system')
                    .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
                    .join('\n');
                const sysPrompt = chatHistoryLog.find(m => m.role === 'system')?.content || '';
                response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ model, prompt: `${sysPrompt}\n\n${fullPrompt}\nAssistant:`, stream: false })
                });
            } else {
                // Ollama /api/chat or OpenAI /v1/chat/completions both accept messages[]
                response = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ model, messages: chatHistoryLog, stream: false, temperature: 0.3, max_tokens: 400 })
                });
            }

            if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

            const data = await response.json();

            // Parse response – handle all formats
            let replyText = '';
            if (data.message?.content) replyText = data.message.content;          // Ollama /api/chat
            else if (data.choices?.[0]?.message?.content) replyText = data.choices[0].message.content; // OpenAI
            else if (data.response) replyText = data.response;                    // Ollama /api/generate
            else replyText = '[Error: Unknown LLM response format]';

            contentSpan.innerHTML = formatMarkdown(replyText);
            chatHistoryLog.push({ role: 'assistant', content: replyText });

        } catch (error) {
            contentSpan.innerHTML = `<span style="color:#ff1744">[CONNECTION FAILED] Unable to reach Local LLM at ${endpoint}. Please ensure the server is running.</span>`;
            console.error("Local LLM Error:", error);
        } finally {
            aiSendBtn.disabled = false;
            aiInput.disabled = false;
            aiInput.focus();
            aiHistory.scrollTop = aiHistory.scrollHeight;
        }
    }

    aiSendBtn.addEventListener('click', handleSend);
    aiInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSend();
    });

    // Helper: append visually to the chat panel
    function appendMessage(role, htmlContent) {
        const div = document.createElement('div');
        div.className = `chat-msg ${role}`;
        if (role === 'user') {
            div.innerHTML = htmlContent;
        } else {
            div.innerHTML = htmlContent;
        }
        aiHistory.appendChild(div);
        setTimeout(() => { aiHistory.scrollTop = aiHistory.scrollHeight; }, 50);
        return div;
    }

    // Helper: basic markdown to HTML for code blocks
    function formatMarkdown(text) {
        let html = text.replace(/```([\s\S]*?)```/g, '<pre style="background:#050510;border:1px solid #444;padding:8px;margin:5px 0;"><code>$1</code></pre>');
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\n/g, '<br>');
        return html;
    }
});
