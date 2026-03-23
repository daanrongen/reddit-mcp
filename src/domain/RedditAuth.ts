import { Context, type Effect, type Option } from "effect";
import type { RedditAuthError } from "./errors.ts";

export type TokenState = {
  readonly accessToken: string;
  readonly expiresAt: number;
  readonly scope: string;
  readonly refreshToken: Option.Option<string>;
};

export interface RedditAuthService {
  /**
   * Returns a valid access token, refreshing if the current token is within
   * 5 minutes of expiry or has already expired.
   */
  readonly getAccessToken: () => Effect.Effect<string, RedditAuthError>;
}

export class RedditAuth extends Context.Tag("RedditAuth")<RedditAuth, RedditAuthService>() {}
