export type Feed = {
  rowid: number;
  url: string;
  title: string;
  lastcheck: number;
  lastupd: number;
  updateInterval: number;
  icon: number;
};

export type XFeed = Feed & {
  total: number;
  unread: number;
}

export type Icon = {
  rowid: number;
  domain: string,
  data: ArrayBuffer;
};

export type FeedItem = {
  rowid: number;
  feed: number;
  date: number;
  title: string;
  content: string;
  url: string;
};

export type XFeedItem = FeedItem & {
  icon: number,
  read: number,
};

export type ItemFilter = {
  limit?: number;
  offset?: number;
  mindate?: number;
  unread?: number;
  feed?: number;
};
