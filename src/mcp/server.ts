import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ManagedRuntime } from "effect";
import type { RedditError } from "../domain/errors.ts";
import type { RedditClient } from "../domain/RedditClient.ts";
import { registerBrowseTools } from "./tools/browse.ts";
import { registerSearchTools } from "./tools/search.ts";
import { registerUserTools } from "./tools/user.ts";
import { registerWriteTools } from "./tools/write.ts";

export const createMcpServer = (
  runtime: ManagedRuntime.ManagedRuntime<RedditClient, RedditError>,
): McpServer => {
  const server = new McpServer({
    name: "reddit-mcp-server",
    version: "1.0.0",
  });

  registerSearchTools(server, runtime);
  registerBrowseTools(server, runtime);
  registerUserTools(server, runtime);
  registerWriteTools(server, runtime);

  return server;
};
