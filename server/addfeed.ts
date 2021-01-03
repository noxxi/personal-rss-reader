import RSS from './rss';
import debug from './log'
let rss = new RSS('data.sqlite');

(async function() {
  for(let i = 2; i<process.argv.length; i++) {
    let url = process.argv[i];
    debug(`adding feed for ${url}`);
    await rss.addFeed(url);
  }
  debug("done");
  process.exit();
})()
 
