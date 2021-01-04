import sqlite3 from "sqlite3";
import * as D from "./log";
import * as T from './types';


export default class Db {
  private db: sqlite3.Database;

  constructor(file: string) {
    this.db = new sqlite3.Database("data.sqlite");
    this.db.on('trace', sql => { D.xdebug(9,`SQL: ${sql}`)})
    sqlite3.verbose();
    this.db.exec(`
      create table if not exists feeds (
        url Text unique,
        title Text,
        lastcheck integer,
        lastupd integer,
        update_interval integer,
        domain string
      )
    `);
    this.db.exec(`
      create table if not exists items (
        feed integer,
        title string,
        url string,
        content string,
        date integer,
        lastseen integer
      )
    `);
    this.db.exec(`
      create table if not exists icons (
        domain string,
        data blob
      )
    `);
    this.db.exec(`
      create table if not exists read (
        item integer,
        date integer
      )
    `)
  }

  // Feed

  updFeed(f: T.Feed): Promise<number> {
    return new Promise((resolve, reject) => {
      let st: sqlite3.Statement;
      let args = [f.url, f.title, f.lastcheck, f.lastupd, f.updateInterval, f.domain];
      if (!f.rowid) {
        D.xdebug(8,`insert new feed ${f.url}`);
        st = this.db.prepare(
	        "insert into feeds (url,title, lastcheck,lastupd,update_interval,domain) values (?,?,?,?,?,?)"
        );
        args = [f.url, f.title];
      } else {
        D.xdebug(8,`update feed ${f.url}`);
        args.push(f.rowid);
        st = this.db.prepare(
	        "update feeds set url=?, title=?, lastcheck=?, lastupd=?, update_interval=?, domain=? where rowid=?"
        );
      }
      st.run(args, function (err) {
        if (err) {
          reject(err);
        } else {
          resolve(f.rowid ? f.rowid : (f.rowid = this.lastID));
        }
      });
    });
  }

  delFeed(rowid: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run("delete from items where feed=?", rowid, (err) => {
        if (err) reject(err);
        else {
          this.db.run("delete from feeds where rowid=?", rowid, (err) => {
            if (err) reject(err)
            else resolve();
          })
        }
      })
    })
  }

  getAllFeedIds(): Promise<number[]> {
    return new Promise((resolve, reject) => {
      this.db.all("select rowid from feeds", function (err, rows) {
        if (err) {
          reject(err);
        } else if (!rows) {
          resolve([]);
        } else {
          resolve(rows.map((v) => v.rowid));
        }
      });
    });
  }

  getFeed(id: number | string): Promise<T.Feed | undefined> {
    return new Promise((resolve, reject) => {
      this.db.get(
        "select rowid,* from feeds where " +
          (typeof id == "number" ? "rowid=?" : "url=?"),
        [id],
        function (err, row) {
          if (err) {
            reject(err);
          } else if (!row) {
            D.xdebug(8,`no feed for ${id}`);
            resolve(undefined);
          } else {
            D.xdebug(8,`found feed for ${id}`);
            resolve({
              rowid: row.rowid,
              url: row.url,
              title: row.title,
              lastcheck: row.lastcheck,
              lastupd: row.lastupd,
              updateInterval: row.update_interval,
              domain: row.domain,
            });
          }
        }
      );
    });
  }

  getXFeeds(): Promise<T.XFeed[]> {
    return new Promise((resolve, reject) => {
      this.db.all(
        "select f.rowid,f.*,count(i.rowid) as total,count(i.rowid)-count(r.item) as unread from feeds f left join items i on f.rowid=i.feed left join read r on i.rowid=r.item group by f.rowid order by f.lastupd desc",
        undefined,
        function (err, rows) {
          if (err) {
            reject(err);
            return;
          }
          let res: T.XFeed[] = [];
          for(let i = 0; i<rows.length; i++) {
            let row = rows[i];
            res.push({
              rowid: row.rowid,
              url: row.url,
              title: row.title,
              lastcheck: row.lastcheck,
              lastupd: row.lastupd,
              updateInterval: row.update_interval,
              domain: row.domain,
              total: row.total,
              unread: row.unread,
            });
          }
          resolve(res);
        }
      );
    });
  }

  // FeedItem

  updItem(item: T.FeedItem): Promise<number> {
    return new Promise((resolve, reject) => {
      let st: sqlite3.Statement;
      let args: any[] = [
        item.feed,
        item.title,
        item.url,
        item.content,
        item.date,
      ];
      if (!item.rowid) {
        st = this.db.prepare("insert into items (feed,title,url,content,date) values (?,?,?,?,?)");
      } else {
        st = this.db.prepare("update items set feed=?, title=?, url=?, content=?, date=? where rowid=?");
        args.push(item.rowid);
      }
      st.run(args, function (err) {
        if (err) {
          reject(err);
        } else {
          resolve(item.rowid ? item.rowid : (item.rowid = this.lastID));
        }
      });
    });
  }

  getItem(id: number | string): Promise<T.XFeedItem | undefined> {
    return new Promise((resolve, reject) => {
      this.db.get(
	      "select i.rowid,i.*,f.domain,r.date as read from items i join feeds f on i.feed=f.rowid left join read r on r.item = i.rowid " +
        "where " + (typeof id == "number" ? "i.rowid=?" : "i.url=?"),
        [id],
        function (err, row) {
          if (err) {
            reject(err);
          } else if (!row) {
            // debug(`no item for ${id}`)
            resolve(undefined);
          } else {
            // debug(`found item for ${id}`)
            resolve({
              rowid: row.rowid,
              url: row.url,
              title: row.title,
              content: row.content,
              date: row.date,
              feed: row.feed,
              read: row.read,
              domain: row.domain,
            });
          }
        }
      );
    });
  }

  getItemsFor(filter: T.ItemFilter): Promise<T.XFeedItem[]> {
    let where: string[] = [];
    if (filter.mindate) {
      where.push(`i.date>=${filter.mindate}`);
    }
    if (filter.feed) {
      where.push(`i.feed=${filter.feed}`);
    }
    if (!filter.unread) {
      where.push(`r.date is null`)
    }
    // TODO unread
    let sql =
      "select i.rowid,i.*,f.domain,r.date as read from items i join feeds f on i.feed=f.rowid left join read r on r.item = i.rowid " +
      (where.length ? " where " + where.join(" and ") : "") +
      " order by i.date,i.rowid" +
      ((filter.limit || 0) > 0 ? ` limit ${filter.limit}` : "") +
      ((filter.offset || 0) > 0 ? ` offset ${filter.offset}` : "");

    return new Promise((resolve, reject) => {
      this.db.all(sql, function (err, rows) {
        if (err) {
          reject(err);
        } else if (!rows) {
          resolve([]);
        } else {
          resolve(
            rows.map((row) => {
              return {
                rowid: row.rowid,
                url: row.url,
                title: row.title,
                content: row.content,
                date: row.date,
                feed: row.feed,
                read: row.read,
                domain: row.domain,
              };
            })
          );
        }
      });
    });
  }

  markItemsRead(items: number[]) {
    let st = this.db.prepare('insert into read (item,date) values (?,?)');
    let now = Date.now();
    for(let i = 0; i<items.length; i++) {
      st.run(items[i],now);
    }
  }

  markItemsUnread(items: number[]) {
    if (!items.length) return;
    this.db.run(`delete from read where item in (${items.join(',')})`);
  }

  updItemsLastSeen(items: number[]) {
    if (!items.length) return;
    let now = Date.now();
    this.db.run(`update items set lastseen=${now} where rowid in (${items.join(',')})`);
  }

  // Icon

  updIcon(f: T.Icon): Promise<number> {
    return new Promise((resolve, reject) => {
      let st: sqlite3.Statement;
      let args: any[] = [ f.domain, Buffer.from(f.data) ];
      if (!f.rowid) {
        D.xdebug(8,`insert new icon`);
        st = this.db.prepare("insert into icons (domain,data) values (?,?)");
      } else {
        D.xdebug(8,`update icon ${f.rowid}`);
        args.push(f.rowid);
        st = this.db.prepare("update icons set domain=?, data=? where rowid=?");
      }
      st.run(args, function (err) {
        if (err) {
          reject(err);
        } else {
          resolve(f.rowid ? f.rowid : (f.rowid = this.lastID));
        }
      });
    });
  }

  delIcon(rowid: number): Promise<void> {
    return new Promise((resolve,reject) => {
      this.db.run("delete from icons where rowid=?", rowid, function(err) {
        if (err) reject(err);
        resolve();
      })
    })
  }

  async getIcon(id: number | string): Promise<T.Icon | undefined> {
    return new Promise((resolve, reject) => {
      this.db.get(
        "select rowid,* from icons where " +
          (typeof id == "number" ? "rowid=?" : "domain=?"),
        [id],
        function (err, row) {
          if (err) {
            reject(err);
          } else if (!row) {
            D.xdebug(8,`no icon for ${id}`);
            resolve(undefined);
          } else {
            D.xdebug(8,`found icon for ${id}`);
            resolve({
              rowid: row.rowid,
              domain: row.domain,
              data: row.data
            });
          }
        }
      );
    });
  }
}

