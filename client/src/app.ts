import * as T from "./types.js";
import * as E from "entities";
import Tablesort = require("tablesort");
import dialogPolyfill from 'dialog-polyfill';


let eH = (s: string|undefined|null) => {
  if (!s) return '';
  return E.encodeHTML(s);
};

// maybe defined by browser extension
declare var openInBackground : (url: string) => void;

let itemsDiv: HTMLDivElement;
let feedsDiv: HTMLDivElement;
let cataasDiv: HTMLDivElement|undefined;

type keyboardCB = (e: KeyboardEvent) => void;
let localKeydown: keyboardCB | undefined;

let activeItem: HTMLElement|undefined = undefined;
let activeMenu = '';
let unread_visible = false;

let menu2action: { [k:string] : (p: URLSearchParams) => void } = {
  feeds: (p) => { showFeeds(p) },
  items: (p) => { showItems(p) }
};

// initialization
document.addEventListener('DOMContentLoaded', () => {
  console.log("init called");
  itemsDiv = document.getElementById("items")! as HTMLDivElement; 
  feedsDiv = document.getElementById("feeds")! as HTMLDivElement; 
  cataasDiv = document.getElementById("cataas") as HTMLDivElement|undefined;

  document.querySelectorAll('dialog').forEach(e => {
    dialogPolyfill.registerDialog(e);
  });

  itemsDiv.onclick = (e) => {
    let node = findItemNode(e.target);
    if (node) {
      activateItem(node);
      toggleVisibilityContent(node);
      e.preventDefault();
    }
  }
  window.onkeydown = handleKeyDown;
  
  for (let m in menu2action) {
    (document.querySelector('#header #show-'+m) as HTMLElement).onclick = () => {
      spa({ menu: m});
    };
  }
  spa()
});

function setLocationHash(w: { [k:string] : string } = {}) : URLSearchParams {
  let p = new URLSearchParams(location.hash.substr(1));
  Object.entries(w).forEach((e) => {
    p.set(e[0],e[1]);
  });
  if (!p.get('menu')) p.set('menu','items');
  if (p.get('menu') == 'feeds') {
    p.delete('unread');
    p.delete('feed');
  } else if (p.get('menu') == 'items') {
    p.delete('feed-filter');
  }
  location.hash = '#' + p.toString();
  return p;
}

function spa(w: { [k:string] : string } = {}) {
  let p = setLocationHash(w);
  let menu  = p.get('menu')!;
  activeMenu = '';
  document.querySelectorAll('#header [id^="show-"]').forEach(e => {
    console.log('menu',e.id,menu);
    if (e.id == 'show-'+menu) {
      e.classList.add('active');
      (document.querySelector('#main #' + menu) as HTMLElement).style.display = 'block';
      activeMenu = menu;
      menu2action[menu](p);
    } else {
      e.classList.remove('active');
      let xid = e.id.replace('show-','');
      (document.querySelector('#main #' + xid) as HTMLElement).style.display = 'none';
    }
  })
}

// ---------------------- MISC ----------------------------------------------

let locale = 'de-DE';
function toDate(t:number) {
  return (new Date(t)).toLocaleDateString(locale, { year: 'numeric', month: 'numeric', day: 'numeric' });
}
function toTime(t:number) {
  return (new Date(t)).toLocaleTimeString(locale, { hour: 'numeric', minute: 'numeric' });
}
function toTimeOrDate(t:number) {
  let v = !t ? '-' : Date.now() - t >= 86000*1000 ? toDate(t) : toTime(t);
  // console.log(`t=${t} diff=${Date.now() -t} -> ${v}`);
  return v;
} 

// ---------------------- ITEMS ---------------------------------------------

// get Items from server
async function showItems(p: URLSearchParams) {
  let filter: T.ItemFilter = {
    unread: +(p && p.get('unread') || '0'),
    feed: +(p && p.get('feed') || '0'),
  };
  let items = (await rest("get-items", filter)) as T.XFeedItem[];
  // console.log(items);

  let isread = (r:number) : string => {
    if (!r) return '';
    return ` data-read="${r}"`;
  };

  let nodes = '';
  let date = '';
  items.forEach((item,i) => {
    let d = toDate(item.date);
    if (d != date) {
      date = d;
      nodes += `<div class="date">${eH(date)}</div>`;
    }
    
    let domain = item.domain || new URL(item.url).host;
    nodes += `
      <div class="item" data-id="${eH(item.rowid.toString())}"${isread(item.read)}>
       <div>
        <img class="icon" src="/api/icon/${domain}">
        <span class="title"><a href="${item.url}">${eH(item.title)}</a></span>
       </div>
       <div class="content" data-ct="${eH(item.content)}"></div> 
      </div>`;
  });
  itemsDiv.innerHTML = nodes;
  activeItem = undefined;
  toggleVisibilityUnread(!!filter.unread);
  activateByOffset(0);
}

// activate a specific item, deactivates the previous one
function activateItem(e: HTMLElement) {
  if (activeItem) {
    // if (activeItem == e) return;
    toggleVisibilityContent(activeItem, -1);
    activeItem.id = '';
  }
  activeItem = e;
  activeItem.id = 'activeitem';
  moveIntoView(activeItem);
}

// activates item by offset relativ to currently active one
function activateByOffset(offset: number) {
  let items = itemsDiv.getElementsByClassName('item');
  let m: HTMLElement[] = [];
  for(let i=0; i<items.length; i++) {
    let ii = items[i] as HTMLElement;
    if (ii.dataset.read && !unread_visible) continue;
    m.push(ii);
  }
  if (!m.length) {
    // console.log("no active item");
    if (activeItem) {
      activeItem.id = '';
      activeItem = undefined;
    }
    noItems(true);
    return;
  }
  noItems(false);
  if (!activeItem || (activeItem.dataset.read && !unread_visible)) activeItem = m[0];
  for(let i=0; i<m.length; i++) {
    if (m[i] == activeItem) {
      let ni = i+offset;
      ni = ni<0 ? 0: ni >= m.length ? m.length-1 : ni;
      // console.log(`active item ${ni}`);
      activateItem(m[ni]);
      break;
    }
  }
}

// find main node (.item) starting from some inner element of item
function findItemNode(e : any) : HTMLElement|undefined {
  while (e instanceof HTMLElement) {
    if (e.classList.contains('item')) return e;
    e = e.parentNode;
  }
  return undefined;
}

// toggle visibilty of content in specific item
function toggleVisibilityContent(e: HTMLElement|undefined, visible: number = 0) {
  e = findItemNode(e);
  if (!(e)) return;

  if (e != activeItem && activeItem) {
    toggleVisibilityContent(activeItem,-1);
  }
  if (e = e.getElementsByClassName('content')[0] as HTMLElement) {
    if (!visible) visible = e.style.display == 'block' ? -1:1;
    if (visible>0) {
      e.style.display = 'block';
      e.innerHTML = e.dataset.ct!;
      moveIntoView(e);
    } else {
      e.style.display = 'none';
      e.innerHTML = '';
    }
  }
}

// toggle visibility of read items (marked with strikethrough)
function toggleVisibilityUnread(newv : undefined|boolean = undefined) {
  unread_visible = (newv == undefined) ? !itemsDiv.getAttribute('data-unread-visible') : newv;
  if (unread_visible) {
    itemsDiv.setAttribute('data-unread-visible',"1");
    document.getElementById('indicator-unread-visible')!.style.display = 'inline';
  } else {
    itemsDiv.removeAttribute('data-unread-visible');
    document.getElementById('indicator-unread-visible')!.style.display = 'none';
  }
  fixDateShownInItemList();
  activateByOffset(0);
}

// called when no items can be shown - show cat instead
function noItems(enable: boolean) {
  if (!cataasDiv) return;
  cataasDiv.style.display = 'block';
  if (enable) {
    cataasDiv.innerHTML = `
      <div class="title">Sorry, no items. But here is a cat.</div>
      <div class="img"><img src="https://cataas.com/cat?i=${Math.random()}" referrerpolicy="no-referrer"></div>
    `;
  } else {
    cataasDiv.innerHTML = '';
  }
}

// mark single item as read [m]
function markRead(node: HTMLElement|undefined) {
  let e = findItemNode(node);
  if (!e) return;
  if (e.dataset.read) return;
  e.dataset.read = Date.now().toString();
  fixDateShownInItemList();
  rest('set-read', {items: [+e.dataset.id!]});
}

// mark all items until this one as read [a]
function markReadUntil(node: HTMLElement|undefined) {
  let e = findItemNode(node);
  if (!e) return;
  let items = itemsDiv.getElementsByClassName('item');
  let m: HTMLElement[] = [];
  for(let i=0; i<items.length; i++) {
    let ii = items[i] as HTMLElement;
    if (ii.dataset.read) continue;
    m.push(ii);
    if (ii == e) {
      if (!m.length) break;
      let ac = Date.now().toString();
      let mi = [];
      for(let j = 0; j<m.length; j++) {
        m[j].dataset.read = ac;
        mi.push(+m[j].dataset.id!);
      }
      fixDateShownInItemList();
      rest('set-read',{ items: mi });
      break;
    } 
  }  
}

// mark all visible items read [n]
function markReadAllVisible(pad = 20) {
  let items = itemsDiv.getElementsByClassName('item');
  let m: HTMLElement[] = [];
  for(let i=0; i<items.length; i++) {
    let ii = items[i] as HTMLElement;
    if (ii.dataset.read) continue;
    let box = ii.getBoundingClientRect();
    if (box.bottom < pad || box.top > window.innerHeight-pad) continue;
    m.push(ii);
  }
  if (m.length) {      
    let mi = [];
    let ac = Date.now().toString();
    for(let j = 0; j<m.length; j++) {
      m[j].dataset.read = ac;
      mi.push(+m[j].dataset.id!);
    }
    fixDateShownInItemList();
    rest('set-read',{ items: mi });
    activateByOffset(0);
  }
}

// unmark last marked items as read [u]
function unmarkRead() {
  let max = 0;
  itemsDiv.querySelectorAll(`.item[data-read]`).forEach(e => {
    let v = +(e as HTMLElement).dataset.read!;
    if (v>max) max=v;
  });
  if (!max) return; // nothing to undo

  let ids : number[] = [];
  itemsDiv.querySelectorAll(`.item[data-read='${max}']`).forEach(e => {
    let ds = (e as HTMLElement).dataset;
    delete ds.read;
    ids.push(+ds.id!);
  });

  fixDateShownInItemList();
  rest('set-unread',{ items: ids });
  activateByOffset(0);
}

// fix dates shown in item list: should be shown only if followed by visible items
function fixDateShownInItemList() {
  let lastdate: HTMLElement|undefined;
  itemsDiv.querySelectorAll('.date,.item').forEach(xe => {
    let e = xe as HTMLElement;
    if (e.classList.contains('date')) {
      if (lastdate) lastdate.style.display = 'none';  // no (visible) item in between
      lastdate = e;
      lastdate.style.display = 'block';
    }
    if (e.classList.contains('item') && (unread_visible || !e.dataset.read)) 
      lastdate = undefined;
  });
  if (lastdate) lastdate.style.display = 'none';
}

// ---------------------- FEEDS ---------------------------------------------


// get Feeds from server
async function showFeeds(p: URLSearchParams) {
  let feeds = (await rest('get-feeds')) as T.XFeed[];
  if (cataasDiv) cataasDiv.style.display = 'none';
  // console.log(feeds);
  let nodes = `
    <table class="feeds">
     <thead><tr class="header">
      <th data-sort-method='none'>&nbsp;<!-- Icon --></th>
      <th>Title</th>
      <th data-sort-default>LastUpd</th>
      <th>LastChk</th>
      <th>NextChk</th>
      <th>Unread</th>
      <th>Total</th>
     </tr></thead>
     <tbody>
      <tr data-sort-method="none">
       <td>&nbsp;</td>
       <td><input size=50 id="filter" placeholder="Type to filter ..."></td>
       <td colspan=5>
        <button id="add-feed" style="display:none;">Add Feed</button>
        &nbsp;
       </td>
      </tr>
  `;
  feeds.forEach((feed,i) => {
    let unread = feed.unread.toString();
    if (unread != '0') unread = `<a href="#menu=items&feed=${feed.rowid}">${unread}</a>`;
    let total = feed.total.toString();
    if (total != '0') total = `<a href="#menu=items&unread=1&feed=${feed.rowid}">${total}</a>`;
    let domain = feed.domain || new URL(feed.url).host;
    nodes += `
      <tr class="feed" data-id="${eH(feed.rowid.toString())}">
       <td><img class="icon" src="/api/icon/${domain}"></td>
       <td>
        <div class="title">${eH(feed.title)}</div>
        <div class="url">${eH(feed.url)}</div>
       </td>
       <td class="lastupd" data-sort="${feed.lastupd}">${eH(toTimeOrDate(feed.lastupd))}</td>
       <td class="lastcheck" data-sort="${feed.lastcheck}">${eH(toTimeOrDate(feed.lastcheck))}</td>
       <td class="nextupd" data-sort="${feed.lastcheck+feed.updateInterval}">${eH(toTimeOrDate(feed.lastcheck + feed.updateInterval))}</td>
       <td class="unread">${unread}</td>
       <td class="total">${total}</td>
    `;
  });
  nodes += "</tbody></table>";
  feedsDiv.innerHTML = nodes;
  feedsDiv.querySelectorAll('a[href^="#"]').forEach(e => {
    (e as HTMLElement).onclick = (me) => {
      location.href = e.getAttribute('href')!;
      spa();
      me.preventDefault();
    }
  });

  // make table sortable
  new Tablesort(feedsDiv.querySelector('table.feeds'), {
    descending: true
  });

  // add some search
  let input = feedsDiv.querySelector('input#filter')! as HTMLInputElement;
  input.value = p.get('feed-filter') || '';

  let addFeedButton = feedsDiv.querySelector('button#add-feed')! as HTMLElement;
  addFeedButton.onclick = () => {
    let url = input.value;
    if (!confirm(`Add ${url} as new Feed?`)) return;
    rest('update-feed', { url: url, title: "NO TITLE YET" })
      .then(feed => {
        console.log(`added ${url} as new feed`, feed);
        spa();
      }).catch(why => {
        console.log(`failed to add ${url} as feed - ${why}`);
      })
  };

  let filter = () => {
    let v = input.value.toLowerCase();
    // console.log(`search for ${v}`);
    setLocationHash({ 'feed-filter': v });
    let addFeed = true;
    feedsDiv.querySelectorAll('tr.feed').forEach(e => {
      let text = (e.children[1] as HTMLElement).textContent?.toLowerCase() || '';
      let w = text.includes(v) ? '' : 'none';
      // console.log(`[${w}] ${text}`);
      (e as HTMLElement).style.display = w;
      if (!w) addFeed = false;
    });
    if (addFeed) {
      try {
        let u = new URL(v);
        if (u.protocol != 'http:' && u.protocol != 'https:') throw "wrong protocol";
        if (!u.hostname.match(/^\w+(\.\w+)+$/)) throw "not a hostname";
        if (u.pathname.length<2) throw "path too short";
      } catch {
        addFeed = false;
      }
    }
    addFeedButton.style.display = addFeed ? 'inline' : 'none';
  }
  let timer: any;
  input.onkeydown = input.onpaste = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(filter, 100);
  }
  if (input.value) filter();

  // edit on double-click over feed
  feedsDiv.ondblclick = (e) => {
    let tr = e.target instanceof HTMLElement &&  e.target.closest('tr.feed');
    if (!tr) return;
    // console.log(tr);
    editFeed(tr as HTMLElement);
  };
}

// ---------------------- KEY BINDINGS ---------------------------------------------

// handles keyboard control
function handleKeyDown(e: KeyboardEvent) {
  if (e.ctrlKey || e.altKey || e.metaKey) return;
  if ((e.target as HTMLElement).matches('input')) {
    // console.log("ignore keypress " + e.key);
    return; // filter input
  }
  if (localKeydown) return localKeydown(e);

  // console.log(activeMenu, e.key);
  // global keys
  let done = true;
  if (e.key == '?') {
    showHelp();
  } else if (e.key == 'r') {
    spa(); // just refresh
  } else if (e.key == "f") {
    spa({menu: activeMenu == 'items' ? 'feeds' : 'items'});
  } else {
    done = false;
  }

  // keys specific to items view
  if (!done && activeMenu == 'items') {
    done = true;
    if (e.key == "ArrowUp" || e.key == 'k') {
      activateByOffset(-1);
    } else if (e.key == "ArrowDown" || e.key == 'j') {
      activateByOffset(+1);
    } else if (e.key == " ") {
      toggleVisibilityContent(activeItem);
    } else if (e.key == 'm') {
      let oa = activeItem;
      activateByOffset(+1);
      markRead(oa);
      activateByOffset(0);
    } else if (e.key == 'a') {
      let oa = activeItem;
      activateByOffset(+1);
      markReadUntil(oa);
      activateByOffset(0);
    } else if (e.key == 'u') {
      unmarkRead();
    } else if (e.key == 'f') {
      spa({ menu: 'feeds'});
    } else if (e.key == 'Enter') {
      openItem(activeItem);
    } else if (e.key == 'n') {
      markReadAllVisible();
    } else if (e.key == 'h') {
      toggleVisibilityUnread();
    } else {
      done = false;
    }
  }
  if (done) e.preventDefault();
}

// opens active item in new tab [Enter]
function openItem(e: HTMLElement|undefined) {
  if (!e) return;
  let url = e.querySelector('.title a[href]')?.getAttribute('href');
  if (!url) return;
  if (e == activeItem) {
    let oa = activeItem;
    activateByOffset(+1);
    markRead(oa);
    activateByOffset(0);
  }
  if (typeof openInBackground == 'function') {
    console.log("use openInBackground from extension");
    openInBackground(url);
  } else {
    console.log("open in _blank - " + (typeof openInBackground));
    window.open(url,'_blank');
  }
}

// scroll view so that item is as fully visible as possible
function moveIntoView(e: HTMLElement, pad = 50) {
  let box = e.getBoundingClientRect();
  let scroll = 0;
  if ((scroll = box.top-pad) < 0) {
    // make top part of e visible at top of page
  } else if ((scroll = box.bottom-window.innerHeight+pad)>0) {
    // make bottom part of e visible at bottom of page
    if (scroll>box.top+pad) {
      // but make sure that the top part is visible too
      scroll = box.top+pad;
    }
  } else {
    return;
  }
  // console.log('scrollBy',scroll);
  window.scrollBy(0,scroll);
}



// ---------------------- XHR MGR ---------------------------------------------


// manager for XHR, limit the number of XHR in process
let queue = (function(maxq = 1){
  type qc = (err: any, res: any) => void;
  type qe = {
    cmd: string,
    data: any,
    callback: qc,
  };
  let waitq: qe[] = [];
  let active = 0;
  function qfetch(cmd: string, data: any, callback: qc) {
    waitq.push({ cmd, data, callback});
    runQ();
  }
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

// update with server
async function rest(cmd: string, data: any = undefined) : Promise<any> {
  return new Promise((resolve, reject) => {
    queue.fetch(cmd, data, (err,data) => {
      if (err) reject(err);
      else resolve(data);
    })
  })
}

// ---------------------- Edit feed  ---------------------------------------------

function editFeed(tr: HTMLElement) {
  rest('get-feed', { rowid: tr.dataset.id }).then(feed => {
    let dialog = document.querySelector('#editFeed')! as HTMLDialogElement;
    let form = dialog.getElementsByTagName('form')[0]!;
    let elem = form.elements;
    (elem.namedItem('title') as HTMLInputElement).value = feed.title;
    (elem.namedItem('url') as HTMLInputElement).value = feed.url;
    (elem.namedItem('domain') as HTMLInputElement).value = feed.domain || '';

    type finalcb = () => void;
    let save = (final: finalcb) => {
      let nf : T.Feed = { ...feed };
      nf.url = form.url.value;
      nf.domain = form.domain.value;
      let changed : string[] = [];
      if (nf.url != feed.url) changed.push('url');
      if (nf.domain != (feed.domain || '')) changed.push('domain');
      console.log({ save: save, changed: changed, ...nf });
      if (!changed || !save) return;
      localKeydown = (e) => { e.preventDefault() };
      rest('update-feed', nf).then(() => {
        console.log('saved');
        (tr.querySelector('.url')! as HTMLElement).textContent = nf.url;
        (tr.querySelector('.icon')! as HTMLImageElement).src =
          "/api/icon/" + (nf.domain || new URL(nf.url).host);
        final();
      }).catch((why) => {
        console.log('saving failed: ' + why);
        final();
      });
    };

    let cancel = (final: finalcb) => {
      console.log('edit aborted');
      final();
    };

    let deleteFeed = (final: finalcb) => {
      console.log('delete Feed');
      if (!confirm("Do you really want to delete Feed?")) {
        final();
        return;
      }
      rest('delete-feed', { rowid: feed.rowid }).then(() => {
        console.log('feed deleted');
        tr.parentElement?.removeChild(tr);
        final();
      }).catch(why => {
        console.log('feed not deleted: ' + why);
      });
    }

    let editDone = (e: Event, action: (final: finalcb) => void) => {
      e.preventDefault();
      action(() => {
        localKeydown = undefined;
      });
    };

    dialog.onclose = (e) => {
      editDone(e,
        dialog.returnValue == 'save' ? save :
        dialog.returnValue == 'delete' ? deleteFeed :
        cancel
      );
    };

    console.log('Edit Feed up');
    dialog.showModal();
    localKeydown = (e: KeyboardEvent) => {
      if (e.key == 'Escape') return editDone(e, cancel);
      e.preventDefault();
    }
  });
}


// ---------------------- Help window ---------------------------------------------

function showHelp() {
  let dialog = document.getElementById('showHelp')! as HTMLDialogElement;
  localKeydown = () => { dialog.close() }
  dialog.onclick = () => { dialog.close() }
  dialog.onclose = () => {
    console.log('show Help down');
    localKeydown = undefined;
  };
  console.log('show Help up');
  dialog.showModal();
}