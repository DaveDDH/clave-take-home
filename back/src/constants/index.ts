export const XAI_API_KEY = process.env.XAI_API_KEY;
export const XAI_MODEL = process.env.XAI_MODEL || "grok-4-1-fast-reasoning";

export const GROQ_API_KEY = process.env.GROQ_API_KEY;
export const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-20b";

export const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
export const OPENAI_MODEL = process.env.OPENAI_MODEL || "openai/gpt-oss-20b";

export const HELICONE_KEY = process.env.HELICONE_KEY;

// Debug mode: when true, conversations are not saved to the database
export const DEBUG_MODE = process.env.DEBUG === 'true';
