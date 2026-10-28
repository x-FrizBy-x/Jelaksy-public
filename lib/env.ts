import { z } from "zod";

const EnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is not set."),
  SESSION_SECRET: z.string().min(1, "SESSION_SECRET is not set."),
});

type Env = z.infer<typeof EnvSchema>;

let cached: Env | undefined;

/**
 * Validates required environment variables on first use rather than at import
 * time, so `next build` works without secrets and the error names the variable.
 */
export function getEnv(): Env {
  if (!cached) {
    const result = EnvSchema.safeParse(process.env);

    if (!result.success) {
      throw new Error(
        `Invalid environment: ${result.error.issues.map((issue) => issue.message).join(" ")}`
      );
    }

    cached = result.data;
  }

  return cached;
}
