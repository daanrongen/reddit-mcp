import { Config } from "effect";

export const RedditClientIdConfig = Config.string("REDDIT_CLIENT_ID");
export const RedditClientSecretConfig = Config.string("REDDIT_CLIENT_SECRET");
export const RedditRefreshTokenConfig = Config.option(Config.string("REDDIT_REFRESH_TOKEN"));
export const RedditUsernameConfig = Config.option(Config.string("REDDIT_USERNAME"));
