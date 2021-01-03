import RSS from './rss';
import * as D from './log'
let rss = new RSS('data.sqlite');

D.level(10);
(async function() {
  D.verbose(`updating all feeds`);
  await rss.updAllIcons(undefined,true);
  D.verbose("done");
  process.exit();
})()
 
