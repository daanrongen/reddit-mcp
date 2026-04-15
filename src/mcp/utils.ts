import type { Cause, Effect, ManagedRuntime } from "effect";
import { Cause as CauseModule } from "effect";
import type { RedditError } from "../domain/errors.ts";
import type { RedditClient } from "../domain/RedditClient.ts";

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

/**
 * Runs an Effect against the MCP runtime and returns the MCP tool response
 * shape. On success wraps the value with formatSuccess; on failure wraps the
 * cause with formatError.
 */
export const runTool = async <A>(
  runtime: ManagedRuntime.ManagedRuntime<RedditClient, RedditError>,
  effect: Effect.Effect<A, RedditError, RedditClient>,
) => {
  const exit = await runtime.runPromiseExit(effect);
  if (exit._tag === "Failure") return formatError(exit.cause);
  return formatSuccess(exit.value);
};
