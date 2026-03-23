import type { Cause } from "effect";
import { Cause as CauseModule } from "effect";

export const formatSuccess = (data: unknown) => ({
  content: [
    {
      type: "text" as const,
      text: typeof data === "string" ? data : JSON.stringify(data, null, 2),
    },
  ],
});

export const formatError = (cause: Cause.Cause<unknown>) => ({
  content: [
    {
      type: "text" as const,
      text: `Error: ${CauseModule.pretty(cause)}`,
    },
  ],
  isError: true as const,
});

export const WRITE_AUTH_ERROR =
  "Write operations require REDDIT_REFRESH_TOKEN. " +
  "See README for setup instructions on obtaining a refresh token via the OAuth2 authorization code flow.";
