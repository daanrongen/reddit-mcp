import { Effect, Layer, Option } from "effect";
import { RedditUsernameConfig } from "../config.ts";
import {
  RedditApiError,
  type RedditAuthError,
  RedditNotFoundError,
  RedditRateLimitError,
} from "../domain/errors.ts";
import { RedditAuth } from "../domain/RedditAuth.ts";
import { RedditClient } from "../domain/RedditClient.ts";

const REDDIT_API_BASE = "https://oauth.reddit.com";

const buildUserAgent = (username: Option.Option<string>): string => {
  const user = Option.getOrElse(username, () => "your-username");
  return `reddit-mcp/1.0 by ${user}`;
};

export const RedditClientLive = Layer.effect(
  RedditClient,
  Effect.gen(function* () {
    const auth = yield* RedditAuth;
    const usernameOption = yield* Effect.orDie(RedditUsernameConfig);
    const userAgent = buildUserAgent(usernameOption);

    const makeRequest = <T>(
      method: "GET" | "POST",
      path: string,
      params?: Record<string, string | number | boolean | undefined>,
      body?: Record<string, string | number | boolean>,
    ): Effect.Effect<
      T,
      RedditAuthError | RedditApiError | RedditNotFoundError | RedditRateLimitError
    > =>
      Effect.gen(function* () {
        const token = yield* auth.getAccessToken();

        const url = new URL(`${REDDIT_API_BASE}${path}`);
        url.searchParams.set("raw_json", "1");

        if (method === "GET" && params) {
          for (const [key, value] of Object.entries(params)) {
            if (value !== undefined && value !== null && value !== "") {
              url.searchParams.set(key, String(value));
            }
          }
        }

        const headers: Record<string, string> = {
          Authorization: `Bearer ${token}`,
          "User-Agent": userAgent,
          Accept: "application/json",
        };

        const fetchInit: RequestInit = { method, headers };

        if (method === "POST" && body) {
          headers["Content-Type"] = "application/x-www-form-urlencoded";
          fetchInit.body = new URLSearchParams(
            Object.fromEntries(Object.entries(body).map(([k, v]) => [k, String(v)])),
          ).toString();
        }

        return yield* Effect.tryPromise({
          try: async () => {
            const response = await fetch(url.toString(), fetchInit);

            if (response.status === 429) {
              const resetHeader = response.headers.get("x-ratelimit-reset");
              const resetAfterSeconds = resetHeader ? Number.parseFloat(resetHeader) : 60;
              throw Object.assign(new Error("rate_limit"), { resetAfterSeconds });
            }

            if (response.status === 404) {
              throw Object.assign(new Error("not_found"), { path });
            }

            if (!response.ok) {
              const text = await response.text().catch(() => "");
              throw new Error(
                `Reddit API error ${response.status}: ${response.statusText}. ${text}`,
              );
            }

            return response.json() as Promise<T>;
          },
          catch: (e) => {
            if (e instanceof Error) {
              if (e.message === "rate_limit") {
                return new RedditRateLimitError({
                  resetAfterSeconds:
                    (e as Error & { resetAfterSeconds?: number }).resetAfterSeconds ?? 60,
                });
              }
              if (e.message === "not_found") {
                return new RedditNotFoundError({
                  resource: (e as Error & { path?: string }).path ?? path,
                });
              }
            }
            return new RedditApiError({
              message: e instanceof Error ? e.message : `Reddit request failed: ${path}`,
              cause: e,
            });
          },
        });
      });

    return {
      get: <T>(path: string, params?: Record<string, string | number | boolean | undefined>) =>
        makeRequest<T>("GET", path, params),

      post: <T>(path: string, body: Record<string, string | number | boolean>) =>
        makeRequest<T>("POST", path, undefined, body),
    };
  }),
);
