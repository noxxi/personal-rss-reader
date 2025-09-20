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
    let url = localStorage.getItem("cataas") || "https://cataas.com/cat?i=";
    loadImage(url + Math.floor(Math.random()*100000), cataasDiv);
  } else {
    cataasDiv.innerHTML = '';
  }
}

async function loadImage(url: string, div: HTMLDivElement) {
  try {
    const response = await fetch(url, { method: "GET" });
    const blob = await response.blob();
    const objectURL = URL.createObjectURL(blob);
    const filename = response.headers.get('x-filename');

    div.innerHTML = `
      <div class="title">Sorry, no items. But here is a cat.</div>
      <div class="img"><img id="cataas-img" referrerpolicy="no-referrer"></div>
    `;

    const imgEl = document.getElementById("cataas-img");
    if (!(imgEl instanceof HTMLImageElement)) {
      throw new Error("no cataas-img id in HTML");
    }
    imgEl.src = objectURL;
    imgEl.onload = () => URL.revokeObjectURL(objectURL);
    if (filename != null) {
      imgEl.title = filename;
    }
  } catch (err) {
    console.error("Failed to load image:", err);
  }
}
