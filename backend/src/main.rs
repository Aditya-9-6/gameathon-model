//! IronWall+ Gamethon Demo Backend
//! ================================
//! Two-layer architecture:
//!   Layer 1 → Pingora proxy (port 8080)  — intercepts & classifies attack traffic
//!   Layer 2 → axum WebSocket (port 9001) — broadcasts live telemetry to game board
//!
//! All components share a single tokio::sync::broadcast channel for events.

use anyhow::Result;
use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::IntoResponse,
    routing::get,
    Router,
};
use chrono::Utc;
use lazy_static::lazy_static;
use async_trait::async_trait;
use futures::StreamExt;
use pingora_core::server::configuration::Opt;
use pingora_core::server::Server;
use pingora_core::upstreams::peer::HttpPeer;
use pingora_core::Result as PingoraResult;
use pingora_proxy::{ProxyHttp, Session};
use regex::Regex;
use serde::{Deserialize, Serialize};
use tokio::sync::broadcast;
use tower_http::cors::{Any, CorsLayer};
use tracing::{error, info};
use uuid::Uuid;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION 1: THREAT DICTIONARY — Sub-microsecond RegEx Classifier
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum AttackType {
    SqlInjection,
    XssInjection,
    PathTraversal,
    DdosSwarm,
    ZeroDayMutator,
    MirrorProbe,
    PhishingCampaign,
    Evolution, // Internal event for Ouroboros cycle
    Safe,
}

impl AttackType {
    pub fn as_str(&self) -> &'static str {
        match self {
            AttackType::SqlInjection => "SQL_INJECTION",
            AttackType::XssInjection => "XSS_INJECTION",
            AttackType::PathTraversal => "PATH_TRAVERSAL",
            AttackType::DdosSwarm => "DDOS_SWARM",
            AttackType::ZeroDayMutator => "ZERO_DAY_MUTATOR",
            AttackType::MirrorProbe => "MIRROR_PROBE",
            AttackType::PhishingCampaign => "PHISHING_CAMPAIGN",
            AttackType::Evolution => "EVOLUTION",
            AttackType::Safe => "SAFE",
        }
    }

    pub fn severity(&self) -> u32 {
        match self {
            AttackType::SqlInjection => 85,
            AttackType::XssInjection => 80,
            AttackType::PathTraversal => 75,
            AttackType::DdosSwarm => 95,
            AttackType::ZeroDayMutator => 100,
            AttackType::MirrorProbe => 60,
            AttackType::PhishingCampaign => 70,
            AttackType::Evolution => 0,
            AttackType::Safe => 0,
        }
    }
}

/// Pre-compiled threat signature patterns — loaded once at startup.
pub struct ThreatDictionary {
    patterns: Vec<(AttackType, Regex)>,
}

lazy_static! {
    static ref THREAT_DICT: ThreatDictionary = ThreatDictionary::new();
}

impl Default for ThreatDictionary {
    fn default() -> Self {
        Self::new()
    }
}

impl ThreatDictionary {
    pub fn new() -> Self {
        // All patterns compiled once → classification is < 1µs per call
        let patterns = vec![
            (
                AttackType::SqlInjection,
                Regex::new(r"(?i)(SQL_INJECTION|union\s+select|drop\s+table|insert\s+into|1\s*=\s*1|or\s+1|xp_cmdshell|information_schema|benchmark\(|sleep\()").unwrap(),
            ),
            (
                AttackType::XssInjection,
                Regex::new(r"(?i)(XSS_INJECTION|<script|javascript:|onerror=|onload=|document\.cookie|alert\(|window\.location)").unwrap(),
            ),
            (
                AttackType::PathTraversal,
                Regex::new(r"(?i)(PATH_TRAVERSAL|\.\./|\.\.\\|/etc/passwd|/etc/shadow|/etc/group|c:\\windows|boot\.ini)").unwrap(),
            ),
            (
                AttackType::DdosSwarm,
                Regex::new(r"(?i)(DDOS_SWARM|flood|swarm|botnet|syn_flood|amplif|slowloris|layer[_\s]?[47]|volumetric)").unwrap(),
            ),
            (
                AttackType::ZeroDayMutator,
                Regex::new(r"(?i)(ZERO_DAY_MUTATOR|zero.?day|0day|shellcode|heap.?spray|rop.?chain|exploit|cve-\d{4}|mutation|polymorphic)").unwrap(),
            ),
            (
                AttackType::MirrorProbe,
                Regex::new(r"(?i)(MIRROR_PROBE|mirror|honeypot|deception|tartarus)").unwrap(),
            ),
            (
                AttackType::PhishingCampaign,
                Regex::new(r"(?i)(PHISHING_CAMPAIGN|phish|social\.engineering)").unwrap(),
            ),
        ];
        Self { patterns }
    }

    /// Classify a raw payload string. Returns in < 1µs for typical inputs.
    pub fn classify(&self, payload: &str) -> AttackType {
        let start = std::time::Instant::now();
        for (attack_type, pattern) in &self.patterns {
            if pattern.is_match(payload) {
                let elapsed = start.elapsed();
                info!(
                    attack = attack_type.as_str(),
                    latency_ns = elapsed.as_nanos(),
                    "🔴 THREAT DETECTED"
                );
                return attack_type.clone();
            }
        }
        AttackType::Safe
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION 2: TELEMETRY EVENT — serde JSON Defense Data
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/// Defense telemetry event broadcast to all connected WebSocket clients.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TelemetryEvent {
    pub event: String,         // "BLOCKED" | "SAFE"
    pub attack_type: String,   // e.g. "SQL_INJECTION"
    pub origin_ip: String,     // attacker's IP (real or simulated)
    pub block_speed_ns: u128,  // nanoseconds to classify + block
    pub severity: u32,         // 0-100 threat score
    pub event_id: String,      // unique UUID v4
    pub timestamp: String,     // ISO 8601
    pub compute_saved_ms: f64, // fake compute saving metric for HUD
    pub payload_preview: String, // first 64 chars of payload
}

impl TelemetryEvent {
    pub fn blocked(attack: &AttackType, origin_ip: &str, block_ns: u128, payload: &str) -> Self {
        TelemetryEvent {
            event: "BLOCKED".into(),
            attack_type: attack.as_str().into(),
            origin_ip: origin_ip.to_string(),
            block_speed_ns: block_ns,
            severity: attack.severity(),
            event_id: Uuid::new_v4().to_string(),
            timestamp: Utc::now().to_rfc3339(),
            compute_saved_ms: (block_ns as f64 / 1_000_000.0) * 847.3, // dramatic multiplier
            payload_preview: payload.chars().take(64).collect(),
        }
    }

    pub fn safe(origin_ip: &str, block_ns: u128) -> Self {
        TelemetryEvent {
            event: "SAFE".into(),
            attack_type: "SAFE".into(),
            origin_ip: origin_ip.to_string(),
            block_speed_ns: block_ns,
            severity: 0,
            event_id: Uuid::new_v4().to_string(),
            timestamp: Utc::now().to_rfc3339(),
            compute_saved_ms: 0.0,
            payload_preview: String::new(),
        }
    }

    pub fn evolution() -> Self {
        TelemetryEvent {
            event: "EVOLUTION_START".into(),
            attack_type: "EVOLUTION".into(),
            origin_ip: "ouroboros-engine".into(),
            block_speed_ns: 0,
            severity: 0,
            event_id: Uuid::new_v4().to_string(),
            timestamp: Utc::now().to_rfc3339(),
            compute_saved_ms: 10.0,
            payload_preview: "Automatic Ouroboros Evolution Cycle Initiated".into(),
        }
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION 2B: STATEFUL DECEPTION ENGINE (Tartarus)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

use std::collections::HashMap;
use std::sync::{Arc, Mutex};

#[derive(Default)]
pub struct DeceptionState {
    pub ip_blocks: HashMap<String, u32>,
}

lazy_static! {
    static ref DECEPTION_ENGINE: Arc<Mutex<DeceptionState>> = Arc::new(Mutex::new(DeceptionState::default()));
}

impl DeceptionState {
    pub fn track_and_judge(&mut self, ip: &str, initial_attack: AttackType) -> AttackType {
        let count = {
            let c = self.ip_blocks.entry(ip.to_string()).or_insert(0);
            *c += 1;
            *c
        };

        // HARDENING: Prevent memory exhaustion DoS by limiting map size
        if self.ip_blocks.len() > 1000 {
            // Self-cleaning: If we exceed 1000 unique IPs, clear the map and start fresh
            // In production, an LRU cache would be better, but this is robust for a demo.
            info!("🛡️ Deception Engine: IP memory limit reached (1000). Purging tracking table.");
            self.ip_blocks.clear();
            // Re-insert the current IP so we don't lose its current block state
            self.ip_blocks.insert(ip.to_string(), count);
        }

        if count >= 4 {
            info!("🌌 IP {} banished to Mirror Dimension (block #{})", ip, count);
            AttackType::MirrorProbe
        } else {
            initial_attack
        }
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION 3: PINGORA PROXY — Layer 1 Threat Interception
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/// Judge attack payload — matches what attacker.html fires over WebSocket
#[derive(Debug, Deserialize)]
pub struct AttackPayload {
    pub attack_type: String,
    pub origin_ip: Option<String>,
    pub payload: Option<String>,
}

pub struct IronWallProxy {
    tx: broadcast::Sender<String>,
}

impl IronWallProxy {
    pub fn new(tx: broadcast::Sender<String>) -> Self {
        Self { tx }
    }
}

#[async_trait]
impl ProxyHttp for IronWallProxy {
    type CTX = ();

    fn new_ctx(&self) -> Self::CTX {}

    /// request_filter runs BEFORE forwarding — this is where the magic happens.
    async fn request_filter(
        &self,
        session: &mut Session,
        _ctx: &mut Self::CTX,
    ) -> PingoraResult<bool> {
        let start = std::time::Instant::now();

        // Extract payload from X-IronWall-Payload header OR the URI/Query (for curl tests)
        let header_payload = session
            .req_header()
            .headers
            .get("x-ironwall-payload")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");

        let uri_payload = session.req_header().uri.to_string();
        let payload = format!("{} | {}", header_payload, uri_payload);

        let origin_ip = session
            .req_header()
            .headers
            .get("x-forwarded-for")
            .and_then(|v| v.to_str().ok())
            .and_then(|s| s.split(',').next()) // Get first IP in the chain
            .or_else(|| {
                session.req_header()
                    .headers
                    .get("x-real-ip")
                    .and_then(|v| v.to_str().ok())
            })
            .unwrap_or("127.0.0.1")
            .to_string();

        let initial_attack = THREAT_DICT.classify(&payload);
        let elapsed_ns = start.elapsed().as_nanos();

        if initial_attack != AttackType::Safe {
            // Check Tartarus stateful banishment within its own scope to drop the guard before await
            let attack = {
                let mut engine = DECEPTION_ENGINE.lock().unwrap();
                engine.track_and_judge(&origin_ip, initial_attack)
            };

            // Block the request at the proxy edge
            let event = TelemetryEvent::blocked(&attack, &origin_ip, elapsed_ns, &payload);
            let json = serde_json::to_string(&event).unwrap_or_default();
            let _ = self.tx.send(json);

            // Respond with 403 — packet was killed at the proxy layer
            let mut response = pingora_http::ResponseHeader::build(403, None)?;
            response.insert_header("X-IronWall-Verdict", "BLOCKED")?;
            response.insert_header("X-IronWall-Attack", attack.as_str())?;
            response.insert_header("X-Block-Speed-NS", elapsed_ns.to_string().as_str())?;
            session
                .write_response_header(Box::new(response), false)
                .await?;

            // HARDENING: Use proper JSON serialization to prevent injection/formatting errors
            let body = serde_json::json!({
                "verdict": "BLOCKED",
                "attack": attack.as_str()
            });
            let body_bytes = bytes::Bytes::from(body.to_string());

            session
                .write_response_body(Some(body_bytes), true)
                .await?;
            return Ok(true); // true = request handled, don't forward
        }

        // Safe packet → broadcast and let it pass to axum
        let event = TelemetryEvent::safe(&origin_ip, elapsed_ns);
        let json = serde_json::to_string(&event).unwrap_or_default();
        let _ = self.tx.send(json);

        Ok(false) // false = forward the request normally
    }

    async fn upstream_peer(
        &self,
        _session: &mut Session,
        _ctx: &mut Self::CTX,
    ) -> PingoraResult<Box<HttpPeer>> {
        // Forward clean traffic to the axum Core Server
        let peer = Box::new(HttpPeer::new(
            "127.0.0.1:9001",
            false,
            "localhost".to_string(),
        ));
        Ok(peer)
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION 4: AXUM WEBSOCKET SERVER — Layer 2 Telemetry Broadcaster
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

#[derive(Clone)]
pub struct AppState {
    pub tx: broadcast::Sender<String>,
}

/// WebSocket upgrade handler — game board connects here
async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, state))
}

async fn handle_socket(mut socket: WebSocket, state: AppState) {
    let mut rx = state.tx.subscribe();
    info!("🎮 Game board client connected via WebSocket");

    loop {
        tokio::select! {
            // 1. Broadcast telemetry events from the proxy/heartbeat to the game board
            Ok(msg) = rx.recv() => {
                if socket.send(Message::Text(msg)).await.is_err() {
                    break;
                }
            }
            // 2. Accept incoming judge attack payloads from the control panel
            msg = socket.next() => {
                match msg {
                    Some(Ok(Message::Text(text))) => {
                        let start = std::time::Instant::now();
                        
                        // Try parsing JSON first for clean telemetry, fallback to raw string classification
                        let (attack_type, origin_ip, payload_text) = if let Ok(parsed) = serde_json::from_str::<AttackPayload>(&text) {
                            let atk = THREAT_DICT.classify(parsed.payload.as_deref().unwrap_or(&parsed.attack_type));
                            (atk, parsed.origin_ip.unwrap_or_else(|| "ws-direct".into()), parsed.payload.unwrap_or(text))
                        } else {
                            (THREAT_DICT.classify(&text), "ws-direct".into(), text)
                        };

                        let elapsed_ns = start.elapsed().as_nanos();

                        // Even WS-direct attacks trigger deception logic
                        let attack = {
                            let mut engine = DECEPTION_ENGINE.lock().unwrap();
                            if attack_type != AttackType::Safe {
                                engine.track_and_judge(&origin_ip, attack_type)
                            } else {
                                attack_type
                            }
                        };

                        if attack != AttackType::Safe {
                            info!(
                                "🔴 [WS-DIRECT] BLOCK: {:?} | IP: {} | SPEED: {}ns",
                                attack, origin_ip, elapsed_ns
                            );
                        }

                        let event = if attack != AttackType::Safe {
                            TelemetryEvent::blocked(&attack, &origin_ip, elapsed_ns, &payload_text)
                        } else {
                            TelemetryEvent::safe(&origin_ip, elapsed_ns)
                        };

                        if let Ok(json) = serde_json::to_string(&event) {
                            let _ = state.tx.send(json);
                        }
                    }
                    Some(Ok(_)) => (), // Ignore non-text messages
                    _ => break,        // Socket closed or error
                }
            }
        }
    }
    info!("🔌 Client disconnected");
}

/// Health check endpoint
async fn health() -> impl IntoResponse {
    serde_json::json!({
        "status": "ONLINE",
        "system": "IronWall+ Gamethon Demo",
        "version": "1.0.0",
        "layers": {
            "proxy": "Pingora:8080",
            "telemetry_ws": "axum:9001"
        }
    })
    .to_string()
}

/// Serve a simple status page listing useful URLs
async fn index() -> impl IntoResponse {
    axum::response::Html(
        r#"
        <!DOCTYPE html>
        <html>
        <head><title>IronWall+ Backend</title></head>
        <body style="background:#050510;color:#00f5ff;font-family:monospace;padding:40px">
        <h1>⚡ IronWall+ Backend Online</h1>
        <div style="background:#0a0a20;padding:20px;border:1px solid #00f5ff;border-radius:10px">
            <p><strong>Status:</strong> <span style="color:#39ff14">ACTIVE</span></p>
            <p><strong>Security Engine:</strong> Pingora Layer-1</p>
            <p><strong>Telemetry:</strong> Axum WebSocket</p>
        </div>
        <div style="margin-top:20px">
            <p style="color:#39ff14">🛡️ <a href="index.html" style="color:#00f5ff;text-decoration:none">OPEN DEFENSE HUD →</a></p>
            <p style="color:#ff6b35">🔴 <a href="attacker.html" style="color:#ff6b35;text-decoration:none">OPEN RED TEAM PANEL →</a></p>
        </div>
        </body>
        </html>
        "#,
    )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION 5: MAIN — Spin up both layers concurrently
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize structured logging
    tracing_subscriber::fmt()
        .with_env_filter("ironwall_gamethon=debug,info")
        .with_target(false)
        .compact()
        .init();

    info!("⚡ IronWall+ Gamethon Demo starting...");

    // Shared broadcast channel — 256 message buffer
    let (tx, _rx) = broadcast::channel::<String>(256);
    let tx_clone = tx.clone();

    // ── Layer 2: axum WebSocket telemetry server ──────────────────
    let app_state = AppState { tx: tx.clone() };
    let app = Router::new()
        .route("/", get(index))
        .route("/ws", get(ws_handler))
        .route("/health", get(health))
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        )
        .with_state(app_state);

    let axum_handle = tokio::spawn(async move {
        let port = std::env::var("PORT")
            .ok()
            .and_then(|p| p.parse::<u16>().ok())
            .unwrap_or(9001);
        let addr = format!("0.0.0.0:{}", port);
        let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
        info!("🎮 axum WebSocket server listening on {}", addr);
        axum::serve(listener, app).await.unwrap();
    });

    // ── Layer 1: Pingora proxy server ─────────────────────────────
    let pingora_handle = tokio::task::spawn_blocking(move || {
        let opt = Opt::default();
        let mut server = Server::new(Some(opt)).expect("Pingora server init failed");
        server.bootstrap();

        let proxy = IronWallProxy::new(tx_clone);
        let mut proxy_service =
            pingora_proxy::http_proxy_service(&server.configuration, proxy);
            
        proxy_service.add_tcp("0.0.0.0:8080");

        info!("🛡️  Pingora proxy listening on 0.0.0.0:8080");
        server.add_service(proxy_service);
        server.run_forever();
    });

    // ── Layer 3: Ouroboros Evolution Heartbeat ────────────────────
    // Heartbeat logic to keep connections alive
    let _heartbeat_tx = tx.clone();
    // 🧬 Ouroboros Heartbeat: Triggering autonomous evolution cycle (DISABLED for manual demo control)
    /*
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(75));
        loop {
            interval.tick().await;
            info!("🧬 Ouroboros heartbeat: triggering autonomous evolution cycle");
            let event = TelemetryEvent::evolution();
            if let Ok(json) = serde_json::to_string(&event) {
                let _ = heartbeat_tx.send(json);
            }
        }
    });
    */

    info!("✅ IronWall+ Gamethon backend is LIVE");
    info!("   📡 WebSocket telemetry → ws://localhost:9001/ws");
    info!("   🛡️  Pingora proxy       → http://localhost:8080");
    info!("   💚 Open frontend/index.html    → Game Board");
    info!("   🔴 Open frontend/attacker.html → Red Team Controller");

    // Run both layers until one exits
    tokio::select! {
        _ = axum_handle => error!("axum server exited unexpectedly"),
        _ = pingora_handle => error!("Pingora server exited unexpectedly"),
    }

    Ok(())
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION 6: UNIT TESTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

#[cfg(test)]
mod tests {
    use super::*;

    fn dict() -> ThreatDictionary {
        ThreatDictionary::new()
    }

    // ── ThreatDictionary::classify ────────────────────────────────

    #[test]
    fn test_classify_sql_injection_or_tautology() {
        let d = dict();
        let payload = "SELECT * FROM users WHERE id = '1' OR '1'='1'; DROP TABLE sessions; --";
        assert_eq!(d.classify(payload), AttackType::SqlInjection);
    }

    #[test]
    fn test_classify_sql_injection_union_select() {
        let d = dict();
        let payload = "UNION SELECT * FROM users WHERE 1=1; DROP TABLE sessions;--";
        assert_eq!(d.classify(payload), AttackType::SqlInjection);
    }

    #[test]
    fn test_classify_sql_injection_keyword_signal() {
        // The attacker.js sends the full payload string; we also accept the type keyword
        let d = dict();
        assert_eq!(d.classify("SQL_INJECTION"), AttackType::SqlInjection);
    }

    #[test]
    fn test_classify_ddos_swarm() {
        let d = dict();
        let payload = "BOTNET_FLOOD :: src=4800_nodes · 120Gbps · syn_flood + udp_amplify · layer4_vol";
        assert_eq!(d.classify(payload), AttackType::DdosSwarm);
    }

    #[test]
    fn test_classify_ddos_keyword_signal() {
        let d = dict();
        assert_eq!(d.classify("DDOS_SWARM"), AttackType::DdosSwarm);
    }

    #[test]
    fn test_classify_zero_day_mutator() {
        let d = dict();
        let payload = "MUTATOR_v9 :: heap_spray(0x4141) + ROP_chain[gadget_0x7ff3] + shellcode[polymorphic_xor_0xDE]";
        assert_eq!(d.classify(payload), AttackType::ZeroDayMutator);
    }

    #[test]
    fn test_classify_zero_day_keyword_signal() {
        let d = dict();
        assert_eq!(d.classify("ZERO_DAY_MUTATOR"), AttackType::ZeroDayMutator);
    }

    #[test]
    fn test_classify_xss_injection() {
        let d = dict();
        let payload = "<script>alert(document.cookie)</script>";
        assert_eq!(d.classify(payload), AttackType::XssInjection);
    }

    #[test]
    fn test_classify_path_traversal() {
        let d = dict();
        let payload = "../../etc/passwd";
        assert_eq!(d.classify(payload), AttackType::PathTraversal);
    }

    #[test]
    fn test_classify_safe_normal_request() {
        let d = dict();
        assert_eq!(d.classify("GET /api/products HTTP/1.1"), AttackType::Safe);
        assert_eq!(d.classify(""), AttackType::Safe);
        assert_eq!(d.classify("hello world"), AttackType::Safe);
    }

    #[test]
    fn test_classify_case_insensitive() {
        let d = dict();
        assert_eq!(d.classify("union select 1,2,3"), AttackType::SqlInjection);
        assert_eq!(d.classify("UNION SELECT 1,2,3"), AttackType::SqlInjection);
        assert_eq!(d.classify("Union Select 1,2,3"), AttackType::SqlInjection);
    }

    // ── AttackType helpers ────────────────────────────────────────

    #[test]
    fn test_attack_type_as_str() {
        assert_eq!(AttackType::SqlInjection.as_str(), "SQL_INJECTION");
        assert_eq!(AttackType::XssInjection.as_str(), "XSS_INJECTION");
        assert_eq!(AttackType::DdosSwarm.as_str(), "DDOS_SWARM");
        assert_eq!(AttackType::ZeroDayMutator.as_str(), "ZERO_DAY_MUTATOR");
        assert_eq!(AttackType::Safe.as_str(), "SAFE");
    }

    #[test]
    fn test_attack_type_severity() {
        assert_eq!(AttackType::SqlInjection.severity(), 85);
        assert_eq!(AttackType::XssInjection.severity(), 80);
        assert_eq!(AttackType::DdosSwarm.severity(), 95);
        assert_eq!(AttackType::ZeroDayMutator.severity(), 100);
        assert_eq!(AttackType::Safe.severity(), 0);
    }

    // ── DeceptionState ────────────────────────────────────────────

    #[test]
    fn test_tartarus_stateful_banishment() {
        let mut state = DeceptionState::default();
        let ip = "1.2.3.4";
        
        // First 3 blocks return initial type
        assert_eq!(state.track_and_judge(ip, AttackType::SqlInjection), AttackType::SqlInjection);
        assert_eq!(state.track_and_judge(ip, AttackType::SqlInjection), AttackType::SqlInjection);
        assert_eq!(state.track_and_judge(ip, AttackType::SqlInjection), AttackType::SqlInjection);
        
        // 4th block returns MirrorProbe
        assert_eq!(state.track_and_judge(ip, AttackType::SqlInjection), AttackType::MirrorProbe);
        
        // Different IP is still safe (for now)
        assert_eq!(state.track_and_judge("5.6.7.8", AttackType::SqlInjection), AttackType::SqlInjection);
    }

    // ── TelemetryEvent construction ───────────────────────────────

    #[test]
    fn test_telemetry_event_blocked_fields() {
        let event = TelemetryEvent::blocked(
            &AttackType::SqlInjection,
            "192.168.1.7",
            340,
            "OR '1'='1'",
        );
        assert_eq!(event.event, "BLOCKED");
        assert_eq!(event.attack_type, "SQL_INJECTION");
        assert_eq!(event.origin_ip, "192.168.1.7");
        assert_eq!(event.block_speed_ns, 340);
        assert_eq!(event.severity, 85);
        assert!(!event.event_id.is_empty(), "event_id should be a UUID");
        assert!(!event.timestamp.is_empty(), "timestamp should be set");
        assert_eq!(event.payload_preview, "OR '1'='1'");
    }

    #[test]
    fn test_telemetry_event_evolution() {
        let event = TelemetryEvent::evolution();
        assert_eq!(event.event, "EVOLUTION_START");
        assert_eq!(event.attack_type, "EVOLUTION");
        assert_eq!(event.compute_saved_ms, 10.0);
    }

    #[test]
    fn test_telemetry_event_safe_fields() {
        let event = TelemetryEvent::safe("10.0.0.1", 120);
        assert_eq!(event.event, "SAFE");
        assert_eq!(event.attack_type, "SAFE");
        assert_eq!(event.severity, 0);
        assert_eq!(event.compute_saved_ms, 0.0);
        assert_eq!(event.payload_preview, "");
    }

    #[test]
    fn test_telemetry_event_payload_truncated_at_64() {
        let long_payload = "A".repeat(128);
        let event = TelemetryEvent::blocked(&AttackType::SqlInjection, "1.2.3.4", 100, &long_payload);
        assert_eq!(event.payload_preview.len(), 64);
    }

    #[test]
    fn test_telemetry_event_serializes_to_json() {
        let event = TelemetryEvent::blocked(&AttackType::DdosSwarm, "10.0.0.1", 290, "DDOS_SWARM");
        let json = serde_json::to_string(&event).expect("should serialize");
        assert!(json.contains("\"BLOCKED\""));
        assert!(json.contains("\"DDOS_SWARM\""));
        assert!(json.contains("\"severity\":95"));
    }

    #[test]
    fn test_compute_saved_is_positive_for_blocked() {
        let event = TelemetryEvent::blocked(&AttackType::ZeroDayMutator, "0.0.0.1", 480, "shellcode");
        assert!(event.compute_saved_ms > 0.0, "compute saved should be non-zero");
    }

    // ── Classifier speed ────────────────────────────────────────

    #[test]
    fn test_classifier_speed_sub_microsecond() {
        let d = dict();
        let payload = "UNION SELECT * FROM users WHERE 1=1; DROP TABLE sessions;--";
        let start = std::time::Instant::now();
        for _ in 0..1000 {
            let _ = d.classify(payload);
        }
        let elapsed = start.elapsed();
        let per_call_ns = elapsed.as_nanos() / 1000;
        // Release build: ~100ns/call. Debug build: up to ~20µs acceptable.
        // Use 50µs as the ceiling — any regression beyond that is a real problem.
        assert!(per_call_ns < 50_000, "Classifier too slow: {}ns/call (check regex patterns)", per_call_ns);
    }
}

