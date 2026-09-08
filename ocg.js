/* Optional Content Group (PDF layer) reading and editing.
 *
 * Port of toggle_layers.py. Hiding a layer only sets its default visibility
 * to OFF in the PDF's default OCG configuration -- the content stays in the
 * file and any viewer can switch it back on.
 */
(function (global) {
  "use strict";

  const { PDFDocument, PDFName, PDFArray, PDFDict } = global.PDFLib;

  const OCPROPERTIES = PDFName.of("OCProperties");
  const OCGS = PDFName.of("OCGs");
  const D = PDFName.of("D");
  const OFF = PDFName.of("OFF");
  const ON = PDFName.of("ON");
  const NAME = PDFName.of("Name");
  const BASESTATE = PDFName.of("BaseState");

  async function load(bytes) {
    return PDFDocument.load(bytes, {
      ignoreEncryption: true,
      updateMetadata: false,
    });
  }

  /** Return {ocgs, d} where ocgs is a list of {ref, name}. Empty if no layers. */
  function getOcgs(doc) {
    const ocp = doc.catalog.lookupMaybe(OCPROPERTIES, PDFDict);
    if (!ocp) return { ocgs: [], d: null };

    const arr = ocp.lookupMaybe(OCGS, PDFArray);
    const d = ocp.lookupMaybe(D, PDFDict);
    if (!arr || !d) return { ocgs: [], d: null };

    const ocgs = [];
    for (let i = 0; i < arr.size(); i++) {
      const ref = arr.get(i);
      if (!ref || typeof ref.tag !== "string") continue; // skip non-indirect entries
      ocgs.push({ ref, name: nameOf(doc, ref, ocgs.length + 1) });
    }
    return { ocgs, d };
  }

  function nameOf(doc, ref, i) {
    try {
      const dict = doc.context.lookup(ref, PDFDict);
      const n = dict && dict.lookup(NAME);
      if (n && typeof n.decodeText === "function") {
        const text = n.decodeText();
        if (text) return text;
      }
    } catch (e) {
      /* fall through to the placeholder */
    }
    return `(unnamed layer ${i})`;
  }

  /** true when /BaseState is /OFF, i.e. layers are hidden unless listed in /ON. */
  function baseStateOff(d) {
    const bs = d.lookupMaybe(BASESTATE, PDFName);
    return !!bs && bs === PDFName.of("OFF");
  }

  function tagsIn(d, key) {
    const arr = d.lookupMaybe(key, PDFArray);
    const tags = new Set();
    if (!arr) return tags;
    for (let i = 0; i < arr.size(); i++) {
      const ref = arr.get(i);
      if (ref && typeof ref.tag === "string") tags.add(ref.tag);
    }
    return tags;
  }

  /** Visibility currently stored in the file, as a boolean per layer. */
  function visibilityOf(ocgs, d) {
    if (!d) return ocgs.map(() => true);
    const off = tagsIn(d, OFF);
    if (baseStateOff(d)) {
      const on = tagsIn(d, ON);
      return ocgs.map((o) => on.has(o.ref.tag) && !off.has(o.ref.tag));
    }
    return ocgs.map((o) => !off.has(o.ref.tag));
  }

  /** Write the given visibility (one boolean per layer) into the /D config. */
  function applyVisibility(doc, ocgs, d, visible) {
    const hiddenRefs = [];
    const shownRefs = [];
    ocgs.forEach((o, i) => (visible[i] ? shownRefs : hiddenRefs).push(o.ref));

    d.set(OFF, doc.context.obj(hiddenRefs));

    // Keep /ON consistent when the file already has one, or when /BaseState
    // is /OFF and /ON is the only thing that can make a layer visible.
    if (d.lookupMaybe(ON, PDFArray) || baseStateOff(d)) {
      d.set(ON, doc.context.obj(shownRefs));
    }
  }

  function defaultOut(filename) {
    const dot = filename.lastIndexOf(".");
    const root = dot > 0 ? filename.slice(0, dot) : filename;
    const ext = dot > 0 ? filename.slice(dot) : ".pdf";
    return `${root}_layers${ext}`;
  }

  global.OCG = { load, getOcgs, visibilityOf, applyVisibility, defaultOut };
})(typeof window !== "undefined" ? window : globalThis);
