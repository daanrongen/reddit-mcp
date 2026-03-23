import { Data } from "effect";

export class RedditAuthError extends Data.TaggedError("RedditAuthError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class RedditApiError extends Data.TaggedError("RedditApiError")<{
  readonly message: string;
  readonly status?: number;
  readonly cause?: unknown;
}> {}

export class RedditRateLimitError extends Data.TaggedError("RedditRateLimitError")<{
  readonly resetAfterSeconds: number;
}> {}

export class RedditNotFoundError extends Data.TaggedError("RedditNotFoundError")<{
  readonly resource: string;
}> {}

export type RedditError =
  | RedditAuthError
  | RedditApiError
  | RedditRateLimitError
  | RedditNotFoundError;
