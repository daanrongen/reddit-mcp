# reddit-mcp

MCP server for [Reddit](https://www.reddit.com/) — search posts, browse subreddits, read comments, and write with OAuth2 user auth over stdio.

## Installation

```bash
bunx @daanrongen/reddit-mcp
```

## Tools

| Domain     | Tools                                                                   | Coverage                                   |
| ---------- | ----------------------------------------------------------------------- | ------------------------------------------ |
| **Search** | `search_posts`, `search_subreddits`                                     | Full-text post and subreddit search        |
| **Browse** | `get_subreddit_posts`, `get_post`, `get_comments`, `get_subreddit_info` | Read posts, comments, and subreddit info   |
| **User**   | `get_user_profile`, `get_user_posts`, `get_user_comments`               | User profiles and activity history         |
| **Write**  | `submit_post`, `submit_comment`, `vote`, `save_post`                    | Post, comment, vote, and save (OAuth only) |

## Configuration

| Variable               | Required         | Description                         |
| ---------------------- | ---------------- | ----------------------------------- |
| `REDDIT_CLIENT_ID`     | Yes              | OAuth2 app client ID                |
| `REDDIT_CLIENT_SECRET` | Yes              | OAuth2 app client secret            |
| `REDDIT_REFRESH_TOKEN` | For write tools  | Refresh token for user-level access |
| `REDDIT_USERNAME`      | For write tools  | Reddit username                     |

Read-only tools (`search_posts`, browse, and user tools) work with just `REDDIT_CLIENT_ID` and `REDDIT_CLIENT_SECRET` using app-only auth. Write tools require a valid refresh token.

### OAuth2 setup

1. Go to [https://www.reddit.com/prefs/apps](https://www.reddit.com/prefs/apps)
2. Create a **script** app (for personal use) or **web app** (for user auth)
3. Note the **client ID** (shown under the app name) and **client secret**
4. For write access, run the OAuth2 authorization flow to obtain a refresh token

## Setup

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "reddit": {
      "type": "stdio",
      "command": "bunx",
      "args": ["@daanrongen/reddit-mcp"],
      "env": {
        "REDDIT_CLIENT_ID": "your-client-id",
        "REDDIT_CLIENT_SECRET": "your-client-secret",
        "REDDIT_REFRESH_TOKEN": "your-refresh-token",
        "REDDIT_USERNAME": "your-username"
      }
    }
  }
}
```

### Claude Code CLI

```bash
claude mcp add reddit \
  -e REDDIT_CLIENT_ID=your-client-id \
  -e REDDIT_CLIENT_SECRET=your-client-secret \
  -- bunx @daanrongen/reddit-mcp
```

## Development

```bash
bun install
bun run dev        # run with --watch
bun test           # run test suite
bun run typecheck  # type-check without emit
bun run lint       # biome lint
bun run format     # biome format
bun run build      # bundle to dist/main.js
```

## Inspecting locally

`bun run inspect` launches the [MCP Inspector](https://github.com/modelcontextprotocol/inspector) against the local build:

```bash
bun run build && bun run inspect
```

This opens the Inspector UI in your browser where you can call any tool interactively and inspect request/response shapes.

## Architecture

```
src/
├── config.ts                  # Effect Config — REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, …
├── main.ts                    # Entry point — ManagedRuntime + StdioServerTransport
├── domain/
│   ├── auth.test.ts           # RedditAuth unit tests
│   ├── client.test.ts         # RedditClient unit tests
│   ├── tools.test.ts          # Tool-level data shape tests
│   ├── errors.ts              # RedditError, AuthError
│   ├── models.ts              # Schema.Class models (Post, Comment, Subreddit, …)
│   ├── RedditAuth.ts          # Context.Tag auth service interface
│   └── RedditClient.ts        # Context.Tag client service interface
├── infra/
│   ├── RedditAuthLive.ts      # OAuth2 token management
│   ├── RedditClientLive.ts    # Layer.scoped — Reddit API adapter
│   └── RedditClientTest.ts    # In-memory test adapter
└── mcp/
    ├── server.ts              # McpServer wired to ManagedRuntime
    ├── utils.ts               # formatSuccess, formatError
    └── tools/                 # search.ts, browse.ts, user.ts, write.ts
```

## License

MIT
