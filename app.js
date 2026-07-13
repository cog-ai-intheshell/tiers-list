const tierDefinitions = [
  { id: "original", label: "OG concept", color: "#a98bff" },
  { id: "tempting", label: "Worth a try", color: "#73a1f6" },
  { id: "niche", label: "Too niche", color: "#ffb36f" },
  { id: "risky", label: "Could look goofy", color: "#ff7477" },
  { id: "dead", label: "It’s dead", color: "#666666" },
];

const state = {
  items: [],
  selectedId: null,
  draggedId: null,
  format: "square",
};

const tierBoard = document.querySelector("#tierBoard");
const libraryGrid = document.querySelector("#libraryGrid");
const libraryDropzone = document.querySelector("#libraryDropzone");
const imageCount = document.querySelector("#imageCount");
const boardStatus = document.querySelector("#boardStatus");
const selectionHelp = document.querySelector("#selectionHelp");
const fileInput = document.querySelector("#fileInput");
const formatSelect = document.querySelector("#formatSelect");
const toast = document.querySelector("#toast");
const pageTitle = document.querySelector("#pageTitle");
const titleDialog = document.querySelector("#titleDialog");
const titleInput = document.querySelector("#titleInput");
const downloadButton = document.querySelector("#downloadButton");

let toastTimer;
let pointerSession = null;
let pointerFrame = 0;
let suppressNextCardClick = false;

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("show");
  toastTimer = window.setTimeout(() => toast.classList.remove("show"), 2200);
}

function updateFormat(format) {
  state.format = format;
  const ratio = {
    square: "1 / 1",
    portrait: "4 / 5",
    landscape: "16 / 9",
  }[format];
  document.documentElement.style.setProperty("--tile-ratio", ratio);
  window.requestAnimationFrame(updateTierLayouts);
  showToast(`${format === "square" ? "Square" : format === "portrait" ? "Portrait" : "Landscape"} format applied`);
}

function buildTierRows() {
  tierBoard.innerHTML = "";

  tierDefinitions.forEach((tier) => {
    const row = document.createElement("div");
    row.className = "tier-row";

    const label = document.createElement("label");
    label.className = "tier-label";
    label.style.backgroundColor = tier.color;

    const input = document.createElement("input");
    input.value = tier.label;
    input.maxLength = 28;
    input.setAttribute("aria-label", `Tier name: ${tier.label}`);
    input.addEventListener("input", () => {
      tier.label = input.value;
    });

    const dropzone = document.createElement("div");
    dropzone.className = "tier-dropzone";
    dropzone.dataset.zone = tier.id;
    dropzone.setAttribute("aria-label", `${tier.label} tier`);

    addDropEvents(dropzone, tier.id);
    dropzone.addEventListener("click", (event) => {
      if (event.target.closest(".image-card")) return;
      if (state.selectedId) moveItem(state.selectedId, tier.id);
    });

    label.append(input);
    row.append(label, dropzone);
    tierBoard.append(row);
  });
}

function createCard(item) {
  const card = document.createElement("article");
  card.className = "image-card";
  card.draggable = false;
  card.dataset.itemId = item.id;
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `${item.name}. Click to select, or drag.`);
  if (state.selectedId === item.id) card.classList.add("is-selected");

  const image = document.createElement("img");
  image.src = item.src;
  image.alt = item.name;
  image.draggable = false;

  const remove = document.createElement("button");
  remove.className = "remove-image";
  remove.type = "button";
  const isInLibrary = item.zone === "library";
  remove.classList.toggle("is-return", !isInLibrary);
  remove.setAttribute(
    "aria-label",
    isInLibrary ? `Delete ${item.name}` : `Return ${item.name} to the library`,
  );
  remove.innerHTML = isInLibrary
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17" /></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7 4 12l5 5M4 12h10a6 6 0 0 1 6 6v1" /></svg>';
  remove.addEventListener("click", (event) => {
    event.stopPropagation();
    handleCardRemoval(item);
  });

  card.addEventListener("click", (event) => {
    event.stopPropagation();
    if (suppressNextCardClick) {
      suppressNextCardClick = false;
      return;
    }
    selectItem(item.id);
  });
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectItem(item.id);
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      handleCardRemoval(item);
    }
  });
  card.addEventListener("pointerdown", (event) => startPointerDrag(event, item, card));
  card.addEventListener("pointermove", updatePointerDrag);

  card.append(image, remove);
  return card;
}

function startPointerDrag(event, item, card) {
  if (event.button !== 0 || event.target.closest(".remove-image")) return;
  const rect = card.getBoundingClientRect();
  pointerSession = {
    id: item.id,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
    currentX: event.clientX,
    currentY: event.clientY,
    width: rect.width,
    height: rect.height,
    card,
    ghost: null,
    target: null,
    active: false,
    zone: null,
  };
  card.setPointerCapture?.(event.pointerId);
}

function updatePointerDrag(event) {
  if (!pointerSession || pointerSession.pointerId !== event.pointerId) return;
  const distance = Math.hypot(
    event.clientX - pointerSession.startX,
    event.clientY - pointerSession.startY,
  );

  if (!pointerSession.active && distance > 7) {
    pointerSession.active = true;
    pointerSession.card.classList.add("is-pointer-source");
    pointerSession.ghost = pointerSession.card.cloneNode(true);
    pointerSession.ghost.className = "image-card drag-ghost";
    pointerSession.ghost.removeAttribute("tabindex");
    pointerSession.ghost.removeAttribute("role");
    pointerSession.ghost.querySelector(".remove-image")?.remove();
    pointerSession.ghost.style.width = `${pointerSession.width}px`;
    pointerSession.ghost.style.height = `${pointerSession.height}px`;
    document.body.append(pointerSession.ghost);
  }

  if (!pointerSession.active) return;
  event.preventDefault();
  pointerSession.currentX = event.clientX;
  pointerSession.currentY = event.clientY;
  if (!pointerFrame) pointerFrame = window.requestAnimationFrame(paintPointerDrag);
}

function paintPointerDrag() {
  pointerFrame = 0;
  if (!pointerSession?.active) return;
  const { currentX, currentY, offsetX, offsetY, ghost } = pointerSession;
  ghost.style.transform = `translate3d(${currentX - offsetX}px, ${currentY - offsetY}px, 0) rotate(2deg) scale(1.04)`;

  const hit = document.elementFromPoint(currentX, currentY);
  const target = hit?.closest(".tier-dropzone, #libraryDropzone");
  if (target !== pointerSession.target) {
    pointerSession.target?.classList.remove("is-over");
    target?.classList.add("is-over");
    pointerSession.target = target || null;
  }
  pointerSession.zone = target?.dataset.zone || (target?.id === "libraryDropzone" ? "library" : null);
}

function finishPointerDrag(event) {
  if (!pointerSession || pointerSession.pointerId !== event.pointerId) return;
  if (pointerSession.active) {
    pointerSession.currentX = event.clientX;
    pointerSession.currentY = event.clientY;
    if (pointerFrame) window.cancelAnimationFrame(pointerFrame);
    paintPointerDrag();
  }
  const { active, id, zone, card, ghost, pointerId, target } = pointerSession;
  pointerSession = null;
  if (card.hasPointerCapture?.(pointerId)) card.releasePointerCapture(pointerId);
  ghost?.remove();
  card.classList.remove("is-pointer-source");
  target?.classList.remove("is-over");

  if (active) {
    event.preventDefault();
    event.stopPropagation();
    suppressNextCardClick = true;
    if (zone) moveItem(id, zone);
    window.setTimeout(() => {
      suppressNextCardClick = false;
    }, 0);
  }
}

function cancelPointerDrag() {
  if (!pointerSession) return;
  if (pointerFrame) window.cancelAnimationFrame(pointerFrame);
  pointerFrame = 0;
  pointerSession.ghost?.remove();
  pointerSession.card.classList.remove("is-pointer-source");
  pointerSession.target?.classList.remove("is-over");
  pointerSession = null;
}

window.addEventListener("pointerup", finishPointerDrag);
window.addEventListener("pointercancel", cancelPointerDrag);

function renderItems() {
  document.querySelectorAll(".tier-dropzone").forEach((zone) => {
    zone.innerHTML = "";
    zone.classList.toggle("is-click-target", Boolean(state.selectedId));
  });
  libraryGrid.innerHTML = "";

  state.items.forEach((item) => {
    const card = createCard(item);
    if (item.zone === "library") {
      libraryGrid.append(card);
    } else {
      document.querySelector(`[data-zone="${item.zone}"]`)?.append(card);
    }
  });

  const total = state.items.length;
  const ranked = state.items.filter((item) => item.zone !== "library").length;
  const libraryCount = total - ranked;
  libraryDropzone.classList.toggle("has-images", libraryCount > 0);
  imageCount.textContent = `${libraryCount} image${libraryCount === 1 ? "" : "s"}`;
  boardStatus.textContent = total ? `${ranked} / ${total} ranked` : "Ready to rank";
  selectionHelp.innerHTML = state.selectedId
    ? '<span>Image selected</span> Click a tier or the library to move it.'
    : '<span>Tip</span> Click an image, then click a tier to move it without dragging.';
  window.requestAnimationFrame(updateTierLayouts);
}

function updateTierLayouts() {
  const ratio = {
    square: 1,
    portrait: 4 / 5,
    landscape: 16 / 9,
  }[state.format];
  const viewportWidth = document.documentElement.clientWidth;
  const baseWidth = viewportWidth <= 760
    ? 92
    : Math.min(126, Math.max(96, viewportWidth * 0.0875));
  const gap = 10;

  document.querySelectorAll(".tier-dropzone").forEach((zone) => {
    const count = zone.querySelectorAll(".image-card").length;
    const styles = getComputedStyle(zone);
    const availableWidth = zone.clientWidth
      - Number.parseFloat(styles.paddingLeft)
      - Number.parseFloat(styles.paddingRight);
    const availableHeight = zone.clientHeight
      - Number.parseFloat(styles.paddingTop)
      - Number.parseFloat(styles.paddingBottom);
    const oneRowWidth = Math.min(baseWidth, availableHeight * ratio);
    const maxColumns = Math.max(1, Math.floor((availableWidth + gap) / (oneRowWidth + gap)));
    const rows = Math.max(1, Math.ceil(count / maxColumns));
    const columns = count ? Math.min(maxColumns, Math.ceil(count / rows)) : 1;
    const rowHeight = Math.max(1, (availableHeight - gap * (rows - 1)) / rows);
    const heightLimitedWidth = rowHeight * ratio;
    const widthLimitedWidth = Math.max(1, (availableWidth - gap * (columns - 1)) / columns);
    const cardWidth = Math.min(oneRowWidth, heightLimitedWidth, widthLimitedWidth);

    zone.style.setProperty("--tier-columns", String(columns));
    zone.style.setProperty("--tier-card-width", `${cardWidth}px`);
  });
}

function selectItem(id) {
  state.selectedId = state.selectedId === id ? null : id;
  renderItems();
}

function moveItem(id, zone) {
  const item = state.items.find((candidate) => candidate.id === id);
  if (!item) return;
  item.zone = zone;
  state.selectedId = null;
  renderItems();
}

function removeItem(id) {
  state.items = state.items.filter((item) => item.id !== id);
  if (state.selectedId === id) state.selectedId = null;
  renderItems();
  showToast("Image removed");
}

function handleCardRemoval(item) {
  if (item.zone === "library") {
    removeItem(item.id);
    return;
  }
  moveItem(item.id, "library");
  showToast("Image returned to the library");
}

function loadCanvasImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image), { once: true });
    image.addEventListener("error", reject, { once: true });
    image.src = src;
  });
}

function drawCoverImage(context, image, x, y, width, height) {
  const sourceRatio = image.naturalWidth / image.naturalHeight;
  const targetRatio = width / height;
  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = image.naturalWidth;
  let sourceHeight = image.naturalHeight;

  if (sourceRatio > targetRatio) {
    sourceWidth = image.naturalHeight * targetRatio;
    sourceX = (image.naturalWidth - sourceWidth) / 2;
  } else {
    sourceHeight = image.naturalWidth / targetRatio;
    sourceY = (image.naturalHeight - sourceHeight) / 2;
  }

  context.save();
  context.beginPath();
  context.roundRect(x, y, width, height, 8);
  context.clip();
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    x,
    y,
    width,
    height,
  );
  context.restore();
}

function drawCenteredLabel(context, text, x, y, width, height) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";
  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width > width - 44 && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  });
  if (line) lines.push(line);
  const lineHeight = 30;
  const startY = y + height / 2 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((currentLine, index) => {
    context.fillText(currentLine, x + width / 2, startY + index * lineHeight);
  });
}

async function exportTierList() {
  const exportWidth = 1600;
  const margin = 80;
  const titleHeight = 180;
  const boardHeaderHeight = 56;
  const rowHeight = 220;
  const boardWidth = exportWidth - margin * 2;
  const labelWidth = 260;
  const exportHeight = margin * 2 + titleHeight + boardHeaderHeight + rowHeight * tierDefinitions.length;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  canvas.width = exportWidth;
  canvas.height = exportHeight;

  context.fillStyle = "#191919";
  context.fillRect(0, 0, exportWidth, exportHeight);

  context.fillStyle = "rgba(248, 248, 248, 0.42)";
  context.font = '600 16px "SF Pro Text", -apple-system, sans-serif';
  context.letterSpacing = "2px";
  context.fillText("TIER LIST", margin, margin + 20);

  context.fillStyle = "#f8f8f8";
  context.font = '700 68px "SF Pro Display", -apple-system, sans-serif';
  context.letterSpacing = "-3px";
  context.fillText(pageTitle.textContent.trim(), margin, margin + 106, boardWidth);
  context.letterSpacing = "0px";

  const boardTop = margin + titleHeight;
  context.fillStyle = "#1d1d1d";
  context.fillRect(margin, boardTop, boardWidth, boardHeaderHeight);
  context.fillStyle = "rgba(248, 248, 248, 0.55)";
  context.font = '600 14px "SF Pro Text", -apple-system, sans-serif';
  context.fillText("RANKING", margin + 22, boardTop + 35);

  const loadedImages = new Map();
  await Promise.all(state.items.map(async (item) => {
    try {
      loadedImages.set(item.id, await loadCanvasImage(item.src));
    } catch {
      loadedImages.set(item.id, null);
    }
  }));

  const imageRatio = {
    square: 1,
    portrait: 4 / 5,
    landscape: 16 / 9,
  }[state.format];

  tierDefinitions.forEach((tier, tierIndex) => {
    const rowTop = boardTop + boardHeaderHeight + tierIndex * rowHeight;
    context.fillStyle = tier.color;
    context.fillRect(margin, rowTop, labelWidth, rowHeight);

    context.fillStyle = "#171814";
    context.font = '700 28px "SF Pro Display", -apple-system, sans-serif';
    context.textAlign = "center";
    context.textBaseline = "middle";
    drawCenteredLabel(context, tier.label, margin, rowTop, labelWidth, rowHeight);

    const contentLeft = margin + labelWidth;
    const contentWidth = boardWidth - labelWidth;
    context.fillStyle = "#1b1b1b";
    context.fillRect(contentLeft, rowTop, contentWidth, rowHeight);

    const items = state.items.filter((item) => item.zone === tier.id);
    const padding = 18;
    const gap = 12;
    const availableWidth = contentWidth - padding * 2;
    const availableHeight = rowHeight - padding * 2;
    const baseWidth = Math.min(172, availableHeight * imageRatio);
    const maxColumns = Math.max(1, Math.floor((availableWidth + gap) / (baseWidth + gap)));
    const rows = Math.max(1, Math.ceil(items.length / maxColumns));
    const columns = items.length ? Math.min(maxColumns, Math.ceil(items.length / rows)) : 1;
    const cellHeight = Math.max(1, (availableHeight - gap * (rows - 1)) / rows);
    const cellWidth = Math.min(
      baseWidth,
      cellHeight * imageRatio,
      (availableWidth - gap * (columns - 1)) / columns,
    );
    const imageHeight = cellWidth / imageRatio;
    const gridHeight = rows * imageHeight + (rows - 1) * gap;
    const gridTop = rowTop + (rowHeight - gridHeight) / 2;

    items.forEach((item, itemIndex) => {
      const image = loadedImages.get(item.id);
      if (!image) return;
      const column = itemIndex % columns;
      const row = Math.floor(itemIndex / columns);
      drawCoverImage(
        context,
        image,
        contentLeft + padding + column * (cellWidth + gap),
        gridTop + row * (imageHeight + gap),
        cellWidth,
        imageHeight,
      );
    });

    context.strokeStyle = "rgba(248, 248, 248, 0.08)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(margin, rowTop + rowHeight - 0.5);
    context.lineTo(margin + boardWidth, rowTop + rowHeight - 0.5);
    context.stroke();
  });

  const footerLineY = exportHeight - 62;
  context.strokeStyle = "rgba(248, 248, 248, 0.12)";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(margin, footerLineY);
  context.lineTo(exportWidth - margin, footerLineY);
  context.stroke();

  context.fillStyle = "rgba(248, 248, 248, 0.48)";
  context.font = '600 14px "SF Pro Text", -apple-system, sans-serif';
  context.textAlign = "center";
  context.textBaseline = "alphabetic";
  context.letterSpacing = "1px";
  context.fillText(
    "GENERATED BY KNIGHTER TIERS LIST - CONFIDENTIAL ALL RIGHT RISERVED ©2026",
    exportWidth / 2,
    exportHeight - 27,
  );
  context.letterSpacing = "0px";

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Unable to generate the PNG");
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const safeTitle = pageTitle.textContent.trim().toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  link.href = url;
  link.download = `${safeTitle || "tier-list"}.png`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function addDropEvents(element, zone) {
  element.addEventListener("dragover", (event) => {
    if (![...event.dataTransfer.types].includes("Files") && !state.draggedId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = state.draggedId ? "move" : "copy";
    element.classList.add("is-over");
  });

  element.addEventListener("dragleave", (event) => {
    if (!element.contains(event.relatedTarget)) element.classList.remove("is-over");
  });

  element.addEventListener("drop", (event) => {
    event.preventDefault();
    element.classList.remove("is-over");
    const imageFiles = [...event.dataTransfer.files].filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length) {
      loadFiles(imageFiles, zone);
      return;
    }
    const id = state.draggedId || event.dataTransfer.getData("text/plain");
    if (id) moveItem(id, zone);
  });
}

function loadFiles(files, zone = "library") {
  const validFiles = files.filter((file) => {
    const validType = ["image/jpeg", "image/png", "image/webp"].includes(file.type);
    const validSize = file.size <= 12 * 1024 * 1024;
    if (!validType || !validSize) showToast(`${file.name} could not be imported`);
    return validType && validSize;
  });

  if (!validFiles.length) return;

  let loaded = 0;
  validFiles.forEach((file) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      state.items.push({
        id: makeId(),
        name: file.name.replace(/\.[^.]+$/, ""),
        src: reader.result,
        zone,
      });
      loaded += 1;
      if (loaded === validFiles.length) {
        renderItems();
        showToast(`${loaded} image${loaded === 1 ? "" : "s"} added`);
      }
    });
    reader.readAsDataURL(file);
  });
}

fileInput.addEventListener("change", () => {
  loadFiles([...fileInput.files]);
  fileInput.value = "";
});

libraryDropzone.addEventListener("click", (event) => {
  if (event.target.closest(".image-card")) return;
  if (state.selectedId) {
    moveItem(state.selectedId, "library");
    return;
  }
  fileInput.click();
});
libraryDropzone.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    fileInput.click();
  }
});
addDropEvents(libraryDropzone, "library");

document.addEventListener("paste", (event) => {
  const files = [...event.clipboardData.items]
    .filter((item) => item.type.startsWith("image/"))
    .map((item) => item.getAsFile())
    .filter(Boolean);
  if (files.length) loadFiles(files);
});

formatSelect.addEventListener("change", () => updateFormat(formatSelect.value));

downloadButton.addEventListener("click", async () => {
  const label = downloadButton.querySelector("span");
  const initialLabel = label.textContent;
  downloadButton.disabled = true;
  label.textContent = "Generating…";
  try {
    await exportTierList();
    showToast("Tier list downloaded as PNG");
  } catch {
    showToast("The PNG could not be generated");
  } finally {
    downloadButton.disabled = false;
    label.textContent = initialLabel;
  }
});

document.querySelector("#editTitleButton").addEventListener("click", () => {
  titleInput.value = pageTitle.textContent;
  titleDialog.showModal();
  titleInput.select();
});

document.querySelector("#cancelTitleButton").addEventListener("click", () => titleDialog.close());
document.querySelector("#titleForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const nextTitle = titleInput.value.trim();
  if (nextTitle) pageTitle.textContent = nextTitle;
  titleDialog.close();
});

buildTierRows();
renderItems();
updateFormat("square");

let resizeFrame;
window.addEventListener("resize", () => {
  window.cancelAnimationFrame(resizeFrame);
  resizeFrame = window.requestAnimationFrame(updateTierLayouts);
});
