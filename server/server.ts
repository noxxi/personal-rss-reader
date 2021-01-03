import express from 'express'
import bodyParser from 'body-parser';
import RSS from './rss';
import * as T from './types'
import debug, * as D from './log'

let rss = new RSS('data.sqlite');
D.level(5);

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

app.get('/api/icon/:i', (req,res) => {
  if (req.params.i == 'null') {
    console.log("icon null");
    let data = generic_rss_icon();
    res.setHeader('Content-Type','image/png');
    res.setHeader("Cache-Control", "public, max-age=2592000");
    res.setHeader('Expires', new Date(Date.now() + 2592000000).toUTCString());
    res.send(data);
    return;
  }
  console.log(`get icon ${req.params.i}`);
  rss.getIcon(+req.params['i'])
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
  rss.updAllFeeds().then(() => {
    // D.xdebug(3,"update feeds done, update icons");
    rss.updAllIcons(undefined).then(() => {
      // D.xdebug(3,"update icons done")
      updateTimer = setTimeout(updateRSS, 5000);
    })
  })
}

function generic_rss_icon() {
  return Buffer.from(`
    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
    AElFTkSuQmCCNjYyMQ==
  `, 'base64');
}
