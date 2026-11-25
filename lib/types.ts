export type ThemeMode = "light" | "dark";

export interface Message {
  id: string;
  role: "user" | "model";
  content: string;
  createdAt: number;
  isError?: boolean;
  isStopped?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  hasCustomTitle?: boolean;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
}

export interface StarterPrompt {
  title: string;
  subtitle: string;
  prompt: string;
}

export const STARTER_PROMPTS: StarterPrompt[] = [
  {
    title: "Architect a system",
    subtitle: "Design a resilient event-driven API with clear trade-offs",
    prompt:
      "Design a clean, resilient event-driven notification service in TypeScript. Compare queue vs. pub/sub patterns and include a minimal schema.",
  },
  {
    title: "Refactor & simplify",
    subtitle: "Turn nested conditionals into readable, composable code",
    prompt:
      "Show me how to refactor deeply nested validation logic in TypeScript using early returns and a declarative rule table, with before/after examples.",
  },
  {
    title: "Explain a concept",
    subtitle: "Break down CRDTs and eventual consistency intuitively",
    prompt:
      "Explain Conflict-free Replicated Data Types (CRDTs) intuitively. How do state-based and operation-based CRDTs differ, and when should I use them?",
  },
  {
    title: "Synthesize a plan",
    subtitle: "Create a structured 4-week learning roadmap",
    prompt:
      "Create a focused 4-week study plan for mastering WebAssembly with Rust, including weekly milestones and one small weekend project per week.",
  },
];
