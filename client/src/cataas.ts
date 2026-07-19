// use CatAsAService to provide cat picture when new items can be shown
export {
  init,             // initialization
  show,             // show/hide cat picture
  toggleDetails,    // toggle details visibility (location, date)
  toggleFullscreen, // toggle fullscreen cat picture
  nextImage,        // go forward in history (or load new image)
  prevImage,        // go back in history (does nothing if at start)
  navigateOffset,   // load next (+1) or previous (-1) image relative to current seed
  isActive,         // whether cataas mode is currently active
}

const MAX_HISTORY = 50;
let imageHistory: string[] = [];
let historyIndex = -1;  // index of currently displayed image in imageHistory
let active = false;
let currentSeed: number | null = null;
let currentOffset: number = 0;

let cataasDiv: HTMLDivElement|undefined;

function init() {
  cataasDiv = document.getElementById("cataas") as HTMLDivElement|undefined;
}

function isActive(): boolean {
  return active;
}

function show(enable: boolean) {
  if (!cataasDiv) return;
  cataasDiv.style.display = 'block';
  if (enable) {
    if (!active) {
      active = true;
      nextImage();
    }
    // already active: keep showing the current image unchanged
  } else {
    active = false;
    cataasDiv.innerHTML = '';
    // history is intentionally preserved so it survives when items reappear
  }
}

function updateSeedOffsetFromUrl(url: string) {
  try {
    const iParam = new URL(url).searchParams.get('i');
    if (!iParam) { currentSeed = null; currentOffset = 0; return; }
    const m = iParam.match(/^(\d+)([+-]\d+)?$/);
    if (!m) { currentSeed = null; currentOffset = 0; return; }
    currentSeed = parseInt(m[1]);
    currentOffset = m[2] ? parseInt(m[2]) : 0;
  } catch {
    currentSeed = null; currentOffset = 0;
  }
}

function nextImage() {
  if (!cataasDiv) return;
  if (historyIndex < imageHistory.length - 1) {
    // go forward in existing history
    historyIndex++;
    const url = imageHistory[historyIndex];
    updateSeedOffsetFromUrl(url);
    loadImage(url, cataasDiv);
  } else {
    // at end of history — fetch a new image
    const base = localStorage.getItem("cataas") || "https://cataas.com/cat?i=";
    currentSeed = Math.floor(Math.random() * 100000);
    currentOffset = 0;
    const url = base + currentSeed;
    if (imageHistory.length >= MAX_HISTORY) {
      imageHistory.shift();
      // historyIndex stays the same numerically but now points one earlier;
      // since we're trimming from the front, adjust:
      historyIndex = Math.max(0, historyIndex - 1);
    }
    imageHistory.push(url);
    historyIndex = imageHistory.length - 1;
    loadImage(url, cataasDiv);
  }
}

function prevImage() {
  if (!cataasDiv) return;
  if (historyIndex <= 0) return;  // already at oldest entry, do nothing
  historyIndex--;
  const url = imageHistory[historyIndex];
  updateSeedOffsetFromUrl(url);
  loadImage(url, cataasDiv);
}

function navigateOffset(delta: number) {
  if (!cataasDiv || !active || currentSeed === null) return;
  currentOffset += delta;
  const base = localStorage.getItem("cataas") || "https://cataas.com/cat?i=";
  const offsetStr = currentOffset > 0 ? `%2B${currentOffset}` : currentOffset < 0 ? `${currentOffset}` : '';
  const url = base + currentSeed + offsetStr;
  if (imageHistory.length >= MAX_HISTORY) {
    imageHistory.shift();
    historyIndex = Math.max(0, historyIndex - 1);
  }
  imageHistory.push(url);
  historyIndex = imageHistory.length - 1;
  loadImage(url, cataasDiv);
}

async function loadImage(url: string, div: HTMLDivElement) {
  // If the img element already exists (navigating within cataas mode), update
  // its src in-place so the fullscreen element is never destroyed.
  let imgEl = document.getElementById("cataas-img") as HTMLImageElement | null;
  if (!imgEl) {
    // First time entering cataas mode — build the full HTML structure.
    div.innerHTML = `
      <div class="title">Sorry, no items. But here is a cat.</div>
      <div class="img"><img id="cataas-img" referrerpolicy="no-referrer"></div>
      <div id="cataas-details-container"></div>
    `;
    imgEl = document.getElementById("cataas-img") as HTMLImageElement;
    if (!imgEl) { console.error("no cataas-img id in HTML"); return; }
  }

  // Update src (works whether the element is new or already in fullscreen).
  imgEl.src = url;
  imgEl.title = '';

  // Clear stale details while we fetch new ones.
  const container = document.getElementById("cataas-details-container");
  if (container) container.innerHTML = '';

  // --- Async phase: fetch metadata and populate details ---
  try {
    let filename: string|null = null;
    let geoLocation: string|null = null;
    let locationName: string|null = null;
    let dateTaken: string|null = null;
    try {
      const response = await fetch(url, { method: "HEAD" });
      filename = response.headers.get('x-filename');
      geoLocation = response.headers.get('x-geo-location');
      locationName = response.headers.get('x-location-name');
      dateTaken = response.headers.get('x-date-taken');
    } catch (_) {
      // ignore — image will still be displayed without details
    }

    if (filename != null) {
      imgEl.title = filename;
    }

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

    const hasDetails = detailItems.length > 0;

    const availableDetails: string[] = [];
    if (geoLocation) availableDetails.push('location');
    if (dateTaken) availableDetails.push('date');
    const detailsDesc = availableDetails.length > 0 ? ` (${availableDetails.join(', ')})` : '';

    const container = document.getElementById("cataas-details-container");
    if (container && hasDetails) {
      container.innerHTML = `
        <div class="details-toggle" id="cataas-toggle">Show details${detailsDesc}</div>
        <div class="details-content" id="cataas-details" style="display: none;">
          ${detailItems.join('')}
        </div>
      `;
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
