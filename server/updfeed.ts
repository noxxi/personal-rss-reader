import RSS from './rss';
import * as D from './log'
let rss = new RSS('data.sqlite');

D.level(10);
let force = true;
(async function() {
  if (process.argv.length>2) {
    for(let i = 2; i<process.argv.length; i++) {
      let url = process.argv[i];
      D.verbose(`updating feed for ${url}`);
      await rss.updFeed(url,force);
    }
  } else {
    D.verbose(`updating all feeds`);
    await rss.updAllFeeds(force);
  }
  D.verbose("done");
  process.exit();
})()
 
