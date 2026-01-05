# Claude Code Instructions

## Project Overview
This is the front-end dashboard for a Natural Language Dashboard Generator. It has two main views:
1. **Copilot** - Chat-like UI where users ask questions and receive data visualizations
2. **Dashboard** - Canvas where users can add, arrange, and manage saved widgets

## Critical Rules

### Code Quality
- **Files must NEVER exceed 400 lines of code** - Split into smaller components/modules
- **Always split into reusable components** - No monolithic files
- **Use shadcn/ui components FIRST** - Only create custom components when shadcn doesn't have what you need
- **Never run `npm run dev` or `npm start`** - The user will run these manually
- **After you finish ANY change, you must run `npm run typecheck`** - This will ensure code quality

### Folder Structure
Follow this structure strictly:

```
src/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Entry point (redirects or shows default view)
│   ├── globals.css               # Global styles
│   ├── copilot/
│   │   └── page.tsx              # Copilot chat view
│   └── dashboard/
│       └── page.tsx              # Dashboard canvas view
│
├── components/
│   ├── ui/                       # shadcn/ui components (auto-generated)
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── dialog.tsx
│   │   └── ...
│   │
│   ├── layout/                   # Layout components
│   │   ├── Sidebar.tsx           # Left panel with navigation
│   │   ├── SidebarItem.tsx       # Individual nav item
│   │   └── AppShell.tsx          # Main app wrapper with sidebar
│   │
│   ├── chat/                     # Copilot chat components
│   │   ├── ChatContainer.tsx     # Main chat wrapper
│   │   ├── ChatInput.tsx         # Message input
│   │   ├── MessageList.tsx       # Message history
│   │   ├── MessageBubble.tsx     # Individual message
│   │   ├── TypingIndicator.tsx   # Loading animation
│   │   └── index.ts              # Barrel export
│   │
│   ├── widgets/                  # Widget/visualization components
│   │   ├── WidgetCard.tsx        # Card wrapper for visualizations
│   │   ├── WidgetSaveModal.tsx   # Modal to save widget with name
│   │   ├── WidgetPicker.tsx      # Popup to select saved widgets
│   │   └── index.ts              # Barrel export
│   │
│   ├── charts/                   # Chart components
│   │   ├── BarChart.tsx
│   │   ├── LineChart.tsx
│   │   ├── PieChart.tsx
│   │   ├── MetricCard.tsx
│   │   ├── DataTable.tsx
│   │   ├── ChartRenderer.tsx     # Dynamic chart selector
│   │   └── index.ts              # Barrel export
│   │
│   └── dashboard/                # Dashboard-specific components
│       ├── DashboardCanvas.tsx   # Main canvas with drag-and-drop
│       ├── DraggableWidget.tsx   # Draggable widget wrapper
│       ├── AddWidgetButton.tsx   # Floating "+" button
│       └── index.ts              # Barrel export
│
├── hooks/                        # Custom React hooks
│   ├── useChat.ts                # Chat state and API calls
│   ├── useWidgets.ts             # Widget state management
│   ├── useDashboard.ts           # Dashboard layout state
│   └── useLocalStorage.ts        # Persist data locally
│
├── lib/                          # Utilities and configurations
│   ├── utils.ts                  # shadcn utility (cn function)
│   ├── api.ts                    # API client for backend
│   └── constants.ts              # App constants
│
├── types/                        # TypeScript type definitions
│   ├── chat.ts                   # Chat-related types
│   ├── widget.ts                 # Widget types
│   ├── chart.ts                  # Chart data types
│   └── api.ts                    # API response types
│
└── stores/                       # State management (if needed)
    ├── widget-store.ts           # Saved widgets store
    └── dashboard-store.ts        # Dashboard layout store
```

### Component Guidelines

1. **shadcn/ui First**
   - Always check if shadcn has a component: `npx shadcn@latest add <component>`
   - Available components: button, input, dialog, card, popover, tooltip, etc.
   - Only create custom components in `components/` folders when necessary

2. **Component Size**
   - If a component exceeds 200 lines, consider splitting
   - Extract sub-components, hooks, or utilities
   - Keep render logic minimal

3. **Barrel Exports**
   - Each component folder should have an `index.ts` for clean imports
   - Example: `export { ChatContainer } from './ChatContainer';`

4. **Naming Conventions**
   - Components: PascalCase (`MessageBubble.tsx`)
   - Hooks: camelCase with `use` prefix (`useChat.ts`)
   - Types: PascalCase (`Message`, `Widget`)
   - Utilities: camelCase (`formatDate.ts`)

### Scripts
- `npm run typecheck` - Run TypeScript compiler check AND lint
- `npm run lint` - Run ESLint AND typecheck
- `npm run build` - Build for production
- Do NOT run dev/start commands

### Type Safety
- Always define types in `src/types/`
- Never use `any` - use `unknown` and type guards if needed
- All API responses must be typed

### State Management
- Use React hooks for local state
- Use Zustand (in `stores/`) for global state if needed
- Persist widgets to localStorage

### Charts
- Use Recharts for visualizations
- Each chart type should be a separate component
- `ChartRenderer` dynamically selects the right chart based on data type

---

## Senior Code Standards (MVP Mindset)

This is an MVP. Write code like a senior engineer: clean, simple, debuggable. No over-engineering.

### Naming: Self-Documenting Code
- Names should make comments unnecessary
- Functions: verb + noun (`saveWidget`, `fetchMessages`, `parseChartData`)
- Booleans: `is`, `has`, `should`, `can` prefix (`isLoading`, `hasError`, `canSave`)
- Handlers: `handle` + event (`handleSubmit`, `handleWidgetDrop`)
- No abbreviations: `message` not `msg`, `button` not `btn`, `error` not `err`

### Functions: Small and Focused
- One function = one job (single responsibility)
- Max 20-30 lines per function; if longer, extract helpers
- Use early returns to reduce nesting:
  ```typescript
  // Good
  if (!user) return null;
  if (!data) return <Empty />;
  return <Content data={data} />;

  // Bad
  if (user) {
    if (data) {
      return <Content data={data} />;
    } else {
      return <Empty />;
    }
  } else {
    return null;
  }
  ```

### Components: Minimal Props
- Pass only what's needed - no prop drilling
- Prefer composition over configuration:
  ```typescript
  // Good: Composition
  <Card>
    <CardHeader>Title</CardHeader>
    <CardContent>{children}</CardContent>
  </Card>

  // Avoid: Over-configured
  <Card title="Title" headerVariant="large" showBorder={true} ... />
  ```

### State: Keep It Minimal
- Derive values instead of storing them:
  ```typescript
  // Good: Derived
  const isEmpty = messages.length === 0;

  // Bad: Redundant state
  const [isEmpty, setIsEmpty] = useState(true);
  ```
- Lift state only when necessary
- Colocate state with the component that uses it

### Error Handling: Graceful, Not Paranoid
- Handle errors at boundaries, not everywhere
- User-friendly messages, detailed logs:
  ```typescript
  try {
    await saveWidget(widget);
  } catch (error) {
    console.error('Failed to save widget:', error);
    toast.error('Could not save widget. Please try again.');
  }
  ```
- Don't catch errors you can't handle meaningfully

### Types: Precise, Not Complex
- Simple types > clever generics
- Inline types for one-off usage, shared types in `types/`
- Union types for known values: `type ChartType = 'bar' | 'line' | 'pie';`
- Avoid `any`. Use `unknown` with type guards when truly dynamic

### Comments: Only When "Why" Isn't Obvious
- Code should explain WHAT, comments explain WHY
- No "what" comments:
  ```typescript
  // Bad: Obvious
  // Set loading to true
  setLoading(true);

  // Good: Explains non-obvious decision
  // Delay to allow animation to complete before unmounting
  setTimeout(() => setVisible(false), 300);
  ```

### Abstraction: Wait for Duplication
- Don't create abstractions preemptively
- Rule of three: abstract only after 3 real duplications
- A little repetition is better than wrong abstraction
- Copy-paste is fine for MVP; refactor later when patterns emerge

### Dependencies: Minimal and Intentional
- Every dependency is a liability
- Prefer built-in APIs (fetch, URLSearchParams, etc.)
- Before adding a package: Can we do this in <20 lines?

### Debugging: Code That Helps You
- Use meaningful error messages
- Console logs during development are fine; use `console.error` for actual errors
- Keep data flow obvious: avoid magic, avoid indirection
- Prefer explicit over implicit

### Avoid These Anti-Patterns
1. **Premature optimization**: Make it work, then make it fast (if needed)
2. **Over-abstraction**: No factories, no abstract classes, no DI containers
3. **Config-driven everything**: Code is easier to debug than config
4. **Defensive programming internally**: Trust your own code; validate at boundaries only
5. **Feature flags for MVP**: Just change the code
6. **Commented-out code**: Delete it; git has history

### React Specific
- Prefer `function` components over arrow functions for top-level
- Extract hooks when logic is reused or component gets complex
- Use `key` prop correctly (stable IDs, not array index for dynamic lists)
- Avoid `useEffect` when you can compute during render
- Event handlers inline unless they're reused or complex

### File Organization Within Components
```typescript
// 1. Imports (external, then internal, then types)
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { Message } from '@/types/chat';

// 2. Types (if component-specific)
interface Props {
  messages: Message[];
  onSend: (content: string) => void;
}

// 3. Component
export function MessageList({ messages, onSend }: Props) {
  // 3a. Hooks
  const [input, setInput] = useState('');

  // 3b. Derived values
  const isEmpty = messages.length === 0;

  // 3c. Handlers
  const handleSubmit = () => {
    onSend(input);
    setInput('');
  };

  // 3d. Early returns
  if (isEmpty) return <EmptyState />;

  // 3e. Main render
  return <div>...</div>;
}
```

### The MVP Test
Before writing code, ask:
1. Does the user need this right now?
2. Is this the simplest solution that works?
3. Can I delete this later without breaking everything?

If any answer is "no", reconsider.
