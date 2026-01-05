# Text-to-SQL with LLM: Implementation Guide

Based on the C3 (Clear Prompting, Calibration with Hints, Consistent Output) research paper for zero-shot Text-to-SQL.

## Overview

The goal is to convert natural language questions from users into SQL queries that can be executed against our restaurant database to generate dashboard visualizations.

```
User Question → LLM (Text-to-SQL) → SQL Query → Database → Data → Visualization
```

## The C3 Method: Three Key Components

### 1. Clear Prompting (CP)

**Clear Layout**: Structure the prompt with clear separators using `###` markers:

```
### Complete PostgreSQL query only and with no explanation,
### and do not select extra columns that are not explicitly requested.
### PostgreSQL tables, with their properties:
#
# product_groups (id, name, category, subcategory, ...)
# sales (id, product_group_id, quantity, revenue, date, ...)
#
### What are the top 5 best-selling product categories?
SELECT
```

**Why it matters**: Clear layout improved accuracy by 7% in the research. The LLM better understands the structure when sections are clearly delineated.

**Clear Context (Schema Linking)**: Don't send the entire database schema. Instead:
1. First, ask the LLM to identify relevant tables for the question
2. Then, ask the LLM to identify relevant columns within those tables
3. Only include the linked schema in the final prompt

This reduces token usage and prevents the LLM from hallucinating irrelevant columns.

### 2. Calibration with Hints (CH)

LLMs have known biases when writing SQL. Calibrate them using system prompts:

**Bias 1 - Extra Columns**: LLMs tend to SELECT columns not explicitly requested.
```
Tip: COUNT(*) should not be in SELECT when it's only needed for ORDER BY.
Example:
- Question: "Which category has the most products?"
- Wrong: SELECT category, COUNT(*) FROM products GROUP BY category ORDER BY COUNT(*) DESC LIMIT 1
- Correct: SELECT category FROM products GROUP BY category ORDER BY COUNT(*) DESC LIMIT 1
```

**Bias 2 - Misuse of JOIN/IN/OR**: LLMs often misuse these, causing extra results.
```
Tip: Avoid "IN", "OR", "LEFT JOIN" as they might cause extra results.
Use "INTERSECT" or "EXCEPT" instead, and use "DISTINCT" or "LIMIT" when necessary.
```

**Implementation**: Use a multi-turn conversation format where you first "teach" the LLM these tips, then ask the actual question.

### 3. Consistent Output (CO)

LLM outputs are non-deterministic. To improve consistency:

1. Generate multiple SQL queries (e.g., n=5 or n=20)
2. Execute each query against the database
3. Group queries by their execution results
4. Select the SQL from the largest group (voting mechanism)

This leverages the fact that correct SQL variations will produce the same results.

## Implementation for This Project

### Step 1: Schema Linking (First LLM Call)

```typescript
const schemaLinkingPrompt = `
Given the database schema and question, identify relevant tables and columns.

Schema:
# product_groups (id, name, category, subcategory, price, ...)
# sales (id, product_group_id, date, quantity, revenue, ...)
# ...

Question: "${userQuestion}"

Output JSON with relevant tables and their columns:
{ "product_groups": ["id", "name", "category"], "sales": ["product_group_id", "revenue"] }
`;
```

### Step 2: SQL Generation (Second LLM Call)

```typescript
const sqlGenerationPrompt = `
### Complete PostgreSQL query only and with no explanation,
### and do not select extra columns that are not explicitly requested.
### PostgreSQL tables, with their properties:
#
# product_groups (${linkedColumns.product_groups.join(', ')})
# sales (${linkedColumns.sales.join(', ')})
# Foreign keys: sales.product_group_id = product_groups.id
#
### ${userQuestion}
SELECT
`;
```

### Step 3: Execute and Validate

```typescript
async function processUserMessage(question: string) {
  // 1. Schema linking
  const relevantSchema = await schemaLinking(question);

  // 2. Generate multiple SQL candidates
  const sqlCandidates = await generateSQL(question, relevantSchema, { n: 5 });

  // 3. Execute each and group by results
  const resultGroups = new Map<string, { sql: string; result: any }[]>();

  for (const sql of sqlCandidates) {
    try {
      const result = await executeSQL(sql);
      const resultKey = JSON.stringify(result);

      if (!resultGroups.has(resultKey)) {
        resultGroups.set(resultKey, []);
      }
      resultGroups.get(resultKey)!.push({ sql, result });
    } catch (error) {
      // Skip invalid SQL
    }
  }

  // 4. Select the most common result
  const bestGroup = [...resultGroups.values()]
    .sort((a, b) => b.length - a.length)[0];

  return {
    sql: bestGroup[0].sql,
    data: bestGroup[0].result
  };
}
```

## System Prompt Template

```typescript
const SYSTEM_PROMPT = `
You are an excellent SQL writer for a restaurant analytics database.

IMPORTANT TIPS - Do not make these mistakes:

Tip 1: Only SELECT columns explicitly requested.
- If asked "Which category sells the most?", only SELECT category, not COUNT(*).
- COUNT(*) should only appear in ORDER BY, not SELECT, unless explicitly asked.

Tip 2: Avoid "IN", "OR", "LEFT JOIN" - they often cause extra/duplicate results.
- Use INTERSECT or EXCEPT for set operations.
- Use DISTINCT when appropriate.
- Use LIMIT when asking for "top N" results.

Tip 3: Match column names exactly as provided in the schema.
- Use the exact casing and naming from the schema.
`;
```

## Token Efficiency

The C3 method uses ~1,000 tokens per query (vs ~10,000 for few-shot methods) by:
- Only including relevant schema (schema linking)
- Using zero-shot prompts (no examples needed)
- Clear, concise prompt structure

## Expected Accuracy

Based on the paper's results on the Spider benchmark:
- Zero-shot with C3: ~82% execution accuracy
- This outperforms fine-tuned models while being more flexible

## Error Handling

Common error categories to handle:
1. **Schema-linking errors**: Wrong tables/columns selected
2. **JOIN errors**: Incorrect or missing joins
3. **Condition errors**: Wrong WHERE clauses
4. **Nested query errors**: Issues with subqueries

Implement retry logic with more explicit hints when errors occur.
