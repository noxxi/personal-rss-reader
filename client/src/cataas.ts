// use CatAsAService to provide cat picture when new items can be shown
export {
  init,  // initialization
  show,  // show/hide cat picture
  toggleDetails,  // toggle details visibility (location, date)
  toggleFullscreen,  // toggle fullscreen cat picture
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
    const geoLocation = response.headers.get('x-geo-location');
    const locationName = response.headers.get('x-location-name');
    const dateTaken = response.headers.get('x-date-taken');

    // Build details HTML (hidden by default)
    const detailItems: string[] = [];

    if (geoLocation) {
      const [lat, lon] = geoLocation.split(',').map(s => s.trim());
      const mapsUrl = `https://www.google.com/maps?q=${lat},${lon}`;
      const locationText = locationName ? `${locationName} (${lat}, ${lon})` : `${lat}, ${lon}`;
      detailItems.push(`
        <div class="detail-item geo-location">
          <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer">
            📍 ${locationText}
          </a>
        </div>
      `);
    }

    if (dateTaken) {
      detailItems.push(`
        <div class="detail-item date-taken">
          📅 ${dateTaken}
        </div>
      `);
    }

    // Only show toggle if there are details to show
    const hasDetails = detailItems.length > 0;

    // Build description of available details
    const availableDetails: string[] = [];
    if (geoLocation) availableDetails.push('location');
    if (dateTaken) availableDetails.push('date');
    const detailsDesc = availableDetails.length > 0 ? ` (${availableDetails.join(', ')})` : '';

    const toggleHtml = hasDetails ? `
      <div class="details-toggle" id="cataas-toggle">Show details${detailsDesc}</div>
      <div class="details-content" id="cataas-details" style="display: none;">
        ${detailItems.join('')}
      </div>
    ` : '';

    div.innerHTML = `
      <div class="title">Sorry, no items. But here is a cat.</div>
      <div class="img"><img id="cataas-img" referrerpolicy="no-referrer"></div>
      ${toggleHtml}
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

    // Setup toggle functionality
    if (hasDetails) {
      const toggleEl = document.getElementById("cataas-toggle");
      const detailsEl = document.getElementById("cataas-details");
      if (toggleEl && detailsEl) {
        toggleEl.addEventListener('click', () => {
          const isHidden = detailsEl.style.display === 'none';
          detailsEl.style.display = isHidden ? 'block' : 'none';
          toggleEl.textContent = isHidden ? `Hide details${detailsDesc}` : `Show details${detailsDesc}`;
        });
      }
    }
  } catch (err) {
    console.error("Failed to load image:", err);
  }
}

function toggleDetails() {
  const toggleEl = document.getElementById("cataas-toggle");
  if (toggleEl) {
    toggleEl.click();
  }
}

function toggleFullscreen() {
  const img = document.getElementById("cataas-img");
  if (!img) return;
  if (document.fullscreenElement) {
    document.exitFullscreen();
  } else {
    img.requestFullscreen();
  }
}
