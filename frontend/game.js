/**
 * IronWall+ Gamethon — Main Game Engine (v2 — Educational Edition)
 * =======================================
 * Feature 3: AI Debrief notification with typewriter effect
 * All existing features preserved: Canvas Packet Animations, WebSocket, WebGL Glitch, Scoring
 */

'use strict';

// ── Constants ──────────────────────────────────────────────────────────────
// Allow overriding host via query parameter from Lobby (e.g. ?host=192.168.1.14:3000)
const urlParams = new URLSearchParams(window.location.search);
const hostParam = urlParams.get('host');
const wsParam = urlParams.get('ws');

let WS_URL;
if (wsParam) {
    WS_URL = wsParam;
} else if (hostParam) {
    // If we came from lobby, connect to the proxy port on that specific host
    WS_URL = (hostParam.includes('onrender.com')) ? `wss://${hostParam}/ws` : `ws://${hostParam}/ws`;
} else if (window.location.hostname.includes('onrender.com')) {
    // Production on Render — Hardcode to the backend service URL
    WS_URL = `wss://ironwall-backend.onrender.com/ws`;
} else {
    // Fallback to current domain (if opened directly or local)
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    WS_URL = `${protocol}//${window.location.host}/ws`;
}
let CORE_RADIUS = 54;
const PARTICLE_COUNT = 18;

// ── AI Debrief Messages (sourced from IronWall+ README + Phi-3 Battle Narratives) ────────
const AI_DEBRIEF = {
    SQL_INJECTION: {
        title: 'Attack Neutralized — SQL Injection Blocked.',
        body: 'FluxGate AI detected a semantic anomaly: valid application queries never contain tautologies like <code>OR \'1\'=\'1\'</code>. The Pingora WAF parsed the SQL AST and spotted the bypass in 340ns. <strong>Battle Report</strong>: "SQL injection probe from 192.168.1.7 deflected with precision. UNION-based reconnaissance severed before database exposure."',
    },
    XSS_INJECTION: {
        title: 'Attack Neutralized — Cross-Site Scripting Blocked.',
        body: 'FluxGate AI detected a <code>&lt;script&gt;</code> tag in the query parameter — a classic reflected XSS vector. The Content-Security-Policy header was re-enforced and the payload was sanitized at the Pingora edge. <strong>Battle Report</strong>: "XSS cookie-steal payload stripped before reaching the DOM renderer. All 9,814 active sessions remain secure."',
    },
    PATH_TRAVERSAL: {
        title: 'Attack Neutralized — Path Traversal Blocked.',
        body: 'FluxGate AI flagged <code>../../../../../../etc/passwd</code> in the file path parameter. The WAF pattern engine matched the traversal sequence and blocked it at the eBPF/XDP layer with sub-millisecond latency (Aegis Prime). <strong>Battle Report</strong>: "Directory traversal probe to /etc/passwd intercepted. OS file tree remains inaccessible."',
    },
    DDOS_SWARM: {
        title: 'Attack Neutralized — DDoS Swarm Sinkholed.',
        body: 'FluxGate AI flagged 120 Gbps of volumetric traffic from 4,800 unique ASNs in under 290ns. SYN cookies issued; botnet sinkholed at Medusa engine rate-limiter. <strong>Battle Report</strong>: "Distributed flood from swarm botnet absorbed. Zero impact on application layer."',
    },
    ZERO_DAY_MUTATOR: {
        title: 'Attack Neutralized — Zero-Day Shellcode Stopped.',
        body: 'Polymorphic XOR shellcode detected via behavioral entropy analysis. The ROP chain memory access pattern was anomalous even as the byte signature changed. <strong>Ouroboros Engine activated</strong>: mutated variant now being red-teamed to auto-generate a Wasm virtual patch. <strong>Battle Report</strong>: "Polymorphic exploit CVE-2026-XXXX sandboxed. Heap spray neutralized before first ROP gadget executed."',
    },
    MIRROR_PROBE: {
        title: 'Tartarus Engine — Attacker Banished to Mirror Dimension.',
        body: 'Persistent probe detected (3+ blocks from same IP). Tartarus Deception Engine activated: attacker routed to fake infrastructure serving honeypot .env files, fake admin dashboards, and dummy DB credentials. All interactions logged. <strong>Battle Report</strong>: "Mirror Dimension breach confirmed. Attacker consuming fake resources. Intelligence harvest in progress via Chitchat gossip broadcast."',
    },
    PHISHING_CAMPAIGN: {
        title: 'Payload Contained — But the Human Clicked.',
        body: 'The phishing email bypassed the inbox filter (SPF/DKIM spoofed). The employee clicked. However, FluxGate AI detected the DNS callback beacon from the C2 server and severed the connection. <strong>Key lesson</strong>: MFA ensures credential theft alone cannot grant access. The human is always the weakest link.',
    },
    UNKNOWN: {
        title: 'Attack Neutralized.',
        body: 'FluxGate AI detected an anomalous request signature via behavioral heuristics. Dropped at the Pingora edge layer before reaching the application server.',
    },
};

// ── Code Fixes (Vulnerable vs Secure) ───────────────────────────────────────
const CODE_FIXES = {
    SQL_INJECTION: {
        bad: `// VULNERABLE: Direct string concatenation\nconst query = "SELECT * FROM users WHERE name = '" + userName + "'";`,
        good: `// SECURE: Use Parameterized Queries (Prepared Statements)\nconst query = "SELECT * FROM users WHERE name = ?";\ndb.execute(query, [userName]);`,
        desc: "Directly injecting user input into SQL strings allows 'Tautology' attacks like OR '1'='1' to bypass authentication."
    },
    XSS_INJECTION: {
        bad: `// VULNERABLE: Direct insertion into innerHTML\ndashboard.innerHTML = "<h1>Welcome, " + userProfile.name + "</h1>";`,
        good: `// SECURE: Use textContent to prevent script execution\nconst h1 = document.createElement('h1');\nh1.textContent = "Welcome, " + userProfile.name;\ndashboard.appendChild(h1);`,
        desc: "Inserting raw user input into the DOM allows attackers to run malicious JavaScript in the context of other users' browsers."
    },
    PATH_TRAVERSAL: {
        bad: `// VULNERABLE: Blindly trusting path parameters\nconst path = "/uploads/" + fileName;\nreturn fs.readFile(path);`,
        good: `// SECURE: Sanitize and validate against an allow-list\nconst safeName = path.basename(fileName);\nif (!ALLOWED_FILES.includes(safeName)) throw Error("Unauthorized Access");`,
        desc: "Path traversal allow attackers to escape the intended directory (using ../) and read sensitive files like /etc/passwd."
    },
    ZERO_DAY_MUTATOR: {
        bad: `// UNPROTECTED: Relying on static signature matching\nif (packet.signature === KNOWN_EXPLOIT_SIG) block();`,
        good: `// EVOLVED: Behavioral Entropy & Ouroboros Sandboxing\nif (calculateEntropy(packet) > THRESHOLD) {\n  sandbox.execute(packet);\n  generateWasmPatch(packet);\n}`,
        desc: "Zero-days have no known signatures. We use behavioral analysis and autonomous patch generation to stay ahead of polymorphic threats."
    },
    PHISHING_CAMPAIGN: {
        bad: `// WEAK: Relying solely on perimeter email filters\nif (email.spf === 'pass') deliverToInbox();`,
        good: `// ROBUST: Zero-Trust + DNS Beacon Kill-Switch\nif (dns.isAnomalousCallback(target)) {\n  severConnection();\n  triggerMFAChallenge();\n}`,
        desc: "Phishing targets human psychology. Even if the click happens, we detect the C2 beacon and neutralize the account compromise."
    }
};

// ── Cyber-Wiki Glossary ─────────────────────────────────────────────────────
const GLOSSARY = [
    { term: "eBPF (Extended Berkeley Packet Filter)", def: "A revolutionary technology that lets us run sandboxed programs in the Linux kernel. It allows IronWall+ to drop malicious packets at the network interface layer before they even reach the OS." },
    { term: "WAF (Web Application Firewall)", def: "A security filter that sits in front of a web app. It inspects HTTP traffic to block attacks like SQLi and XSS which look like 'normal' web requests." },
    { term: "Ouroboros Engine", def: "Our custom AI feedback loop. It takes blocked zero-day payloads, 'mutates' them in a sandbox, and automatically generates a WASM-based virtual patch to block all future variants." },
    { term: "Tartarus Engine", def: "A software-defined deception layer. Instead of just blocking repeated attackers, we route them to a 'Mirror Dimension'—a fake environment where we can study their techniques safely." },
    { term: "AST (Abstract Syntax Tree)", def: "How a compiler 'sees' code. IronWall+ parses raw requests into an AST to determine if a string is piece of data or a malicious command." }
];

// ── Threat Actors ──────────────────────────────────────────────────────────
const THREAT_ACTORS = [
    { name: "Neon Wraith", origin: "Unknown / Proxy-Chain", tactic: "Advanced SQL Obfuscation" },
    { name: "Ghost Shell", origin: "North-East Asia", tactic: "Zero-Day Mutation" },
    { name: "Binary Crow", origin: "Eastern Europe", tactic: "Credential Stuffing" },
    { name: "Titan Hunter", origin: "Distributed Mesh", tactic: "DDoS Flood" },
    { name: "Void Cipher", origin: "Dark-Web Cluster", tactic: "Polymorphic XSS" }
];

// ── State ──────────────────────────────────────────────────────────────────
const state = {
    threats: 0,
    computeSaved: 0,
    comboCount: 0,
    comboTimer: null,
    threatLevel: 0,       // 0-100
    packets: [],
    particles: [],
    startTime: Date.now(),
    ws: null,
    glitchIntensity: 0,
    bgStars: [],
    debriefTimer: null,
    screenShake: 0,
    // Stats & Replay
    attackCounts: {},     // { SQL_INJECTION: 3, XSS_INJECTION: 1, ... }
    blockTimes: [],       // array of ns values for avg calculation
    damagePrevented: 0,   // rupees
    replayLog: [],        // last 10 { type, ts }
    heatRingIntensity: 0, // 0-1 for the threat heat ring around core
};

// ── Audio Engine (Cyber-Synth) ────────────────────────────────────────────────
class CyberSynth {
    constructor() {
        this.ctx = null;
        this.enabled = false;
    }

    init() {
        if (this.ctx) return;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.enabled = true;
            console.log('[CyberSynth] Audio Engine Initialized');
        } catch (e) {
            console.error('[CyberSynth] Failed to init audio', e);
        }
    }

    play(type) {
        if (!this.enabled || !this.ctx) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);

        const now = this.ctx.currentTime;

        if (type === 'threat') {
            // Low-frequency aggressive thrum + sweep
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(140, now);
            osc.frequency.exponentialRampToValueAtTime(40, now + 0.4);
            gain.gain.setValueAtTime(0.25, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
            osc.start(now);
            osc.stop(now + 0.5);
        } else if (type === 'block') {
            // High-pitched digital bip
            osc.type = 'square';
            osc.frequency.setValueAtTime(880, now);
            osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
            osc.start(now);
            osc.stop(now + 0.2);
        } else if (type === 'evolution') {
            // Organic rising synth
            osc.type = 'sine';
            osc.frequency.setValueAtTime(220, now);
            osc.frequency.linearRampToValueAtTime(440, now + 1.5);
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.2, now + 0.1);
            gain.gain.linearRampToValueAtTime(0, now + 2.0);
            osc.start(now);
            osc.stop(now + 2.0);
        }
    }
}
const audio = new CyberSynth();
window.addEventListener('mousedown', () => audio.init(), { once: true });
window.addEventListener('keydown', () => audio.init(), { once: true });

// ── Per-Attack Unique Sound FX ─────────────────────────────────────────────────
function playAttackSound(attackType, ctx) {
    if (!ctx || ctx.state === 'suspended') { try { ctx.resume(); } catch { } }
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);

    if (attackType === 'SQL_INJECTION') {
        // Deep grinding bass hum — database being drilled
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(80, now);
        osc.frequency.linearRampToValueAtTime(55, now + 0.6);
        gain.gain.setValueAtTime(0.3, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
        osc.start(now); osc.stop(now + 0.7);
    } else if (attackType === 'XSS_INJECTION') {
        // High piercing electronic squeal — script injection
        osc.type = 'square';
        osc.frequency.setValueAtTime(1400, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.4);
        gain.gain.setValueAtTime(0.18, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc.start(now); osc.stop(now + 0.5);
    } else if (attackType === 'PATH_TRAVERSAL') {
        // Stuttering clicks — file system scraping
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.setValueAtTime(300, now + 0.1);
        osc.frequency.setValueAtTime(600, now + 0.2);
        osc.frequency.setValueAtTime(200, now + 0.3);
        gain.gain.setValueAtTime(0.2, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.start(now); osc.stop(now + 0.4);
    } else if (attackType === 'DDOS_SWARM') {
        // Roaring low bass rumble — massive traffic flood
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(40, now);
        osc.frequency.linearRampToValueAtTime(30, now + 1.0);
        gain.gain.setValueAtTime(0.4, now); gain.gain.linearRampToValueAtTime(0, now + 1.1);
        osc.start(now); osc.stop(now + 1.1);
    } else if (attackType === 'ZERO_DAY_MUTATOR' || attackType === 'MIRROR_PROBE') {
        // Eerie descending alien tone — unknown/polymorphic threat
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(120, now + 0.9);
        gain.gain.setValueAtTime(0.22, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
        osc.start(now); osc.stop(now + 1.0);
    } else if (attackType === 'PHISHING_CAMPAIGN') {
        // Social / chime sound — human deception
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.setValueAtTime(1100, now + 0.15);
        osc.frequency.setValueAtTime(660, now + 0.3);
        gain.gain.setValueAtTime(0.15, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc.start(now); osc.stop(now + 0.5);
    } else {
        // Generic threat fallback
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.4);
        gain.gain.setValueAtTime(0.25, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc.start(now); osc.stop(now + 0.5);
    }
}

// ── Voice Announcer (TTS) ───────────────────────────────────────────────────
class VoiceAnnouncer {
    constructor() {
        this.enabled = false;
        this.synth = window.speechSynthesis;
        this.voice = null;
    }

    init() {
        if (!this.synth) return;
        const voices = this.synth.getVoices();
        // Prefer a mechanical/system voice, fallback to any English
        this.voice = voices.find(v => v.name.includes('Google') && v.lang.includes('en')) ||
            voices.find(v => v.lang === 'en-US' || v.lang === 'en-GB') ||
            voices[0];
    }

    toggle() {
        this.enabled = !this.enabled;
        if (this.enabled && !this.voice) this.init();
        return this.enabled;
    }

    speak(text) {
        if (!this.enabled || !this.synth) return;
        this.synth.cancel(); // Interrupt current speech for urgency
        const utterance = new SpeechSynthesisUtterance(text);
        if (this.voice) utterance.voice = this.voice;
        utterance.rate = 1.15; // Slightly faster
        utterance.pitch = 0.9; // Lower system pitch
        this.synth.speak(utterance);
    }
}
const voiceSynth = new VoiceAnnouncer();
if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = () => voiceSynth.init();
}

const voiceBtn = document.getElementById('voice-btn');
if (voiceBtn) {
    voiceBtn.addEventListener('click', () => {
        const isOn = voiceSynth.toggle();
        if (isOn) {
            voiceBtn.textContent = '🔊 VOICE: ON';
            voiceBtn.style.color = '#39ff14';
            voiceBtn.style.borderColor = '#39ff14';
            voiceBtn.style.boxShadow = 'inset 0 0 10px rgba(57,255,20,0.2)';
            voiceSynth.speak('Voice announcer, online.');
        } else {
            voiceBtn.textContent = '🔊 VOICE: OFF';
            voiceBtn.style.color = '#00f5ff';
            voiceBtn.style.borderColor = '#00f5ff';
            voiceBtn.style.boxShadow = 'inset 0 0 10px rgba(0,245,255,0.2)';
            voiceSynth.synth.cancel();
        }
    });
}

// ── Canvas Setup ────────────────────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const glitch = document.getElementById('glitchCanvas');
const gl = glitch.getContext('webgl') || glitch.getContext('experimental-webgl');

function resizeCanvas() {
    const arena = document.getElementById('arena');
    const W = arena.clientWidth;
    const H = arena.clientHeight;
    canvas.width = glitch.width = W;
    canvas.height = glitch.height = H;
    // Dynamic core scaling based on height (split-screen mode check)
    CORE_RADIUS = Math.max(30, Math.min(54, H * 0.15));
    if (gl) { gl.viewport(0, 0, W, H); }
    initBgStars();
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ── Background Star Field ───────────────────────────────────────────────────
function initBgStars() {
    state.bgStars = Array.from({ length: 120 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.2 + 0.2,
        a: Math.random(),
        speed: Math.random() * 0.3 + 0.05,
    }));
}

// ── WebGL Glitch Shader ─────────────────────────────────────────────────────
let glitchProgram = null;
let glitchTimeUniform = null;
let glitchIntUniform = null;

function initWebGL() {
    if (!gl) return;

    const vert = `
    attribute vec2 aPos;
    void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
  `;
    const frag = `
    precision mediump float;
    uniform float uTime;
    uniform float uIntensity;
    uniform vec2  uRes;

    float rand(vec2 co) {
      return fract(sin(dot(co.xy, vec2(12.9898,78.233))) * 43758.5453);
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / uRes;
      float intensity = uIntensity;
      if (intensity < 0.01) { gl_FragColor = vec4(0.0); return; }

      // Horizontal scan-line glitch bars
      float bar = floor(uv.y * 40.0 + uTime * 8.0);
      float glitch = rand(vec2(bar, uTime)) * intensity;
      float shift  = (rand(vec2(bar * 1.3, uTime * 0.7)) - 0.5) * 0.06 * intensity;

      uv.x += shift;

      // RGB chromatic aberration
      float r = rand(vec2(uv.x + shift,     uv.y)) * glitch * 0.8;
      float g = rand(vec2(uv.x,             uv.y)) * glitch * 0.4;
      float b = rand(vec2(uv.x - shift * 2.0, uv.y)) * glitch;

      // Only draw where glitch > threshold
      float show = step(0.65, rand(vec2(floor(uv.y * 60.0), uTime)));
      gl_FragColor = vec4(r, g, b, glitch * 0.35 * show * intensity);
    }
  `;

    function compile(type, src) {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        return s;
    }

    glitchProgram = gl.createProgram();
    gl.attachShader(glitchProgram, compile(gl.VERTEX_SHADER, vert));
    gl.attachShader(glitchProgram, compile(gl.FRAGMENT_SHADER, frag));
    gl.linkProgram(glitchProgram);
    gl.useProgram(glitchProgram);

    // Full-screen quad
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const aPosLoc = gl.getAttribLocation(glitchProgram, 'aPos');
    gl.enableVertexAttribArray(aPosLoc);
    gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, false, 0, 0);

    glitchTimeUniform = gl.getUniformLocation(glitchProgram, 'uTime');
    glitchIntUniform = gl.getUniformLocation(glitchProgram, 'uIntensity');

    const uRes = gl.getUniformLocation(glitchProgram, 'uRes');
    gl.uniform2f(uRes, glitch.width, glitch.height);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
}

initWebGL();

// ── Packet System ───────────────────────────────────────────────────────────
class Packet {
    constructor(type, eventData) {
        this.type = type;
        this.data = eventData;

        const side = Math.floor(Math.random() * 4);
        const W = canvas.width, H = canvas.height;
        const cx = W * 0.5, cy = H * 0.5;
        const pad = 30;
        switch (side) {
            case 0: this.x = Math.random() * W; this.y = -pad; break;
            case 1: this.x = W + pad; this.y = Math.random() * H; break;
            case 2: this.x = Math.random() * W; this.y = H + pad; break;
            case 3: this.x = -pad; this.y = Math.random() * H; break;
        }

        const dx = cx - this.x;
        const dy = cy - this.y;
        const dist = Math.hypot(dx, dy);
        const speed = type === 'threat' ? 3.2 + Math.random() * 1.5 : 2.0 + Math.random();

        this.vx = (dx / dist) * speed;
        this.vy = (dy / dist) * speed;
        this.radius = type === 'threat' ? 9 : 6;
        this.alive = true;
        this.exploded = false;
        this.alpha = 1;
        this.trail = [];
        this.color = type === 'threat' ? '#ff1744' : '#39ff14';
        this.glow = type === 'threat' ? 'rgba(255,23,68,0.6)' : 'rgba(57,255,20,0.6)';
    }

    update() {
        if (!this.alive) return;
        this.trail.push({ x: this.x, y: this.y, a: this.alpha });
        if (this.trail.length > 14) this.trail.shift();

        this.x += this.vx;
        this.y += this.vy;

        const cx = canvas.width * 0.5;
        const cy = canvas.height * 0.5;
        const dist = Math.hypot(cx - this.x, cy - this.y);

        if (dist < CORE_RADIUS + this.radius) {
            this.alive = false;
            this.exploded = true;
            if (this.type === 'threat') {
                spawnParticles(this.x, this.y, this.color, 22);
                triggerArenaAlert('threat');
            } else {
                spawnParticles(this.x, this.y, this.color, 8);
                triggerArenaAlert('safe');
            }
        }
    }

    draw() {
        if (!this.alive) return;
        for (let i = 0; i < this.trail.length; i++) {
            const t = this.trail[i];
            const frac = i / this.trail.length;
            ctx.beginPath();
            ctx.arc(t.x, t.y, this.radius * frac * 0.7, 0, Math.PI * 2);
            ctx.fillStyle = this.color + Math.floor(frac * 60).toString(16).padStart(2, '0');
            ctx.fill();
        }
        ctx.save();
        ctx.shadowBlur = 22;
        ctx.shadowColor = this.glow;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(this.x - this.radius * 0.25, this.y - this.radius * 0.25, this.radius * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.fill();
        ctx.restore();
    }
}

// ── Particle System ─────────────────────────────────────────────────────────
class Particle {
    constructor(x, y, color) {
        this.x = x; this.y = y;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 5 + 1.5;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed - Math.random() * 2;
        this.alpha = 1;
        this.decay = 0.035 + Math.random() * 0.04;
        this.radius = Math.random() * 4 + 1;
        this.color = color;
    }
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.12;
        this.alpha -= this.decay;
    }
    draw() {
        if (this.alpha <= 0) return;
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.alpha);
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.restore();
    }
}

function spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) { state.particles.push(new Particle(x, y, color)); }
}

// ── Core Server Renderer ─────────────────────────────────────────────────────
let coreGlowPulse = 0;
let coreThreatFlash = 0;

function drawCoreServer(t) {
    const cx = canvas.width * 0.5;
    const cy = canvas.height * 0.5;
    const R = CORE_RADIUS;

    coreGlowPulse += 0.02;
    const glowR = R + Math.sin(coreGlowPulse) * 6;

    ctx.save();
    for (let ring = 1; ring <= 3; ring++) {
        const ringR = R + ring * (R * 0.55); // Dynamic ring spacing
        const rotSpeed = ring * 0.003 * (ring % 2 === 0 ? 1 : -1);
        const segments = ring * 6;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(t * rotSpeed);
        for (let s = 0; s < segments; s++) {
            const angle = (s / segments) * Math.PI * 2;
            const px = Math.cos(angle) * ringR;
            const py = Math.sin(angle) * ringR;
            ctx.beginPath();
            ctx.arc(px, py, 2.5, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(0,245,255,${0.12 * ring})`;
            ctx.shadowBlur = 8;
            ctx.shadowColor = '#00f5ff';
            ctx.fill();
        }
        ctx.strokeStyle = `rgba(0,245,255,${0.06 * ring})`;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.arc(0, 0, ringR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    const grad = ctx.createRadialGradient(cx, cy, R * 0.4, cx, cy, glowR + 20);
    grad.addColorStop(0, coreThreatFlash > 0 ? 'rgba(255,23,68,0.6)' : 'rgba(0,245,255,0.55)');
    grad.addColorStop(0.6, coreThreatFlash > 0 ? 'rgba(255,23,68,0.12)' : 'rgba(0,245,255,0.12)');
    grad.addColorStop(1, 'transparent');
    ctx.beginPath();
    ctx.arc(cx, cy, glowR + 20, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(t * 0.005);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2 - Math.PI / 6;
        const hx = Math.cos(angle) * R;
        const hy = Math.sin(angle) * R;
        i === 0 ? ctx.moveTo(hx, hy) : ctx.lineTo(hx, hy);
    }
    ctx.closePath();
    const coreColor = coreThreatFlash > 0 ? '#ff1744' : '#00f5ff';
    ctx.strokeStyle = coreColor;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 30;
    ctx.shadowColor = coreColor;
    ctx.stroke();

    const innerGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.9);
    innerGrad.addColorStop(0, coreThreatFlash > 0 ? 'rgba(255,23,68,0.25)' : 'rgba(0,245,255,0.20)');
    innerGrad.addColorStop(1, 'rgba(3,3,8,0.85)');
    ctx.fillStyle = innerGrad;
    ctx.fill();
    
    // Dynamic font size
    const fontSize = Math.max(8, R * 0.18);
    ctx.font = `bold ${fontSize}px 'Share Tech Mono', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = coreColor;
    ctx.shadowBlur = 12;
    ctx.shadowColor = coreColor;
    ctx.fillText('CORE', 0, -7);
    ctx.fillText('SERVER', 0, 7);
    ctx.restore();

    if (coreThreatFlash > 0) coreThreatFlash -= 0.04;
}

// ── Arena Alert ─────────────────────────────────────────────────────────────
function triggerArenaAlert(type) {
    const arena = document.getElementById('arena');
    arena.classList.remove('threat-alert', 'safe-pulse');
    void arena.offsetWidth;
    if (type === 'threat') {
        arena.classList.add('threat-alert');
        coreThreatFlash = 1;
        state.glitchIntensity = 1.0;
        state.screenShake = 18; // Trigger shake
        audio.play('threat');
    } else {
        arena.classList.add('safe-pulse');
        audio.play('block'); // Subtle feedback for safe packets
    }
}

// ── EXP Popup ──────────────────────────────────────────────────────────────
function spawnExpPopup(x, y, text, type) {
    const el = document.createElement('div');
    el.className = `exp-popup${type === 'threat' ? ' threat' : ''}`;
    el.textContent = text;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    document.getElementById('arena').appendChild(el);
    setTimeout(() => el.remove(), 1900);
}

// ── Combo Meter ─────────────────────────────────────────────────────────────
function updateCombo(increment) {
    if (!increment) { state.comboCount = 0; }
    else { state.comboCount = Math.min(state.comboCount + 1, 99); }

    clearTimeout(state.comboTimer);
    const display = document.getElementById('combo-display');
    const label = document.getElementById('combo-label');

    if (state.comboCount > 1) {
        label.textContent = `×${state.comboCount}`;
        display.classList.add('active');
        label.style.animation = 'none';
        void label.offsetWidth;
        label.style.animation = '';
        state.comboTimer = setTimeout(() => {
            display.classList.remove('active');
            state.comboCount = 0;
        }, 3000);
    } else {
        display.classList.remove('active');
    }
}

// ── Threat Log ─────────────────────────────────────────────────────────────
function addLogEntry(event) {
    const container = document.getElementById('log-entries');
    const el = document.createElement('div');
    const isSafe = event.event === 'SAFE';
    el.className = `log-entry${isSafe ? ' safe' : ''}`;
    const icon = isSafe ? '🟢' : '🔴';
    const type = event.attack_type || 'UNKNOWN';
    const ip = event.origin_ip || '???.???.???.???';
    const ns = event.block_speed_ns != null ? `${event.block_speed_ns}ns` : '—';
    el.textContent = `${icon} ${type} · ${ip} · ${ns}`;
    container.insertBefore(el, container.firstChild);
    while (container.children.length > 8) container.removeChild(container.lastChild);
}

// ── HUD Updates ─────────────────────────────────────────────────────────────
function updateHUD() {
    document.getElementById('hud-threats').textContent = state.threats.toLocaleString();
    state.computeSaved += 0.04 + (state.threatLevel / 100) * 0.3;
    document.getElementById('hud-compute').textContent = state.computeSaved.toFixed(2) + ' ms';
    const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
    const h = String(Math.floor(elapsed / 3600)).padStart(2, '0');
    const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, '0');
    const s = String(elapsed % 60).padStart(2, '0');
    document.getElementById('hud-uptime').textContent = `${h}:${m}:${s}`;
    state.threatLevel = Math.max(0, state.threatLevel - 0.3);
    const pct = Math.min(100, state.threatLevel);
    document.getElementById('threat-bar').style.width = pct + '%';
    const levelEl = document.getElementById('hud-level');
    if (pct < 25) levelEl.textContent = 'NOMINAL';
    else if (pct < 55) levelEl.textContent = 'ELEVATED';
    else if (pct < 80) levelEl.textContent = 'CRITICAL';
    else levelEl.textContent = '⚠ BREACH';
}

// ════════════════════════════════════════════════════════════════════════════
// FEATURE 3 — AI DEBRIEF NOTIFICATION (BLUE TEAM TUTOR)
// ════════════════════════════════════════════════════════════════════════════

let debriefTypewriterTimer = null;

function showAIDebrief(attackType) {
    const debrief = document.getElementById('ai-debrief');
    const titleEl = document.getElementById('debrief-title');
    const bodyEl = document.getElementById('debrief-body');

    const config = AI_DEBRIEF[attackType] || AI_DEBRIEF.UNKNOWN;

    // Cancel any running debrief
    clearTimeout(state.debriefTimer);
    clearInterval(debriefTypewriterTimer);
    debrief.classList.remove('hidden', 'slide-in');
    bodyEl.innerHTML = '';
    titleEl.textContent = config.title;

    // Trigger slide-in
    requestAnimationFrame(() => {
        debrief.classList.add('slide-in');
    });

    // Typewriter on body text (strip tags for typewriter, re-inject raw HTML after)
    // Phase 4: Threat Actor Attribution
    const actor = THREAT_ACTORS[Math.floor(Math.random() * THREAT_ACTORS.length)];
    const actorHTML = `<div style="margin-top:10px; padding:6px; background:rgba(255,165,0,0.1); border-left:2px solid orange; font-size:0.6rem;">
        <strong>SUSPECTED ACTOR:</strong> ${actor.name}<br>
        <strong>TACTIC:</strong> ${actor.tactic}
    </div>`;

    const bodyHTML = `<span>${config.body}</span>${actorHTML}`;
    const plainText = bodyHTML.replace(/<[^>]+>/g, '');
    let i = 0;
    debriefTypewriterTimer = setInterval(() => {
        i++;
        // Show proportional chunk of the HTML (simple approach: reveal by char count)
        const visible = bodyHTML.substring(0, findHTMLPos(bodyHTML, i));
        bodyEl.innerHTML = visible + (i < plainText.length ? '<span class="cursor">▋</span>' : '');
        if (i >= plainText.length) {
            clearInterval(debriefTypewriterTimer);
            bodyEl.innerHTML = bodyHTML + `<br><br><span id="dive-link" style="color:var(--neon-cyan); cursor:pointer; text-decoration:underline; font-weight:bold;">[TECHNICAL DEEP DIVE]</span>`;
            document.getElementById('dive-link').onclick = () => openCodeFix(attackType);
        }
    }, 18);

    // Auto-dismiss after 20 seconds (increased from 8s)
    state.debriefTimer = setTimeout(() => {
        debrief.classList.remove('slide-in');
        setTimeout(() => debrief.classList.add('hidden'), 500);
    }, 20000);
}

// Maps plain-text character index back to position in HTML string (skips tags)
function findHTMLPos(html, charTarget) {
    let count = 0;
    let i = 0;
    while (i < html.length && count < charTarget) {
        if (html[i] === '<') {
            while (i < html.length && html[i] !== '>') i++;
        } else {
            count++;
        }
        i++;
    }
    return i;
}

// ── Phase 3 Modal Logic ──────────────────────────────────────────────────────
function openCodeFix(type) {
    const fix = CODE_FIXES[type];
    if (!fix) return;

    document.getElementById('fix-title').textContent = `Deep Dive: ${type.replace(/_/g, ' ')}`;
    document.getElementById('code-bad').textContent = fix.bad;
    document.getElementById('code-good').textContent = fix.good;
    document.getElementById('fix-explanation').textContent = fix.desc;

    document.getElementById('code-fix-overlay').classList.add('open');
}

function closeCodeFix() {
    document.getElementById('code-fix-overlay').classList.remove('open');
}

document.getElementById('fix-close').onclick = closeCodeFix;
document.getElementById('code-fix-overlay').onclick = (e) => {
    if (e.target === document.getElementById('code-fix-overlay')) closeCodeFix();
};

// ── Glossary Sidebar ──
function initGlossary() {
    const list = document.getElementById('glossary-content');
    list.innerHTML = GLOSSARY.map(item => `
        <div class="glossary-item">
            <div class="glossary-term">${item.term}</div>
            <div class="glossary-def">${item.def}</div>
        </div>
    `).join('');

    document.getElementById('knowledge-btn').onclick = () => {
        document.getElementById('glossary-panel').classList.toggle('open');
    };

    document.getElementById('close-glossary').addEventListener('click', () => {
        document.getElementById('glossary-panel').classList.remove('open');
    });
}
initGlossary();

// ── Phase 4 Logic ───────────────────────────────────────────────────────────
function triggerNetworkPulse(isThreat) {
    const dot = document.getElementById('pulse-dot');
    dot.setAttribute('fill', isThreat ? '#ff1744' : '#00f5ff');
    dot.setAttribute('opacity', '1');

    // Simple 3-stage animation via CSS or JS. Let's do a simple translation.
    dot.animate([
        { cx: 50, opacity: 1 },
        { cx: 300, opacity: 1, offset: 0.3 },
        { cx: 550, opacity: 1, offset: 0.7 },
        { cx: 750, opacity: 0 }
    ], {
        duration: 1200,
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
    });
}

function addMatrixLog(msg) {
    const stream = document.getElementById('matrix-stream');
    const line = document.createElement('div');
    line.className = 'matrix-line';
    line.textContent = `> ${msg}`;
    stream.appendChild(line);
    if (stream.children.length > 25) stream.removeChild(stream.firstChild);
}

const SYSTEM_LOGS = [
    "[eBPF] Hooking syscall...", "[WAF] Inspecting AST...", "[RUST] Memory safe...",
    "[CORE] Health nominal", "[AI] Pattern matching...", "[WASM] Gen 2 Patch active",
    "[NET] Intercepting frame", "[OS] Context switch OK"
];
setInterval(() => {
    if (Math.random() > 0.7) {
        addMatrixLog(SYSTEM_LOGS[Math.floor(Math.random() * SYSTEM_LOGS.length)]);
    }
}, 2000);

// ── Ouroboros Engine Panel ────────────────────────────────────────────────────
function showOuroborosPanel() {
    const debrief = document.getElementById('ai-debrief');
    const titleEl = document.getElementById('debrief-title');
    const bodyEl = document.getElementById('debrief-body');

    clearTimeout(state.debriefTimer);
    clearInterval(debriefTypewriterTimer);
    debrief.classList.remove('hidden', 'slide-in');
    debrief.classList.add('ouroboros-mode');

    titleEl.textContent = '🧬 Ouroboros Engine — Initiating Evolution Cycle...';
    bodyEl.innerHTML = '';

    const steps = [
        '► Mutating collected attack variants in isolation sandbox...',
        '► Identifying detection gap: comment-based SQL evasion (/**/)...',
        '► Phi-3 LLM generating virtual patch suggestion...',
        '► Ghost Engine compiling Wasm module: comment_stripper_v2.wasm...',
        '► Patch deployed. All future comment-evasion variants: <strong style="color:#39ff14">BLOCKED</strong>.',
        '► Evo Points +10 | Detection Coverage: 97.4% → 98.1%',
    ];

    requestAnimationFrame(() => debrief.classList.add('slide-in'));

    let stepIdx = 0;
    const stepInterval = setInterval(() => {
        if (stepIdx >= steps.length) {
            clearInterval(stepInterval);
            state.debriefTimer = setTimeout(() => {
                debrief.classList.remove('slide-in', 'ouroboros-mode');
                setTimeout(() => debrief.classList.add('hidden'), 500);
            }, 3000);
            return;
        }
        const line = document.createElement('div');
        line.innerHTML = steps[stepIdx];
        line.style.marginBottom = '4px';
        line.style.opacity = '0';
        bodyEl.appendChild(line);
        requestAnimationFrame(() => { line.style.transition = 'opacity 0.4s'; line.style.opacity = '1'; });
        stepIdx++;
    }, 700);
}

// ── WebSocket Handler ────────────────────────────────────────────────────────
function connectWS() {
    console.log(`[IronWall+] Attempting connection to ${WS_URL}...`);
    if (state.ws) {
        state.ws.close(); // HARDENING: Prevent socket leaks by closing existing instance
    }
    const statusEl = document.getElementById('ws-status');
    state.ws = new WebSocket(WS_URL);

    state.ws.onopen = () => {
        statusEl.textContent = '● CONNECTED';
        statusEl.style.color = '#39ff14';
        console.log('[IronWall+] WebSocket connected');
        // Announce system ready on first connect
        if (!state._announced) {
            state._announced = true;
            try {
                if (window.speechSynthesis) {
                    // Cancel any pending speech first
                    window.speechSynthesis.cancel();
                    const utt = new SpeechSynthesisUtterance(
                        'IronWall Plus. System ready. All defenses online. Threat grid active.'
                    );
                    utt.rate = 0.9;
                    utt.pitch = 0.7;
                    utt.volume = 1.0;
                    // Small delay to let browser initialize audio
                    setTimeout(() => window.speechSynthesis.speak(utt), 400);
                }
            } catch (e) { /* voice optional */ }
        }
    };

    state.ws.onclose = (event) => {
        statusEl.textContent = '◌ RECONNECTING...';
        statusEl.style.color = '#ff6b35';
        console.warn(`[IronWall+] WebSocket closed: code=${event.code} reason=${event.reason || 'none'}`);
        setTimeout(connectWS, 2500);
    };

    state.ws.onerror = () => {
        statusEl.textContent = '✕ NO SERVER';
        statusEl.style.color = '#ff1744';
    };

    state.ws.onmessage = (msg) => {
        let event;
        try { event = JSON.parse(msg.data); } catch { return; }
        handleTelemetryEvent(event);
    };
}

function handleTelemetryEvent(event) {
    const isThreat = event.event === 'BLOCKED';

    // Phase 4: Pulse & Matrix
    triggerNetworkPulse(isThreat);
    addMatrixLog(isThreat ? `[BLOCKED] ${event.attack_type}` : `[SAFE] Packet accepted`);

    const packet = new Packet(isThreat ? 'threat' : 'safe', event);
    state.packets.push(packet);

    if (isThreat) {
        state.threats++;
        state.computeSaved += event.compute_saved_ms || 0;
        state.threatLevel = Math.min(100, state.threatLevel + (event.severity || 30));

        // ── Per-Attack Unique Sound FX
        playAttackSound(event.attack_type, audio.ctx);

        // ── Threat Heat Ring
        state.heatRingIntensity = Math.min(1, state.heatRingIntensity + 0.6);

        // ── Stats tracking
        const at = event.attack_type || 'UNKNOWN';
        state.attackCounts[at] = (state.attackCounts[at] || 0) + 1;
        if (event.block_speed_ns) state.blockTimes.push(event.block_speed_ns);
        const dmgMap = {
            SQL_INJECTION: 120000, XSS_INJECTION: 80000, PATH_TRAVERSAL: 60000,
            DDOS_SWARM: 500000, ZERO_DAY_MUTATOR: 450000, MIRROR_PROBE: 50000,
            PHISHING_CAMPAIGN: 70000
        };
        state.damagePrevented += (dmgMap[at] || 30000);

        // ── Replay Log
        state.replayLog.push({ type: at, ts: Date.now() });
        if (state.replayLog.length > 10) state.replayLog.shift();
        updateReplayFeed();

        // ── World Map ping
        spawnWorldMapPing(at);

        // ── Live Stats refresh
        updateStatsPanel();

        // ── Feature 3: Trigger AI Debrief ──
        showAIDebrief(event.attack_type || 'UNKNOWN');

        // ── Voice Announcement (native Web Speech API) ──
        try {
            if (window.speechSynthesis) {
                const friendlyName = (event.attack_type || 'UNKNOWN').replace(/_/g, ' ');
                const utt = new SpeechSynthesisUtterance(`Warning, ${friendlyName} attack identified.`);
                utt.rate = 1.1; utt.pitch = 0.8;
                window.speechSynthesis.speak(utt);
            }
        } catch (e) { /* voice optional */ }

        // ── Ouroboros: show evolution notice on Zero-Day or Mirror ──
        if (event.attack_type === 'ZERO_DAY_MUTATOR' || event.attack_type === 'MIRROR_PROBE') {
            setTimeout(() => showOuroborosPanel(), 1500);
        }
    }

    addLogEntry(event);
}

// ── WebGL Glitch Render ──────────────────────────────────────────────────────
let glitchTime = 0;
function renderGlitch() {
    if (!gl || !glitchProgram) return;
    glitchTime += 0.016;
    state.glitchIntensity = Math.max(0, state.glitchIntensity - 0.025);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(glitchProgram);
    gl.uniform1f(glitchTimeUniform, glitchTime);
    gl.uniform1f(glitchIntUniform, state.glitchIntensity);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

// ── Background Stars ─────────────────────────────────────────────────────────
function drawBgStars() {
    for (const star of state.bgStars) {
        star.a += star.speed * 0.01;
        const alpha = (Math.sin(star.a) + 1) * 0.5 * 0.6 + 0.1;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,245,255,${alpha.toFixed(2)})`;
        ctx.fill();
    }
}

// ── Grid Background ──────────────────────────────────────────────────────────
function drawGrid() {
    const W = canvas.width, H = canvas.height;
    const step = 55;
    ctx.strokeStyle = 'rgba(0,245,255,0.04)';
    ctx.lineWidth = 0.5;
    for (let x = 0; x < W; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
}

// ── Main Animation Loop ────────────────────────────────────────────────────
let lastHUDUpdate = 0;
function loop(t) {
    requestAnimationFrame(loop);

    ctx.fillStyle = '#030308';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Apply Screen Shake
    if (state.screenShake > 0) {
        const sx = (Math.random() - 0.5) * state.screenShake;
        const sy = (Math.random() - 0.5) * state.screenShake;
        ctx.translate(sx, sy);
        state.screenShake *= 0.9;
        if (state.screenShake < 0.5) state.screenShake = 0;
    }

    drawGrid();
    drawBgStars();
    drawCoreServer(t);

    state.packets = state.packets.filter(p => p.alive);
    for (const p of state.packets) { p.update(); p.draw(); }

    state.particles = state.particles.filter(p => p.alpha > 0);
    for (const p of state.particles) { p.update(); p.draw(); }

    renderGlitch();

    if (t - lastHUDUpdate > 50) {
        updateHUD();
        lastHUDUpdate = t;
    }
}
 
// ── Role Enforcement (Multi-Device) ──────────────────────────────────────────
function enforceRole() {
    const urlParams = new URLSearchParams(window.location.search);
    const isLobbySession = urlParams.has('host') || urlParams.has('ws');
    
    if (isLobbySession) {
        // Hide regular navigation buttons as we are in a dedicated device role
        const navActions = document.querySelector('.header-actions');
        if (navActions) {
            navActions.style.display = 'none';
        }
        
        // Add a "Leave Session" button
        const header = document.getElementById('header');
        if (header) {
            const leaveBtn = document.createElement('button');
            leaveBtn.textContent = '🏠 LEAVE SESSION';
            leaveBtn.className = 'record-btn';
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

enforceRole();
initNavProxy();
 
// ── Boot ────────────────────────────────────────────────────────────────────
connectWS();
requestAnimationFrame(loop);

// Demo: removed auto-fire packets to ensure attacks only trigger from control panel

// ── Victory Scorecard ────────────────────────────────────────────────────────
function showScorecard() {
    const overlay = document.createElement('div');
    overlay.id = 'scorecard-overlay';
    overlay.style = `position:fixed; inset:0; background:rgba(3,3,8,0.95); z-index:5000; display:flex; align-items:center; justify-content:center;`;

    const card = document.createElement('div');
    card.style = `width:90%; max-width:500px; background:#030a16; border:1px solid #00f5ff; padding:40px; border-radius:12px; font-family:'Orbitron', monospace; text-align:center; box-shadow: 0 0 50px rgba(0,245,255,0.3);`;

    card.innerHTML = `
        <h2 style="color:#39ff14; text-shadow:0 0 10px #39ff14; margin-bottom:20px;">DEPLOYMENT SUCCESSFUL</h2>
        <div style="font-size:0.8rem; color:#00f5ff; margin-bottom:30px;">SESSION PERFORMANCE REPORT</div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; text-align:left; margin-bottom:40px;">
            <div><span style="color:#aaa; font-size:0.6rem;">THREATS NEUTRALIZED:</span><br><span style="font-size:1.2rem;">${state.threats}</span></div>
            <div><span style="color:#aaa; font-size:0.6rem;">EVOLUTIONS CYCLES:</span><br><span style="font-size:1.2rem;">${Math.floor(state.threats / 5)}</span></div>
            <div><span style="color:#aaa; font-size:0.6rem;">UPTIME:</span><br><span style="font-size:1.2rem;">99.999%</span></div>
            <div><span style="color:#aaa; font-size:0.6rem;">SECURITY SCORE:</span><br><span style="font-size:1.2rem; color:#39ff14;">S+ ALPHA</span></div>
        </div>
        <button onclick="location.reload()" style="background:none; border:1px solid #00f5ff; color:#00f5ff; padding:10px 30px; cursor:pointer; font-family:'Orbitron'; font-weight:bold;">REBOOT SYSTEM</button>
    `;

    overlay.appendChild(card);
    document.body.appendChild(overlay);
    if (audio.enabled) audio.play('evolution');
}

// Bind Escape key to show scorecard during demo
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') showScorecard();
});

// ── Heat Ring Decay (called in main draw loop) ────────────────────────────────
// Integrated into the existing animation loop - decays over time
setInterval(() => {
    if (state.heatRingIntensity > 0) {
        state.heatRingIntensity = Math.max(0, state.heatRingIntensity - 0.02);
    }
}, 50);

// ── World Attack Map ──────────────────────────────────────────────────────────
const wmCanvas = document.getElementById('worldMapCanvas');
const wmCtx = wmCanvas ? wmCanvas.getContext('2d') : null;
const worldPings = []; // { x, y, age, color }

// Approximate city coordinates mapped to canvas (normalized 0-1)
const WORLD_CITIES = [
    [0.22, 0.28], [0.18, 0.32], [0.27, 0.38], [0.35, 0.30], [0.48, 0.38],
    [0.52, 0.30], [0.55, 0.26], [0.62, 0.34], [0.70, 0.28], [0.75, 0.42],
    [0.78, 0.48], [0.65, 0.50], [0.58, 0.56], [0.50, 0.62], [0.34, 0.52],
    [0.25, 0.55], [0.15, 0.50], [0.10, 0.40], [0.42, 0.60], [0.72, 0.60],
];

const ATTACK_COLORS = {
    SQL_INJECTION: '#ff6b35', XSS_INJECTION: '#ff1744', PATH_TRAVERSAL: '#ffd700',
    DDOS_SWARM: '#ff0080', ZERO_DAY_MUTATOR: '#bf5fff', MIRROR_PROBE: '#00f5ff',
    PHISHING_CAMPAIGN: '#39ff14', UNKNOWN: '#ffffff',
};

function spawnWorldMapPing(attackType) {
    if (!wmCtx) return;
    const city = WORLD_CITIES[Math.floor(Math.random() * WORLD_CITIES.length)];
    const w = wmCanvas.width, h = wmCanvas.height;
    worldPings.push({
        x: city[0] * w, y: city[1] * h, age: 0,
        color: ATTACK_COLORS[attackType] || '#ffffff'
    });
    if (worldPings.length > 20) worldPings.shift();
}

function drawWorldMap() {
    if (!wmCtx || !wmCanvas) return;
    wmCanvas.width = wmCanvas.offsetWidth;
    wmCanvas.height = wmCanvas.offsetHeight;
    const w = wmCanvas.width, h = wmCanvas.height;
    wmCtx.clearRect(0, 0, w, h);

    // Simple dot map of world
    wmCtx.fillStyle = 'rgba(0,245,255,0.04)';
    wmCtx.fillRect(0, 0, w, h);

    // City dots
    WORLD_CITIES.forEach(([nx, ny]) => {
        wmCtx.beginPath();
        wmCtx.arc(nx * w, ny * h, 1.5, 0, Math.PI * 2);
        wmCtx.fillStyle = 'rgba(0,245,255,0.2)';
        wmCtx.fill();
    });

    // Target crosshair in India ~center-right
    const tx = 0.63 * w, ty = 0.44 * h;
    wmCtx.strokeStyle = 'rgba(0,245,255,0.5)';
    wmCtx.lineWidth = 0.8;
    wmCtx.beginPath(); wmCtx.moveTo(tx - 6, ty); wmCtx.lineTo(tx + 6, ty); wmCtx.stroke();
    wmCtx.beginPath(); wmCtx.moveTo(tx, ty - 6); wmCtx.lineTo(tx, ty + 6); wmCtx.stroke();
    wmCtx.beginPath(); wmCtx.arc(tx, ty, 5, 0, Math.PI * 2);
    wmCtx.strokeStyle = 'rgba(0,245,255,0.6)'; wmCtx.stroke();

    // Draw and age pings
    for (let i = worldPings.length - 1; i >= 0; i--) {
        const p = worldPings[i];
        p.age++;
        const life = Math.max(0, 1 - p.age / 80);
        if (life <= 0) { worldPings.splice(i, 1); continue; }

        // Travel line from origin to target
        wmCtx.beginPath();
        wmCtx.moveTo(p.x, p.y);
        wmCtx.lineTo(tx, ty);
        wmCtx.strokeStyle = `${p.color}${Math.floor(life * 80).toString(16).padStart(2, '0')}`;
        wmCtx.lineWidth = 0.8;
        wmCtx.setLineDash([3, 4]);
        wmCtx.stroke();
        wmCtx.setLineDash([]);

        // Expanding ring at origin
        const r = (p.age % 30) * 1.5;
        wmCtx.beginPath();
        wmCtx.arc(p.x, p.y, r, 0, Math.PI * 2);
        wmCtx.strokeStyle = `${p.color}${Math.floor(life * 120).toString(16).padStart(2, '0')}`;
        wmCtx.lineWidth = 0.6;
        wmCtx.stroke();

        // Dot at origin
        wmCtx.beginPath();
        wmCtx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
        wmCtx.fillStyle = p.color;
        wmCtx.globalAlpha = life;
        wmCtx.fill();
        wmCtx.globalAlpha = 1;
    }
}

setInterval(drawWorldMap, 50);

// ── Stats Panel ───────────────────────────────────────────────────────────────
function updateStatsPanel() {
    // Top threat
    let topThreat = '--', topCount = 0;
    Object.entries(state.attackCounts).forEach(([k, v]) => {
        if (v > topCount) { topCount = v; topThreat = k.replace(/_/g, ' '); }
    });
    const topEl = document.getElementById('stat-top-threat');
    if (topEl) topEl.textContent = topThreat;

    // Damage prevented
    const dmgEl = document.getElementById('stat-damage');
    if (dmgEl) {
        const lakh = state.damagePrevented / 100000;
        dmgEl.textContent = lakh >= 1 ? `₹${lakh.toFixed(1)}L` : `₹${(state.damagePrevented / 1000).toFixed(0)}K`;
    }

    // Avg block time
    const avgEl = document.getElementById('stat-avg-block');
    if (avgEl && state.blockTimes.length > 0) {
        const avg = state.blockTimes.reduce((a, b) => a + b, 0) / state.blockTimes.length;
        avgEl.textContent = `${Math.round(avg)}ns`;
    }

    // Attack breakdown bars
    const barsEl = document.getElementById('stats-bars');
    if (!barsEl) return;
    const entries = Object.entries(state.attackCounts).sort((a, b) => b[1] - a[1]);
    const maxVal = entries.length > 0 ? entries[0][1] : 1;
    barsEl.innerHTML = entries.slice(0, 6).map(([k, v]) => `
        <div class="stats-bar-row">
            <div class="stats-bar-label">${k.split('_')[0]}</div>
            <div class="stats-bar-track"><div class="stats-bar-fill" style="width:${(v / maxVal) * 100}%"></div></div>
            <div class="stats-bar-count">${v}</div>
        </div>`).join('');

    // Sparkline
    drawSparkline();
}

function drawSparkline() {
    const sc = document.getElementById('sparklineCanvas');
    if (!sc) return;
    sc.width = sc.offsetWidth;
    const sCtx = sc.getContext('2d');
    const logs = state.replayLog;
    if (logs.length < 2) return;
    const w = sc.width, h = sc.height;
    sCtx.clearRect(0, 0, w, h);
    sCtx.strokeStyle = '#a855f7';
    sCtx.lineWidth = 1.5;
    sCtx.beginPath();
    const now = Date.now();
    const span = 60000; // 60 second window
    logs.forEach((e, i) => {
        const x = ((now - e.ts) / span);
        const cx = w - x * w;
        const cy = h * 0.5 + (Math.sin(i) * h * 0.3);
        i === 0 ? sCtx.moveTo(cx, cy) : sCtx.lineTo(cx, cy);
        sCtx.fillStyle = ATTACK_COLORS[e.type] || '#fff';
        sCtx.beginPath(); sCtx.arc(cx, cy, 2.5, 0, Math.PI * 2); sCtx.fill();
        sCtx.beginPath(); sCtx.moveTo(cx, cy);
    });
    sCtx.stroke();
}

// Stats toggle button
const statsBtn = document.getElementById('stats-btn');
const statsPanel = document.getElementById('stats-panel');
const statsClose = document.getElementById('stats-close');
if (statsBtn && statsPanel) {
    statsBtn.addEventListener('click', () => {
        statsPanel.classList.toggle('hidden');
        if (!statsPanel.classList.contains('hidden')) updateStatsPanel();
    });
    if (statsClose) statsClose.addEventListener('click', () => statsPanel.classList.add('hidden'));
}

// ── Attack Replay ─────────────────────────────────────────────────────────────
function updateReplayFeed() {
    const feed = document.getElementById('replay-feed');
    if (!feed) return;
    feed.innerHTML = state.replayLog.map(e =>
        `<span class="replay-chip">${e.type.split('_')[0]}</span>`
    ).join('');
}

const replayBtn = document.getElementById('replay-btn');
if (replayBtn) {
    replayBtn.addEventListener('click', () => {
        if (state.replayLog.length === 0) return;
        replayBtn.disabled = true;
        replayBtn.textContent = '⏳ REPLAYING...';
        const feed = document.getElementById('replay-feed');
        if (feed) feed.innerHTML = '';
        state.replayLog.forEach((entry, i) => {
            setTimeout(() => {
                // Visually re-trigger the chip
                if (feed) {
                    const chip = document.createElement('span');
                    chip.className = 'replay-chip';
                    chip.textContent = entry.type.split('_')[0];
                    feed.appendChild(chip);
                }
                // Re-trigger map ping, sound, and packet animation
                spawnWorldMapPing(entry.type);
                playAttackSound(entry.type, audio.ctx);
                const p = new Packet('threat', { attack_type: entry.type });
                state.packets.push(p);
                
                state.heatRingIntensity = Math.min(1, state.heatRingIntensity + 0.25);
                if (i === state.replayLog.length - 1) {
                    setTimeout(() => {
                        replayBtn.disabled = false;
                        replayBtn.textContent = '▶ REPLAY SIEGE';
                    }, 800);
                }
            }, i * 700);
        });
    });
}

// ════════════════════════════════════════════════════════════════════════════
// FEATURE 8 — GAMIFICATION PHASE 2: ACTIVE DEFENSE QUIZZES
// ════════════════════════════════════════════════════════════════════════════

const QUIZ_DATA = {
    SQL_INJECTION: {
        q: "How do we prevent SQL Injection at the application layer?",
        opts: [
            { text: "Base64 encode all user inputs", correct: false },
            { text: "Use Parameterized Queries (Prepared Statements)", correct: true },
            { text: "Block CORS requests", correct: false }
        ]
    },
    XSS_INJECTION: {
        q: "Which technique prevents Reflected XSS from executing in the browser?",
        opts: [
            { text: "Content-Security-Policy (CSP) and context-aware escaping", correct: true },
            { text: "Using HTTPS instead of HTTP", correct: false },
            { text: "Disabling Right-Click on the webpage", correct: false }
        ]
    },
    PATH_TRAVERSAL: {
        q: "How do we secure file uploads against Path Traversal (e.g. ../../etc/passwd)?",
        opts: [
            { text: "Store files in a hidden directory", correct: false },
            { text: "Sanitize filenames using an explicit Allow-List", correct: true },
            { text: "Encrypt the database", correct: false }
        ]
    },
    DDOS_SWARM: {
        q: "A massive botnet is overwhelming exactly one API endpoint. How do we mitigate this?",
        opts: [
            { text: "Restart the backend server repeatedly", correct: false },
            { text: "Increase the size of the database connection pool", correct: false },
            { text: "Implement adaptive Rate Limiting and SYN Cookies at the Edge", correct: true }
        ]
    },
    ZERO_DAY_MUTATOR: {
        q: "Zero-days have no known static signatures. What is our best defense strategy?",
        opts: [
            { text: "Behavioral Heuristics and eBPF kernel sandboxing", correct: true },
            { text: "Updating our antivirus signature database daily", correct: false },
            { text: "Changing the server IP address every week", correct: false }
        ]
    }
};

const completedQuizzes = new Set();
const quizOverlay = document.getElementById('quiz-overlay');

function triggerQuiz(attackType) {
    if (!quizOverlay || !QUIZ_DATA[attackType] || completedQuizzes.has(attackType)) return;
    completedQuizzes.add(attackType);

    const quiz = QUIZ_DATA[attackType];
    document.getElementById('quiz-question').textContent = quiz.q;
    const optsContainer = document.getElementById('quiz-options');
    optsContainer.innerHTML = '';

    const shuffledOpts = [...quiz.opts].sort(() => Math.random() - 0.5);

    shuffledOpts.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'quiz-opt-btn';
        btn.textContent = opt.text;
        btn.onclick = () => handleQuizAnswer(btn, opt.correct, optsContainer);
        optsContainer.appendChild(btn);
    });

    quizOverlay.classList.remove('hidden');
    requestAnimationFrame(() => quizOverlay.classList.add('open'));
    if (audio.enabled) audio.play('phish');
}

function handleQuizAnswer(btn, isCorrect, container) {
    Array.from(container.children).forEach(b => {
        b.disabled = true;
        b.style.pointerEvents = 'none';
        if (b === btn) {
            b.classList.add(isCorrect ? 'correct' : 'wrong');
        }
    });

    if (isCorrect) {
        if (audio.enabled) audio.play('block');
        const arena = document.getElementById('arena');
        spawnExpPopup(arena.clientWidth / 2, arena.clientHeight / 2 - 100, `+500 BONUS EXP`, 'safe');
    } else {
        if (audio.enabled) audio.play('blocked');
        state.threatLevel = Math.min(100, state.threatLevel + 20);
        updateHUD();
    }

    setTimeout(() => {
        quizOverlay.classList.remove('open');
        setTimeout(() => quizOverlay.classList.add('hidden'), 320);
    }, 1800);
}

// ════════════════════════════════════════════════════════════════════════════
// FEATURE 9 — GAMIFICATION PHASE 3: PHISHING MINIGAME
// ════════════════════════════════════════════════════════════════════════════

const PHISHING_EMAILS = [
    {
        from: "admin@ironwa11.com",
        subject: "Urgent: Mandatory MFA Reset",
        body: "A recent security audit has flagged your account for suspicious activity. You must reset your MFA token within 2 hours or face suspension.",
        link: "https://auth.ironwall.corp-mfa.com/reset",
        isPhish: true
    },
    {
        from: "hr@ironwall.com",
        subject: "Q3 Bonus Structure Finalized",
        body: "Please review the attached portal document for the finalized Q3 bonus structures.",
        link: "https://ironwall.myworkday.com/q3_bonus_doc",
        isPhish: false
    },
    {
        from: "it-support@lronwall.com", /* lower-case L » lronwall */
        subject: "Password Expiry Notice",
        body: "Your Active Directory password will expire in 24 hours. Please click the link to update your credentials.",
        link: "https://ironwall.auth-provider-update.com/login",
        isPhish: true
    }
];

let phishingTimer = null;
let currentPhishBox = null;

function schedulePhishing() {
    clearTimeout(phishingTimer);
    const delay = 40000 + Math.random() * 50000;
    phishingTimer = setTimeout(() => {
        triggerPhishingModal();
    }, delay);
}

function triggerPhishingModal() {
    const email = PHISHING_EMAILS[Math.floor(Math.random() * PHISHING_EMAILS.length)];
    currentPhishBox = email;

    document.getElementById('phish-subject').textContent = email.subject;
    document.getElementById('phish-from').textContent = email.from;
    document.getElementById('phish-content').textContent = email.body;
    document.getElementById('phish-bad-link').textContent = email.link;

    const overlay = document.getElementById('phishing-overlay');
    overlay.classList.remove('hidden');
    requestAnimationFrame(() => overlay.classList.add('open'));

    if (audio.enabled) audio.play('phish');
}

function handlePhishingChoice(action) {
    const overlay = document.getElementById('phishing-overlay');
    const isPhish = currentPhishBox.isPhish;

    overlay.classList.remove('open');
    setTimeout(() => overlay.classList.add('hidden'), 400);

    if (action === 'report') {
        if (isPhish) {
            if (audio.enabled) audio.play('block');
            spawnExpPopup(window.innerWidth - 200, window.innerHeight - 200, "+1000 SOCIAL DEFENSE", "safe");
        } else {
            if (audio.enabled) audio.play('blocked');
            spawnExpPopup(window.innerWidth - 200, window.innerHeight - 200, "-200 FALSE ALARM", "threat");
            state.threatLevel = Math.min(100, state.threatLevel + 5);
        }
    } else if (action === 'open') {
        if (isPhish) {
            if (audio.enabled) audio.play('threat');
            triggerMassiveBreach();
        } else {
            spawnExpPopup(window.innerWidth - 200, window.innerHeight - 200, "WORKFLOW CONTINUED", "safe");
        }
    }
    updateHUD();
    schedulePhishing();
}

function triggerMassiveBreach() {
    state.threatLevel = 100;
    state.glitchIntensity = 1.0;
    state.screenShake = 40;
    updateHUD();

    const w = document.body.clientWidth / 2;
    const h = document.body.clientHeight / 2;
    spawnExpPopup(w, h, "SYSTEM COMPROMISED", "threat");
    spawnExpPopup(w, h + 50, "CREDENTIALS STOLEN", "threat");

    addMatrixLog("[CRITICAL] Internal network breached via compromised user endpoint.");
    showAIDebrief('PHISHING_CAMPAIGN');
}

document.getElementById('phish-report-btn')?.addEventListener('click', () => handlePhishingChoice('report'));
document.getElementById('phish-bad-link')?.addEventListener('click', (e) => { e.preventDefault(); handlePhishingChoice('open'); });
document.getElementById('phish-open-btn')?.addEventListener('click', () => handlePhishingChoice('open'));

// Initialize Phishing Engine
schedulePhishing();
