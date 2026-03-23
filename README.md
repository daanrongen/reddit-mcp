# reddit-mcp

MCP server for [Reddit](https://www.reddit.com/) — search posts, browse subreddits, read comments, and write with OAuth2 user auth over stdio.

## Installation

```bash
npx -y @daanrongen/reddit-mcp
```

## Tools (13 total)

| Domain     | Tools                                                                       | Coverage                                   |
| ---------- | --------------------------------------------------------------------------- | ------------------------------------------ |
| **Search** | `search_posts`, `search_subreddits`                                         | Full-text post and subreddit search        |
| **Browse** | `get_subreddit_posts`, `get_post`, `get_comments`, `get_subreddit_info`     | Read posts, comments, and subreddit info   |
| **User**   | `get_user_profile`, `get_user_posts`, `get_user_comments`                   | User profiles and activity history         |
| **Write**  | `submit_post`, `submit_comment`, `vote`, `save_post`                        | Post, comment, vote, and save (OAuth only) |

## Setup

### Reddit OAuth2 app

1. Go to [https://www.reddit.com/prefs/apps](https://www.reddit.com/prefs/apps)
2. Create a **script** app (for personal use) or **web app** (for user auth)
3. Note the **client ID** (under the app name) and **client secret**
4. For write access, obtain a refresh token via the OAuth2 flow

### Environment variables

| Variable                | Required       | Description                            |
| ----------------------- | -------------- | -------------------------------------- |
| `REDDIT_CLIENT_ID`      | Yes            | OAuth2 app client ID                   |
| `REDDIT_CLIENT_SECRET`  | Yes            | OAuth2 app client secret               |
| `REDDIT_REFRESH_TOKEN`  | For write tools | Refresh token for user-level access   |
| `REDDIT_USERNAME`       | For write tools | Reddit username                        |

Read-only tools (`search_posts`, `browse`, `user` tools) work with just `REDDIT_CLIENT_ID` and `REDDIT_CLIENT_SECRET` using app-only auth. Write tools require a valid refresh token.

### Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "reddit": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@daanrongen/reddit-mcp"],
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

Or via the CLI:

```bash
claude mcp add reddit \
  -e REDDIT_CLIENT_ID=your-client-id \
  -e REDDIT_CLIENT_SECRET=your-client-secret \
  -- npx -y @daanrongen/reddit-mcp
```

## Development

```bash
bun install
bun run dev        # run with --watch
bun test           # run test suite
bun run build      # bundle to dist/main.js
bun run inspect    # open MCP Inspector in browser
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
├── config.ts                 # Effect Config — REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, …
├── main.ts                   # Entry point — ManagedRuntime + StdioServerTransport
├── domain/
│   ├── RedditClient.ts       # Context.Tag service interface
│   ├── errors.ts             # RedditError, AuthError
│   └── models.ts             # Schema.Class models (Post, Comment, Subreddit, …)
├── infra/
│   ├── RedditClientLive.ts   # Layer.scoped — OAuth2 token management + Reddit API
│   └── RedditClientTest.ts   # In-memory test adapter
└── mcp/
    ├── server.ts             # McpServer wired to ManagedRuntime
    ├── utils.ts              # formatSuccess, formatError
    └── tools/                # search.ts, browse.ts, user.ts, write.ts
```
