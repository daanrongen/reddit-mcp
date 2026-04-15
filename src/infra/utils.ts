import { Option } from "effect";

/**
 * Constructs the User-Agent header value required by the Reddit API.
 * Falls back to "your-username" when no Reddit username is configured.
 */
export const buildUserAgent = (username: Option.Option<string>): string => {
  const user = Option.getOrElse(username, () => "your-username");
  return `reddit-mcp/1.0 by ${user}`;
};
