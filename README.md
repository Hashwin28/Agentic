# Project Aegis (Anti-Gravity FinTech Edition)

Project Aegis is a simulated core-banking resilience and high-frequency continuity shield demonstration. It is built as a Multi-Agent System (MAS) via the Model Context Protocol (MCP) using NitroStack.

## Important Disclaimer

**This project is a simulation for demonstration purposes only.** 
There is no real bank, no real money, and no real customer data anywhere in this system. It does not connect to any real banking infrastructure. Everything runs against a mock in-memory ledger initialized with synthetic data.

## Math vs. Presentation Flavor

To evaluate this project accurately, it is important to delineate the actual mathematical implementations from the presentation terminology:

### Actual Mathematical & Systems Implementations:
- **Incremental SVD Sketching:** The `IncrementalSVDEngine` implements a real Frequent-Directions-style matrix sketch over a 4-dimensional telemetry vector. It operates in $O(k \cdot d)$ time, maintaining a baseline of nominal system behavior.
- **Exponential Decay & Filtering:** The sketch utilizes an exponential decay weighting ($\lambda = 0.95$) to adapt to volume growth and an $L_1$-norm clamp to reject extreme single-frame log corruptions.
- **Anomaly Detection:** The `residualError(x)` method mathematically computes the $L_2$ norm of the residual vector after projecting the current telemetry onto the healthy subspace: $\|(I - P_S)x\|$. Note: The anomaly threshold ($> 15.0$) is a tuned demo constant, not a derived statistical bound.
- **Remediation Patterns:**
  - **Request Coalescing:** The `SingleFlightGate` pattern safely deduplicates identical concurrent reads.
  - **Idempotency Locking:** The `IdempotencyEnforcer` calculates cryptographic hashes to mathematically reject duplicate submission attempts within a TTL window.
  - **Admission Control:** The `QosShunting` implements token-bucket based prioritization.

### Presentation "Flavor":
- The terms **"Anti-Gravity"**, **"Orbital Drift"**, **"Kinetic Mass"**, and **"Structural Collapse"** are presentation dressing to visually conceptualize standard load-shedding and telemetry-anomaly scenarios. They map directly to standard distributed systems concepts (e.g., "Orbital Drift" = SVD Subspace Residual Error, "Kinetic Mass" = Lock Contention).
- The agents (PRIME, ATLAS, CERBERUS, HERMES) act as standard MCP tool providers mapping to the remediation patterns above.

## Demonstration Modes

### Mock Mode (Default)
By default, the dashboard runs in "Mock mode", against an in-memory database generating synthetic, deterministic data.

### Live Validation Mode
This project includes a real, verifiable proof layer alongside the mock engine. The **Live validation mode** tests the system against a genuine local Postgres 15 instance under real Artillery-generated HTTP load, proving that the anomaly detection is triggering on actual connection-pool contention, not scripted telemetry data.

**To run the Live validation mode:**
1. Ensure Docker and Artillery are installed locally: `npm i -g artillery`
2. Start the database: `cd validation && docker-compose up -d`
3. Start the legacy core server: `node validation/legacy-core-server.js`
4. On the frontend dashboard, toggle the "Simulations" data source to **Live Validation Harness**.
5. Triggering the Salary Day Storm will now spawn a child process executing the `thundering-herd.yml` load spec against the local Postgres server.

*Note: While Live mode operates on real row-level ACID locks and connection pooling limits, it is still a local, single-machine demo rig and should not be considered a production core-banking environment.*
