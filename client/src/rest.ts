// Interface to REST API, with parallel number of calls restricted
//
// rest(command: string, args: any) : Promise<any>
//   command: string, will be used for calling /api/command
//   args: if not given GET will be done, else will be send as json within POST 
//
// if there is some <div id="xhrq-size"></div> it will be used to show the
// number of XHR running and outstanding

export { rest };


// number of calls in parallel
let maxq = 1; 

// queue of XHR, only maxq will be run at the same time
//  - queue.qfetch(cmd,data,callback): put new cmd into queue and run
let queue = (function(){
  // callback when REST call is done
  type qc = (err: any, res: any) => void;

  // queue entry, i.e. command, arguments and callback
  type qe = {
    cmd: string,
    data: any,
    callback: qc,
  };

  // the queue itself
  let waitq: qe[] = [];

  // how many calls are currently active
  // should be <= maxq
  let active = 0;

  // put new 'fetch' into queue and run next queue entries
  function qfetch(cmd: string, data: any, callback: qc) {
    waitq.push({ cmd, data, callback});
    runQ();
  }

  // run next queue entries, up to maxq in parallel
  function runQ() {
    if (active >= maxq) return; // wait for fetch to finish first
    let e = waitq.shift();
    if (!e) return; // nothing to do
    let url = "/api/" +  e.cmd;
    console.log('send new request', url,e.data);
    updActive(1);

    let abort = new AbortController();
    let timer = setTimeout(() => {
      clearTimeout(timer);
      abort.abort();
    }, 2000);
    let args: { [k:string]: any } = { signal: abort.signal };
    if (e.data) {
      args['method'] = 'POST';
      args['headers'] = { 'Content-Type': 'application/json' };
      args['body'] = JSON.stringify(e.data);
    }
    let cb = e.callback;
    fetch(url, args)
      .then(r => {
        console.log(`${url} returned: ${r.status}`)
        if (!r.ok) cb(r.status, undefined)
        else cb(undefined, r.json());
        updActive(-1);
        runQ();
      })
      .catch(err => {
        cb(err, undefined);
        updActive(-1);
        runQ();
      });
  }

  // just update information about currently running events
  let activeDiv = document.getElementById('xhrq-size');
  function updActive(plus = 0) {
    active += plus;
    let total = waitq.length + active;
    if (activeDiv) {
      if (total) {
        activeDiv.textContent = '';
      } else {
        activeDiv.textContent = total.toString() + ' outstanding XHR';
      }
    }
    console.log(`${total} outstanding XHR`);
  }

  updActive(0);
  return { fetch: qfetch }
})();

// put a new REST call into the queue and run queue
async function rest(cmd: string, data: any = undefined) : Promise<any> {
  return new Promise((resolve, reject) => {
    queue.fetch(cmd, data, (err,data) => {
      if (err) reject(err);
      else resolve(data);
    })
  })
}


