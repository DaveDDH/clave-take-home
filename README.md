# Clave Engineering Take-Home Assessment

## Architecture Evolution: From Demo to Production

This demo uses a normalized PostgreSQL schema with static JSON data. For production scale (1000+ restaurants, real-time webhooks), the architecture would evolve as follows:

| Aspect | Demo (Current) | Production |
|--------|----------------|------------|
| **Data Model** | Normalized schema + Gold Views | Event Sourcing + CQRS |
| **Tenancy** | Single-tenant | Multi-tenant with Row-Level Security |
| **Data Ingestion** | Batch ETL from JSON files | Real-time webhooks (Toast, DoorDash, Square) |
| **Storage** | Supabase Postgres | Hot (Redis) / Warm (TimescaleDB) / Cold (S3) |
| **Query Layer** | Gold Views (pre-joined, pre-aggregated) | Materialized projections + continuous aggregates |
| **Scaling** | Vertical | Horizontal (tenant-based partitioning) |
| **Audit Trail** | None | Append-only event store with replay |

This is the pattern used by Uber, DoorDash, and Stripe for multi-tenant analytics workloads.
