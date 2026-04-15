import { Context, type Effect } from "effect";
import type {
  RedditApiError,
  RedditAuthError,
  RedditNotFoundError,
  RedditRateLimitError,
} from "./errors.ts";

export interface RedditClientService {
  /**
   * Performs an authenticated GET request to the Reddit API.
   * Automatically injects the Bearer token, handles 429 rate-limit responses
   * by surfacing RedditRateLimitError, and maps 404 to RedditNotFoundError.
   * May surface RedditAuthError if token acquisition fails.
   */
  readonly get: <T>(
    path: string,
    params?: Record<string, string | number | boolean | undefined>,
  ) => Effect.Effect<
    T,
    RedditAuthError | RedditApiError | RedditRateLimitError | RedditNotFoundError
  >;

  /**
   * Performs an authenticated POST request to the Reddit API.
   * Used for write operations. Requires the user auth flow to be configured.
   * May surface RedditAuthError if token acquisition fails.
   */
  readonly post: <T>(
    path: string,
    body: Record<string, string | number | boolean>,
  ) => Effect.Effect<
    T,
    RedditAuthError | RedditApiError | RedditRateLimitError | RedditNotFoundError
  >;
}

export class RedditClient extends Context.Tag("RedditClient")<
  RedditClient,
  RedditClientService
>() {}
