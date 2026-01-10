# Assessment: the production-grade solution

## Executive Summary

**Deployed on:** https://clave-take-home-3v808zaa5-daveddhs-projects.vercel.app

This solution prioritizes real-world operational concerns: vendor flexibility, cost predictability, horizontal scalability, and robust error recovery. Every architectural decision was made with production deployment in mind.

![SonarCloud Analysis](docs/sonar.png)

**Key Highlights:**

- **Zero AI vendor lock-in** — Swap between OpenAI, xAI, Groq, or any other, without code changes. *Switch providers overnight.*
- **Perfect code quality** — SonarQube shows 0 issues. *Less technical debt, faster onboarding.*
- **Horizontally scalable** — 100% stateless, Dockerized backend. *Scale by adding containers.*
- **Comprehensive testing** — 500+ tests, 90%+ coverage across all services. *Deploy with confidence.*
- **Research-backed Text-to-SQL** — C3 methodology ([paper](docs/C3-%20Zero-shot%20Text-to-SQL%20with%20ChatGPT.pdf)). *90% token savings vs few-shot.*
- **Cost-conscious design** — Real-time cost tracking, ~$1/client/month at 50 queries/day. *Predictable unit economics.*
- **AI observability** — Helicone integration for monitoring and debugging. *No guesswork in production.*
- **Unified TypeScript stack** — 100% TS across ETL, frontend, and backend, providing total type-safety. *One language, faster iteration.*
- **Clean separation of concerns** — Independent ETL, backend, and frontend projects. *Teams work in parallel.*
- **Medallion architecture** — Bronze/Silver/Gold data layers. *Clean data flow, easy debugging.*
- **Real-time streaming** — SSE for progressive AI responses. *Instant feedback, no spinners.*
- **Robust error handling** — Model escalation, SQL refinement, self-consistency, graceful fallbacks. *Uptime when LLMs fail.*
- **Intelligent data extraction** — Fuzzy matching with Levenshtein typo correction. *Handles messy POS data.*
- **Cohesive Vercel ecosystem** — Next.js, shadcn/ui, AI SDK on Vercel. *Faster time to market.*

## Quick Start

```bash
# 1. Run ETL
cd etl && source .env
npm run dev

# 2. Run Back
cd ../back && npm run dev

# 3. Run Front
cd ../front && npm run dev
```

## Thought Process

### 1. Data First

I started by understanding the problem and reading the raw data. I quickly discovered the Square catalog didn't contain all products — some items in orders had no matching catalog entry. This led me to research typo correction algorithms, where I found Levenshtein distance. I built scripts to test product matching, iterated on the approach, and eventually combined dynamic fuzzy matching with catalog-based extraction.

### 2. Schema Design & ETL

With the data understood, I analyzed common fields across sources and designed a normalized database schema. I then built the ETL pipeline in distinct phases: validation, preprocessing, and loading. This separation made debugging straightforward and allowed incremental reprocessing.

### 3. Gold Views

Once clean data was in the database, I reviewed the expected queries to identify common join patterns. I created denormalized Gold views with proper indexes — this simplifies the SQL the LLM needs to generate and improves query performance.

### 4. Text-to-SQL Research

I researched state-of-the-art Text-to-SQL approaches, reviewed leaderboards, and read several papers. The C3 methodology stood out: good accuracy with low implementation complexity. I built the AI pipeline skeleton using the Vercel AI SDK and implemented the C3 approach (clear prompting, calibration hints, self-consistency voting).

### 5. Chart System

For visualizations, I decided on a predefined set of chart types with controlled styling, strict types, and defined schemas. I wrapped shadcn chart components and connected the type definitions to the SQL query output — ensuring type safety from database to UI.

### 6. Iteration & Hardening

I tested various queries to check performance, fine-tuned prompts, added few-shot examples, and refined the Gold views. Once accuracy was acceptable, I added retry mechanisms, model escalation, and error recovery. Finally, I polished the frontend, fixed all SonarQube issues, added comprehensive tests, and validated the entire project in a fresh environment.

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (Next.js)                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐           │
│  │  Copilot View   │  │ Dashboard View  │  │   Widget Store  │           │
│  │ (Chat + Charts) │  │ (Drag-and-drop) │  │    (Zustand)    │           │
│  └────────┬────────┘  └─────────┬───────┘  └─────────────────┘           │
└───────────┼─────────────────────┼────────────────────────────────────────┘
            │                     │
            │    SSE Streaming    │
            ▼                     ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                          BACKEND (Express.js)                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        AI Pipeline                                  │   │
│  │  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐          │   │
│  │  │ Classify │ → │  Schema  │ → │   SQL    │ → │  Chart   │          │   │
│  │  │  Query   │   │  Linking │   │Generation│   │ Inference│          │   │
│  │  └──────────┘   └──────────┘   └──────────┘   └──────────┘          │   │
│  │                       ↓                                             |   │ 
│  │  ┌──────────────────────────────────────────────────────────────┐   │   │
│  │  │ Self-Consistency Voting │ Iterative Refinement │ Escalation  │   │   │
│  │  └──────────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    Model Abstraction Layer                          │   │
│  │         ┌─────────┐    ┌─────────┐    ┌─────────┐                   │   │
│  │         │   xAI   │    │ OpenAI  │    │  Groq   │                   │   │
│  │         └─────────┘    └─────────┘    └─────────┘                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                        DATABASE (PostgreSQL)                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                   │
│  │    GOLD     │    │   SILVER    │    │   BRONZE    │                   │
│  │    Views    │    │   Tables    │    │    (ETL)    │                   │
│  │ (Analytics) │    │(Normalized) │    │ (Raw JSON)  │                   │
│  └─────────────┘    └─────────────┘    └─────────────┘                   │
└──────────────────────────────────────────────────────────────────────────┘
```

## Technology Stack

### Frontend
| Technology   | Purpose           |
| ------------ | ----------------- |
| Next.js 16   | App Router, SSR   |
| shadcn/ui    | Component library |
| Tailwind CSS | Styling           |
| Recharts     | Visualizations    |
| Zustand      | State management  |
| @dnd-kit     | Drag-and-drop     |

### Backend
| Technology    | Purpose          |
| ------------- | ---------------- |
| Express.js    | HTTP server      |
| TypeScript    | Type safety      |
| Drizzle ORM   | Database queries |
| Vercel AI SDK | LLM integration  |

### ETL
| Technology  | Purpose           |
| ----------- | ----------------- |
| React + Ink | Interactive CLI   |
| Zod         | Schema validation |
| Levenshtein | Fuzzy matching    |

## Project Structure

```
clave-take-home/
├── back/                    # Express.js backend
│   ├── src/
│   │   ├── ai/              # AI pipeline
│   │   │   ├── models/      # LLM providers
│   │   │   └── actions/     # Query processing
│   │   ├── db/              # Database layer
│   │   ├── routes/          # API endpoints
│   │   └── utils/           # SSE, cost tracking
│   └── test_data/           # Test fixtures
│
├── front/                   # Next.js frontend
│   ├── src/
│   │   ├── app/             # Pages
│   │   ├── components/      # UI components
│   │   ├── stores/          # State management
│   │   └── types/           # TypeScript types
│   └── CLAUDE.md            # AI guidelines
│
├── etl/                     # Data pipeline
│   ├── cli.tsx              # Interactive CLI
│   ├── lib/                 # ETL utilities
│   └── gold_views.sql       # Analytics views
│
├── data/                    # Source data
│   └── sources/             # Raw JSON files
│
└── temp/                    # Architecture analysis
    ├── overview.md          # Evaluation synthesis
    └── 01-24 files          # Detailed analysis
```

## Key Files Reference

### Backend (`/back/src/`)
| File                                                | Purpose                 |
| --------------------------------------------------- | ----------------------- |
| `ai/models/index.ts`                                | Model abstraction layer |
| `ai/actions/processUserMessage/self-consistency.ts` | Multi-candidate voting  |
| `ai/actions/processUserMessage/escalation.ts`       | Progressive retry       |
| `ai/actions/processUserMessage/prompt.ts`           | Calibration hints       |
| `ai/actions/processUserMessage/sql-refinement.ts`   | Error-guided correction |
| `utils/sse.ts`                                      | SSE streaming           |
| `utils/cost.ts`                                     | Token cost tracking     |

### Frontend (`/front/src/`)
| File                     | Purpose                 |
| ------------------------ | ----------------------- |
| `app/copilot/page.tsx`   | Chat interface          |
| `app/dashboard/page.tsx` | Widget canvas           |
| `components/charts/`     | Chart components        |
| `stores/`                | Zustand state           |
| `CLAUDE.md`              | AI assistant guidelines |

### ETL (`/etl/`)
| File                    | Purpose             |
| ----------------------- | ------------------- |
| `cli.tsx`               | Interactive CLI     |
| `lib/preprocessor.ts`   | Data transformation |
| `lib/levenshtein.ts`    | Fuzzy matching      |
| `lib/product-groups.ts` | Product grouping    |
| `gold_views.sql`        | Analytics views     |


## AI Pipeline (C3 Methodology)

The Text-to-SQL pipeline implements the **[C3 (Clear Prompting, Calibration, Consistency)](https://arxiv.org/abs/2307.07306)** research methodology:

### 1. Clear Prompting
- **Schema Linking**: Only relevant tables/columns sent to LLM
- **Structured Layout**: Explicit separators and clear instructions
- **Token Efficiency**: ~1,000 tokens vs ~10,000 for few-shot

### 2. Calibration with Hints
Domain-specific tips correct known LLM biases:

```sql
-- Hint: Use Gold Views (pre-joined, optimized)
-- Hint: Money already in DOLLARS (no division needed)
-- Hint: Pivot second dimension for chart-friendly data
```

### 3. Consistent Output (Self-Consistency Voting)
```
Generate 3 SQL candidates (temp=0.0, 0.3, 0.5)
       ↓
Execute all candidates
       ↓
Group by result values
       ↓
Vote: select SQL from largest group
       ↓
Return SQL + confidence score
```

**Result**: ~82% execution accuracy with 90% token savings.

### 4. Iterative Refinement

When a generated SQL query fails execution, the system feeds the error message back to the LLM to generate a corrected query.

**Why Iterative Refinement?**
- **Higher success rate**: LLMs occasionally generate SQL with minor errors. Refinement gives the system a second chance to correct these mistakes.
- **Error-aware correction**: PostgreSQL error messages are highly informative (e.g., `column "sales" does not exist, did you mean "total_cents"?`). Feeding this context back enables targeted fixes.
- **No additional latency on success**: Refinement only triggers when the initial query fails.

```
Generate SQL → Execute → Success? → Return results
                  ↓
               Failed
                  ↓
         Feed error to LLM → Generate corrected SQL → Re-execute
                                                          ↓
                                                    Return or fail gracefully
```

### 5. Automatic Retry with Escalation

The system implements automatic retry with progressive escalation when LLM calls fail.

**Why Escalation?**
- **Graceful degradation**: Tries increasingly powerful configurations before giving up.
- **Cost efficiency**: Starts with chosen settings (often faster/cheaper), only escalating when needed.
- **Transparent to users**: Retries happen automatically.

**Escalation Order:**
```
Failure → Increase reasoning (if low) → Bigger model → Even bigger model → Max reasoning → Fail gracefully
```

| Step | Action                                            |
| ---- | ------------------------------------------------- |
| 1    | If reasoning = low, increase to high (same model) |
| 2    | Move to next bigger model                         |
| 3    | Continue to biggest model                         |
| 4    | If not at high reasoning, increase to high        |
| 5    | All options exhausted → friendly error message    |

Model hierarchy (smallest → biggest): `gpt-oss-20b` → `grok-4.1-fast` → `gpt-5.2`

## Data Architecture (Medallion Pattern)

### Bronze Layer (Raw)
- Source JSON files from Square, Toast, DoorDash
- No transformation, audit trail

### Silver Layer (Normalized)
```sql
-- Core tables
orders, order_items, locations, products,
product_variations, product_aliases, categories, payments
```

### Gold Layer (Analytics)
| View                       | Purpose              | Pre-Aggregation          |
| -------------------------- | -------------------- | ------------------------ |
| `gold_orders`              | Order-level analysis | Row-level with pre-joins |
| `gold_product_performance` | Product rankings     | By product               |
| `gold_daily_sales`         | Daily summaries      | By date                  |
| `gold_hourly_trends`       | Time patterns        | By hour                  |

**Gold View Benefits**:
- LLM generates simpler SQL (fewer JOINs)
- Money pre-converted to dollars
- Time fields pre-extracted
- Only completed orders

## Developer Experience

### TypeScript Everywhere
- 100% TypeScript with strict mode
- Drizzle ORM for type-safe queries
- Shared types for API contracts

### CLAUDE.md Guidelines
AI coding assistants follow documented standards:
- File size limits (400 lines max)
- Component patterns
- Naming conventions
- Anti-patterns to avoid

### Testing

All three projects have comprehensive Jest test suites with 80%+ coverage requirements.

```bash
# Run all tests
cd etl && npm test    # 96% coverage, 283 tests
cd back && npm test   # 98% coverage, 140 tests
cd front && npm test  # 95% coverage, 171 tests
```

#### ETL Tests (`/etl`)
| Module                  | Coverage | Description                     |
| ----------------------- | -------- | ------------------------------- |
| `lib/levenshtein.ts`    | 100%     | Fuzzy string matching algorithm |
| `lib/normalizers.ts`    | 99%      | Product name normalization      |
| `lib/product-groups.ts` | 95%      | Product grouping logic          |
| `lib/schemas/`          | 100%     | Zod schema validation           |
| `lib/preprocessor/`     | 95%      | Data transformation             |
| `lib/cli-actions/`      | 96%      | CLI command handlers            |

#### Backend Tests (`/back`)
| Module                     | Coverage | Description               |
| -------------------------- | -------- | ------------------------- |
| `utils/cost.ts`            | 100%     | Token cost calculation    |
| `utils/logger.ts`          | 100%     | Logging utilities         |
| `utils/sse.ts`             | 95%      | Server-Sent Events        |
| `db/schema.ts`             | 100%     | Database schema exports   |
| `db/metadata.ts`           | 100%     | Database metadata queries |
| `ai/actions/.../prompt.ts` | 100%     | C3 calibration prompts    |
| `constants/`               | 100%     | Environment configuration |

#### Frontend Tests (`/front`)
| Module                   | Coverage | Description                 |
| ------------------------ | -------- | --------------------------- |
| `stores/`                | 96%      | Zustand state management    |
| `lib/api.ts`             | 99%      | API client with SSE parsing |
| `hooks/useTypewriter.ts` | 100%     | Typewriter animation hook   |
| `components/layout/`     | 100%     | Layout components           |
| `components/chat/`       | 90%      | Chat UI components          |
| `components/dashboard/`  | 97%      | Dashboard components        |

## Scalability Design

### Zero Vendor Lock-in

```typescript
// Model abstraction enables seamless switching
const MODEL_HIERARCHY = ['gpt-oss-20b', 'grok-4.1-fast', 'gpt-5.2'];

// Adding a new provider: ~50 lines, ~30 minutes
export function createModel(provider: 'xai' | 'openai' | 'groq' | 'anthropic') {
  // Unified interface across all providers
}
```

### Stateless Backend
- No session storage
- Database-only state
- Ready for horizontal scaling

### Progressive Escalation
```
Failure → Increase reasoning → Bigger model → Max config → Graceful error
```

## Architecture Evolution

This demo uses a normalized PostgreSQL schema populated with data from the JSON files you provided. For production scale (1000+ restaurants, real-time events), the architecture would evolve as follows:

| Aspect             | Demo (Current)                      | Production                                     | Comparison                                                                             |
| ------------------ | ----------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------- |
| **Data Model**     | Normalized schema + Gold Views      | Event Sourcing + CQRS                          | · Audit trail<br>· Replay from any point in time<br>· Separate read/write optimization |
| **Tenancy**        | Single-tenant                       | Multi-tenant with RLS                          | · Automatic data isolation per restaurant<br>· Scales to 1000s of tenants              |
| **Data Ingestion** | One-time batch load from JSON files | Live webhooks from POS systems                 | · Real-time updates<br>· No manual ETL runs needed                                     |
| **Storage**        | Supabase Postgres                   | Hot (Redis)<br>Warm (TimescaleDB)<br>Cold (S3) | · 90% storage cost reduction<br>· Query speed matched to data freshness                |
| **Query Layer**    | Gold Views (manual refresh)         | Continuous aggregates (auto-refresh)           | · Views update automatically<br>· No stale data                                        |
| **DB Scaling**     | Vertical (bigger DB)                | Horizontal (tenant-based partitioning)         | · Linear cost scaling<br>· No single point of failure                                  |
| **Audit Trail**    | None                                | Append-only event store                        | · Full history<br>· Compliance ready<br>· Debug any past state                         |

This is the pattern used by Uber, DoorDash, and Stripe for multi-tenant analytics workloads.

## Cost Tracking

### Per-Query Cost Breakdown

**Cheapest Configuration**: $0.0018/query
```
1. Classification:  $0.0006
2. SQL Generation:  $0.0006
3. Response:        $0.0007
```

**Most Expensive Configuration**: $0.051/query
```
1. Classification:  $0.013
2. SQL Generation:  $0.0105
3. Response:        $0.0273
```

**Cost Ratio**: 28x difference between configurations

### Monthly Estimate (50 queries/day/client)
- Cheapest: **~$1.02/month/client**
- Most expensive: **~$49.50/month/client**

The cheapest configuration successfully handles all provided example queries.

## License

MIT
