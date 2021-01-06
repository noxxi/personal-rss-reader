import express from 'express'
import bodyParser, { json } from 'body-parser';
import RSS from './rss';
import * as T from './types';
import * as R from 'runtypes';
import debug, * as D from './log';

let rss = new RSS('data.sqlite');
let devel_debug = 0;
D.level(devel_debug ? 10:5);

const app = express()
const port = 3000

app.use(express.static('../client'))
app.use(bodyParser.json());

let get_items = (req: express.Request, res: express.Response) => {
  let p : { [k:string] : string } = {};
  Object.keys(req.query).forEach((k) => { p[k] = req.query[k]!.toString(); });
  Object.keys(req.body).forEach((k) => { p[k] = req.body[k]!.toString(); });
  let filter: T.ItemFilter = {
    unread: +(p['unread'] || '0'),
    feed: +(p['feed'] || '0'),
  };
  // debug(filter);
  rss.getItemsFor(filter)
    .then(feeds => {
      res.json(feeds)
    })
};
app.get('/api/get-items', get_items);
app.post('/api/get-items', get_items);

app.get('/api/get-feeds', async (req, res) => {
  try {
    let feeds = await rss.getXFeeds();
    res.json(feeds);
  } catch(why) {
    res.sendStatus(404);
    res.json({ error: why });
  }
});

app.post('/api/get-feed', async (req, res) => {
  try {
    let rowid = +req.body.rowid;
    if (!rowid) throw "no rowid given";
    let feed = await rss.getFeed(rowid);
    res.json(feed);
  } catch(why) {
    res.sendStatus(404);
    res.json({error: why});
  }
});

app.post('/api/update-feed', async (req, res) => {
  try {
    let ufeed = R.Record({
      rowid: R.Number,
      url: R.String,
      domain: R.String,
      title: R.String
    }).check(req.body);
    let feed : T.Feed;
    if (ufeed.rowid) {
      let rfeed = await rss.getFeed(ufeed.rowid);
      if (!rfeed) throw `no feed with rowid=${ufeed.rowid}`;
      feed = { ...rfeed, ...ufeed };
    } else {
      feed = { ...ufeed, lastcheck: 0, lastupd: 0, updateInterval: 0 };
    }
    let rowid = rss.updFeed(feed);
    res.json({rowid});
  } catch(why) {
    res.sendStatus(404);
    res.json({error: why});
  }
});

app.post('/api/delete-feed', async (req, res) => {
  try {
    let rowid = +req.body.rowid;
    if (!rowid) throw "no rowid given";
    rss.delFeed(rowid);
    res.json({ result: 'ok'})
  } catch(why) {
    res.sendStatus(404);
    res.json({error: why});
  }
});

app.post('/api/set-read', (req, res) => {
  try {
    let items = R.Array(R.Number).check(req.body.items);
    rss.markItemsRead(items);
    res.json({ result:'ok'});
  } catch(why) {
    res.sendStatus(404);
    res.json({error: why});
  }
})

app.post('/api/set-unread', (req, res) => {
  try {
    let items = R.Array(R.Number).check(req.body.items);
    rss.markItemsUnread(items);
    res.json({ result:'ok'});
  } catch(why) {
    res.sendStatus(404);
    res.json({error: why});
  }
})

app.get('/api/icon/:domain', async (req,res) => {
  try {
    let domain = req.params.domain;
    if (!domain) throw "no domain given";
    console.log(`get icon for ${domain}`);
    let data = await rss.getIcon(domain);
    res.setHeader('Content-Type','image/png');
    res.setHeader("Cache-Control", "public, max-age=2592000");
    res.setHeader('Expires', new Date(Date.now() + 2592000000).toUTCString());
    res.send(data);
  } catch(why) {
    res.sendStatus(404);
    res.json({error: why});
  }
});

let updateTimer = setTimeout(updateRSS, 1*1000);

app.listen(port, () => {
  D.verbose(`listening at http://localhost:${port}`)
})

function updateRSS() {
  // D.xdebug(5,"update All Feeds");
  if (devel_debug) return;
  rss.loadAllFeeds().then(() => {
    // D.xdebug(3,"update feeds done");
    updateTimer = setTimeout(updateRSS, 5000);
  })
}

