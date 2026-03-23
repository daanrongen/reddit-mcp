import { describe, expect, it } from "bun:test";
import { Effect } from "effect";
import { RedditClient } from "../../src/domain/RedditClient.ts";
import { makeRedditClientTest, RedditClientTest } from "../../src/infra/RedditClientTest.ts";

describe("search tools data", () => {
  it("search_posts returns a listing response", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* RedditClient;
        return yield* client.get<{
          data?: { children?: Array<{ data?: { id?: string } }> };
        }>("/search", { q: "effect-ts" });
      }).pipe(Effect.provide(RedditClientTest)),
    );

    expect(Array.isArray(result.data?.children)).toBe(true);
  });

  it("search_subreddits returns a listing response", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* RedditClient;
        return yield* client.get<{
          data?: { children?: unknown[] };
        }>("/subreddits/search", { q: "typescript" });
      }).pipe(Effect.provide(RedditClientTest)),
    );

    expect(Array.isArray(result.data?.children)).toBe(true);
  });
});

describe("browse tools data", () => {
  it("get_subreddit_posts hot returns posts list", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* RedditClient;
        return yield* client.get<{
          data?: { children?: Array<{ data?: { score?: number } }> };
        }>("/r/programming/hot");
      }).pipe(Effect.provide(RedditClientTest)),
    );

    const posts = result.data?.children ?? [];
    expect(posts.length).toBeGreaterThan(0);
    expect(typeof posts[0]?.data?.score).toBe("number");
  });

  it("get_subreddit_info returns about data", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* RedditClient;
        return yield* client.get<{
          data?: { display_name?: string; subscribers?: number };
        }>("/r/programming/about");
      }).pipe(Effect.provide(RedditClientTest)),
    );

    expect(result.data?.display_name).toBe("programming");
    expect(result.data?.subscribers).toBeGreaterThan(0);
  });
});

describe("user tools data", () => {
  it("get_user_profile returns user data", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* RedditClient;
        return yield* client.get<{
          data?: { name?: string; link_karma?: number; comment_karma?: number };
        }>("/user/testuser/about");
      }).pipe(Effect.provide(RedditClientTest)),
    );

    expect(result.data?.name).toBe("testuser");
    expect(typeof result.data?.link_karma).toBe("number");
  });
});

describe("custom fixture handlers", () => {
  it("can provide post fixture with known score", async () => {
    const layer = makeRedditClientTest(
      new Map([
        [
          "/r/rust/hot",
          {
            data: {
              children: [
                {
                  data: {
                    id: "rust1",
                    title: "Rust 2.0 announcement",
                    score: 42000,
                    author: "rust_team",
                    subreddit: "rust",
                  },
                },
              ],
              after: null,
            },
          },
        ],
      ]),
    );

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* RedditClient;
        return yield* client.get<{
          data?: { children?: Array<{ data?: { title?: string; score?: number } }> };
        }>("/r/rust/hot");
      }).pipe(Effect.provide(layer)),
    );

    expect(result.data?.children?.[0]?.data?.title).toBe("Rust 2.0 announcement");
    expect(result.data?.children?.[0]?.data?.score).toBe(42000);
  });
});
