// use CatAsAService to provide cat picture when new items can be shown
export { 
  init,  // initialization
  show,  // show/hide cat picture
}

let cataasDiv: HTMLDivElement|undefined;
function init() {
  cataasDiv = document.getElementById("cataas") as HTMLDivElement|undefined;
}

function show(enable: boolean) {
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

