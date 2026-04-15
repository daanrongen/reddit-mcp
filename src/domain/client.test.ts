import { describe, expect, it } from "bun:test";
import { Effect } from "effect";
import {
  makeNotFoundTest,
  makeRedditClientTest,
  RedditClientTest,
} from "../infra/RedditClientTest.ts";
import { RedditApiError, RedditNotFoundError } from "./errors.ts";
import { RedditClient } from "./RedditClient.ts";

describe("RedditClientTest — default fixtures", () => {
  it("returns subreddit posts from hot feed", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* RedditClient;
        return yield* client.get<{
          data?: { children?: Array<{ data?: { title?: string } }> };
        }>("/r/programming/hot");
      }).pipe(Effect.provide(RedditClientTest)),
    );

    expect(result.data?.children).toHaveLength(1);
    expect(result.data?.children?.[0]?.data?.title).toBe("Test Post");
  });

  it("returns empty search results", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* RedditClient;
        return yield* client.get<{ data?: { children?: unknown[] } }>("/search", { q: "test" });
      }).pipe(Effect.provide(RedditClientTest)),
    );

    expect(Array.isArray(result.data?.children)).toBe(true);
  });

  it("returns subreddit about info", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* RedditClient;
        return yield* client.get<{ data?: { subscribers?: number } }>("/r/programming/about");
      }).pipe(Effect.provide(RedditClientTest)),
    );

    expect(result.data?.subscribers).toBe(5000000);
  });

  it("returns user profile", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* RedditClient;
        return yield* client.get<{ data?: { name?: string } }>("/user/testuser/about");
      }).pipe(Effect.provide(RedditClientTest)),
    );

    expect(result.data?.name).toBe("testuser");
  });
});

describe("RedditClientTest — unmatched path fails", () => {
  it("returns RedditApiError for unknown paths", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* RedditClient;
        return yield* Effect.either(client.get("/r/unknown/hot"));
      }).pipe(Effect.provide(RedditClientTest)),
    );

    expect(result._tag).toBe("Left");
    if (result._tag === "Left") {
      expect(result.left).toBeInstanceOf(RedditApiError);
    }
  });
});

describe("makeRedditClientTest — custom fixtures", () => {
  it("can provide custom fixture for a specific path", async () => {
    const customLayer = makeRedditClientTest(
      new Map([
        [
          "/r/typescript/new",
          {
            data: {
              children: [{ data: { id: "ts1", title: "TypeScript 6.0 Released", score: 9000 } }],
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
        }>("/r/typescript/new");
      }).pipe(Effect.provide(customLayer)),
    );

    expect(result.data?.children?.[0]?.data?.title).toBe("TypeScript 6.0 Released");
    expect(result.data?.children?.[0]?.data?.score).toBe(9000);
  });
});

describe("makeNotFoundTest", () => {
  it("returns RedditNotFoundError", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const client = yield* RedditClient;
        return yield* Effect.either(client.get("/r/missing/about"));
      }).pipe(Effect.provide(makeNotFoundTest("/r/missing/about"))),
    );

    expect(result._tag).toBe("Left");
    if (result._tag === "Left") {
      expect(result.left).toBeInstanceOf(RedditNotFoundError);
    }
  });
});
