import { describe, expect, it } from "bun:test";
import { Effect } from "effect";
import { RedditAuth } from "../../src/domain/RedditAuth.ts";
import { RedditAuthTest } from "../../src/infra/RedditClientTest.ts";

describe("RedditAuthTest", () => {
  it("returns a test access token", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const auth = yield* RedditAuth;
        return yield* auth.getAccessToken();
      }).pipe(Effect.provide(RedditAuthTest)),
    );

    expect(result).toBe("test-access-token");
  });
});
