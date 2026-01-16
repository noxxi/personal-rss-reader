// Items view
export { 
  init,                       // initialization
  show,                       // show view, includes paramater from location.hash
  openItem,                   // open item in new tab
  activateByOffset,           // activate item relativ to current one
  markRead,                   // mark item read
  markReadUntil,              // mark all read until given item
  markReadAllVisible,         // mark all visible items read
  unmarkRead,                 // undo last "mark read" operation (multiple undo possible)
  toggleVisibilityContent,    // show/hide content of item
  toggleVisibilityUnread,     // show/hide unread items
  togglePreserved,            // mark/unmark item as preserved
  activeItem                  // current active item (for keyboard control)
};

import { rest } from "./rest";
import { toDate, eH, moveIntoView } from "./util";
import * as keydown from "./keydown";
import * as cataas from "./cataas";
import * as T from "./types";


// maybe defined by browser extension
declare var openInBackground : (url: string) => void;

let itemsDiv: HTMLDivElement;
let activeItem: HTMLElement|undefined = undefined;
let unread_visible = false;

function init() {
  itemsDiv = document.getElementById("items")! as HTMLDivElement;
  itemsDiv.onclick = (e) => {
    let node = findItemNode(e.target);
    if (node) {
      activateItem(node);
      toggleVisibilityContent(node);
      e.preventDefault();
    }
  }
  cataas.init();
}

// get Items from server
async function show(p: URLSearchParams) {
  let filter: T.ItemFilter = {
    unread: +(p && p.get('unread') || '0'),
    feed: +(p && p.get('feed') || '0'),
  };
  let items = (await rest("get-items", filter, { silent: true })) as T.XFeedItem[];
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
    
    let domain = item.domain;
    if (!domain) {
      try {
        domain = new URL(item.url).host;
      } catch {
        return;
      }
    }
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
  if (activeItem && activeItem != e) {
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
  cataas.show(enable);
}

// mark single item as read [m]
function markRead(node: HTMLElement|undefined) {
  let e = findItemNode(node);
  if (!e) return;
  if (e.dataset.read) return;
  if (e.classList.contains('preserved')) return;
  e.dataset.read = Date.now().toString();
  fixDateShownInItemList();
  rest('set-read', {items: [+e.dataset.id!]}, { silent: true });
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
    if (ii.classList.contains('preserved')) continue;
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

// toggle preserved flag of specific item
function togglePreserved(e: HTMLElement|undefined) {
  e = findItemNode(e);
  if (!(e)) return;
  e.classList.toggle("preserved");
}

// mark all visible items read [n]
function markReadAllVisible(pad = 20) {
  let items = itemsDiv.getElementsByClassName('item');
  let m: HTMLElement[] = [];
  for(let i=0; i<items.length; i++) {
    let ii = items[i] as HTMLElement;
    if (ii.dataset.read) continue;
    if (ii.classList.contains('preserved')) continue;
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


