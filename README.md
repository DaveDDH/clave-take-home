# Clave Engineering Take-Home Assessment

## Architecture Evolution: From Demo to Production

This demo uses a normalized PostgreSQL schema with static JSON data. For a production-grade system supporting hundreds of restaurants with real-time POS webhooks, the architecture would evolve as follows:

### Current State (Demo)
- **Normalized schema** with application-layer fuzzy matching
- **Gold Views** for optimized analytics queries (pre-joined, pre-aggregated)
- Single-tenant, batch-loaded data

### Production Requirements

**Event Sourcing + CQRS**
- Append-only event store for audit trails and point-in-time recovery
- Separate read/write models for performance at scale
- Event handlers for real-time webhook processing (Toast, DoorDash, Square)

**Multi-Tenancy**
- `restaurant_id` on all tables with Row-Level Security (RLS)
- Tenant context set per-request for automatic data isolation

**Data Tiering**
- **Hot** (Redis): Last 24h for real-time dashboards
- **Warm** (TimescaleDB): Last 90 days with continuous aggregates
- **Cold** (S3 + Athena): Historical data for compliance

**Infrastructure**
- Event queue (Kafka/SQS) for webhook ingestion
- Horizontal scaling via tenant-based partitioning

This is the pattern used by Uber, DoorDash, and Stripe for similar multi-tenant analytics workloads
