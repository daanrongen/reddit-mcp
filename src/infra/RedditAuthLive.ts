import { Effect, Layer, Option, Ref } from "effect";
import {
  RedditClientIdConfig,
  RedditClientSecretConfig,
  RedditRefreshTokenConfig,
  RedditUsernameConfig,
} from "../config.ts";
import { RedditAuthError } from "../domain/errors.ts";
import { RedditAuth, type TokenState } from "../domain/RedditAuth.ts";

const REDDIT_TOKEN_URL = "https://www.reddit.com/api/v1/access_token";
/** Refresh when token has fewer than 5 minutes remaining. */
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

const buildUserAgent = (username: Option.Option<string>): string => {
  const user = Option.getOrElse(username, () => "your-username");
  return `reddit-mcp/1.0 by ${user}`;
};

const fetchToken = (
  clientId: string,
  clientSecret: string,
  grantParams: Record<string, string>,
  userAgent: string,
): Effect.Effect<TokenState, RedditAuthError> =>
  Effect.tryPromise({
    try: async () => {
      const credentials = btoa(`${clientId}:${clientSecret}`);
      const body = new URLSearchParams(grantParams);

      const response = await fetch(REDDIT_TOKEN_URL, {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": userAgent,
        },
        body: body.toString(),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`Token request failed (${response.status}): ${text}`);
      }

      const json = (await response.json()) as {
        access_token?: string;
        expires_in?: number;
        scope?: string;
        token_type?: string;
        error?: string;
      };

      if (json.error || !json.access_token) {
        throw new Error(`Token error: ${json.error ?? "missing access_token"}`);
      }

      return {
        accessToken: json.access_token,
        expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
        scope: json.scope ?? "",
        refreshToken: grantParams.refresh_token
          ? Option.some(grantParams.refresh_token)
          : Option.none(),
      } satisfies TokenState;
    },
    catch: (e) =>
      new RedditAuthError({
        message: e instanceof Error ? e.message : "Failed to fetch Reddit access token",
        cause: e,
      }),
  });

export const RedditAuthLive = Layer.effect(
  RedditAuth,
  Effect.gen(function* () {
    const clientId = yield* Effect.orDie(RedditClientIdConfig);
    const clientSecret = yield* Effect.orDie(RedditClientSecretConfig);
    const refreshTokenOption = yield* Effect.orDie(RedditRefreshTokenConfig);
    const usernameOption = yield* Effect.orDie(RedditUsernameConfig);

    const userAgent = buildUserAgent(usernameOption);

    // Determine initial grant type based on whether a refresh token is available.
    const initialGrantParams = Option.match(refreshTokenOption, {
      onNone: () => ({ grant_type: "client_credentials" }),
      onSome: (rt) => ({ grant_type: "refresh_token", refresh_token: rt }),
    });

    const initialToken = yield* fetchToken(clientId, clientSecret, initialGrantParams, userAgent);
    const tokenRef = yield* Ref.make<TokenState>(initialToken);

    const getAccessToken = () =>
      Effect.gen(function* () {
        const current = yield* Ref.get(tokenRef);
        const needsRefresh = Date.now() >= current.expiresAt - REFRESH_BUFFER_MS;

        if (!needsRefresh) {
          return current.accessToken;
        }

        // Refresh using the stored refresh token if available, otherwise re-fetch
        // via client_credentials.
        const grantParams = Option.match(current.refreshToken, {
          onNone: () => ({ grant_type: "client_credentials" }),
          onSome: (rt) => ({ grant_type: "refresh_token", refresh_token: rt }),
        });

        const fresh = yield* fetchToken(clientId, clientSecret, grantParams, userAgent);
        yield* Ref.set(tokenRef, fresh);
        return fresh.accessToken;
      });

    return { getAccessToken };
  }),
);
