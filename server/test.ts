import RSS from './rss';
import debug from './log'
let rss = new RSS('data.sqlite');

(async function() {
  await rss.updFeed('https://www.heise.de/rss/heise-atom.xml');
  // await rss.updAllFeeds();
  await rss.updAllIcons(undefined,true);
  // let feeds = await rss.getItemsFor({ limit: 10, mindate: 1605102360000})
  // debug(feeds)
  debug("done");
  process.exit();
})()
 
