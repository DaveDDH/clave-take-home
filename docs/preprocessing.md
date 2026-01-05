# Data Preprocessing Pipeline

Transforms raw order data from Toast, DoorDash, and Square into a unified schema.

## Pipeline Steps

### 1. Validate Source Data
Validates all input JSON files against Zod schemas (`lib/schemas.ts`).

### 2. Build Locations
Merges location IDs across sources using `data/locations.json` config. Maps Toast, DoorDash, and Square location IDs to a single unified ID.

### 3. Build Unified Catalog
Collects products from all sources and normalizes them:

#### 3a. Extract Variations from Names
Uses regex patterns from `data/variation_patterns.json` to extract variations:
- `"Churros 12pcs"` → base: `Churros`, variation: `12 pcs` (quantity)
- `"Coffee - Large"` → base: `Coffee`, variation: `Large` (size)
- `"Lg Coke"` → base: `Coke`, variation: `Large` (size prefix)

#### 3b. Group Products
Two-pass grouping:

1. **Configured Groups** (`data/product_groups.json`): Match products by suffix or keywords with fuzzy matching (Levenshtein distance ≤ 2):
   - Suffix: `"Buffalo Wings"` → matches group with suffix `"Wings"`
   - Keyword: `"Coca-Cola"` → matches group with keyword `"coke"`
   - Fuzzy: `"expresso"` → matches keyword `"espresso"`

2. **Levenshtein Fallback**: Remaining products grouped if base names have distance ≤ 3.

#### 3c. Pick Canonical Names
For each group, picks the best name (proper capitalization, longer names preferred).

### 4. Process Orders
For each source (Toast, DoorDash, Square):
- Maps order type (`dine_in`, `takeout`, `delivery`)
- Maps channel (`pos`, `online`, `doordash`, etc.)
- Links items to unified products and variations
- Normalizes payment types and card brands
- Creates product aliases (raw name → product mapping)

## Output Schema

```
normalized/
├── locations        # Unified location records
├── categories       # Product categories
├── products         # Canonical product names
├── product_variations  # Size, quantity, flavor variants
├── product_aliases  # Raw name → product mappings
├── orders           # Unified order records
├── order_items      # Line items with product links
└── payments         # Payment records
```

## Configuration Files

| File | Purpose |
|------|---------|
| `data/locations.json` | Maps source location IDs |
| `data/product_groups.json` | Defines product grouping rules |
| `data/variation_patterns.json` | Regex patterns for variation extraction |

## Usage

```bash
npm run preprocess ./output.json
```
