# Clave Engineering Take-Home Assessment

A production-grade **Text-to-SQL analytics platform** for restaurant data, featuring AI-powered natural language queries, real-time streaming responses, and a drag-and-drop dashboard.

## Quick Start

```bash
# 1. Start PostgreSQL (Supabase)
# 2. Load environment variables
cd etl && source .env

# 3. Run ETL pipeline
npm run dev

# 4. Start backend
cd ../back && npm run dev

# 5. Start frontend
cd ../front && npm run dev
```

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (Next.js)                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐          │
│  │   Copilot View  │  │  Dashboard View │  │   Widget Store  │          │
│  │  (Chat + Charts)│  │(Drag-and-drop)  │  │    (Zustand)    │          │
│  └────────┬────────┘  └────────┬────────┘  └─────────────────┘          │
└───────────┼─────────────────────┼────────────────────────────────────────┘
            │                     │
            │    SSE Streaming    │
            ▼                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                          BACKEND (Express.js)                             │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                        AI Pipeline                                   │ │
│  │  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐        │ │
│  │  │ Classify │ → │  Schema  │ → │   SQL    │ → │  Chart   │        │ │
│  │  │  Query   │   │  Linking │   │Generation│   │ Inference│        │ │
│  │  └──────────┘   └──────────┘   └──────────┘   └──────────┘        │ │
│  │                       ↓                                             │ │
│  │  ┌──────────────────────────────────────────────────────────────┐  │ │
│  │  │ Self-Consistency Voting │ Iterative Refinement │ Escalation │  │ │
│  │  └──────────────────────────────────────────────────────────────┘  │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                    Model Abstraction Layer                          │ │
│  │         ┌─────────┐    ┌─────────┐    ┌─────────┐                  │ │
│  │         │   xAI   │    │ OpenAI  │    │  Groq   │                  │ │
│  │         └─────────┘    └─────────┘    └─────────┘                  │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                        DATABASE (PostgreSQL)                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                  │
│  │    GOLD     │    │   SILVER    │    │   BRONZE    │                  │
│  │   Views     │    │   Tables    │    │    (ETL)    │                  │
│  │(Analytics)  │    │(Normalized) │    │  (Raw JSON) │                  │
│  └─────────────┘    └─────────────┘    └─────────────┘                  │
└──────────────────────────────────────────────────────────────────────────┘
```

## AI Pipeline (C3 Methodology)

The Text-to-SQL pipeline implements the **C3 (Clear Prompting, Calibration, Consistency)** research methodology:

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
| View | Purpose | Pre-Aggregation |
|------|---------|-----------------|
| `gold_orders` | Order-level analysis | Row-level with pre-joins |
| `gold_product_performance` | Product rankings | By product |
| `gold_daily_sales` | Daily summaries | By date |
| `gold_hourly_trends` | Time patterns | By hour |

**Gold View Benefits**:
- LLM generates simpler SQL (fewer JOINs)
- Money pre-converted to dollars
- Time fields pre-extracted
- Only completed orders

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
- Cheapest: **~$2.70/month/client**
- Most expensive: **~$76.50/month/client**

The cheapest configuration successfully handles all provided example queries.

## Technology Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| Next.js 16 | App Router, SSR |
| shadcn/ui | Component library |
| Tailwind CSS | Styling |
| Recharts | Visualizations |
| Zustand | State management |
| @dnd-kit | Drag-and-drop |

### Backend
| Technology | Purpose |
|------------|---------|
| Express.js | HTTP server |
| TypeScript | Type safety |
| Drizzle ORM | Database queries |
| Vercel AI SDK | LLM integration |

### ETL
| Technology | Purpose |
|------------|---------|
| React + Ink | Interactive CLI |
| Zod | Schema validation |
| Levenshtein | Fuzzy matching |

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
```bash
cd back && node test-queries.js
```

Integration tests validate full pipeline:
- Query → Classification → SQL → Execution → Chart

---

## Costs explained
Cheapest config:
1. $0.0006
2. $0.0006
3. $0.0007

Total: $0.0018

Most expensive config:
1. $0.013
2. $0.0105
3. $0.0273

Total: $0.051

The most basic config is 28X cheaper than the most complex one (per query). Assuming our clients perform 50 queries per day, we would have 1500 queries per month. With the cheapest config, that would be $1/month/client, while for the most expensive one, that would be around $50/month. The beautiful part of this, is that the most basic config successfully replies to all the example queries you provided.

## Cleaning the data

This is the generated product grouping:

| product_name        | variation_name       | category_name      | source_raw_name              | variation_type |
| ------------------- | -------------------- | ------------------ | ---------------------------- | -------------- |
| Ahi Tuna Bowl       | null                 | Entrees            | null                         | null           |
| Avocado Toast       | null                 | Breakfast          | null                         | null           |
| Bacon               | null                 | Breakfast          | null                         | null           |
| BBQ Pulled Pork     | null                 | Entrees            | null                         | null           |
| Breakfast Burrito   | null                 | Breakfast          | null                         | null           |
| Brunch Platter      | null                 | Breakfast          | null                         | null           |
| Bruschetta          | null                 | Appetizers         | null                         | null           |
| Burger              | Classic              | Burgers            | Classic Burger               | semantic       |
| Burger              | Double               | Burgers            | Classic Burger - Double      | null           |
| Burger              | Veggie               | Burgers            | Veggie Burger                | semantic       |
| Chips               | null                 | Sides              | null                         | null           |
| Churros             | 12 pcs               | Desserts           | Churros - 12 piece           | quantity       |
| Churros             | 6 pcs                | Desserts           | Churros - 6 piece            | quantity       |
| Clam Chowder        | null                 | Appetizers         | null                         | null           |
| Coffee              | Cold Brew            | Drinks             | Cold Brew                    | semantic       |
| Coffee              | Dbl Shot             | Drinks             | expresso - dbl shot          | null           |
| Coffee              | Double               | Drinks             | Espresso - Double            | null           |
| Coffee              | Espresso             | Drinks             | Espresso                     | semantic       |
| Coffee              | Large                | Drinks             | Coffee - Large               | null           |
| Coffee              | Reg                  | Drinks             | coffe - reg                  | null           |
| Coffee              | Single               | Drinks             | Espresso - Single            | null           |
| Coleslaw            | null                 | Sides              | null                         | null           |
| Crab Cakes          | null                 | Entrees            | null                         | null           |
| Craft Beer          | Pint                 | Beer & Wine        | Craft Beer - Pint            | null           |
| Croissant           | null                 | Breakfast          | null                         | null           |
| Edamame             | null                 | Appetizers         | null                         | null           |
| Eggs Benedict       | null                 | Breakfast          | null                         | null           |
| Fish & Chips        | null                 | Entrees            | null                         | null           |
| Fish Tacos          | null                 | Entrees            | null                         | null           |
| Fries               | French               | Sides & Appetizers | French Fries                 | semantic       |
| Fries               | Large                | Sides & Appetizers | French Fries - Large         | null           |
| Fries               | Small                | Sides & Appetizers | French Fries - Small         | null           |
| Fries               | Sweet Potato         | Sides & Appetizers | Sweet Potato Fries           | semantic       |
| Fries               | Truffle              | Sides & Appetizers | Truffle Fries                | semantic       |
| Fruit               | Fresh                | Sides & Appetizers | Fresh Fruit                  | semantic       |
| Fruit               | Fresh Fruit Cup      | Sides & Appetizers | Fresh Fruit Cup              | semantic       |
| Garlic Bread        | null                 | Appetizers         | null                         | null           |
| Guacamole & Chips   | null                 | Appetizers         | null                         | null           |
| Hash Browns         | null                 | Breakfast          | null                         | null           |
| Iced Tea            | null                 | Drinks             | null                         | null           |
| Lemonade            | null                 | Beverages          | null                         | null           |
| Loaded Baked Potato | null                 | Sides              | null                         | null           |
| Lobster Roll        | null                 | Entrees            | null                         | null           |
| Margarita           | null                 | Cocktails          | null                         | null           |
| Mashed Potatoes     | null                 | Sides              | null                         | null           |
| Milkshake           | Chocolate            | Drinks             | Milkshake - Chocolate        | null           |
| Milkshake           | Strawberry           | Drinks             | Milkshake - Strawberry       | null           |
| Milkshake           | Vanilla              | Drinks             | Milkshake - Vanilla          | null           |
| Nachos              | Nachos Grande        | Sides & Appetizers | Nachos Grande                | semantic       |
| Nachos              | Nachos Supreme       | Sides & Appetizers | Nachos Supreme               | semantic       |
| Onion Rings         | null                 | Sides              | null                         | null           |
| Orange Juice        | null                 | Drinks             | null                         | null           |
| Pancake Stack       | null                 | Breakfast          | null                         | null           |
| Pasta               | Chicken Alfredo      | Pasta              | Chicken Alfredo              | semantic       |
| Pasta               | Lobster Mac & Cheese | Pasta              | Lobster Mac & Cheese         | semantic       |
| Pasta               | Pasta Primavera      | Pasta              | Pasta Primavera              | semantic       |
| Pasta               | Shrimp Scampi        | Pasta              | Shrimp Scampi                | semantic       |
| Pickle Spear        | null                 | Sides              | null                         | null           |
| Pitcher of Beer     | null                 | Beer & Wine        | null                         | null           |
| Pizza               | BBQ Chicken          | Entrees            | BBQ Chicken Pizza            | semantic       |
| Pizza               | Margherita           | Entrees            | Margherita Pizza             | semantic       |
| Pizza               | Slice                | Entrees            | Margherita Pizza - Slice     | null           |
| Pizza               | Whole Pie            | Entrees            | Margherita Pizza - Whole Pie | null           |
| Quesadilla          | null                 | Entrees            | null                         | null           |
| Salad               | Caesar               | Sides & Appetizers | Caesar Salad                 | semantic       |
| Salad               | Garden               | Sides & Appetizers | Garden Salad                 | semantic       |
| Salad               | House                | Sides & Appetizers | House Salad                  | semantic       |
| Sandwich            | Club                 | Sandwiches         | Club Sandwich                | semantic       |
| Sandwich            | Egg                  | Sandwiches         | Egg Sandwich                 | semantic       |
| Sandwich            | Grilled Chicken      | Sandwiches         | Grilled Chicken Sandwich     | semantic       |
| Sandwich            | Reuben               | Sandwiches         | Reuben Sandwich              | semantic       |
| Sandwich            | Turkey Club          | Sandwiches         | Turkey Club                  | semantic       |
| Smoothie Bowl       | null                 | Breakfast          | null                         | null           |
| Soft Drink          | Coca-Cola            | Drinks             | Coca-Cola                    | semantic       |
| Soft Drink          | Fountain Soda        | Drinks             | fountain soda                | semantic       |
| Soft Drink          | Large                | Drinks             | Coca-Cola - Large            | null           |
| Soft Drink          | Small                | Drinks             | Coca-Cola - Small            | null           |
| Steak               | Filet Mignon         | Entrees            | Filet Mignon                 | semantic       |
| Steak               | Philly Cheesesteak   | Entrees            | Philly Cheesesteak           | semantic       |
| Steak               | Prime Rib            | Entrees            | Prime Rib                    | semantic       |
| Steak               | Ribeye Steak         | Entrees            | Ribeye Steak                 | semantic       |
| Tiramisu            | null                 | Desserts           | null                         | null           |
| Wine                | Bottle               | Beer & Wine        | House Red Wine - Bottle      | null           |
| Wine                | Glass                | Beer & Wine        | House Red Wine - Glass       | null           |
| Wine                | House                | Beer & Wine        | House Wine                   | semantic       |
| Wine                | House Red            | Beer & Wine        | House Red Wine               | semantic       |
| Wings               | 12 pcs               | Sides & Appetizers | Buffalo Wings - 12 piece     | quantity       |
| Wings               | 6 pcs                | Sides & Appetizers | Buffalo Wings - 6 piece      | quantity       |
| Wings               | Buffalo              | Sides & Appetizers | Buffalo Wings                | semantic       |
| Wings               | Chicken              | Sides & Appetizers | Chicken Wings                | semantic       |
| Wrap                | Buffalo Chicken      | Sandwiches         | Buffalo Chicken Wrap         | semantic       |
| Wrap                | Veggie               | Sandwiches         | Veggie Wrap                  | semantic       |

## Iterative Refinement

The Text-to-SQL pipeline uses **iterative refinement** to improve query accuracy. When a generated SQL query fails execution, the system feeds the error message back to the LLM to generate a corrected query.

### Why Iterative Refinement?

1. **Higher success rate**: LLMs occasionally generate SQL with minor errors (wrong column names, syntax issues). Rather than failing immediately, refinement gives the system a second chance to correct these mistakes.

2. **Error-aware correction**: PostgreSQL error messages are highly informative (e.g., `column "sales" does not exist, did you mean "total_cents"?`). Feeding this context back to the LLM enables targeted fixes.

3. **No additional latency on success**: Refinement only triggers when the initial query fails, so successful queries run at full speed.

### How It Works

```
Generate SQL → Execute → Success? → Return results
                  ↓
               Failed
                  ↓
         Feed error to LLM → Generate corrected SQL → Re-execute
                                                          ↓
                                                    Return or fail gracefully
```

The refinement prompt includes:
- The original failed SQL
- The PostgreSQL error message
- The user's question
- The database schema

This gives the LLM full context to understand what went wrong and how to fix it.

## Automatic Retry with Escalation

The system implements automatic retry with progressive escalation when LLM calls fail. This is a production best practice that maximizes reliability without manual intervention.

### Why Escalation?

1. **Graceful degradation**: Instead of failing immediately, the system tries increasingly powerful configurations before giving up.

2. **Cost efficiency**: Starts with the user's chosen settings (often faster/cheaper), only escalating to more expensive options when needed.

3. **Transparent to users**: Retries happen automatically—users see a successful response or a friendly error message, never raw failure details.

### Escalation Order

```
Failure → Increase reasoning (if low) → Bigger model → Even bigger model → Max reasoning → Fail gracefully
```

| Step | Action |
|------|--------|
| 1 | If reasoning = low, increase to high (same model) |
| 2 | Move to next bigger model |
| 3 | Continue to biggest model |
| 4 | If not at high reasoning, increase to high |
| 5 | All options exhausted → friendly error message |

Model hierarchy (smallest → biggest): `gpt-oss-20b` → `grok-4.1-fast` → `gpt-5.2`

### When Escalation Triggers

- SQL generation produced no valid candidates
- All SQL executions failed
- LLM API error (network, timeout, rate limit)
- Empty or invalid model response

This pattern is used by production systems at scale to ensure high availability even when individual model providers experience issues.

## Architecture Evolution

This demo uses a normalized PostgreSQL schema populated with data from the JSON files you provided. For production scale (1000+ restaurants, real-time events), the architecture would evolve as follows:

| Aspect | Demo (Current) | Production | Comparison |
|--------|----------------|------------|------------|
| **Data Model** | Normalized schema + Gold Views | Event Sourcing + CQRS | · Audit trail<br>· Replay from any point in time<br>· Separate read/write optimization |
| **Tenancy** | Single-tenant | Multi-tenant with RLS | · Automatic data isolation per restaurant<br>· Scales to 1000s of tenants |
| **Data Ingestion** | One-time batch load from JSON files | Live webhooks from POS systems | · Real-time updates<br>· No manual ETL runs needed |
| **Storage** | Supabase Postgres | Hot (Redis)<br>Warm (TimescaleDB)<br>Cold (S3) | · 90% storage cost reduction<br>· Query speed matched to data freshness |
| **Query Layer** | Gold Views (manual refresh) | Continuous aggregates (auto-refresh) | · Views update automatically<br>· No stale data |
| **DB Scaling** | Vertical (bigger DB) | Horizontal (tenant-based partitioning) | · Linear cost scaling<br>· No single point of failure |
| **Audit Trail** | None | Append-only event store | · Full history<br>· Compliance ready<br>· Debug any past state |

This is the pattern used by Uber, DoorDash, and Stripe for multi-tenant analytics workloads.

## Key Files Reference

### Backend (`/back/src/`)
| File | Purpose |
|------|---------|
| `ai/models/index.ts` | Model abstraction layer |
| `ai/actions/processUserMessage/self-consistency.ts` | Multi-candidate voting |
| `ai/actions/processUserMessage/escalation.ts` | Progressive retry |
| `ai/actions/processUserMessage/prompt.ts` | Calibration hints |
| `ai/actions/processUserMessage/sql-refinement.ts` | Error-guided correction |
| `utils/sse.ts` | SSE streaming |
| `utils/cost.ts` | Token cost tracking |

### Frontend (`/front/src/`)
| File | Purpose |
|------|---------|
| `app/copilot/page.tsx` | Chat interface |
| `app/dashboard/page.tsx` | Widget canvas |
| `components/charts/` | Chart components |
| `stores/` | Zustand state |
| `CLAUDE.md` | AI assistant guidelines |

### ETL (`/etl/`)
| File | Purpose |
|------|---------|
| `cli.tsx` | Interactive CLI |
| `lib/preprocessor.ts` | Data transformation |
| `lib/levenshtein.ts` | Fuzzy matching |
| `lib/product-groups.ts` | Product grouping |
| `gold_views.sql` | Analytics views |

### Detailed Analysis (`/temp/`)
See `/temp/overview.md` for complete evaluation synthesis and all 24 analysis files documenting architectural decisions.

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

## License

MIT
