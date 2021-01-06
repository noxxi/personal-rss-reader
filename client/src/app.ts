import dialogPolyfill from 'dialog-polyfill';
import * as main from "./main";

// initialization
document.addEventListener('DOMContentLoaded', () => {
  console.log("init called");
  document.querySelectorAll('dialog').forEach(e => {
    dialogPolyfill.registerDialog(e);
  });

  main.init();
  main.spa();
});

