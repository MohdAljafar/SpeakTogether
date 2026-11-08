import "dotenv/config";

const required = [
  "DATABASE_URL", "SUPABASE_URL", "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY", "LIVEKIT_URL",
  "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET"
];

export function validateEnv({ worker = false } = {}) {
  const missing = required.filter((key) => !process.env[key]);
  if (worker && !process.env.GEMINI_API_KEY) missing.push("GEMINI_API_KEY");
  if (missing.length) throw new Error(`Missing environment variables: ${missing.join(", ")}`);
}
