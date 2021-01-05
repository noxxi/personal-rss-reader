import express from 'express'
import bodyParser from 'body-parser';
import RSS from './rss';
import * as T from './types'
import debug, * as D from './log'

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

app.get('/api/get-feeds', (req, res) => {
  rss.getXFeeds()
    .then(feeds => {
      res.json(feeds)
    })
});

app.post('/api/get-feed', (req, res) => {
  let rowid = +req.body.rowid;
  rss.getFeed(rowid)
    .then(feed => {
      res.json(feed)
    })
});

app.post('/api/update-feed', (req, res) => {
  rss.updFeed(req.body)
    .then(rowid => {
      res.json({ rowid: rowid })
    })
});

app.post('/api/set-read', (req, res) => {
  let items = req.body.items as number[];
  rss.markItemsRead(items);
  res.json({ result:'ok'});
})

app.post('/api/set-unread', (req, res) => {
  let items = req.body.items as number[];
  rss.markItemsUnread(items);
  res.json({ result:'ok'});
})

app.get('/api/icon/:domain', (req,res) => {
  console.log(`get icon for ${req.params.domain}`);
  rss.getIcon(req.params.domain)
    .then(data => {
      res.setHeader('Content-Type','image/png');
      res.setHeader("Cache-Control", "public, max-age=2592000");
      res.setHeader('Expires', new Date(Date.now() + 2592000000).toUTCString());
      res.send(data);
    })
    .catch(err =>  {
      res.sendStatus(404);
    });
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

