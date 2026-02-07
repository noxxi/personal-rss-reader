// key bindings
export { 
  init,               // initialization, i.e. set global document.keydown
  setLocalKeyDown,    // (temporary) local keydown handler which overrides global one 
};

import { openItem } from "./items";
import * as main from "./main";
import * as items from "./items";
import * as cataas from "./cataas";
import * as notify from "./notify";

type keyboardCB = (e: KeyboardEvent) => void;
let localKeyDown: keyboardCB | undefined;

function init() {
  window.onkeydown = handleKeyDown;

  // on mobile provide functionality via buttons instead of keyboard
  let b = document.getElementById("mark-read-all")! as HTMLButtonElement;
  b.onclick = (e) => { items.markReadAllVisible(); }
  b = document.getElementById("mark-read-until")! as HTMLButtonElement;
  b.onclick = (e) => {
    let oa = items.activeItem;
    items.activateByOffset(+1);
    items.markReadUntil(oa);
    items.activateByOffset(0);
  }
  b = document.getElementById("undo")! as HTMLButtonElement;
  b.onclick = (e) => { items.unmarkRead(); }
  b = document.getElementById("toggle-hidden")! as HTMLButtonElement;
  b.onclick = (e) => { items.toggleVisibilityUnread(); }

  // long press on mobile should mark item for preservation
  // so that it does not gets deleted on markRead*
  let it = document.getElementById("items") as HTMLDivElement;
  let startX = 0;
  let startY = 0;
  let isSwiping: boolean;
  it.ontouchstart = function(e) {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    isSwiping = false;
  }
  it.ontouchmove = function(e) {
    let deltaX = e.touches[0].clientX - startX;
    let deltaY = e.touches[0].clientY - startY;
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 30) { // 30px threshold
      if (!isSwiping) {
        isSwiping = true;
        items.togglePreserved(e.target as HTMLElement);
      }
    }
  }
  it.ontouchcancel = it.ontouchend =
    function(e) { isSwiping = false; }
}

function setLocalKeyDown(cb: keyboardCB|undefined) {
  localKeyDown = cb;
}

// handles keyboard control
function handleKeyDown(e: KeyboardEvent) {
  if (e.ctrlKey || e.altKey || e.metaKey) return;
  if ((e.target as HTMLElement).matches('input')) {
    // console.log("ignore keypress " + e.key);
    return; // filter input
  }

  // ESC key: dismiss notifications first, then local handlers
  if (e.key == 'Escape') {
    if (notify.hasVisibleNotifications()) {
      notify.dismissTop();
      e.preventDefault();
      return;
    }
  }

  if (localKeyDown) return localKeyDown(e);

  // console.log(main.activeMenu, e.key);
  // global keys
  let done = true;
  if (e.key == '?') {
    showHelp();
  } else if (e.key == 'r') {
    main.spa(); // just refresh
  } else if (e.key == "f") {
    main.spa({menu: main.activeMenu == 'items' ? 'feeds' : 'items'});
  } else {
    done = false;
  }

  // keys specific to items view
  if (!done && main.activeMenu == 'items') {
    done = true;
    if (e.key == "ArrowUp" || e.key == 'k') {
      items.activateByOffset(-1);
    } else if (e.key == "ArrowDown" || e.key == 'j') {
      items.activateByOffset(+1);
    } else if (e.key == " ") {
      items.toggleVisibilityContent(items.activeItem);
    } else if (e.key == 'm') {
      let oa = items.activeItem;
      items.activateByOffset(+1);
      items.markRead(oa);
      items.activateByOffset(0);
    } else if (e.key == 'a') {
      let oa = items.activeItem;
      items.activateByOffset(+1);
      items.markReadUntil(oa);
      items.activateByOffset(0);
    } else if (e.key == 'u') {
      items.unmarkRead();
    } else if (e.key == 'f') {
      main.spa({ menu: 'feeds'});
    } else if (e.key == 'Enter') {
      items.openItem(items.activeItem);
    } else if (e.key == 'n') {
      items.markReadAllVisible();
    } else if (e.key == 'h') {
      items.toggleVisibilityUnread();
    } else if (e.key == 'x') {
      cataas.toggleDetails();
    } else if (e.key == 'z') {
      cataas.toggleFullscreen();
    } else {
      done = false;
    }
  }
  if (done) e.preventDefault();
}
// help dialog
function showHelp() {
  let dialog = document.getElementById('showHelp')! as HTMLDialogElement;
  localKeyDown = () => { dialog.close() }
  dialog.onclick = () => { dialog.close() }
  dialog.onclose = () => {
    console.log('show Help down');
    localKeyDown = undefined;
  };
  console.log('show Help up');
  dialog.showModal();
}


