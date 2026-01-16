// Interface to REST API, with parallel number of calls restricted
//
// rest(command: string, args: any, options?: RestOptions) : Promise<any>
//   command: string, will be used for calling /api/command
//   args: if not given GET will be done, else will be send as json within POST
//   options: optional configuration for notifications
//
// if there is some <div id="xhrq-size"></div> it will be used to show the
// number of XHR running and outstanding

import * as notify from './notify';

export { rest };

// REST call options
export interface RestOptions {
  silent?: boolean; // Don't show notifications
  pendingMessage?: string; // Custom pending message
  successMessage?: string; // Custom success message
}

// Operation descriptors for automatic notifications
const operationMessages: { [cmd: string]: { pending: string; success: string } } = {
  'set-read': {
    pending: 'Marking as read...',
    success: 'Marked as read'
  },
  'set-unread': {
    pending: 'Marking as unread...',
    success: 'Marked as unread'
  },
  'update-feed': {
    pending: 'Saving feed...',
    success: 'Feed saved'
  },
  'delete-feed': {
    pending: 'Deleting feed...',
    success: 'Feed deleted'
  }
};


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
  async function runQ() {
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
    }, 10000);
    let args: { [k:string]: any } = { signal: abort.signal };
    if (e.data) {
      args['method'] = 'POST';
      args['headers'] = { 'Content-Type': 'application/json' };
      args['body'] = JSON.stringify(e.data);
    }
    try {
      let r = await fetch(url, args);
      console.log(`${url} returned: ${r.status}`);
      if (!r.ok) throw r.status;
      e.callback(undefined, r.json());
    } catch (err) {
      console.log(`fetch ${url} failed: ${err}`);
      e.callback(err, undefined);
    }
    updActive(-1);
    runQ();
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
async function rest(cmd: string, data: any = undefined, options: RestOptions = {}) : Promise<any> {
  const silent = options.silent || false;
  let notificationId: string | undefined;

  // Show pending notification if not silent
  if (!silent) {
    const messages = operationMessages[cmd];
    const pendingMessage = options.pendingMessage || (messages?.pending);

    if (pendingMessage) {
      notificationId = notify.pending(pendingMessage);
    }
  }

  // Helper function to execute the REST call
  const execute = (): Promise<any> => {
    return new Promise((resolve, reject) => {
      queue.fetch(cmd, data, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  };

  try {
    const result = await execute();

    // Update notification to success if not silent
    if (!silent && notificationId) {
      const messages = operationMessages[cmd];
      const successMessage = options.successMessage || (messages?.success) || 'Operation completed';
      notify.update(notificationId, {
        type: 'success',
        message: successMessage
      });
    }

    return result;
  } catch (err) {
    // Show error notification if not silent
    if (!silent) {
      const errorMessage = typeof err === 'string' ? `Error: ${err}` :
                          err instanceof Error ? `Error: ${err.message}` :
                          `Operation failed (${cmd})`;

      // If we have a pending notification, update it to error
      if (notificationId) {
        notify.update(notificationId, {
          type: 'error',
          message: errorMessage,
          onRetry: () => rest(cmd, data, options)
        });
      } else {
        // Otherwise create a new error notification
        notify.error(errorMessage, () => rest(cmd, data, options));
      }
    }

    throw err;
  }
}


