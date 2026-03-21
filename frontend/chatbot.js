// ════════════════════════════════════════════════════════════════════════════
// IRONWALL+ AI CONSULTANT — Dual-Mode: Backend Proxy (cloud) + Local Ollama
// ════════════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    const aiToggleBtn = document.getElementById('ai-chat-toggle-btn');
    const aiPanel = document.getElementById('ai-chat-panel');
    const aiCloseBtn = document.getElementById('ai-chat-close');
    const aiInput = document.getElementById('ai-chat-input');
    const aiSendBtn = document.getElementById('ai-chat-send');
    const aiHistory = document.getElementById('ai-chat-history');
    const epUrlInput = document.getElementById('ai-endpoint-url');
    const modelNameInput = document.getElementById('ai-model-name');

    if (!aiToggleBtn || !aiPanel) return;

    // ── System Prompt ──────────────────────────────────────────────
    let chatHistoryLog = [
        {
            role: "system",
            content: "You are the IronWall+ AI Consultant, a highly advanced cybersecurity defensive AI built into a cyberpunk Web Application Firewall. Answer EXTREMELY concisely — 1-2 sentences max. Explain cyber attacks (SQLi, XSS, DDoS) and mitigations in plain terms. Tone: professional, authoritative, slightly robotic. Do not hallucinate."
        }
    ];

    // ── Toggle Panel ───────────────────────────────────────────────
    aiToggleBtn.addEventListener('click', () => {
        aiPanel.classList.toggle('open');
        if (aiPanel.classList.contains('open')) aiInput.focus();
    });
    if (aiCloseBtn) {
        aiCloseBtn.addEventListener('click', () => aiPanel.classList.remove('open'));
    }

    // ── Send Message ───────────────────────────────────────────────
    async function handleSend() {
        const text = aiInput.value.trim();
        if (!text) return;

        appendMessage('user', text);
        chatHistoryLog.push({ role: "user", content: text });
        aiInput.value = '';
        aiSendBtn.disabled = true;
        aiInput.disabled = true;

        // Show streaming bubble
        const aiMsgDiv = appendMessage('ai', '<strong>SYSTEM:</strong> <span class="typing-stream"></span><span class="stream-cursor">█</span>');
        const streamSpan = aiMsgDiv.querySelector('.typing-stream');
        const cursor = aiMsgDiv.querySelector('.stream-cursor');

        const endpoint = (epUrlInput ? epUrlInput.value.trim() : '') || '/api/ai/chat';
        const model = (modelNameInput ? modelNameInput.value.trim() : '') || 'tinyllama';
        let fullReply = '';

        try {
            // Detect endpoint type
            const isLocalOllamaGenerate = endpoint.includes('/api/generate');
            const isLocalOllamaChat = endpoint.includes('/api/chat') && !endpoint.includes('/api/ai/');
            const isBackendProxy = endpoint.includes('/api/ai/') || endpoint.startsWith('/api/ai');
            const isStreaming = isLocalOllamaGenerate || isLocalOllamaChat;

            let body;
            if (isLocalOllamaGenerate) {
                const sysPrompt = chatHistoryLog.find(m => m.role === 'system')?.content || '';
                const fullPrompt = chatHistoryLog
                    .filter(m => m.role !== 'system')
                    .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
                    .join('\n');
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
                // Works for both Ollama /api/chat and backend /api/ai/chat (OpenAI-compatible)
                body = JSON.stringify({
                    model,
                    messages: chatHistoryLog,
                    stream: isStreaming,
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
            }).catch(() => { throw new Error("CONNECTION_FAILED"); });

            if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

            if (isStreaming) {
                // ── Stream NDJSON line-by-line (Ollama style) ──────────────
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop();

                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed) continue;
                        try {
                            const json = JSON.parse(trimmed);
                            let token = '';
                            if (isLocalOllamaGenerate) {
                                token = json.response ?? '';
                            } else if (json.message?.content !== undefined) {
                                token = json.message.content;
                            } else if (json.choices?.[0]?.delta?.content) {
                                token = json.choices[0].delta.content;
                            }
                            if (token) {
                                fullReply += token;
                                streamSpan.innerHTML = formatMarkdown(fullReply);
                                aiHistory.scrollTop = aiHistory.scrollHeight;
                            }
                            if (json.done === true) break;
                        } catch (_) { /* skip malformed JSON */ }
                    }
                }

            } else {
                // ── Non-streaming (backend proxy returns full JSON at once) ──
                const json = await response.json();

                // Handle Ollama /api/chat non-stream style
                if (json.message?.content) {
                    fullReply = json.message.content;
                }
                // Handle OpenAI-style
                else if (json.choices?.[0]?.message?.content) {
                    fullReply = json.choices[0].message.content;
                }
                // Handle backend cloud-sim style
                else if (typeof json.content === 'string') {
                    fullReply = json.content;
                }
                // Fallback
                else {
                    fullReply = JSON.stringify(json);
                }

                // Animate it character-by-character for effect
                let i = 0;
                const chars = fullReply.split('');
                await new Promise(resolve => {
                    const interval = setInterval(() => {
                        i += 3; // Speed: 3 chars per tick
                        streamSpan.innerHTML = formatMarkdown(fullReply.substring(0, i));
                        aiHistory.scrollTop = aiHistory.scrollHeight;
                        if (i >= chars.length) {
                            clearInterval(interval);
                            streamSpan.innerHTML = formatMarkdown(fullReply);
                            resolve();
                        }
                    }, 18);
                });
            }

            cursor.remove();
            chatHistoryLog.push({ role: 'assistant', content: fullReply });

        } catch (err) {
            console.error('AI Chat Error:', err);
            const isConnError = err.message === 'CONNECTION_FAILED';
            streamSpan.innerHTML = isConnError
                ? `<span style="color:#ff6b35">[CONNECTION ERROR]</span> Cannot reach the AI endpoint.<br><br>
                   <strong>If using locally:</strong> Run <code>OLLAMA_ORIGINS="*" ollama serve</code><br>
                   <strong>If deployed:</strong> The backend proxy should handle this automatically. Try refreshing.`
                : `<span style="color:#ff1744">[ERROR]</span> ${err.message}`;
            cursor.style.display = 'none';
        } finally {
            aiSendBtn.disabled = false;
            aiInput.disabled = false;
            aiInput.focus();
            aiHistory.scrollTop = aiHistory.scrollHeight;
        }
    }

    aiSendBtn.addEventListener('click', handleSend);
    aiInput.addEventListener('keypress', e => { if (e.key === 'Enter') handleSend(); });

    // ── Helpers ────────────────────────────────────────────────────
    function appendMessage(role, htmlContent) {
        const div = document.createElement('div');
        div.className = `chat-msg ${role}`;
        div.innerHTML = htmlContent;
        aiHistory.appendChild(div);
        setTimeout(() => { aiHistory.scrollTop = aiHistory.scrollHeight; }, 50);
        return div;
    }

    function formatMarkdown(text) {
        let html = text.replace(/```([\s\S]*?)```/g, '<pre style="background:#050510;border:1px solid #444;padding:8px;margin:5px 0;"><code>$1</code></pre>');
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\n/g, '<br>');
        return html;
    }
});
