import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Effect, type ManagedRuntime, Option } from "effect";
import { z } from "zod";
import { RedditRefreshTokenConfig } from "../../config.ts";
import type { RedditError } from "../../domain/errors.ts";
import { RedditClient } from "../../domain/RedditClient.ts";
import { runTool, WRITE_AUTH_ERROR } from "../utils.ts";

/**
 * Guard that checks whether REDDIT_REFRESH_TOKEN is configured before
 * executing a write operation. Returns WRITE_AUTH_ERROR text if missing.
 */
const requireRefreshToken = Effect.gen(function* () {
  const option = yield* Effect.orDie(RedditRefreshTokenConfig);
  return Option.isSome(option);
});

type SubmitPostResponse = {
  json?: {
    errors?: unknown[];
    data?: {
      url?: string;
      id?: string;
      name?: string;
    };
  };
};

type SubmitCommentResponse = {
  json?: {
    errors?: unknown[];
    data?: {
      things?: Array<{
        data?: {
          id?: string;
          name?: string;
          body?: string;
          permalink?: string;
        };
      }>;
    };
  };
};

export const registerWriteTools = (
  server: McpServer,
  runtime: ManagedRuntime.ManagedRuntime<RedditClient, RedditError>,
) => {
  server.tool(
    "submit_post",
    "Submit a new post to a subreddit. Requires REDDIT_REFRESH_TOKEN to be configured.",
    {
      subreddit: z.string().min(1).describe("Target subreddit without r/ prefix"),
      title: z.string().min(1).max(300).describe("Post title"),
      kind: z
        .enum(["self", "link"])
        .describe("'self' for a text post, 'link' for a URL submission"),
      text: z.string().optional().describe("Post body in Markdown — required when kind is 'self'"),
      url: z.string().optional().describe("URL to submit — required when kind is 'link'"),
      nsfw: z.boolean().optional().describe("Mark the post as NSFW (default: false)"),
      spoiler: z.boolean().optional().describe("Mark the post as a spoiler (default: false)"),
      flair_id: z.string().optional().describe("Flair template ID to apply to the post"),
      flair_text: z
        .string()
        .optional()
        .describe("Flair text to apply (only when the subreddit allows user-set flair text)"),
    },
    {
      title: "Submit Post",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    async ({ subreddit, title, kind, text, url, nsfw, spoiler, flair_id, flair_text }) =>
      runTool(
        runtime,
        Effect.gen(function* () {
          const hasToken = yield* requireRefreshToken;
          if (!hasToken) return WRITE_AUTH_ERROR;

          const client = yield* RedditClient;

          const body: Record<string, string | number | boolean> = {
            sr: subreddit,
            title,
            kind,
            resubmit: true,
            nsfw: nsfw ?? false,
            spoiler: spoiler ?? false,
          };

          if (kind === "self" && text) body.text = text;
          if (kind === "link" && url) body.url = url;
          if (flair_id) body.flair_id = flair_id;
          if (flair_text) body.flair_text = flair_text;

          const data = yield* client.post<SubmitPostResponse>("/api/submit", body);
          const errors = data.json?.errors ?? [];

          if (errors.length > 0) {
            return `Post submission failed. Errors: ${JSON.stringify(errors)}`;
          }

          const postUrl = data.json?.data?.url ?? "";
          const postId = data.json?.data?.id ?? "";

          return `Post submitted successfully!\nID: ${postId}\nURL: ${postUrl}`;
        }),
      ),
  );

  server.tool(
    "submit_comment",
    "Reply to a Reddit post or comment. Requires REDDIT_REFRESH_TOKEN to be configured.",
    {
      parent_id: z
        .string()
        .min(1)
        .describe(
          "Fullname of the parent — a post ID prefixed with t3_ (e.g. 't3_abc123') or a comment ID prefixed with t1_ (e.g. 't1_xyz789')",
        ),
      text: z.string().min(1).describe("Comment body in Markdown"),
    },
    {
      title: "Submit Comment",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    async ({ parent_id, text }) =>
      runTool(
        runtime,
        Effect.gen(function* () {
          const hasToken = yield* requireRefreshToken;
          if (!hasToken) return WRITE_AUTH_ERROR;

          const client = yield* RedditClient;
          const data = yield* client.post<SubmitCommentResponse>("/api/comment", {
            parent: parent_id,
            text,
          });

          const errors = data.json?.errors ?? [];
          if (errors.length > 0) {
            return `Comment submission failed. Errors: ${JSON.stringify(errors)}`;
          }

          const comment = data.json?.data?.things?.[0]?.data;
          const commentId = comment?.id ?? "";
          const permalink = comment?.permalink ?? "";

          return `Comment submitted successfully!\nID: ${commentId}${permalink ? `\nURL: https://reddit.com${permalink}` : ""}`;
        }),
      ),
  );

  server.tool(
    "vote",
    "Vote on a Reddit post or comment. Requires REDDIT_REFRESH_TOKEN to be configured.",
    {
      id: z
        .string()
        .min(1)
        .describe(
          "Fullname of the thing to vote on — post ID prefixed with t3_ (e.g. 't3_abc123') or comment ID prefixed with t1_ (e.g. 't1_xyz789')",
        ),
      dir: z
        .union([z.literal(1), z.literal(0), z.literal(-1)])
        .describe("Vote direction: 1 = upvote, 0 = remove vote, -1 = downvote"),
    },
    {
      title: "Vote",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async ({ id, dir }) =>
      runTool(
        runtime,
        Effect.gen(function* () {
          const hasToken = yield* requireRefreshToken;
          if (!hasToken) return WRITE_AUTH_ERROR;

          const client = yield* RedditClient;
          yield* client.post<void>("/api/vote", { id, dir });

          const label = dir === 1 ? "Upvoted" : dir === -1 ? "Downvoted" : "Vote removed from";
          return `${label} ${id}`;
        }),
      ),
  );

  server.tool(
    "save_post",
    "Save or unsave a Reddit post or comment. Requires REDDIT_REFRESH_TOKEN to be configured.",
    {
      id: z
        .string()
        .min(1)
        .describe(
          "Fullname of the post or comment — e.g. 't3_abc123' for a post, 't1_xyz789' for a comment",
        ),
      save: z.boolean().describe("true to save, false to unsave"),
    },
    {
      title: "Save Post",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async ({ id, save }) =>
      runTool(
        runtime,
        Effect.gen(function* () {
          const hasToken = yield* requireRefreshToken;
          if (!hasToken) return WRITE_AUTH_ERROR;

          const client = yield* RedditClient;
          const path = save ? "/api/save" : "/api/unsave";
          yield* client.post<void>(path, { id });

          return `${save ? "Saved" : "Unsaved"} ${id}`;
        }),
      ),
  );
};
