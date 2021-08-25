// various utils
export { 
  eH,               // escape HTML, essentially entities.encodeHTML
  toDate,           // show as dd.mm.yyyy
  toTime,           // show as HH:MM
  toTimeOrDate,     // show as time if recent, else if date
  moveIntoView,     // scroll, so that given HTML element is best in view
};

import * as entities from "entities";

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

let eH = (s: string|undefined|null) => {
  if (!s || !s.length) return '';
  // console.log(`eH=${s.length}|${s}|`);
  return entities.encodeHTML(s);
};


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


