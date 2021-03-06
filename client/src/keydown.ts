// key bindings
export { 
  init,               // initialization, i.e. set global document.keydown
  setLocalKeyDown,    // (temporary) local keydown handler which overrides global one 
};

import { openItem } from "./items";
import * as main from "./main";
import * as items from "./items";

type keyboardCB = (e: KeyboardEvent) => void;
let localKeyDown: keyboardCB | undefined;

function init() {
  window.onkeydown = handleKeyDown;
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


