/**
 * IronWall+ Gamethon — Red Team Controller (v3 — Full Feature Edition)
 * =====================================================================
 * Feature 1: Payload X-Ray Modal — drag-to-fire mechanic with anatomy lesson
 * Feature 2: Blast Radius Simulator — financial + operational damage on hover
 * Feature 3: AI Debrief (triggered by backend BLOCKED echo)
 * Feature 4: Phishing Campaign Modal — compose + employee simulation
 * Feature 5: XSS Injection attack with cookie-steal lesson
 * Feature 6: Path Traversal attack with system-file exfil lesson
 * Feature 7: Mirror Dimension / Honeypot modal (Tartarus Engine)
 */

'use strict';

// Allow overriding host via query parameter from Lobby (e.g. ?host=192.168.1.14:3000)
const urlParams = new URLSearchParams(window.location.search);
const hostParam = urlParams.get('host');
const wsParam = urlParams.get('ws');

let WS_URL, API_BASE;
if (wsParam) {
    WS_URL = wsParam;
    API_BASE = wsParam.replace('/ws', '');
} else if (hostParam) {
    API_BASE = (hostParam.includes('://')) ? hostParam : `http://${hostParam}`;
    WS_URL = (hostParam.includes('onrender.com')) ? `wss://${hostParam}/ws` : `ws://${hostParam}/ws`;
} else if (window.location.hostname.includes('onrender.com')) {
    API_BASE = `https://ironwall-backend.onrender.com`;
    WS_URL = `wss://ironwall-backend.onrender.com/ws`;
} else {
    API_BASE = `${window.location.protocol}//${window.location.host}`;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    WS_URL = `${protocol}//${window.location.host}/ws`;
}

// ── Mobile Detection ──────────────────────────────────────────────────────────
const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
if (isTouch) document.body.classList.add('is-touch');

// ── State ────────────────────────────────────────────────────────────────────
const atk = {
    ws: null,
    count: 0,
    combo: 1,
    exp: 0,
    level: 1,
    comboTimer: null,
    lastAttackTime: 0,
    pendingBtn: null, // button awaiting X-Ray confirmation
    threatLevel: 0,
};

// ── Audio Engine (Cyber-Synth) ────────────────────────────────────────────────
class CyberSynth {
    constructor() { this.ctx = null; this.enabled = false; }

    init() {
        if (this.ctx) return;
        try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); this.enabled = true; }
        catch (e) { }
    }

    // Helper: single tone with frequency sweep
    _tone(freq, endFreq, type, vol, dur, delay = 0) {
        const ctx = this.ctx, now = ctx.currentTime + delay;
        const osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now);
        if (endFreq !== freq)
            osc.frequency.exponentialRampToValueAtTime(Math.max(endFreq, 1), now + dur);
        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + dur + 0.01);
    }

    play(type) {
        if (!this.enabled || !this.ctx) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();

        switch (type) {
            case 'fire':   // Crisp laser ZAP
                this._tone(1200, 180, 'sawtooth', 0.28, 0.18);
                this._tone(600, 90, 'square', 0.12, 0.14);
                break;
            case 'blocked': // Harsh electric DENIED buzz
                this._tone(380, 380, 'square', 0.30, 0.07);
                this._tone(760, 760, 'sawtooth', 0.20, 0.07, 0.09);
                this._tone(380, 380, 'square', 0.25, 0.07, 0.20);
                break;
            case 'sql':    // Descending digital glitch crunch
                this._tone(950, 280, 'sawtooth', 0.25, 0.14);
                this._tone(475, 140, 'square', 0.13, 0.10, 0.07);
                break;
            case 'xss':    // Sharp high-freq injection ping
                this._tone(2600, 700, 'sine', 0.22, 0.10);
                this._tone(1800, 400, 'sine', 0.16, 0.08, 0.06);
                break;
            case 'ddos':   // Rapid stutter burst
                for (let i = 0; i < 7; i++)
                    this._tone(700, 700, 'square', 0.18, 0.035, i * 0.055);
                break;
            case 'zero':   // Deep ominous rising siren
                this._tone(60, 500, 'sawtooth', 0.32, 0.30);
                this._tone(120, 900, 'sine', 0.18, 0.28, 0.04);
                break;
            case 'phish':  // Deceptive 3-note chime
                this._tone(1046, 1046, 'sine', 0.22, 0.07);
                this._tone(1318, 1318, 'sine', 0.20, 0.07, 0.09);
                this._tone(1046, 1046, 'sine', 0.14, 0.10, 0.18);
                break;
            default:
                this._tone(900, 200, 'sawtooth', 0.22, 0.15);
        }
    }
}
const audio = new CyberSynth();
window.addEventListener('mousedown', () => audio.init(), { once: true });
window.addEventListener('touchstart', () => audio.init(), { once: true });

// ── Phishing Data ────────────────────────────────────────────────────────────
const phish = {
    subject: null,
    link: null,
};

// ── Voice Announcer (TTS) ───────────────────────────────────────────────────
class VoiceAnnouncer {
    constructor() {
        this.synth = window.speechSynthesis;
        this.voice = null;
    }
    init() {
        if (!this.synth) return;
        const voices = this.synth.getVoices();
        this.voice = voices.find(v => v.name.includes('Google') && v.lang.includes('en')) ||
            voices.find(v => v.lang === 'en-US' || v.lang === 'en-GB') ||
            voices[0];
    }
    speak(text) {
        if (!this.synth) return;
        this.synth.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        if (this.voice) utterance.voice = this.voice;
        utterance.rate = 1.05;
        this.synth.speak(utterance);
    }
    stop() {
        if (this.synth) this.synth.cancel();
    }
}
const voiceSynth = new VoiceAnnouncer();
if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = () => voiceSynth.init();
}

// ════════════════════════════════════════════════════════════════════════════
// FEATURE 2 — BLAST RADIUS SIMULATOR
// ════════════════════════════════════════════════════════════════════════════

const blastPanel = document.getElementById('blast-radius-panel');
const blastTitle = document.getElementById('blast-title');
const blastBody = document.getElementById('blast-body');

document.querySelectorAll('.attack-btn').forEach((btn) => {
    btn.addEventListener('mouseenter', () => {
        const t = btn.dataset.blastTitle;
        const b = btn.dataset.blastBody;
        if (!t || !b) return;
        blastTitle.textContent = t;
        blastBody.innerHTML = b;
        blastPanel.classList.remove('hidden');
        blastPanel.classList.add('visible');
    });
    btn.addEventListener('mouseleave', () => {
        blastPanel.classList.remove('visible');
        setTimeout(() => {
            if (!blastPanel.classList.contains('visible')) blastPanel.classList.add('hidden');
        }, 300);
    });
});

// ════════════════════════════════════════════════════════════════════════════
// FEATURE 1 — PAYLOAD X-RAY MODAL + DRAG-TO-FIRE
// ════════════════════════════════════════════════════════════════════════════

const xrayOverlay = document.getElementById('xray-overlay');
const xrayClose = document.getElementById('xray-close');
const xrayCodeEl = document.getElementById('xray-code-display');
const xrayLessonEl = document.getElementById('xray-lesson-text');
const xrayAttackEl = document.getElementById('xray-attack-name');
const payloadChip = document.getElementById('payload-chip');
const firingChamber = document.getElementById('firing-chamber');

function openXRay(btn) {
    atk.pendingBtn = btn;
    const attackType = btn.dataset.attack;
    const rawPayload = btn.dataset.payload || '';
    const highlight = btn.dataset.highlight || '';
    const lesson = btn.dataset.lesson || '';

    // Format attack name
    xrayAttackEl.textContent = attackType.replace(/_/g, ' ');

    // Highlight the dangerous token in the payload
    let safePayload = rawPayload.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    if (highlight) {
        const safeHL = highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        safePayload = safePayload.replace(
            new RegExp(safeHL.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'), 'g'),
            `<mark class="danger-token">${highlight}</mark>`
        );
    }
    xrayCodeEl.innerHTML = safePayload;
    xrayLessonEl.innerHTML = lesson;

    // Reset drag state
    payloadChip.classList.remove('dragged');
    firingChamber.classList.remove('loaded', 'fired');
    firingChamber.querySelector('.chamber-label').textContent = 'FIRING CHAMBER';
    firingChamber.querySelector('.chamber-drop-hint').textContent = isTouch ? 'TAP TO ARM' : 'DROP HERE';

    xrayOverlay.classList.remove('hidden');
    requestAnimationFrame(() => xrayOverlay.classList.add('open'));

    // Mobile layout adjustment
    if (isTouch) {
        document.querySelector('.xray-drag-label').textContent = 'TAP the payload, then TAP the chamber:';
    }
}

document.getElementById('xray-audio-btn').addEventListener('click', () => {
    const title = document.getElementById('xray-attack-name').textContent;
    const lesson = document.getElementById('xray-lesson-text').textContent;
    voiceSynth.speak(`Attack Type: ${title}. ${lesson}`);
});

function closeXRay() {
    voiceSynth.stop();
    xrayOverlay.classList.remove('open');
    setTimeout(() => xrayOverlay.classList.add('hidden'), 320);
    atk.pendingBtn = null;
}

xrayClose.addEventListener('click', closeXRay);
xrayOverlay.addEventListener('click', (e) => { if (e.target === xrayOverlay) closeXRay(); });

// ── Drag-and-Drop ─────────────────────────────────────────────────────────
payloadChip.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', 'payload');
    payloadChip.classList.add('dragging');
});
payloadChip.addEventListener('dragend', () => payloadChip.classList.remove('dragging'));

firingChamber.addEventListener('dragover', (e) => {
    e.preventDefault();
    firingChamber.classList.add('drag-over');
});
firingChamber.addEventListener('dragleave', () => firingChamber.classList.remove('drag-over'));
firingChamber.addEventListener('drop', (e) => {
    e.preventDefault();
    firingChamber.classList.remove('drag-over');

    if (atk.pendingBtn) {
        // Visual chamber load
        payloadChip.classList.add('dragged');
        firingChamber.classList.add('loaded');
        firingChamber.querySelector('.chamber-label').textContent = 'ARMED';
        firingChamber.querySelector('.chamber-drop-hint').textContent = '🔴 FIRING...';

        setTimeout(() => {
            firingChamber.classList.add('fired');
            firingChamber.querySelector('.chamber-label').textContent = 'LAUNCHED';
            firingChamber.querySelector('.chamber-drop-hint').textContent = '✓';
            fireAttack(atk.pendingBtn);
            setTimeout(closeXRay, 800);
        }, 500);
    }
});

// ── Touch fallback: tap chip then tap chamber ─────────────────────────────
let chipTapped = false;
payloadChip.addEventListener('click', () => {
    chipTapped = true;
    payloadChip.classList.add('chip-selected');
    firingChamber.querySelector('.chamber-drop-hint').textContent = 'NOW TAP CHAMBER';
    if (navigator.vibrate) navigator.vibrate(20);
});

payloadChip.addEventListener('touchstart', (e) => {
    e.preventDefault();
    chipTapped = true;
    payloadChip.classList.add('chip-selected');
    firingChamber.querySelector('.chamber-drop-hint').textContent = 'NOW TAP CHAMBER';
    if (navigator.vibrate) navigator.vibrate(20);
}, { passive: false });

const handleChamberFire = () => {
    if (chipTapped && atk.pendingBtn) {
        chipTapped = false;
        payloadChip.classList.remove('chip-selected');
        firingChamber.classList.add('loaded');
        firingChamber.querySelector('.chamber-label').textContent = 'ARMED';
        firingChamber.querySelector('.chamber-drop-hint').textContent = '🔴 FIRING...';
        setTimeout(() => {
            firingChamber.classList.add('fired');
            firingChamber.querySelector('.chamber-label').textContent = 'LAUNCHED';
            fireAttack(atk.pendingBtn);
            setTimeout(closeXRay, 800);
        }, 500);
    }
};

firingChamber.addEventListener('click', handleChamberFire);
firingChamber.addEventListener('touchstart', (e) => {
    e.preventDefault();
    handleChamberFire();
}, { passive: false });

// ════════════════════════════════════════════════════════════════════════════
// ATTACK FIRING (called after X-Ray confirms OR directly for phishing)
// ════════════════════════════════════════════════════════════════════════════

function fireAttack(btn) {
    const attackType = btn.dataset.attack;
    const payload = btn.dataset.payload || attackType;
    const originIp = btn.dataset.ip || '10.13.37.99';

    const packet = {
        attack_type: attackType,
        origin_ip: originIp,
        payload: payload,
        timestamp: new Date().toISOString(),
        sequence: atk.count + 1,
    };

    safeSend(JSON.stringify(packet));

    btn.classList.add('firing');
    setTimeout(() => btn.classList.remove('firing'), 320);

    if (navigator.vibrate) navigator.vibrate([60, 20, 40]);
    audio.play(btn.dataset.sound || 'fire');

    atk.count++;
    const now = Date.now();
    if (now - atk.lastAttackTime < 3000) {
        atk.combo = Math.min(atk.combo + 1, 10);
    } else {
        atk.combo = 1;
    }
    atk.lastAttackTime = now;

    const dmgMap = {
        SQL_INJECTION: 850,
        XSS_INJECTION: 800,
        PATH_TRAVERSAL: 750,
        DDOS_SWARM: 950,
        ZERO_DAY_MUTATOR: 1000,
        PHISHING_CAMPAIGN: 700,
        MIRROR_PROBE: 600
    };
    atk.exp += (dmgMap[attackType] || 500) * atk.combo;

    clearTimeout(atk.comboTimer);
    atk.comboTimer = setTimeout(() => {
        atk.combo = 1;
        document.getElementById('atk-combo').textContent = '×1';
    }, 3500);

    document.getElementById('atk-count').textContent = atk.count;
    document.getElementById('atk-combo').textContent = `×${atk.combo}`;
    document.getElementById('atk-exp').textContent = atk.exp.toLocaleString();

    checkLevelUp();

    console.log(`[RedTeam] Fired: ${attackType} | combo: ×${atk.combo} | EXP: ${atk.exp}`);
}

// ── Button click → open X-Ray instead of firing directly ─────────────────
document.querySelectorAll('.attack-btn:not(.info-btn)').forEach((btn) => {
    btn.addEventListener('click', () => {
        if (btn.dataset.attack === 'PHISHING_CAMPAIGN') { openPhishModal(); return; }
        if (btn.dataset.attack === 'MIRROR_PROBE') { openMirrorModal(btn); return; }
        if (btn.dataset.attack === 'DDOS_SWARM') { /* allow pass through */ }
        openXRay(btn);
    });
    btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (btn.dataset.attack === 'PHISHING_CAMPAIGN') { openPhishModal(); return; }
        if (btn.dataset.attack === 'MIRROR_PROBE') { openMirrorModal(btn); return; }
        openXRay(btn);
    }, { passive: false });
});

// ════════════════════════════════════════════════════════════════════════════
// FEATURE 7 — MIRROR DIMENSION / HONEYPOT MODAL (Tartarus Engine)
// ════════════════════════════════════════════════════════════════════════════

const mirrorOverlay = document.getElementById('mirror-overlay');
const mirrorClose = document.getElementById('mirror-close');
const mirrorContinueBtn = document.getElementById('mirror-continue-btn');
let mirrorPendingBtn = null;

function openMirrorModal(btn) {
    mirrorPendingBtn = btn;
    mirrorOverlay.classList.remove('hidden');
    requestAnimationFrame(() => mirrorOverlay.classList.add('open'));
}

function closeMirrorModal() {
    mirrorOverlay.classList.remove('open');
    setTimeout(() => mirrorOverlay.classList.add('hidden'), 320);
    mirrorPendingBtn = null;
}

mirrorClose.addEventListener('click', closeMirrorModal);
mirrorOverlay.addEventListener('click', (e) => { if (e.target === mirrorOverlay) closeMirrorModal(); });

mirrorContinueBtn.addEventListener('click', () => {
    if (mirrorPendingBtn) {
        fireAttack(mirrorPendingBtn);
    }
    closeMirrorModal();
});

// ════════════════════════════════════════════════════════════════════════════
// FEATURE 4 — PHISHING CAMPAIGN MODAL
// ════════════════════════════════════════════════════════════════════════════

const phishOverlay = document.getElementById('phish-overlay');
const phishClose = document.getElementById('phish-close');
const phishSendBtn = document.getElementById('phish-send-btn');
const phishResetBtn = document.getElementById('phish-reset-btn');
const phishStepCompose = document.getElementById('phish-step-compose');
const phishStepSim = document.getElementById('phish-step-sim');
const simStatusText = document.getElementById('sim-status-text');
const simResult = document.getElementById('sim-result');

function openPhishModal() {
    phish.subject = null;
    phish.link = null;
    phishSendBtn.disabled = true;

    // Reset selections
    document.querySelectorAll('#phish-subjects .phish-opt, #phish-links .phish-opt').forEach(o => o.classList.remove('selected'));
    document.getElementById('phish-subject-val').textContent = '— not selected —';
    document.getElementById('phish-link-val').textContent = '— not selected —';
    phishStepCompose.classList.remove('hidden');
    phishStepSim.classList.add('hidden');
    simResult.classList.add('hidden');
    simStatusText.textContent = 'Employee reading email...';

    phishOverlay.classList.remove('hidden');
    requestAnimationFrame(() => phishOverlay.classList.add('open'));
}

function closePhishModal() {
    phishOverlay.classList.remove('open');
    setTimeout(() => phishOverlay.classList.add('hidden'), 320);
}

phishClose.addEventListener('click', closePhishModal);
phishOverlay.addEventListener('click', (e) => { if (e.target === phishOverlay) closePhishModal(); });

// Subject selector
document.querySelectorAll('#phish-subjects .phish-opt').forEach((opt) => {
    opt.addEventListener('click', () => {
        document.querySelectorAll('#phish-subjects .phish-opt').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        phish.subject = opt.dataset.val;
        document.getElementById('phish-subject-val').textContent = phish.subject;
        checkPhishReady();
    });
});

// Link selector
document.querySelectorAll('#phish-links .phish-opt').forEach((opt) => {
    opt.addEventListener('click', () => {
        document.querySelectorAll('#phish-links .phish-opt').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        phish.link = opt.dataset.val;
        document.getElementById('phish-link-val').textContent = phish.link;
        checkPhishReady();
    });
});

function checkPhishReady() {
    phishSendBtn.disabled = !(phish.subject && phish.link);
}

phishSendBtn.addEventListener('click', runPhishSimulation);

function runPhishSimulation() {
    phishStepCompose.classList.add('hidden');
    phishStepSim.classList.remove('hidden');
    simResult.classList.add('hidden');

    document.getElementById('sim-subject-text').textContent = phish.subject;
    document.getElementById('sim-link-text').textContent = phish.link;
    simStatusText.textContent = 'Employee reading email...';

    // Simulate employee interaction sequence
    setTimeout(() => { simStatusText.textContent = '🖱 Employee hovering over link...'; }, 1200);
    setTimeout(() => { simStatusText.textContent = '⚠ Employee clicked the link!'; simStatusText.style.color = '#ff6b35'; }, 2400);
    setTimeout(() => { simStatusText.textContent = '📡 Malicious payload executing...'; }, 3400);
    setTimeout(() => {
        simStatusText.textContent = '🛡 FluxGate AI intercepted callback!';
        simStatusText.style.color = '#39ff14';
        showPhishResult();
        // Fire the actual attack packet
        const phishBtn = document.getElementById('btn-phish');
        fireAttack(phishBtn);
    }, 4600);
}

function showPhishResult() {
    simResult.classList.remove('hidden');
    document.getElementById('sim-result-title').textContent = 'Attack Contained — But the Human Clicked.';
    document.getElementById('sim-result-body').innerHTML =
        `The employee clicked <strong>${phish.link}</strong> because the subject line created urgency. ` +
        `The firewall stopped the callback beacon, but credentials were already typed into the fake login page. ` +
        `<br><br><strong class="lesson-highlight">Lesson:</strong> No firewall can stop human psychology. ` +
        `MFA + Security Awareness Training are your only defense against this class of attack.`;

    // Fire websocket
    safeSend(JSON.stringify({
        attack_type: 'PHISHING_CAMPAIGN',
        origin_ip: 'social.engineering.0',
        payload: `PHISH: "${phish.subject}" → ${phish.link}`,
        timestamp: new Date().toISOString(),
        sequence: atk.count,
    }));
}

phishResetBtn.addEventListener('click', () => {
    phishStepCompose.classList.remove('hidden');
    phishStepSim.classList.add('hidden');
    simResult.classList.add('hidden');
    simStatusText.style.color = '';
    phish.subject = null;
    phish.link = null;
    phishSendBtn.disabled = true;
    document.querySelectorAll('#phish-subjects .phish-opt, #phish-links .phish-opt').forEach(o => o.classList.remove('selected'));
    document.getElementById('phish-subject-val').textContent = '— not selected —';
    document.getElementById('phish-link-val').textContent = '— not selected —';
});

// ════════════════════════════════════════════════════════════════════════════
// FEATURE 5 — INTEL OVERLAY (INFORMATIONAL)
// ════════════════════════════════════════════════════════════════════════════

const intelOverlay = document.getElementById('intel-overlay');
const intelClose = document.getElementById('intel-close');

document.querySelectorAll('.info-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.getElementById('intel-attack-name').textContent = btn.dataset.intelTitle;
        document.getElementById('intel-vector').textContent = btn.dataset.intelVector;
        document.getElementById('intel-mitigation').textContent = btn.dataset.intelMitig;

        intelOverlay.classList.remove('hidden');
        requestAnimationFrame(() => intelOverlay.classList.add('open'));
    });
});

document.getElementById('intel-audio-btn').addEventListener('click', () => {
    const title = document.getElementById('intel-attack-name').textContent;
    const vector = document.getElementById('intel-vector').textContent;
    const mitig = document.getElementById('intel-mitigation').textContent;
    try {
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
            const utt = new SpeechSynthesisUtterance(`Threat Intel: ${title}. Attack Vector: ${vector}. Mitigation Strategy: ${mitig}`);
            utt.rate = 0.9; utt.pitch = 0.8;
            window.speechSynthesis.speak(utt);
        }
    } catch (e) { }
});

function closeIntelModal() {
    try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) { }
    intelOverlay.classList.remove('open');
    setTimeout(() => intelOverlay.classList.add('hidden'), 320);
}

intelClose.addEventListener('click', closeIntelModal);
intelOverlay.addEventListener('click', (e) => { if (e.target === intelOverlay) closeIntelModal(); });

// ════════════════════════════════════════════════════════════════════════════
// WEBSOCKET
// ════════════════════════════════════════════════════════════════════════════

function connectWS() {
    if (atk.ws) {
        atk.ws.close(); // HARDENING: Prevent socket leaks by closing existing instance
    }
    const statusEl = document.getElementById('atk-ws-status');
    atk.ws = new WebSocket(WS_URL);

    atk.ws.onopen = () => {
        statusEl.textContent = '● ONLINE — LOCKED & LOADED';
        statusEl.style.color = '#39ff14';
        safeSend(JSON.stringify({ type: 'ATTACKER_READY', ts: Date.now() }));
    };

    atk.ws.onclose = (event) => {
        statusEl.textContent = '◌ RECONNECTING...';
        statusEl.style.color = '#ff6b35';
        console.warn(`[RedTeam] WebSocket closed: code=${event.code} reason=${event.reason || 'none'}`);
        setTimeout(connectWS, 2500);
    };

    atk.ws.onerror = () => {
        statusEl.textContent = '✕ NO SERVER — OPEN backend first';
        statusEl.style.color = '#ff1744';
    };

    atk.ws.onmessage = (msg) => {
        try {
            const event = JSON.parse(msg.data);
            if (event.event === 'BLOCKED') {
                flashConfirm(event.attack_type);
                if (navigator.vibrate) navigator.vibrate(200);
                audio.play('blocked');
            }
            if (event.severity) {
                atk.threatLevel = Math.min(100, event.severity);
                updateAttackerHUD();
            }
        } catch { }
    };
}

function safeSend(data) {
    if (atk.ws && atk.ws.readyState === WebSocket.OPEN) {
        atk.ws.send(data);
        return true;
    }
    // Not connected — show red error on status bar
    const statusEl = document.getElementById('atk-ws-status');
    if (statusEl) {
        const prev = statusEl.textContent;
        const prevColor = statusEl.style.color;
        statusEl.textContent = '✕ NO SERVER — Start backend first!';
        statusEl.style.color = '#ff1744';
        statusEl.style.animation = 'none';
        setTimeout(() => {
            statusEl.textContent = prev || '◌ RECONNECTING...';
            statusEl.style.color = prevColor || '#ff6b35';
        }, 2500);
    }
    // Also flash the fire button red briefly for visual feedback
    document.querySelectorAll('.attack-btn.firing').forEach(b => {
        b.style.boxShadow = '0 0 30px #ff1744';
        setTimeout(() => b.style.boxShadow = '', 500);
    });
    return false;
}

function updateAttackerHUD() {
    const statusEl = document.getElementById('atk-ws-status');
    if (atk.threatLevel > 80) {
        statusEl.style.textShadow = '0 0 10px #ff1744';
        statusEl.style.color = '#ff1744';
    } else {
        statusEl.style.textShadow = '';
        statusEl.style.color = '#39ff14';
    }
}

// ── Phase 3: Manual Bypass Challenge ────────────────────────────────────────
const MANUAL_HINTS = {
    '<script>': "Tip: You're trying an XSS attack. The WAF looks for <script> tags.",
    "OR '1'='1'": "Tip: This is a classic SQL Tautology. It aims to make the WHERE clause always true.",
    "../": "Tip: Path Traversal! You're trying to escape the directory sandbox.",
    "{{": "Tip: Server-Side Template Injection (SSTI) attempt detected.",
};

function initManualEntry() {
    const input = document.getElementById('manual-payload-input');
    const btn = document.getElementById('manual-send-btn');
    const hint = document.getElementById('manual-hint');

    input.addEventListener('input', () => {
        const val = input.value;
        hint.textContent = '';
        for (const [key, msg] of Object.entries(MANUAL_HINTS)) {
            if (val.includes(key)) {
                hint.textContent = msg;
                break;
            }
        }
    });

    btn.onclick = () => {
        const payload = input.value.trim();
        if (!payload) return;

        // Determine attack type based on guess
        let type = 'UNKNOWN_PROBE';
        if (payload.includes('<script')) type = 'XSS_INJECTION';
        else if (payload.includes('OR')) type = 'SQL_INJECTION';
        else if (payload.includes('../')) type = 'PATH_TRAVERSAL';

        safeSend(JSON.stringify({
            attack_type: type,
            payload: payload,
            severity: 10
        }));

        input.value = '';
        hint.textContent = 'Payload neutralized by IronWall+... Check Defense Grid.';
        setTimeout(() => hint.textContent = '', 3000);

        if (navigator.vibrate) navigator.vibrate(50);
        audio.play('fire');
    };
}
initManualEntry();

function flashConfirm(attackType) {
    const map = {
        SQL_INJECTION: 'btn-sql',
        'btn-sql-union': 'btn-sql-union',
        'btn-sql-blind': 'btn-sql-blind',
        XSS_INJECTION: 'btn-xss',
        'btn-xss-stored': 'btn-xss-stored',
        PATH_TRAVERSAL: 'btn-traversal',
        'btn-traversal-win': 'btn-traversal-win',
        DDOS_SWARM: 'btn-ddos',
        'btn-ddos-udp': 'btn-ddos-udp',
        ZERO_DAY_MUTATOR: 'btn-zero',
        MIRROR_PROBE: 'btn-mirror',
        PHISHING_CAMPAIGN: 'btn-phish',
    };
    const id = map[attackType];
    if (!id) return;
    const btn = document.getElementById(id);
    if (!btn) return;
    const orig = btn.style.boxShadow;
    btn.style.boxShadow = '0 0 50px rgba(57,255,20,0.8), inset 0 0 30px rgba(57,255,20,0.3)';
    setTimeout(() => { btn.style.boxShadow = orig; }, 350);
}


// ── Stealth Mode ─────────────────────────────────────────────────────────────
let stealthModeActive = false;
const stealthBtn = document.getElementById('stealth-btn');

function obfuscatePayload(payload, attackType) {
    if (!payload) return payload;
    if (attackType === 'SQL_INJECTION') {
        return payload
            .replace(/OR/gi, 'O/**/R')
            .replace(/SELECT/gi, 'SE/**/LECT')
            .replace(/SLEEP/gi, 'SL/**/EEP')
            .replace(/UNION/gi, 'UN/**/ION');
    } else if (attackType === 'XSS_INJECTION') {
        return payload
            .replace(/script/gi, 'ScRiPt')
            .replace(/onerror/gi, 'oNeRrOr')
            .replace(/alert/gi, 'AlErT');
    } else if (attackType === 'PATH_TRAVERSAL') {
        return payload
            .replace(/\.\.\//g, '%2E%2E%2F')
            .replace(/\.\.\\/g, '%2E%2E%5C');
    } else {
        return `/* STEALTH-${Date.now() % 9999} */ ${payload}`;
    }
}

// NOTE: safeSend already has stealthModeActive in scope (same file).
// We patch it by re-declaring as a wrapper AFTER the original definition.
// This works because the original 'function safeSend' is hoisted but we can
// override the binding by shadowing it in the closure for fireAttack:
//
// Instead we use a simpler approach: intercept inside safeSend itself.
// We add the stealth check directly into the packet JSON before sending.
// fireAttack passes JSON.stringify(packet) — we parse, mutate, re-serialize.
//
// Implementation: monkey-patch the WebSocket send() to apply stealth in-flight.

if (stealthBtn) {
    stealthBtn.addEventListener('click', () => {
        stealthModeActive = !stealthModeActive;
        stealthBtn.textContent = stealthModeActive ? '🕵 STEALTH: ON' : '🕵 STEALTH: OFF';
        stealthBtn.style.background = stealthModeActive
            ? 'rgba(255,107,53,0.3)' : 'rgba(255,107,53,0.05)';
        stealthBtn.style.boxShadow = stealthModeActive
            ? '0 0 15px rgba(255,107,53,0.6), inset 0 0 10px rgba(255,107,53,0.3)'
            : 'inset 0 0 10px rgba(255,107,53,0.2)';

        // Patch/unpatch WebSocket prototype send to intercept packets
        if (stealthModeActive) {
            WebSocket.prototype._origSend = WebSocket.prototype._origSend || WebSocket.prototype.send;
            WebSocket.prototype.send = function (data) {
                let payloadData = data;
                try {
                    const obj = JSON.parse(data);
                    if (obj.attack_type && obj.payload) {
                        obj.payload = obfuscatePayload(obj.payload, obj.attack_type);
                        obj.stealth = true;
                    }
                    payloadData = JSON.stringify(obj);
                } catch { }
                this._origSend(payloadData);
            };
        } else {
            // Restore original send
            if (WebSocket.prototype._origSend) {
                WebSocket.prototype.send = WebSocket.prototype._origSend;
            }
        }
    });
}

// ── Hacker Progression System ───────────────────────────────────────────────
function checkLevelUp() {
    const thresholds = [0, 1500, 4000, 7500, 12000];
    let newLevel = 1;
    for (let i = thresholds.length - 1; i >= 0; i--) {
        if (atk.exp >= thresholds[i]) {
            newLevel = i + 1;
            break;
        }
    }
    if (newLevel > atk.level) {
        atk.level = newLevel;
        document.getElementById('atk-level').textContent = newLevel;
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        audio.play('phish');
        showLevelUpSequence(newLevel);
    }

    document.querySelectorAll('.attack-btn').forEach(btn => {
        const reqLevel = parseInt(btn.dataset.reqLevel || '1');
        if (reqLevel > atk.level) {
            btn.classList.add('locked');
            btn.disabled = true;
        } else {
            if (btn.classList.contains('locked')) {
                btn.classList.remove('locked');
                btn.disabled = false;
                btn.style.boxShadow = '0 0 20px #00f5ff, inset 0 0 10px #00f5ff';
                setTimeout(() => btn.style.boxShadow = '', 1000);
            }
        }
    });
}

function showLevelUpSequence(level) {
    const ranks = ['Scrub', 'Script Kiddie', 'Cyber Mercenary', 'Netrunner', 'Root Node', 'God-Tier'];
    const popup = document.createElement('div');
    popup.className = 'level-up-popup';
    popup.innerHTML = `<div>LVL ${level} REACHED</div><div style="font-size:1rem;color:#39ff14">RANK: ${ranks[level] || 'Unknown'}</div>`;
    document.body.appendChild(popup);
    setTimeout(() => popup.remove(), 3200);
}

// ── Boot ─────────────────────────────────────────────────────────────────────
// ── Role Enforcement (Multi-Device) ──────────────────────────────────────────
function enforceRole() {
    const isLobbySession = urlParams.has('host') || urlParams.has('ws');
    
    if (isLobbySession) {
        // Add a "Leave Session" button to the attacker header
        const header = document.querySelector('.header-left');
        if (header) {
            const leaveBtn = document.createElement('button');
            leaveBtn.textContent = '🏠 LEAVE';
            leaveBtn.className = 'record-btn';
            leaveBtn.style.marginLeft = '10px';
            leaveBtn.style.padding = '2px 8px';
            leaveBtn.style.fontSize = '0.6rem';
            leaveBtn.style.borderColor = 'var(--neon-orange)';
            leaveBtn.style.color = 'var(--neon-orange)';
            leaveBtn.onclick = () => {
                if (confirm('Leave this session and return to lobby?')) {
                    window.location.href = 'lobby.html';
                }
            };
            header.appendChild(leaveBtn);
        }
    }
}

// ── Boot ─────────────────────────────────────────────────────────────────────
checkLevelUp();
connectWS();
enforceRole();
