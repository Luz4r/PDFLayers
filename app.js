/* UI for hiding/showing PDF layers. Port of toggle_layers_gui.py.
 *
 * Everything runs locally: the chosen PDF is read into memory, edited, and
 * handed straight back to the user. Nothing is uploaded anywhere.
 */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const els = {
    open: $("open"), file: $("file"), main: $("main"),
    empty: $("empty"), loaded: $("loaded"), filename: $("filename"),
    allOn: $("all-on"), allOff: $("all-off"), reset: $("reset"),
    layers: $("layers"), status: $("status"), save: $("save"), toast: $("toast"),
  };

  let doc = null;       // the loaded PDFDocument
  let ocgs = [];        // [{ref, name}]
  let d = null;         // the default OCG config dict
  let saved = [];       // visibility as stored in the file, for Reset
  let sourceName = "";  // original filename

  // ---------- helpers ----------

  const setStatus = (text) => { els.status.textContent = text; };

  let toastTimer;
  function toast(text) {
    els.toast.textContent = text;
    els.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { els.toast.hidden = true; }, 2600);
  }

  function setBulkEnabled(enabled) {
    for (const b of [els.allOn, els.allOff, els.reset, els.save]) b.disabled = !enabled;
  }

  const checkboxes = () => Array.from(els.layers.querySelectorAll("input"));
  const currentVisibility = () => checkboxes().map((c) => c.checked);

  // ---------- open ----------

  els.open.addEventListener("click", () => els.file.click());

  els.file.addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    // Reset so picking the same file twice still fires a change event.
    els.file.value = "";
    if (file) await openPdf(file);
  });

  async function openPdf(file) {
    setStatus("Reading…");
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      doc = await OCG.load(bytes);
    } catch (err) {
      setStatus("Could not open this PDF.");
      toast(String((err && err.message) || err));
      return;
    }

    sourceName = file.name || "document.pdf";
    ({ ocgs, d } = OCG.getOcgs(doc));
    saved = OCG.visibilityOf(ocgs, d);

    els.empty.hidden = true;
    els.loaded.hidden = false;
    els.filename.textContent = sourceName;

    render();

    if (!ocgs.length) {
      setStatus("No layers in this PDF.");
    } else {
      const hidden = saved.filter((v) => !v).length;
      setStatus(
        `${ocgs.length} layer${ocgs.length === 1 ? "" : "s"}` +
        (hidden ? ` · ${hidden} hidden` : "")
      );
    }
  }

  function render() {
    els.layers.replaceChildren();

    if (!ocgs.length) {
      const li = document.createElement("li");
      li.className = "layer";
      li.style.color = "var(--muted)";
      li.textContent = "This PDF has no optional content groups.";
      els.layers.append(li);
      setBulkEnabled(false);
      return;
    }

    ocgs.forEach((ocg, i) => {
      const li = document.createElement("li");
      const label = document.createElement("label");
      label.className = "layer";

      const num = document.createElement("span");
      num.className = "layer-num";
      num.textContent = i + 1;

      const name = document.createElement("span");
      name.className = "layer-name";
      name.textContent = ocg.name;

      const box = document.createElement("input");
      box.type = "checkbox";
      box.checked = saved[i];
      box.setAttribute("aria-label", ocg.name);
      box.addEventListener("change", updateCount);

      label.append(num, name, box);
      li.append(label);
      els.layers.append(li);
    });

    setBulkEnabled(true);
    updateCount();
  }

  function updateCount() {
    const hidden = currentVisibility().filter((v) => !v).length;
    setStatus(
      `${ocgs.length} layer${ocgs.length === 1 ? "" : "s"}` +
      (hidden ? ` · ${hidden} hidden` : "")
    );
  }

  // ---------- bulk actions ----------

  const setAll = (visible) => {
    for (const c of checkboxes()) c.checked = visible;
    updateCount();
  };

  els.allOn.addEventListener("click", () => setAll(true));
  els.allOff.addEventListener("click", () => setAll(false));

  els.reset.addEventListener("click", () => {
    checkboxes().forEach((c, i) => { c.checked = saved[i]; });
    updateCount();
    toast("Reverted to the file's saved visibility.");
  });

  // ---------- save ----------

  els.save.addEventListener("click", async () => {
    if (!doc || !ocgs.length) return;

    const visible = currentVisibility();
    const outName = OCG.defaultOut(sourceName);
    els.save.disabled = true;
    setStatus("Saving…");

    let blob;
    try {
      OCG.applyVisibility(doc, ocgs, d, visible);
      // No object streams: keeps the output readable by older PDF viewers
      // and print shops, which is what these files usually go to.
      const bytes = await doc.save({ useObjectStreams: false });
      blob = new Blob([bytes], { type: "application/pdf" });
    } catch (err) {
      setStatus("Could not save this PDF.");
      toast(String((err && err.message) || err));
      els.save.disabled = false;
      return;
    }

    const hidden = visible.filter((v) => !v).length;
    await deliver(blob, outName);
    setStatus(`${outName} · ${hidden} layer${hidden === 1 ? "" : "s"} hidden`);
    els.save.disabled = false;
  });

  /** Hand the file to the user: iOS share sheet if available, else a download. */
  async function deliver(blob, name) {
    const file = new File([blob], name, { type: "application/pdf" });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: name });
        return;
      } catch (err) {
        // The user dismissing the share sheet is not an error.
        if (err && err.name === "AbortError") return;
        // Anything else: fall through to the download path.
      }
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  // ---------- offline ----------

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {
        // Offline support is a bonus; the app works fine without it.
      });
    });
  }
})();
