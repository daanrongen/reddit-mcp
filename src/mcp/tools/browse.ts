import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Effect, type ManagedRuntime } from "effect";
import { z } from "zod";
import type { RedditError } from "../../domain/errors.ts";
import { RedditClient } from "../../domain/RedditClient.ts";
import { formatError, formatSuccess } from "../utils.ts";

type PostData = {
  id?: string;
  name?: string;
  title?: string;
  author?: string;
  score?: number;
  url?: string;
  selftext?: string;
  num_comments?: number;
  subreddit?: string;
  created_utc?: number;
  permalink?: string;
  is_self?: boolean;
  link_flair_text?: string;
};

type CommentData = {
  id?: string;
  author?: string;
  body?: string;
  score?: number;
  created_utc?: number;
  replies?: { data?: { children?: Array<{ kind?: string; data?: CommentData }> } } | "";
  depth?: number;
};

type SubredditAbout = {
  data?: {
    display_name?: string;
    title?: string;
    public_description?: string;
    description?: string;
    subscribers?: number;
    active_user_count?: number;
    over18?: boolean;
    url?: string;
    created_utc?: number;
    submit_text?: string;
  };
};

const formatPost = (post: PostData): string => {
  const lines = [
    `[${post.id ?? "?"}] ${post.title ?? "Untitled"}`,
    `  Author: u/${post.author ?? "?"}  |  Score: ${post.score ?? 0}  |  Comments: ${post.num_comments ?? 0}`,
  ];
  if (post.link_flair_text) lines.push(`  Flair: ${post.link_flair_text}`);
  lines.push(`  URL: ${post.url ?? "?"}`);
  lines.push(`  Reddit: https://reddit.com${post.permalink ?? ""}`);
  if (post.is_self && post.selftext) {
    const preview = post.selftext.slice(0, 300);
    lines.push(`  Text: ${preview}${post.selftext.length > 300 ? "…" : ""}`);
  }
  return lines.join("\n");
};

const formatComment = (comment: CommentData, indent = 0): string => {
  if (!comment.body || comment.body === "[deleted]" || comment.body === "[removed]") return "";
  const prefix = "  ".repeat(indent);
  const lines = [
    `${prefix}u/${comment.author ?? "?"} (score: ${comment.score ?? 0})`,
    `${prefix}${comment.body.slice(0, 500)}${(comment.body?.length ?? 0) > 500 ? "…" : ""}`,
  ];

  // Render up to 2 levels of nested replies to keep output concise.
  if (indent < 2 && typeof comment.replies === "object" && comment.replies?.data?.children) {
    for (const child of comment.replies.data.children.slice(0, 3)) {
      if (child.kind === "t1" && child.data) {
        const nested = formatComment(child.data, indent + 1);
        if (nested) lines.push(nested);
      }
    }
  }

  return lines.join("\n");
};

export const registerBrowseTools = (
  server: McpServer,
  runtime: ManagedRuntime.ManagedRuntime<RedditClient, RedditError>,
) => {
  server.tool(
    "get_subreddit_posts",
    "Fetch posts from a subreddit. Supports hot, new, top, and rising feeds.",
    {
      subreddit: z
        .string()
        .min(1)
        .describe("Subreddit name without r/ prefix (e.g. 'programming')"),
      feed: z.enum(["hot", "new", "top", "rising"]).optional().describe("Feed type (default: hot)"),
      t: z
        .enum(["hour", "day", "week", "month", "year", "all"])
        .optional()
        .describe("Time filter for 'top' feed (default: day)"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe("Number of posts to return (1-100, default: 25)"),
      after: z
        .string()
        .optional()
        .describe("Pagination cursor — the 'after' value from a previous response"),
    },
    {
      title: "Get Subreddit Posts",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    async ({ subreddit, feed, t, limit, after }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* RedditClient;
          const feedPath = feed ?? "hot";
          const data = yield* client.get<{
            data?: {
              children?: Array<{ data?: PostData }>;
              after?: string | null;
            };
          }>(`/r/${subreddit}/${feedPath}`, { t: t ?? "day", limit: limit ?? 25, after });

          const posts = (data.data?.children ?? []).map((c) => c.data ?? {});
          if (!posts.length) return `No posts found in r/${subreddit}.`;

          const pagination = data.data?.after
            ? `\n\nMore results available. Use after="${data.data.after}" to fetch the next page.`
            : "";

          return (
            `r/${subreddit} — ${feedPath} posts:\n\n${posts.map(formatPost).join("\n\n")}` +
            pagination
          );
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  server.tool(
    "get_post",
    "Fetch a single Reddit post by ID or permalink URL, including the top-level comments.",
    {
      id: z
        .string()
        .optional()
        .describe("Reddit post ID (e.g. 'abc123') — provide either this or 'url', not both"),
      url: z
        .string()
        .optional()
        .describe(
          "Full Reddit permalink URL (e.g. 'https://reddit.com/r/programming/comments/abc123/...') — provide either this or 'id'",
        ),
      comment_limit: z
        .number()
        .int()
        .min(0)
        .max(500)
        .optional()
        .describe("Number of top-level comments to include (default: 10)"),
    },
    {
      title: "Get Post",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async ({ id, url, comment_limit }) => {
      if (!id && !url) {
        return formatSuccess("Provide either 'id' or 'url' to fetch a post.");
      }

      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* RedditClient;

          // Resolve the path: either by ID (need subreddit) or full permalink.
          let path: string;
          if (url) {
            // Strip domain to get the path, then append .json if needed.
            const parsed = new URL(url.startsWith("http") ? url : `https://reddit.com${url}`);
            path = parsed.pathname.replace(/\/$/, "");
          } else {
            // ID-only requires fetching the info endpoint to get the subreddit.
            const infoData = yield* client.get<{
              data?: { children?: Array<{ data?: PostData }> };
            }>("/api/info", { id: `t3_${id}` });
            const post = infoData.data?.children?.[0]?.data;
            if (!post) {
              return `Post with ID "${id}" not found.`;
            }
            path = post.permalink?.replace(/\/$/, "") ?? `/r/${post.subreddit}/comments/${id}`;
            return formatPostWithComments(post, [], comment_limit ?? 10);
          }

          const listingData = yield* client.get<
            [
              { data?: { children?: Array<{ data?: PostData }> } },
              {
                data?: {
                  children?: Array<{ kind?: string; data?: CommentData }>;
                };
              },
            ]
          >(path, { limit: comment_limit ?? 10 });

          const post = listingData[0]?.data?.children?.[0]?.data ?? {};
          const commentChildren = listingData[1]?.data?.children ?? [];
          const comments = commentChildren.filter((c) => c.kind === "t1").map((c) => c.data ?? {});

          return formatPostWithComments(post, comments, comment_limit ?? 10);
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  server.tool(
    "get_comments",
    "Fetch comments for a Reddit post. Supports sorting and depth control.",
    {
      subreddit: z.string().min(1).describe("Subreddit name without r/ prefix"),
      post_id: z.string().min(1).describe("Post ID (the short alphanumeric ID, e.g. 'abc123')"),
      sort: z
        .enum(["confidence", "top", "new", "controversial", "old", "random", "qa", "live"])
        .optional()
        .describe("Comment sort order (default: confidence)"),
      limit: z
        .number()
        .int()
        .min(1)
        .max(500)
        .optional()
        .describe("Number of top-level comments to return (default: 25)"),
      depth: z
        .number()
        .int()
        .min(1)
        .max(10)
        .optional()
        .describe("Maximum depth of comment trees to return (default: 3)"),
    },
    {
      title: "Get Comments",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async ({ subreddit, post_id, sort, limit, depth }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* RedditClient;
          const data = yield* client.get<
            [
              unknown,
              {
                data?: {
                  children?: Array<{ kind?: string; data?: CommentData }>;
                };
              },
            ]
          >(`/r/${subreddit}/comments/${post_id}`, {
            sort: sort ?? "confidence",
            limit: limit ?? 25,
            depth: depth ?? 3,
          });

          const commentChildren = data[1]?.data?.children ?? [];
          const comments = commentChildren.filter((c) => c.kind === "t1").map((c) => c.data ?? {});

          if (!comments.length) return "No comments found for this post.";

          const formatted = comments
            .map((c) => formatComment(c))
            .filter(Boolean)
            .join("\n\n---\n\n");

          return `Comments for r/${subreddit}/comments/${post_id} (sort: ${sort ?? "confidence"}):\n\n${formatted}`;
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );

  server.tool(
    "get_subreddit_info",
    "Fetch metadata for a subreddit — subscriber count, description, rules, and settings.",
    {
      subreddit: z.string().min(1).describe("Subreddit name without r/ prefix"),
    },
    {
      title: "Get Subreddit Info",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    },
    async ({ subreddit }) => {
      const result = await runtime.runPromiseExit(
        Effect.gen(function* () {
          const client = yield* RedditClient;
          const [aboutData, rulesData] = yield* Effect.all(
            [
              client.get<SubredditAbout>(`/r/${subreddit}/about`),
              client.get<{
                rules?: Array<{ short_name?: string; description?: string; kind?: string }>;
              }>(`/r/${subreddit}/about/rules`),
            ],
            { concurrency: "unbounded" },
          );

          const about = aboutData.data ?? {};
          const rules = rulesData.rules ?? [];

          const lines = [
            `r/${about.display_name ?? subreddit}`,
            `Title: ${about.title ?? "?"}`,
            `Subscribers: ${about.subscribers?.toLocaleString() ?? "?"}`,
            `Active users: ${about.active_user_count?.toLocaleString() ?? "?"}`,
            `NSFW: ${about.over18 ? "yes" : "no"}`,
            ``,
            `Description:`,
            about.public_description ?? "(no description)",
          ];

          if (rules.length) {
            lines.push("", "Rules:");
            for (const rule of rules) {
              lines.push(`  • ${rule.short_name ?? "Rule"}: ${rule.description ?? ""}`);
            }
          }

          if (about.submit_text) {
            lines.push("", "Submission guidelines:", about.submit_text);
          }

          return lines.join("\n");
        }),
      );
      if (result._tag === "Failure") return formatError(result.cause);
      return formatSuccess(result.value);
    },
  );
};

const formatPostWithComments = (
  post: PostData,
  comments: CommentData[],
  commentLimit: number,
): string => {
  const postLines = [
    `${post.title ?? "Untitled"}`,
    `Author: u/${post.author ?? "?"}  |  Score: ${post.score ?? 0}  |  Comments: ${post.num_comments ?? 0}`,
    `Subreddit: r/${post.subreddit ?? "?"}`,
    `URL: ${post.url ?? "?"}`,
    `Reddit: https://reddit.com${post.permalink ?? ""}`,
  ];

  if (post.is_self && post.selftext) {
    postLines.push("", "Text:", post.selftext);
  }

  if (!comments.length) return postLines.join("\n");

  const formattedComments = comments
    .slice(0, commentLimit)
    .map((c) => formatComment(c))
    .filter(Boolean)
    .join("\n\n---\n\n");

  return `${postLines.join("\n")}\n\nTop comments:\n\n${formattedComments}`;
};
