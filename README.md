# Clave Engineering Take-Home Assessment

## Cleaning the data

This is the generated product grouping:

| product_name        | variation_name         | source_raw_name              | variation_type |
| ------------------- | ---------------------- | ---------------------------- | -------------- |
| Ahi Tuna Bowl       | null                   | null                         | null           |
| Avocado Toast       | null                   | null                         | null           |
| Bacon               | null                   | null                         | null           |
| BBQ Pulled Pork     | null                   | null                         | null           |
| Breakfast Burrito   | null                   | null                         | null           |
| Brunch Platter      | null                   | null                         | null           |
| Bruschetta          | null                   | null                         | null           |
| Burger              | Classic                | Classic Burger               | semantic       |
| Burger              | Double                 | Classic Burger - Double      | null           |
| Burger              | Veggie                 | Veggie Burger                | semantic       |
| Chips               | null                   | null                         | null           |
| Churros             | 12 pcs                 | Churros - 12 piece           | quantity       |
| Churros             | 6 pcs                  | Churros - 6 piece            | quantity       |
| Clam Chowder        | null                   | null                         | null           |
| Coffee              | Cold Brew              | Cold Brew                    | semantic       |
| Coffee              | Double                 | Espresso - Double            | null           |
| Coffee              | Espresso               | Espresso                     | semantic       |
| Coffee              | Large                  | Coffee - Large               | null           |
| Coffee              | reg                    | coffe - reg                  | null           |
| Coffee              | Single                 | Espresso - Single            | null           |
| Coleslaw            | null                   | null                         | null           |
| Crab Cakes          | null                   | null                         | null           |
| Craft Beer          | Pint                   | Craft Beer - Pint            | null           |
| Croissant           | null                   | null                         | null           |
| Edamame             | null                   | null                         | null           |
| Eggs Benedict       | null                   | null                         | null           |
| expresso            | dbl shot               | expresso - dbl shot          | null           |
| Fish & Chips        | null                   | null                         | null           |
| Fish Tacos          | null                   | null                         | null           |
| Fries               | French                 | French Fries                 | semantic       |
| Fries               | Fries - Large          | Fries - Large                | semantic       |
| Fries               | Large                  | French Fries - Large         | null           |
| Fries               | Small                  | French Fries - Small         | null           |
| Fries               | Sweet Potato           | Sweet Potato Fries           | semantic       |
| Fries               | Truffle                | Truffle Fries                | semantic       |
| Fruit               | Fresh                  | Fresh Fruit                  | semantic       |
| Fruit               | Fresh Fruit Cup        | Fresh Fruit Cup              | semantic       |
| Garlic Bread        | null                   | null                         | null           |
| Guacamole & Chips   | null                   | null                         | null           |
| Hash Browns         | null                   | null                         | null           |
| Iced Tea            | null                   | null                         | null           |
| Lemonade            | null                   | null                         | null           |
| Loaded Baked Potato | null                   | null                         | null           |
| Lobster Roll        | null                   | null                         | null           |
| Margarita           | null                   | null                         | null           |
| Mashed Potatoes     | null                   | null                         | null           |
| Milkshake           | Chocolate              | Milkshake - Chocolate        | null           |
| Milkshake           | Strawberry             | Milkshake - Strawberry       | null           |
| Milkshake           | Vanilla                | Milkshake - Vanilla          | null           |
| Nachos              | Nachos Grande          | Nachos Grande                | semantic       |
| Nachos              | Nachos Supreme         | Nachos Supreme               | semantic       |
| Onion Rings         | null                   | null                         | null           |
| Orange Juice        | null                   | null                         | null           |
| Pancake Stack       | null                   | null                         | null           |
| Pasta               | Chicken Alfredo        | Chicken Alfredo              | semantic       |
| Pasta               | Lobster Mac & Cheese   | Lobster Mac & Cheese         | semantic       |
| Pasta               | Pasta Primavera        | Pasta Primavera              | semantic       |
| Pasta               | Shrimp Scampi          | Shrimp Scampi                | semantic       |
| Pickle Spear        | null                   | null                         | null           |
| Pitcher of Beer     | null                   | null                         | null           |
| Pizza               | BBQ Chicken            | BBQ Chicken Pizza            | semantic       |
| Pizza               | Margherita             | Margherita Pizza             | semantic       |
| Pizza               | Margherita Pizza Slice | Margherita Pizza Slice       | semantic       |
| Pizza               | Slice                  | Margherita Pizza - Slice     | null           |
| Pizza               | Whole Pie              | Margherita Pizza - Whole Pie | null           |
| Quesadilla          | null                   | null                         | null           |
| Salad               | Caesar                 | Caesar Salad                 | semantic       |
| Salad               | Garden                 | Garden Salad                 | semantic       |
| Salad               | House                  | House Salad                  | semantic       |
| Sandwich            | Club                   | Club Sandwich                | semantic       |
| Sandwich            | Egg                    | Egg Sandwich                 | semantic       |
| Sandwich            | Griled Chicken         | Griled Chicken Sandwhich     | semantic       |
| Sandwich            | Griled Chiken          | Griled Chiken Sandwich       | semantic       |
| Sandwich            | Grilled Chicken        | Grilled Chicken Sandwich     | semantic       |
| Sandwich            | Reuben                 | Reuben Sandwich              | semantic       |
| Sandwich            | Turkey Club            | Turkey Club                  | semantic       |
| Smoothie Bowl       | null                   | null                         | null           |
| Soft Drink          | Coca-Cola              | Coca-Cola                    | semantic       |
| Soft Drink          | fountain soda          | fountain soda                | semantic       |
| Soft Drink          | Large                  | Coca-Cola - Large            | null           |
| Soft Drink          | lg                     | fountain soda - lg           | null           |
| Soft Drink          | Lg Coke                | Lg Coke                      | semantic       |
| Soft Drink          | sm                     | fountain soda - sm           | null           |
| Soft Drink          | Small                  | Coca-Cola - Small            | null           |
| Steak               | Filet Mignon           | Filet Mignon                 | semantic       |
| Steak               | Philly Cheesesteak     | Philly Cheesesteak           | semantic       |
| Steak               | Prime Rib              | Prime Rib                    | semantic       |
| Steak               | Ribeye Steak           | Ribeye Steak                 | semantic       |
| Tiramisu            | null                   | null                         | null           |
| Wine                | Bottle                 | House Red Wine - Bottle      | null           |
| Wine                | Glass                  | House Red Wine - Glass       | null           |
| Wine                | House                  | House Wine                   | semantic       |
| Wine                | House Red              | House Red Wine               | semantic       |
| Wings               | 12 pcs                 | Buffalo Wings - 12 piece     | quantity       |
| Wings               | 6 pcs                  | Buffalo Wings - 6 piece      | quantity       |
| Wings               | Buffalo                | Buffalo Wings                | semantic       |
| Wings               | Buffalo Wings 12pc     | Buffalo Wings 12pc           | semantic       |
| Wings               | Chicken                | Chicken Wings                | semantic       |
| Wings               | Wings 12pc             | Wings 12pc                   | semantic       |
| Wrap                | Buffalo Chicken        | Buffalo Chicken Wrap         | semantic       |
| Wrap                | Veggie                 | Veggie Wrap                  | semantic       |

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
