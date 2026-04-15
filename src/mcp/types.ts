/**
 * Shared Reddit API response types used across MCP tool files.
 *
 * PostData merges the fields used in browse.ts, search.ts, and user.ts.
 * CommentData merges the fields used in browse.ts and user.ts.
 */

export type PostData = {
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
  /** Present on user-submitted listings */
  link_title?: string;
};

export type CommentData = {
  id?: string;
  author?: string;
  body?: string;
  score?: number;
  subreddit?: string;
  created_utc?: number;
  /** Present on user-comment listings */
  link_title?: string;
  permalink?: string;
  depth?: number;
  replies?: { data?: { children?: Array<{ kind?: string; data?: CommentData }> } } | "";
};

export type ListingResponse<T> = {
  data?: {
    children?: Array<{ data?: T }>;
    after?: string | null;
  };
};

/**
 * Builds the pagination footer string for listing responses.
 * Returns an empty string when there are no further pages.
 */
export const buildPaginationString = (after: string | null | undefined): string =>
  after ? `\n\nMore results available. Use after="${after}" to fetch the next page.` : "";
