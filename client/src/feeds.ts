// Feeds view
export { 
  init,  // initialization
  show,  // show feeds view, includes filter from location.hash
};

import Tablesort = require("tablesort");
import { rest } from "./rest";
import { toTimeOrDate, eH } from "./util";
import * as keydown from "./keydown";
import * as cataas from "./cataas";
import * as main from "./main";
import * as T from "./types";

let feedsDiv: HTMLDivElement;
function init() {
  feedsDiv = document.getElementById("feeds")! as HTMLDivElement;
}

async function show(p: URLSearchParams) {
  let feeds = (await rest('get-feeds')) as T.XFeed[];
  cataas.show(false);
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
      main.spa();
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
    rest('update-feed', { url: url, title: "NO TITLE YET", rowid: 0, domain: '' })
      .then(feed => {
        console.log(`added ${url} as new feed`, feed);
        main.spa();
      }).catch(why => {
        console.log(`failed to add ${url} as feed - ${why}`);
      })
  };

  let filter = () => {
    let v = input.value.toLowerCase();
    // console.log(`search for ${v}`);
    main.setLocationHash({ 'feed-filter': v });
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
        if (!u.hostname.match(/^[\w\-]+(\.[\w-]+)+$/)) throw "not a hostname";
        if (u.pathname.length + u.search.length <2) throw "path too short";
      } catch {
        addFeed = false;
      }
    }
    addFeedButton.style.display = addFeed ? 'inline' : 'none';
  }
  let timer: any;
  let deferFilter = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(filter, 100);
  };
  input.onpaste = deferFilter;
  input.onkeydown = (e) => {
    if (e.key == 'Escape') input.value = '';
    deferFilter();
  };
  if (input.value) filter();

  // edit on double-click over feed
  feedsDiv.ondblclick = (e) => {
    let tr = e.target instanceof HTMLElement &&  e.target.closest('tr.feed');
    if (!tr) return;
    // console.log(tr);
    editFeed(tr as HTMLElement);
  };
}


// edit feed
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
      keydown.setLocalKeyDown((e) => { e.preventDefault() });
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
        keydown.setLocalKeyDown(undefined);
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
    keydown.setLocalKeyDown((e: KeyboardEvent) => {
      if (e.key == 'Escape') return editDone(e, cancel);
      e.preventDefault();
    });
  });
}

