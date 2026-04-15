import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Effect, type ManagedRuntime } from "effect";
import { z } from "zod";
import type { RedditError } from "../../domain/errors.ts";
import { RedditClient } from "../../domain/RedditClient.ts";
import type { ListingResponse, PostData } from "../types.ts";
import { formatError, formatSuccess } from "../utils.ts";

const formatPost = (post: PostData): string => {
  const lines = [
    `[${post.id ?? "?"}] ${post.title ?? "Untitled"}`,
    `  Author: u/${post.author ?? "?"}  |  Score: ${post.score ?? 0}  |  Comments: ${post.num_comments ?? 0}`,
    `  Subreddit: r/${post.subreddit ?? "?"}`,
    `  URL: ${post.url ?? "?"}`,
    `  Reddit: https://reddit.com${post.permalink ?? ""}`,
  ];
  if (post.is_self && post.selftext) {
    const preview = post.selftext.slice(0, 200);
    lines.push(`  Text: ${preview}${post.selftext.length > 200 ? "…" : ""}`);
  }
  return lines.join("\n");
};

const extractPosts = (response: ListingResponse<PostData>): PostData[] =>
  (response.data?.children ?? []).map((c) => c.data ?? {});

export const registerSearchTools = (
  server: McpServer,
  runtime: ManagedRuntime.ManagedRuntime<RedditClient, RedditError>,
) => {
  server.tool(
    "search_posts",
    "Search Reddit for posts matching a query. Optionally restrict to a subreddit, set sort order, time filter, and result limit.",
    {
      q: z.string().min(1).describe("Search query string"),
      subreddit: z
        .string()
        .optional()
        .describe("Restrict search to this subreddit (without r/ prefix, e.g. 'programming')"),
      sort: z
        .enum(["relevance", "hot", "top", "new", "comments"])
        .optional()
        .describe("Sort order for results (default: relevance)"),
      t: z
        .enum(["hour", "day", "week", "month", "year", "all"])
        .optional()
        .describe("Time filter — applies when sort is 'top' or 'new' (default: all)"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe("Number of results to return (1-100, default: 25)"),
    },
    {
      title: "Search Posts",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async ({ q, subreddit, sort, t, limit }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* RedditClient;
          const path = subreddit ? `/r/${subreddit}/search` : "/search";
          const data = yield* client.get<ListingResponse<PostData>>(path, {
            q,
            sort: sort ?? "relevance",
            t: t ?? "all",
            limit: limit ?? 25,
            restrict_sr: subreddit ? "true" : undefined,
            type: "link",
          });
          const posts = extractPosts(data);
          if (!posts.length) return `No posts found for query: "${q}"`;
          return `Search results for "${q}"${subreddit ? ` in r/${subreddit}` : ""}:\n\n${posts.map(formatPost).join("\n\n")}`;
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  server.tool(
    "search_subreddits",
    "Search for subreddits by topic or keyword. Returns matching subreddits with subscriber counts and descriptions.",
    {
      q: z.string().min(1).describe("Topic or keyword to search subreddits for"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe("Number of results to return (1-100, default: 25)"),
    },
    {
      title: "Search Subreddits",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async ({ q, limit }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* RedditClient;
          const data = yield* client.get<{
            data?: {
              children?: Array<{
                data?: {
                  display_name?: string;
                  title?: string;
                  subscribers?: number;
                  public_description?: string;
                  url?: string;
                };
              }>;
            };
          }>("/subreddits/search", { q, limit: limit ?? 25 });

          const subs = (data.data?.children ?? []).map((c) => c.data ?? {});
          if (!subs.length) return `No subreddits found for: "${q}"`;

          const lines = subs.map((s) => {
            const name = s.display_name ?? "?";
            const subscribers = s.subscribers?.toLocaleString() ?? "?";
            const desc = s.public_description
              ? `\n  ${s.public_description.slice(0, 150)}${(s.public_description?.length ?? 0) > 150 ? "…" : ""}`
              : "";
            return `r/${name}  (${subscribers} subscribers)${desc}`;
          });

          return `Subreddits matching "${q}":\n\n${lines.join("\n\n")}`;
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );
};
