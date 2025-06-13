import RSS from './rss';
import * as D from './log'
let rss = new RSS('data.sqlite');

D.level(10);
(async function() {
  await rss.delOldItems(31); // 1 month
  await rss.cleanupUnused();
  D.verbose("done");
  process.exit();
})()
 
