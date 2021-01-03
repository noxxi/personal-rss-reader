import Parser from "rss-parser";
import Db from "./db";
import * as T from './types'
import * as D from "./log";
import sanitizeHtml from "sanitize-html";
import fetch from "node-fetch";



export default class RSS {
  private db: Db;
  public updateInterval_min = 60*1000; // 1 minute
  public updateInterval_max = 600*1000; // 10 minutes
  public updateInterval_backoff = 1.3;

  constructor(dbfile: string) {
    this.db = new Db(dbfile);
  }

  async updAllFeeds(force=false) {
    let ids = await this.db.getAllFeedIds();
    for (let i = 0; i < ids.length; i++) {
      await this.updFeed(ids[i], force);
    }
  }

  async addFeed(url: string, check4dup = true) : Promise<T.Feed> {
    if (check4dup) {
      let exists = await this.db.getFeed(url);
      if (exists) {
        D.xdebug(6,`feed for ${url} existed already`);
        return exists;
      }
    }

    D.xdebug(6,`create new feed ${url}`);
    let feed = {
      url: url,
      title: "",
      rowid: 0,
      lastcheck: 0,
      lastupd: 0,
      updateInterval: this.updateInterval_min,
      icon: 0,
    };
    let id = await this.db.updFeed(feed);
    feed.rowid = id;
    await this.updAllIcons();
    return feed;
  }

  async delFeed(url: string) {
    let feed = await this.db.getFeed(url);
    if (feed) await this.db.delFeed(feed.rowid);
  }

  async updFeed(id: number | string, force = false) {
    let feed = await this.db.getFeed(id);
    if (!feed) {
      if (typeof id == "number") throw `rowid ${id} not found`;
      feed = await this.addFeed(id, false);
    }

    let now = Date.now();
    if (!force) {
      let nextUpdIn = feed.lastcheck + feed.updateInterval - now;
      if (nextUpdIn>0) {
        D.xdebug(6,`skip update feed ${feed.url}: ${feed.title} [${feed.rowid}] - next update in ${nextUpdIn}`);
        return;
      }
      D.xdebug(6,`need update feed ${feed.url}: ${feed.title} [${feed.rowid}] - last=${feed.lastcheck} ivl=${feed.updateInterval} -> ${nextUpdIn}`);
    } else {
      D.xdebug(6,`forced update feed ${feed.url}: ${feed.title} [${feed.rowid}]`);
    }

    let update = async (feed: T.Feed, lastupd = 0) => {
      let diff = now - feed.lastcheck;
      feed.lastcheck = now;
      if (lastupd) {
        feed.lastupd = lastupd;
        D.xdebug(6,`got new updates for ${feed.title} at ${feed.url}`);
        feed.updateInterval = diff / this.updateInterval_backoff;
      } else {
        D.xdebug(6,`no new updates for ${feed.title} at ${feed.url}`);
        feed.updateInterval = diff * this.updateInterval_backoff;
      }
      // D.xdebug(7,`diff=${diff} updi=${feed.updateInterval}`)

      if (feed.updateInterval < this.updateInterval_min) {
        feed.updateInterval = this.updateInterval_min;
      } else if (feed.updateInterval > this.updateInterval_max) {
        feed.updateInterval = this.updateInterval_max;
      }
      D.xdebug(7,`diff=${diff} updi=${feed.updateInterval}`)
      await this.db.updFeed(feed);
    };

    let rp = new Parser();
    let output: Parser.Output<{}>|undefined = undefined;
    try { 
      let res = await fetch(feed.url);
      if (!res.ok)
        throw(`status=${res.status} ${res.statusText}`);
      let text = await res.text();
      output = await rp.parseString(text); 
      if (!output) throw `no output from parser for ${text}`;
    } catch (e) {
      D.xdebug(4,`access to feed ${feed.url} ${feed.title} failed: ${e}`);
      await update(feed);
      return;
    }
 
    feed.title = output.title || "no title";

    let feedid = feed.rowid
    let newFeed = !feedid
    if (newFeed) {
      feed.lastcheck = now;
      feedid = await this.db.updFeed(feed);
      feed.rowid = feedid
      D.xdebug(6,`new feed ${feed.title} at ${feed.url} -> rowid=${feedid}`);
    } else {
      D.xdebug(6,`update feed ${feed.title} at ${feed.url}, rowid=${feedid}`);
    }

    let items = output.items;
    if (!items || items.length < 1) {
      D.xdebug(4,"no items in feed");
      feed.lastcheck = now;
      await this.db.updFeed(feed);
      return;
    }
    D.xdebug(5,`have ${items.length} items in feed`);
    let lastupd = 0;
    let again: number[] = [];
    for (let i = 0; i < items.length; i++) {
      let item = output.items![i];

      if (!item.link) {
        D.xdebug(5,"item has no link", item);
        continue;
      }
      let feeditem = await this.db.getItem(item.link);
      if (feeditem) {
        D.xdebug(5,`item exists already ${feeditem.url}: ${feeditem.title}`);
        again.push(feeditem.rowid);
        continue;
      }
      D.xdebug(4,`new item ${item.link}: ${item.title} ${item.isoDate}`);

      item.content = sanitizeHtml(item.content || "",{
        allowedTags: sanitizeHtml.defaults.allowedTags.concat([ 'img' ])
      });

      let date = item.isoDate ? new Date(item.isoDate).getTime() : now;
      if (date>lastupd) lastupd = date;
      await this.db.updItem({
        title: item.title || "",
        content: item.content,
        url: item.link || "",
        date: date,
        rowid: 0,
        feed: feedid,
      });
    }

    if (again.length) this.db.updItemsLastSeen(again);
    await update(feed, lastupd);
  }

  async getXFeeds() {
    return this.db.getXFeeds();
  }

  async getItemsFor(filter: T.ItemFilter) {
    return this.db.getItemsFor(filter)
  }

  markItemsRead(items : number[]) {
    this.db.markItemsRead(items);
  }

  markItemsUnread(items : number[]) {
    this.db.markItemsUnread(items);
  }

  async updAllIcons(domains: string[]|undefined = undefined, force = false) {
    let ids = await this.db.getAllFeedIds();
    let domain2ic = new Map<string, { new: boolean; failed: boolean; icon: number }>();
    for (let i = 0; i < ids.length; i++) {
      let feed = await this.db.getFeed(ids[i]);
      if (!feed) continue;
      let domain = new URL(feed.url).hostname;
      if (!force && domains && !domains.includes(domain)) continue; // skip this domain 
      let ic = domain2ic.get(domain) || {
        new: false,
        failed: false,
        icon: feed.icon
      };
      D.xdebug(7,`check icon for ${domain}: ${ic}`);
      if (ic.failed) {
        // failed to fetch icon for domain in this loop
        D.xdebug(7,`no retry for ${domain} (already failed once)`); 
        continue; 
      }

      if (!ic.icon) {
        D.xdebug(7,`no icon on feed ${feed.url} ${feed.rowid} - need to get icon for ${domain}`); 
        let icon = await this.db.getIcon(domain);
        if (icon) {
          ic.icon = icon.rowid;
          D.xdebug(7,`remember existing icon ${icon.rowid} for domain ${domain}`); 
        }
      }

      let del_ic : number|undefined;
      if (force && !ic.new || !ic.icon) {
        // fetch new icon
        D.xdebug(7,`need to retrieve new icon for ${domain}`); 
        let data = await this.fetchIcon(domain);
        if (!data) {
          D.xdebug(4,`failed to get icon for ${domain}`);
          ic.failed = true;
          domain2ic.set(domain,ic);
          continue;
        }

        ic.icon = await this.db.updIcon({
          rowid: 0,
          domain: domain,
          data: data
        });
        ic.new = true;
        D.xdebug(7,`remember new icon ${ic.icon} for domain ${domain}`); 
      }

      domain2ic.set(domain, ic);
      if (feed.icon != ic.icon) {
        await this.db.delIcon(feed.icon);
        feed.icon = ic.icon;
        await this.db.updFeed(feed);
      }
    }
  }

  async fetchIcon(domain: string) : Promise<ArrayBuffer | undefined> {
    try {
      let result = await fetch(`http://www.google.com/s2/favicons?domain=${domain}`);
      if (result.ok) return result.arrayBuffer();
    } catch {}
    // D.xdebug(4,`getting icon for ${domain} failed`);
    return;
  }

  async getIcon(id: number): Promise<ArrayBuffer> {
    let icon = await this.db.getIcon(id);
    if (!icon) throw("no image found");
    return icon.data;
  }
}
