import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Effect, type ManagedRuntime } from "effect";
import { z } from "zod";
import type { RedditError } from "../../domain/errors.ts";
import { RedditClient } from "../../domain/RedditClient.ts";
import {
  buildPaginationString,
  type CommentData,
  type ListingResponse,
  type PostData,
} from "../types.ts";
import { formatError, formatSuccess } from "../utils.ts";

type UserAbout = {
  data?: {
    name?: string;
    icon_img?: string;
    comment_karma?: number;
    link_karma?: number;
    total_karma?: number;
    created_utc?: number;
    is_gold?: boolean;
    is_mod?: boolean;
    verified?: boolean;
    subreddit?: {
      display_name_prefixed?: string;
      public_description?: string;
    };
  };
};

const formatUser = (u: NonNullable<UserAbout["data"]>): string => {
  const lines = [
    `u/${u.name ?? "?"}`,
    `Karma — post: ${u.link_karma?.toLocaleString() ?? 0}  |  comment: ${u.comment_karma?.toLocaleString() ?? 0}`,
    `Gold: ${u.is_gold ? "yes" : "no"}  |  Verified: ${u.verified ? "yes" : "no"}`,
    `Account created: ${u.created_utc ? new Date(u.created_utc * 1000).toISOString().split("T")[0] : "?"}`,
  ];
  if (u.subreddit?.public_description) {
    lines.push("", "Profile bio:", u.subreddit.public_description);
  }
  return lines.join("\n");
};

const formatUserPost = (p: PostData): string =>
  [
    `[${p.id ?? "?"}] ${p.title ?? "Untitled"}`,
    `  r/${p.subreddit ?? "?"}  |  Score: ${p.score ?? 0}  |  Comments: ${p.num_comments ?? 0}`,
    `  https://reddit.com${p.permalink ?? ""}`,
  ].join("\n");

const formatUserComment = (c: CommentData): string =>
  [
    `[${c.id ?? "?"}] in r/${c.subreddit ?? "?"}`,
    `  On: "${c.link_title ?? "?"}"`,
    `  Score: ${c.score ?? 0}`,
    `  ${(c.body ?? "").slice(0, 300)}${(c.body?.length ?? 0) > 300 ? "…" : ""}`,
    `  https://reddit.com${c.permalink ?? ""}`,
  ].join("\n");

export const registerUserTools = (
  server: McpServer,
  runtime: ManagedRuntime.ManagedRuntime<RedditClient, RedditError>,
) => {
  server.tool(
    "get_user_profile",
    "Fetch a Reddit user's public profile — karma, account age, and bio.",
    {
      username: z.string().min(1).describe("Reddit username without u/ prefix"),
    },
    {
      title: "Get User Profile",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async ({ username }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* RedditClient;
          const data = yield* client.get<UserAbout>(`/user/${username}/about`);
          const user = data.data;
          if (!user) return `User u/${username} not found.`;
          return formatUser(user);
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  server.tool(
    "get_user_posts",
    "Fetch a Reddit user's submitted posts.",
    {
      username: z.string().min(1).describe("Reddit username without u/ prefix"),
      sort: z
        .enum(["hot", "new", "top", "controversial"])
        .optional()
        .describe("Sort order (default: new)"),
      t: z
        .enum(["hour", "day", "week", "month", "year", "all"])
        .optional()
        .describe("Time filter for 'top' and 'controversial' sorts (default: all)"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe("Number of posts to return (1-100, default: 25)"),
      after: z.string().optional().describe("Pagination cursor"),
    },
    {
      title: "Get User Posts",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    async ({ username, sort, t, limit, after }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* RedditClient;
          const data = yield* client.get<ListingResponse<PostData>>(`/user/${username}/submitted`, {
            sort: sort ?? "new",
            t: t ?? "all",
            limit: limit ?? 25,
            after,
          });

          const posts = (data.data?.children ?? []).map((c) => c.data ?? {});
          if (!posts.length) return `u/${username} has no posts.`;

          const pagination = buildPaginationString(data.data?.after);

          return `Posts by u/${username}:\n\n${posts.map(formatUserPost).join("\n\n")}${pagination}`;
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  server.tool(
    "get_user_comments",
    "Fetch a Reddit user's comment history.",
    {
      username: z.string().min(1).describe("Reddit username without u/ prefix"),
      sort: z
        .enum(["hot", "new", "top", "controversial"])
        .optional()
        .describe("Sort order (default: new)"),
      t: z
        .enum(["hour", "day", "week", "month", "year", "all"])
        .optional()
        .describe("Time filter for 'top' and 'controversial' sorts (default: all)"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe("Number of comments to return (1-100, default: 25)"),
      after: z.string().optional().describe("Pagination cursor"),
    },
    {
      title: "Get User Comments",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    async ({ username, sort, t, limit, after }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* RedditClient;
          const data = yield* client.get<ListingResponse<CommentData>>(
            `/user/${username}/comments`,
            {
              sort: sort ?? "new",
              t: t ?? "all",
              limit: limit ?? 25,
              after,
            },
          );

          const comments = (data.data?.children ?? []).map((c) => c.data ?? {});
          if (!comments.length) return `u/${username} has no comments.`;

          const pagination = buildPaginationString(data.data?.after);

          return (
            `Comments by u/${username}:\n\n${comments.map(formatUserComment).join("\n\n")}` +
            pagination
          );
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );
};
