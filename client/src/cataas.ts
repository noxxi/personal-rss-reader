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
  let url = localStorage.getItem("cataas") || "https://cataas.com/cat?i=";
  if (enable) {
    cataasDiv.innerHTML = `
      <div class="title">Sorry, no items. But here is a cat.</div>
      <div class="img"><img src="${url}${Math.floor(Math.random()*100000)}" referrerpolicy="no-referrer"></div>
    `;
  } else {
    cataasDiv.innerHTML = '';
  }
}
