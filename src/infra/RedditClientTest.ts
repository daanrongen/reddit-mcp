import { Effect, Layer, Option } from "effect";
import { RedditApiError, RedditNotFoundError } from "../domain/errors.ts";
import { RedditAuth } from "../domain/RedditAuth.ts";
import { RedditClient } from "../domain/RedditClient.ts";

export type RedditTestHandlers = Map<string, unknown>;

/**
 * In-memory test adapter for RedditClient.
 * Handlers map path prefixes to fixture data. Unmatched paths fail with
 * RedditApiError so tests can verify error paths.
 */
export const makeRedditClientTest = (handlers: RedditTestHandlers = new Map()) =>
  Layer.succeed(RedditClient, {
    get: <T>(path: string) => {
      for (const [prefix, data] of handlers) {
        if (path.startsWith(prefix)) {
          return Effect.succeed(data as T);
        }
      }
      return Effect.fail(new RedditApiError({ message: `No test handler for path: ${path}` }));
    },
    post: <T>(path: string) => {
      for (const [prefix, data] of handlers) {
        if (path.startsWith(prefix)) {
          return Effect.succeed(data as T);
        }
      }
      return Effect.fail(new RedditApiError({ message: `No test handler for POST path: ${path}` }));
    },
  });

/** Test adapter for RedditAuth — always returns a static test token. */
export const RedditAuthTest = Layer.succeed(RedditAuth, {
  getAccessToken: () => Effect.succeed("test-access-token"),
});

/** Default test layer with common fixture responses. */
export const RedditClientTest = makeRedditClientTest(
  new Map<string, unknown>([
    [
      "/r/programming/hot",
      {
        data: {
          children: [
            {
              data: {
                id: "abc123",
                title: "Test Post",
                author: "testuser",
                score: 1000,
                url: "https://example.com",
                selftext: "",
                num_comments: 50,
                subreddit: "programming",
                created_utc: 1700000000,
                permalink: "/r/programming/comments/abc123/test_post/",
                is_self: false,
              },
            },
          ],
          after: null,
        },
      },
    ],
    [
      "/search",
      {
        data: {
          children: [],
          after: null,
        },
      },
    ],
    [
      "/r/programming/about",
      {
        data: {
          display_name: "programming",
          title: "programming",
          public_description: "Computer programming discussion",
          subscribers: 5000000,
          active_user_count: 10000,
          over18: false,
          url: "/r/programming/",
        },
      },
    ],
    [
      "/user/testuser/about",
      {
        data: {
          name: "testuser",
          icon_img: "",
          comment_karma: 100,
          link_karma: 200,
          created_utc: 1600000000,
          is_gold: false,
        },
      },
    ],
    ["/subreddits/search", { data: { children: [], after: null } }],
  ]),
);

export const makeNotFoundTest = (path: string) =>
  Layer.succeed(RedditClient, {
    get: <T>(_path: string) =>
      Effect.fail(new RedditNotFoundError({ resource: path })) as Effect.Effect<
        T,
        RedditNotFoundError
      >,
    post: <T>(_path: string) =>
      Effect.fail(new RedditNotFoundError({ resource: path })) as Effect.Effect<
        T,
        RedditNotFoundError
      >,
  });

/** Merges RedditClientTest and RedditAuthTest for convenience. */
export const RedditTestLayer = Layer.mergeAll(RedditClientTest, RedditAuthTest);
