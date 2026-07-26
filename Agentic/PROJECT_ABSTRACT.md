# Project Aegis — Architecture Abstract & Technical Specification

> **Intelligent SRE Shield for Core Banking System (CBS)**  
> *SVD-Subspace Anomaly Detection & Constrained Multi-Agent Remediation via NitroStack Model Context Protocol (MCP)*

---

## 1. Abstract

**Project Aegis** is an autonomous Site Reliability Engineering (SRE) and resilience orchestration platform tailored for high-concurrency Core Banking Systems (CBS). Modern banking infrastructure suffers from lock contention, thundering herd read surges (e.g., salary days), and duplicate mutation attempts (double-spending under latency spikes). 

Project Aegis resolves these failure modes by combining:
1. **Real-time 4D Telemetry Analysis** powered by an **Incremental Singular Value Decomposition (SVD)** subspace engine utilizing Frequent Directions matrix sketching and exponential windowing.
2. **A Constrained Multi-Agent Swarm** (`PRIME`, `ATLAS`, `CERBERUS`, `HERMES`) built on the **NitroStack MCP framework**, executing a transactional Saga pattern with automated rollback and deterministic emergency fail-safes.
3. **Hardware-Optimized Resilience Patterns** (Single-Flight Coalescing, SHA-256 Idempotency Interception, and Quality of Service (QoS) Traffic Shunting).
4. **NitroStack Kinetic Canvas Frontend**, rendering real-time orbital subspace residual metrics, agent swarm execution logs, and interactive controls.

---

## 2. System Architecture Overview

```mermaid
graph TD
    subgraph Client & Ingress Layer
        USER[Teller / Web / API Client] -->|HTTP / JSON| INGRESS[NitroStack Express Ingress: 0.0.0.0:PORT]
    end

    subgraph NitroStack MCP Server Layer
        INGRESS --> BANK_API[BankApiService]
        INGRESS --> MCP_APP[AegisApplication / McpApplicationFactory]
        
        BANK_API --> CBS[MockCBSService Ledger & Telemetry]
        
        subgraph Mathematical Engine
            CBS -->|Rolling 60-Sample Vector| SVD[IncrementalSVDEngine]
            SVD -->|Residual Norm Error > 15.0| ANOMALY[Anomaly Signal]
        end
        
        subgraph Multi-Agent Swarm
            MCP_APP --> PRIME[PrimeOrchestrator]
            ANOMALY -->|Saga Trigger| PRIME
            PRIME -->|Step 1: Traffic Shaping| ATLAS[AtlasSreAgent]
            PRIME -->|Step 2: Double-Spend Shield| CERBERUS[CerberusSecurityAgent]
            PRIME -->|Step 3: Audit & Broadcast| HERMES[HermesComplianceAgent]
        end

        subgraph Resilience Pattern Layer
            ATLAS --> SF[SingleFlightGate]
            ATLAS --> QOS[QosShunting]
            CERBERUS --> IDEM[IdempotencyEnforcer]
        end
    end

    subgraph Data & Storage Layer
        CBS -.->|Optional Persistent Backing| PG[(PostgreSQL Database)]
    end

    subgraph Frontend Layer
        MCP_APP -->|@Widget Binding| WIDGET[Next.js Kinetic Canvas UI]
    end
```

---

## 3. Backend Architecture & Components

The backend is built in **TypeScript / Node.js** utilizing `@nitrostack/core` dependency injection and Model Context Protocol (MCP) decorators (`@Module`, `@Injectable`, `@McpApp`, `@Tool`, `@Resource`, `@Widget`).

### 3.1. Core Banking Simulation (`MockCBSService`)
- **Ledger Management**: Simulates a high-concurrency relational core banking database with 500 seeded accounts, atomic debit/credit operations, and mutex-style write-locks.
- **Latency & Stress Injection**: Dynamic latency generation modeling lock contention under normal load (5–20ms) and stressed load (200–2000ms).
- **Graceful DB Startup**: Features a lazy PostgreSQL (`pg.Pool`) fallback connection routine wrapped in non-blocking `try-catch` blocks, ensuring container startup health checks pass even during database connection delays or `ECONNREFUSED`.

### 3.2. Mathematical SVD Engine (`IncrementalSVDEngine`)
- **4D Telemetry Stream**: Continuously monitors four system dimensions:
  1. $\mathbf{x}_1$: Queue Depth
  2. $\mathbf{x}_2$: Thread Occupancy (%)
  3. $\mathbf{x}_3$: Database Saturation (%)
  4. $\mathbf{x}_4$: Retry Rate (req/s)
- **Frequent Directions Matrix Sketching**: Maintains a compact $k \times d$ matrix sketch $B$ ($k=4, d=4$) updated incrementally via singular value shrinkage ($\sigma_i = \sqrt{\max(0, \sigma_i^2 - \sigma_k^2)}$).
- **Subspace Residual Calculation**: Computes the projection matrix $P_S = V_k V_k^T$ onto the healthy subspace. An anomaly is flagged when the orbital residual norm exceeds the calibrated threshold:
  $$\text{Residual Norm} = \| (I - P_S) \mathbf{x}_{\text{norm}} \|_2 > 15.0$$
- **L1-Norm Filtering & Cold-Start Guard**: Clamps extreme log corruptions via L1-norm thresholding and enforces a 60-vector warmup period to prevent false alarms during initial baseline convergence.

### 3.3. Bank API Service (`BankApiService`)
- **Express REST API**: Exposes core endpoints (`/api/v1/transfer`, `/api/v1/balance/:id`, `/api/v1/simulate-storm`).
- **Cloud Readiness**: Listens on `process.env.PORT || 3000` and explicitly binds to `'0.0.0.0'` for compatibility with NitroStack Cloud container ingress health probes.

---

## 4. Multi-Agent Swarm & Saga Remediation

Project Aegis uses a multi-agent orchestration architecture to automate incident remediation:

| Agent Name | Role | Primary Responsibilities & Pattern Flags |
| :--- | :--- | :--- |
| **PRIME** (`PrimeOrchestrator`) | Master Coordinator | Monitors SVD residuals, coordinates the 3-step Saga cascade, handles rollback on step failure, and enforces deterministic emergency fallback (`emergencyHardcodedShieldActivation`). |
| **ATLAS** (`AtlasSreAgent`) | SRE Specialist | Activates `SingleFlightGate` to coalesce duplicate read queries and enforces `QosShunting` to throttle background batch jobs. |
| **CERBERUS** (`CerberusSecurityAgent`) | Security Guard | Deploys `IdempotencyEnforcer` to compute SHA-256 payload hashes and intercept duplicate financial transactions. |
| **HERMES** (`HermesComplianceAgent`) | Compliance & Audit | Generates regulatory SOC2 Root Cause Analysis (RCA) filings with SVD metrics and dispatches alerts to teller dashboards. |

### 4.1. Resilience Patterns
1. **Single-Flight Coalescing (`SingleFlightGate`)**: Merges concurrent duplicate balance queries for the same account into a single execution, preventing read-lock starvation on core banking tables.
2. **Idempotency Enforcement (`IdempotencyEnforcer`)**: Hashes transaction parameters ($\text{SHA-256}(\text{from} \parallel \text{to} \parallel \text{amount} \parallel \text{nonce})$) and caches results for 15 seconds with LRU cache eviction (capped at 10,000 entries) to prevent double-spending.
3. **QoS Shunting (`QosShunting`)**: Implements priority-based admission control, reserving 90% bandwidth for financial transfers while throttling EOD batch jobs during elevated stress.

---

## 5. Frontend Architecture & Widgets

The user interface is developed as a modular **React / Next.js** application located in `src/widgets`, pre-compiled into static HTML artifacts (`out/`) and served directly via Express / NitroStack static routes:

- **`aegis-kinetic-canvas`**: Primary SRE Command Center. Features live orbital subspace 3D/2D vector visualizations, real-time SVD residual gauge meters, interactive synthetic storm triggers (*Salary Day Storm*, *P2P Surge*, *EOD Batch Collision*), and live multi-agent activity log streams.
- **`sre-control-panel`**: Dedicated dashboard for monitoring pattern status flags (`SingleFlight`, `Idempotency`, `QoS`) and manual emergency overrides.
- **`aegis-resilience-widget`**: Compact telemetry widget for embedding health metrics into third-party teller applications.

---

## 6. Technology Stack & Key Files

| Layer | Technologies Used | Key Workspace Files |
| :--- | :--- | :--- |
| **Core MCP Framework** | Node.js, TypeScript, `@nitrostack/core`, `@nitrostack/cli` | [`src/index.ts`](file:///c:/Users/Hashwin.M/Agentic/Agentic/src/index.ts), [`src/app.module.ts`](file:///c:/Users/Hashwin.M/Agentic/Agentic/src/app.module.ts) |
| **API & Server** | Express v5, CORS, Dotenv, `pg` | [`src/bank-api.service.ts`](file:///c:/Users/Hashwin.M/Agentic/Agentic/src/bank-api.service.ts), [`package.json`](file:///c:/Users/Hashwin.M/Agentic/Agentic/package.json) |
| **Mathematics & Linear Algebra** | `ml-matrix` (SVD, Matrix decomposition) | [`src/engine/incremental-svd.engine.ts`](file:///c:/Users/Hashwin.M/Agentic/Agentic/src/engine/incremental-svd.engine.ts) |
| **Multi-Agent Swarm** | Zod, Crypto, Child Process | [`src/agents/prime.orchestrator.ts`](file:///c:/Users/Hashwin.M/Agentic/Agentic/src/agents/prime.orchestrator.ts), [`src/agents/atlas.sre.ts`](file:///c:/Users/Hashwin.M/Agentic/Agentic/src/agents/atlas.sre.ts) |
| **Resilience Patterns** | SHA-256 LRU Cache, Single-Flight Gate | [`src/patterns/single-flight.ts`](file:///c:/Users/Hashwin.M/Agentic/Agentic/src/patterns/single-flight.ts), [`src/patterns/idempotency.ts`](file:///c:/Users/Hashwin.M/Agentic/Agentic/src/patterns/idempotency.ts) |
| **Frontend UI** | Next.js 14, React 18, HTML5 Canvas | `src/widgets/out/aegis-kinetic-canvas.html` |
| **Container & Cloud** | NitroStack Cloud v2 Runner, Docker | [`validation/docker-compose.yml`](file:///c:/Users/Hashwin.M/Agentic/Agentic/validation/docker-compose.yml) |
