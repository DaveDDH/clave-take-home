# Clave Engineering Take-Home Assessment

## Architecture Evolution

This demo uses a normalized PostgreSQL schema populated with data from the JSON files you provided. For production scale (1000+ restaurants, real-time events), the architecture would evolve as follows:

| Aspect | Demo (Current) | Production | Comparison |
|--------|----------------|------------|------------|
| **Data Model** | Normalized schema + Gold Views | Event Sourcing + CQRS | +Audit trail, +replay from any point in time, +separate read/write optimization |
| **Tenancy** | Single-tenant | Multi-tenant with RLS | Automatic data isolation per restaurant, <br>scales to 1000s of tenants |
| **Data Ingestion** | One-time batch load from JSON files | Live webhooks from POS systems | Real-time updates, <br>no manual ETL runs needed |
| **Storage** | Supabase Postgres | Hot (Redis) / Warm (TimescaleDB) / Cold (S3) | +90% storage cost reduction, <br>query speed matched to data freshness |
| **Query Layer** | Gold Views (manual refresh) | Continuous aggregates (auto-refresh) | Views update automatically, <br>no stale data |
| **Scaling** | Vertical (bigger server) | Horizontal (tenant-based partitioning) | Linear cost scaling, <br>no single point of failure |
| **Audit Trail** | None | Append-only event store | Full history, <br>compliance ready, <br>debug any past state |

This is the pattern used by Uber, DoorDash, and Stripe for multi-tenant analytics workloads.
