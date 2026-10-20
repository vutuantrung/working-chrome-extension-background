export default function screenshotSelector(caseId: string, windowId: number) {
  if (document.getElementById("__ext-screenshot-overlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "__ext-screenshot-overlay";
  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    zIndex: "2147483647",
    cursor: "crosshair",
    userSelect: "none",
  });

  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:absolute;inset:0;pointer-events:none;";
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  overlay.appendChild(canvas);
  const ctx = canvas.getContext("2d")!;

  // --- Tip bar: label + action buttons ---
  const tip = document.createElement("div");
  Object.assign(tip.style, {
    position: "absolute",
    top: "16px",
    left: "50%",
    transform: "translateX(-50%)",
    background: "rgba(0,0,0,0.72)",
    color: "#fff",
    padding: "8px 14px 8px 18px",
    borderRadius: "8px",
    fontSize: "13px",
    fontFamily: "system-ui, sans-serif",
    whiteSpace: "nowrap",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    pointerEvents: "auto", // must be auto so buttons are clickable
  });

  const tipLabel = document.createElement("span");
  tipLabel.textContent = "Drag to select a region";
  tip.appendChild(tipLabel);

  function makeButton(label: string): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.textContent = label;
    btn.type = "button";
    Object.assign(btn.style, {
      background: "rgba(255,255,255,0.15)",
      border: "1px solid rgba(255,255,255,0.35)",
      color: "#fff",
      fontSize: "12px",
      fontFamily: "system-ui, sans-serif",
      padding: "4px 10px",
      borderRadius: "6px",
      cursor: "pointer",
      lineHeight: "1.2",
    });
    btn.addEventListener("mouseenter", () => {
      btn.style.background = "rgba(255,255,255,0.28)";
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.background = "rgba(255,255,255,0.15)";
    });
    return btn;
  }

  const fullPageBtn = makeButton("Capture full page");
  fullPageBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    tip.style.display = "none";
    captureAndSend(0, 0, window.innerWidth, window.innerHeight);
  });

  const cancelBtn = makeButton("Cancel");
  cancelBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    cleanup();
  });

  tip.appendChild(fullPageBtn);
  tip.appendChild(cancelBtn);
  overlay.appendChild(tip);

  // The overlay listens for mousedown/mouseup to drive drag-select.
  // Without this, a click on a button still bubbles mousedown+mouseup
  // up to the overlay first (click fires last), which the overlay reads
  // as a zero-size drag and immediately calls cleanup() before the
  // button's own click handler ever runs. Stop them at the source.
  tip.addEventListener("mousedown", (e) => e.stopPropagation());
  tip.addEventListener("mouseup", (e) => e.stopPropagation());

  // --- Selection box ---
  const selBox = document.createElement("div");
  Object.assign(selBox.style, {
    position: "absolute",
    border: "2px solid #3b82f6",
    boxShadow: "0 0 0 1px rgba(255,255,255,0.5)",
    pointerEvents: "none",
    display: "none",
    boxSizing: "border-box",
  });
  overlay.appendChild(selBox);
  document.body.appendChild(overlay);

  let startX = 0, startY = 0, isDragging = false;

  function drawMask(x: number, y: number, w: number, h: number) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(0,0,0,0)";
    ctx.fillRect(0, 0, canvas.width, y);
    ctx.fillRect(0, y + h, canvas.width, canvas.height - y - h);
    ctx.fillRect(0, y, x, h);
    ctx.fillRect(x + w, y, canvas.width - x - w, h);
  }

  function updateSelBox(x: number, y: number, w: number, h: number) {
    selBox.style.display = "block";
    selBox.style.left = x + "px";
    selBox.style.top = y + "px";
    selBox.style.width = w + "px";
    selBox.style.height = h + "px";
  }

  function cleanup() {
    overlay.remove();
  }

  // --- Shared capture + crop + send logic ---
  function captureAndSend(x: number, y: number, w: number, h: number) {
    const dpr = window.devicePixelRatio || 1;
    chrome.runtime.sendMessage(
      { type: "CAPTURE_SCREENSHOT" },
      (response: { dataUrl?: string; error?: string }) => {
        cleanup();
        if (!response?.dataUrl) return;
        const img = new Image();
        img.onload = () => {
          const c = document.createElement("canvas");
          c.width = Math.round(w * dpr);
          c.height = Math.round(h * dpr);
          const cx = c.getContext("2d")!;
          cx.drawImage(
            img,
            Math.round(x * dpr), Math.round(y * dpr),
            Math.round(w * dpr), Math.round(h * dpr),
            0, 0,
            Math.round(w * dpr), Math.round(h * dpr)
          );
          chrome.runtime.sendMessage({
            type: "SCREENSHOT_CROPPED",
            dataUrl: c.toDataURL("image/png"),
            caseId,
            windowId,
          });
        };
        img.src = response.dataUrl;
      }
    );
  }

  overlay.addEventListener("mousedown", (e) => {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    e.preventDefault();
  });

  overlay.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    const x = Math.min(e.clientX, startX);
    const y = Math.min(e.clientY, startY);
    const w = Math.abs(e.clientX - startX);
    const h = Math.abs(e.clientY - startY);
    drawMask(x, y, w, h);
    updateSelBox(x, y, w, h);
    tip.style.display = "none";
  });

  overlay.addEventListener("mouseup", (e) => {
    if (!isDragging) return;
    isDragging = false;
    const x = Math.min(e.clientX, startX);
    const y = Math.min(e.clientY, startY);
    const w = Math.abs(e.clientX - startX);
    const h = Math.abs(e.clientY - startY);
    if (w < 10 || h < 10) { cleanup(); return; }
    captureAndSend(x, y, w, h);
  });
}