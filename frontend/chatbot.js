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
    
    // ── Cloud API Base Detection ──
    const urlParams = new URLSearchParams(window.location.search);
    const hostParam = urlParams.get('host');
    let API_BASE;
    if (hostParam) {
        API_BASE = (hostParam.includes('://')) ? hostParam : `http://${hostParam}`;
    } else if (window.location.hostname.includes('onrender.com')) {
        API_BASE = `https://ironwall-backend.onrender.com`;
    } else {
        API_BASE = `${window.location.protocol}//${window.location.host}`;
    }

    // Default to Ollama's /api/chat endpoint which accepts messages[] array
    if (epUrlInput && (!epUrlInput.value || epUrlInput.value.includes('/api/generate') || epUrlInput.value.includes('localhost:11434'))) {
        epUrlInput.value = API_BASE + '/api/ai/chat';
    }
    if (modelNameInput && !modelNameInput.value) {
        modelNameInput.value = 'tinyllama';
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

    // Send Message — STREAMING MODE
    async function handleSend() {
        const text = aiInput.value.trim();
        if (!text) return;

        // 1. Add User Message to UI & Log
        appendMessage('user', text);
        chatHistoryLog.push({ role: "user", content: text });
        aiInput.value = '';
        aiSendBtn.disabled = true;
        aiInput.disabled = true;

        // 2. Add empty AI bubble — we will stream tokens into it
        const aiMsgDiv = appendMessage('ai', '<strong>SYSTEM:</strong> <span class="typing-stream"></span><span class="stream-cursor">█</span>');
        const streamSpan = aiMsgDiv.querySelector('.typing-stream');
        const cursor = aiMsgDiv.querySelector('.stream-cursor');

        const endpoint = epUrlInput.value.trim();
        const model = modelNameInput.value.trim();
        let fullReply = '';

        try {
            const isOllamaGenerate = endpoint.includes('/api/generate');

            let body;
            if (isOllamaGenerate) {
                const fullPrompt = chatHistoryLog
                    .filter(m => m.role !== 'system')
                    .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
                    .join('\n');
                const sysPrompt = chatHistoryLog.find(m => m.role === 'system')?.content || '';
                body = JSON.stringify({
                    model,
                    prompt: `${sysPrompt}\n\n${fullPrompt}\nAssistant:`,
                    stream: true,
                    num_predict: 120,
                    temperature: 0.1,
                    top_k: 10,
                    top_p: 0.5
                });
            } else {
                // Ollama /api/chat or OpenAI /v1/chat/completions
                body = JSON.stringify({
                    model,
                    messages: chatHistoryLog,
                    stream: true,
                    temperature: 0.1,
                    num_predict: 120,
                    max_tokens: 120,
                    top_k: 10,
                    top_p: 0.5
                });
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

            // ── Stream NDJSON line-by-line ──
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop(); // keep incomplete last line

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed) continue;
                    try {
                        const json = JSON.parse(trimmed);

                        // Extract token from either format
                        let token = '';
                        if (isOllamaGenerate) {
                            token = json.response ?? '';             // /api/generate
                        } else if (json.message?.content !== undefined) {
                            token = json.message.content;            // /api/chat
                        } else if (json.choices?.[0]?.delta?.content) {
                            token = json.choices[0].delta.content;   // OpenAI SSE
                        }

                        if (token) {
                            fullReply += token;
                            streamSpan.innerHTML = formatMarkdown(fullReply);
                            aiHistory.scrollTop = aiHistory.scrollHeight;
                        }

                        // Stop if Ollama signals done
                        if (json.done === true) break;

                    } catch (_) { /* skip malformed JSON lines */ }
                }
            }

            // Finalise — remove blinking cursor, save to history
            cursor.remove();
            chatHistoryLog.push({ role: 'assistant', content: fullReply });

        } catch (error) {
            cursor.remove();
            const failureMsg = window.location.hostname.includes('onrender.com')
                ? `[LOCAL AI UNAVAILABLE] This cloud version requires Ollama to be running on YOUR machine at ${endpoint}. <br><br><strong>Setup:</strong><br>1. Install Ollama<br>2. Run <code>set OLLAMA_ORIGINS="*"</code><br>3. Restart Ollama and refresh.`
                : `[CONNECTION FAILED] Unable to reach Local LLM at ${endpoint}. <br><br>Ensure Ollama is running and CORS is enabled: <code>set OLLAMA_ORIGINS="*"</code>`;
            streamSpan.innerHTML = `<span style="color:#ff1744">${failureMsg}</span>`;
            console.error("Local LLM Stream Error:", error);
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
