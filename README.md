# ⚡ IronWall+ — Gamethon Demo

> Real-time cyberpunk network defense game. Judges attack, IronWall blocks, the crowd watches. Now with local streaming AI.

---

## 🚀 Live Demo (Cloud Deployment)

The project is deployed on Render and ready to test instantly:

- 🛡️ **Defense Grid (Big Screen)**: [ironwall-frontend.onrender.com](https://ironwall-frontend.onrender.com)
- 🗡️ **Attacker Panel (Phone)**: [ironwall-frontend.onrender.com/attacker.html](https://ironwall-frontend.onrender.com/attacker.html)

No installation required! Just open the links and start attacking.

---

## Local Quick Start (Optional)

### 1. Start the Rust backend
```powershell
cd backend
cargo run
```
Server starts on two ports:
- `ws://localhost:9001/ws` → WebSocket telemetry (game board)
- `http://localhost:8080`  → Pingora proxy (attack interception)

### 2. Open the frontend
Open both files directly in a browser (no build step needed):

| File | Purpose |
|------|---------|
| `frontend/index.html` | **Main Game Board** — project on the big screen |
| `frontend/lobby.html` | **WiFi Bridge** — easy connection for multiple devices |
| `frontend/attacker.html` | **Judge Controller** — open on phone / second tab |

---

## 📱 Multi-Device Setup (Judge Connectivity)

IronWall+ now features a built-in **WiFi Bridge (Lobby)** for easy judge connection:

1.  **Host**: Start the app on your main PC and open `index.html`.
2.  **Lobby Code**: Look at the top header for the 4-digit **LOBBY CODE** (e.g. `4496`).
3.  **Share**: Click the **Share** button next to the code to copy a direct join link.
4.  **Join**: On any phone/tablet on the same WiFi, open the link or go to `http://[YOUR-IP]:3000/lobby.html` and enter the code.
5.  **Sync**: Attacks fired from the mobile panel now reflect instantly on the main board!

---

## Architecture

```
Judge phone (attacker.html)
        │  WebSocket payload
        ▼
[LAYER 1] Pingora Proxy :8080
        │  ThreatDictionary.classify() — < 1µs RegEx
        │  BLOCKED? → drop + broadcast event
        │  SAFE?    → forward to Core Server
        ▼
[LAYER 2] axum WebSocket :9001
        │  tokio broadcast channel
        ▼
Game Board (index.html)  ←── live telemetry
  Canvas animations + WebGL glitch shader
```

## 🎮 Gamification & Educational Mechanics

IronWall+ is uniquely gamified for an engaging hackathon presentation:

1. **Hacker Progression System**: The Attacker Panel features an RPG-like leveling system. Users start as "Script Kiddies" and must land attacks to earn EXP, eventually unlocking advanced payloads (DDoS, Zero-Days).
2. **Vulnerability Patch Quizzes**: Upon catching an attack type for the first time, IronWall+ interrupts the Defense Grid with a multiple-choice pop-up quiz testing the defender on how to properly patch the root vulnerability in the source code.
3. **Phishing Simulator**: A simulated email client periodically appears on the defense board; the presenter must identify whether a payload is legitimate or phishing to earn bonus security points (or trigger a massive system compromise).

## Attack Payloads (what each button fires)

| Button | Attack Type | Severity |
|--------|-------------|---------|
| 💉 SQL: Tautology | `SQL_INJECTION` | 85 |
| 🔗 SQL: Union-Based | `SQL_INJECTION` | 90 |
| ⏱ SQL: Blind/Time | `SQL_INJECTION` | 82 |
| 🕸️ XSS: Reflected | `XSS_INJECTION` | 80 |
| 💾 XSS: Stored | `XSS_INJECTION` | 95 |
| 📂 Path Traversal (Linux) | `PATH_TRAVERSAL` | 75 |
| 🪟 Path Traversal (Windows) | `PATH_TRAVERSAL` | 75 |
| 🌊 DDoS: SYN Flood | `DDOS_SWARM` | 95 |
| 🔊 DDoS: UDP Amp | `DDOS_SWARM` | 98 |
| ☢️ Zero-Day Mutator | `ZERO_DAY_MUTATOR` | 100 |
| 🌌 Mirror Probe | `MIRROR_PROBE` | 60 |
| 🎣 Phishing | (simulator) | — |

## Folder Structure
```
gamethon-demo/
├── Modelfile               ← Ollama ironwall-ai model config (speed-tuned Phi-3)
├── .cargo/config.toml      ← 2-thread compile, sccache
├── backend/
│   ├── Cargo.toml
│   └── src/main.rs         ← Pingora + ThreatDictionary + axum WS
└── frontend/
    ├── index.html           ← Game Board (Defense Grid)
    ├── attacker.html        ← Judge Mobile Controller
    ├── demo.html            ← Split-screen presentation mode
    ├── game.js              ← Canvas engine + WebGL glitch + scoring
    ├── attacker.js          ← Button → WS firing mechanism
    ├── chatbot.js           ← Streaming LLM client (Ollama NDJSON)
    ├── recorder.js          ← Browser screen recording
    └── style.css            ← Cyberpunk CRT aesthetic
```

> **Note:** This is a standalone hackathon demo. It does NOT modify the main `ironwall-plus/ironwall_rust` production codebase.
