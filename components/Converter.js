"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { generate, arrowComponent, sectionFile, pageCode } from "@/lib/htmlToJsx";
import { makeZip, strBytes } from "@/lib/zip";
import { copyText, downloadBlob } from "@/lib/clipboard";

export default function Converter() {
  const [html, setHtml] = useState("");
  const [component, setComponent] = useState(true);
  const [name, setName] = useState("Component");
  const [bodyOnly, setBodyOnly] = useState(true);
  const [live, setLive] = useState(true);
  const [splitOn, setSplitOn] = useState(false);

  const [result, setResult] = useState(null); // { combined, sections, parent }
  const [status, setStatus] = useState("");
  const [statusErr, setStatusErr] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("Converting…");
  const [dragging, setDragging] = useState(false);
  const [toast, setToast] = useState("");

  const lastName = useRef("Component");
  const toastTimer = useRef(null);
  const dragDepth = useRef(0);

  // Mirror state into a ref so convertNow can stay stable across renders.
  const stateRef = useRef({});
  stateRef.current = { html, component, name, bodyOnly, splitOn };

  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 1800);
  }, []);

  const convertNow = useCallback((overrideSplit) => {
    const s = stateRef.current;
    const sp = overrideSplit !== undefined ? overrideSplit : s.splitOn;
    if (!s.html.trim()) { setResult(null); setStatus(""); setStatusErr(false); return; }
    try {
      const r = generate(s.html, { component: s.component, name: s.name, bodyOnly: s.bodyOnly, split: sp });
      setResult(r);
      setStatusErr(false);
      setStatus(r.sections ? `${r.sections.length} sections` : `${r.combined.split("\n").length} lines`);
    } catch (e) {
      setStatusErr(true);
      setStatus("Error: " + e.message);
    }
  }, []);

  const runWithLoader = useCallback((msg, overrideSplit) => {
    setLoadingMsg(msg);
    setLoading(true);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      convertNow(overrideSplit);
      setLoading(false);
    }));
  }, [convertNow]);

  // Live conversion (debounced) for typing + option changes. Split toggle is
  // handled separately so it can show the loader.
  useEffect(() => {
    if (!live) return;
    const t = setTimeout(() => convertNow(), 200);
    return () => clearTimeout(t);
  }, [html, component, name, bodyOnly, live, convertNow]);

  const toggleSplit = () => {
    const next = !splitOn;
    setSplitOn(next);
    if (html.trim()) runWithLoader(next ? "Splitting into sections…" : "Converting…", next);
  };

  const loadFile = useCallback((file) => {
    if (!file) return;
    const base = file.name.replace(/\.(html?|xhtml)$/i, "");
    if (base) { const n = base.replace(/[^A-Za-z0-9_$]/g, "") || "Component"; setName(n); lastName.current = n; }
    setLoadingMsg("Reading " + file.name + "…");
    setLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      setHtml(e.target.result);
      setLoadingMsg("Converting…");
      requestAnimationFrame(() => requestAnimationFrame(() => {
        convertNow();
        setLoading(false);
        showToast("Loaded " + file.name);
      }));
    };
    reader.onerror = () => { setLoading(false); setStatusErr(true); setStatus("Error reading file"); };
    reader.readAsText(file);
  }, [convertNow, showToast]);

  // Drag & drop anywhere on the window.
  useEffect(() => {
    const onEnter = (e) => { e.preventDefault(); dragDepth.current++; setDragging(true); };
    const onOver = (e) => e.preventDefault();
    const onLeave = (e) => { e.preventDefault(); if (--dragDepth.current <= 0) setDragging(false); };
    const onDrop = (e) => {
      e.preventDefault(); dragDepth.current = 0; setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) loadFile(file);
    };
    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [loadFile]);

  const outFilename = () => {
    if (result && result.sections) return result.parent.name + ".jsx";
    return ((name || lastName.current || "Component").replace(/[^A-Za-z0-9_$]/g, "") || "Component") + ".jsx";
  };

  const copyAll = async () => {
    if (!result) return;
    const ok = await copyText(result.combined);
    showToast(ok ? (result.sections ? "Copied all (one file)" : "Copied to clipboard") : "Copy failed — select & Ctrl+C");
  };

  const downloadJsx = () => {
    if (!result) return;
    const fn = outFilename();
    downloadBlob(new Blob([result.combined], { type: "text/plain" }), fn);
    showToast("Downloaded " + fn);
  };

  const downloadZip = () => {
    if (!result || !result.sections) return;
    const files = result.sections.map((s) => ({ name: s.name + ".jsx", data: strBytes(sectionFile(s.name, s.inner)) }));
    files.push({ name: result.parent.name + ".jsx", data: strBytes(pageCode(result.parent.name, result.sections, true)) });
    downloadBlob(makeZip(files), result.parent.name + "-sections.zip");
    showToast("Downloaded " + files.length + " files (.zip)");
  };

  const clearAll = () => { setHtml(""); setResult(null); setStatus(""); setStatusErr(false); };

  return (
    <>
      <header>
        <h1>HTML <span>→</span> JSX</h1>
        <div className="opts">
          <label className="opt"><input type="checkbox" checked={component} onChange={(e) => setComponent(e.target.checked)} /> Wrap as component</label>
          <label className="opt">Name: <input type="text" value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className="opt"><input type="checkbox" checked={bodyOnly} onChange={(e) => setBodyOnly(e.target.checked)} /> Body only</label>
          <button className="tgl" aria-pressed={splitOn} onClick={toggleSplit}>Split into sections</button>
          <label className="opt"><input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} /> Live</label>
        </div>
      </header>

      <main>
        <section className="pane">
          <div className="pane-head">
            HTML input
            <div className="actions">
              <button className="file-btn">Choose file<input type="file" accept=".html,.htm,text/html" onChange={(e) => loadFile(e.target.files[0])} /></button>
              <button onClick={clearAll}>Clear</button>
              <button className="primary" onClick={() => runWithLoader(splitOn ? "Splitting into sections…" : "Converting…")}>Convert →</button>
            </div>
          </div>
          <textarea
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            placeholder="Paste HTML here, or drop / choose an .html file..."
            spellCheck={false}
          />
        </section>

        <section className="pane">
          <div className="pane-head">
            JSX output
            <span className={"status" + (statusErr ? " err" : "")}>{status}</span>
            <div className="actions">
              <button onClick={copyAll}>{result && result.sections ? "Copy all" : "Copy"}</button>
              <button onClick={downloadJsx}>Download .jsx</button>
              {result && result.sections && <button onClick={downloadZip}>Download .zip</button>}
            </div>
          </div>

          {result && result.sections ? (
            <div className="section-list">
              <Card name={result.parent.name} meta="page · composes sections" code={pageCode(result.parent.name, result.sections, false)} isParent />
              {result.sections.map((s) => (
                <Card key={s.name} name={s.name} meta="section" code={arrowComponent(s.name, s.inner)} />
              ))}
            </div>
          ) : (
            <pre className="output">{result ? result.combined : ""}</pre>
          )}

          {loading && (
            <div className="loader"><div className="spinner" /><span>{loadingMsg}</span></div>
          )}
          {dragging && <div className="drop">Drop your .html file to convert</div>}
        </section>
      </main>

      <div className={"toast" + (toast ? " show" : "")}>{toast}</div>
    </>
  );
}

function Card({ name, meta, code, isParent }) {
  const [label, setLabel] = useState("Copy");
  const onCopy = async () => {
    const ok = await copyText(code);
    setLabel(ok ? "Copied!" : "Press Ctrl+C");
    setTimeout(() => setLabel("Copy"), 1400);
  };
  return (
    <div className={"card" + (isParent ? " parent" : "")}>
      <div className="card-head">
        <span className="nm">{name}</span>
        <span className="meta">{meta}</span>
        <button className={label === "Copied!" ? "ok" : ""} onClick={onCopy}>{label}</button>
      </div>
      <pre>{code}</pre>
    </div>
  );
}
