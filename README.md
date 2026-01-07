# Clave Engineering Take-Home Assessment

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
