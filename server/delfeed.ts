import RSS from './rss';
import * as D from './log'
let rss = new RSS('data.sqlite');

D.level(10);
(async function() {
  for(let i = 2; i<process.argv.length; i++) {
    let url = process.argv[i];
    D.verbose(`deleting feed for ${url}`);
    await rss.delFeed(url);
    await rss.cleanupUnused();
  }
  D.verbose("done");
  process.exit();
})()
 
