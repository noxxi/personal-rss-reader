// main control 
export { 
  init,                // initilization, setup global menu
  setLocationHash,     // helper to update location.hash with new parameters
  spa,                 // spa handler, switch to new view or update current one
  activeMenu,          // currently active menu: 'feeds'|'items'
};

import * as feeds from "./feeds";
import * as items from "./items";
import * as keydown from "./keydown";

let activeMenu = '';
let menu2action: { [k:string] : (p: URLSearchParams) => void } = {
  feeds: (p) => { feeds.show(p) },
  items: (p) => { items.show(p) }
};

function init() {
  items.init();
  feeds.init();
  keydown.init();
  for (let m in menu2action) {
    (document.querySelector('#header #show-'+m) as HTMLElement).onclick = () => {
      spa({ menu: m});
    };
  }
}

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


