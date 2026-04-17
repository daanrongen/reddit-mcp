import { Schema } from "effect";

export class RedditPost extends Schema.Class<RedditPost>("RedditPost")({
  id: Schema.optional(Schema.String),
  name: Schema.optional(Schema.String),
  title: Schema.optional(Schema.String),
  author: Schema.optional(Schema.String),
  score: Schema.optional(Schema.Number),
  url: Schema.optional(Schema.String),
  selftext: Schema.optional(Schema.String),
  num_comments: Schema.optional(Schema.Number),
  subreddit: Schema.optional(Schema.String),
  created_utc: Schema.optional(Schema.Number),
  permalink: Schema.optional(Schema.String),
  is_self: Schema.optional(Schema.Boolean),
  link_flair_text: Schema.optional(Schema.String),
  link_title: Schema.optional(Schema.String),
}) {}

export class RedditComment extends Schema.Class<RedditComment>("RedditComment")({
  id: Schema.optional(Schema.String),
  author: Schema.optional(Schema.String),
  body: Schema.optional(Schema.String),
  score: Schema.optional(Schema.Number),
  subreddit: Schema.optional(Schema.String),
  created_utc: Schema.optional(Schema.Number),
  link_title: Schema.optional(Schema.String),
  permalink: Schema.optional(Schema.String),
  depth: Schema.optional(Schema.Number),
}) {}

export class RedditSubreddit extends Schema.Class<RedditSubreddit>("RedditSubreddit")({
  display_name: Schema.optional(Schema.String),
  title: Schema.optional(Schema.String),
  public_description: Schema.optional(Schema.String),
  description: Schema.optional(Schema.String),
  subscribers: Schema.optional(Schema.Number),
  active_user_count: Schema.optional(Schema.Number),
  over18: Schema.optional(Schema.Boolean),
  url: Schema.optional(Schema.String),
  created_utc: Schema.optional(Schema.Number),
  submit_text: Schema.optional(Schema.String),
}) {}

export class RedditUser extends Schema.Class<RedditUser>("RedditUser")({
  name: Schema.optional(Schema.String),
  icon_img: Schema.optional(Schema.String),
  comment_karma: Schema.optional(Schema.Number),
  link_karma: Schema.optional(Schema.Number),
  created_utc: Schema.optional(Schema.Number),
  is_gold: Schema.optional(Schema.Boolean),
}) {}
