// HTML -> JSX conversion. Framework-agnostic; the only browser dependency is
// DOMParser, which is used inside generate() and therefore only runs client-side.

// HTML attribute name -> JSX prop name (the irregular ones).
const ATTR_MAP = {
  "class": "className", "for": "htmlFor",
  "accept-charset": "acceptCharset", "accesskey": "accessKey", "allowfullscreen": "allowFullScreen",
  "autocomplete": "autoComplete", "autofocus": "autoFocus", "autoplay": "autoPlay",
  "cellpadding": "cellPadding", "cellspacing": "cellSpacing", "charset": "charSet",
  "classid": "classID", "colspan": "colSpan", "contenteditable": "contentEditable",
  "contextmenu": "contextMenu", "controlslist": "controlsList", "crossorigin": "crossOrigin",
  "datetime": "dateTime", "enctype": "encType", "formaction": "formAction", "formenctype": "formEncType",
  "formmethod": "formMethod", "formnovalidate": "formNoValidate", "formtarget": "formTarget",
  "frameborder": "frameBorder", "hreflang": "hrefLang", "http-equiv": "httpEquiv",
  "inputmode": "inputMode", "keyparams": "keyParams", "keytype": "keyType", "marginheight": "marginHeight",
  "marginwidth": "marginWidth", "maxlength": "maxLength", "mediagroup": "mediaGroup",
  "minlength": "minLength", "novalidate": "noValidate", "radiogroup": "radioGroup",
  "readonly": "readOnly", "rowspan": "rowSpan", "spellcheck": "spellCheck", "srcdoc": "srcDoc",
  "srclang": "srcLang", "srcset": "srcSet", "tabindex": "tabIndex", "usemap": "useMap",
  "autocapitalize": "autoCapitalize", "itemprop": "itemProp", "itemscope": "itemScope",
  "itemtype": "itemType", "itemid": "itemID", "itemref": "itemRef",
  // SVG common
  "stroke-width": "strokeWidth", "stroke-linecap": "strokeLinecap", "stroke-linejoin": "strokeLinejoin",
  "stroke-dasharray": "strokeDasharray", "stroke-dashoffset": "strokeDashoffset",
  "stroke-miterlimit": "strokeMiterlimit", "stroke-opacity": "strokeOpacity", "fill-opacity": "fillOpacity",
  "fill-rule": "fillRule", "clip-path": "clipPath", "clip-rule": "clipRule", "stop-color": "stopColor",
  "stop-opacity": "stopOpacity", "text-anchor": "textAnchor", "font-family": "fontFamily",
  "font-size": "fontSize", "font-weight": "fontWeight", "letter-spacing": "letterSpacing",
  "baseline-shift": "baselineShift", "color-interpolation": "colorInterpolation",
  "dominant-baseline": "dominantBaseline", "enable-background": "enableBackground",
  "flood-color": "floodColor", "flood-opacity": "floodOpacity", "marker-end": "markerEnd",
  "marker-mid": "markerMid", "marker-start": "markerStart", "shape-rendering": "shapeRendering",
  "vector-effect": "vectorEffect", "xlink:href": "xlinkHref",
};

const VOID = new Set(["area","base","br","col","embed","hr","img","input","keygen","link","meta","param","source","track","wbr"]);

// Top-level elements excluded from "Split into sections" — not visual content.
const NON_SECTION = new Set(["SCRIPT","STYLE","NOSCRIPT","TEMPLATE","LINK","META","TITLE","BASE"]);

function camelCase(s) {
  return s.replace(/[-:]([a-z])/g, (_, c) => c.toUpperCase());
}

function styleToObject(style) {
  const out = [];
  style.split(";").forEach(decl => {
    const i = decl.indexOf(":");
    if (i < 0) return;
    const prop = decl.slice(0, i).trim();
    const val = decl.slice(i + 1).trim();
    if (!prop || !val) return;
    const key = prop.startsWith("--") ? `'${prop}'` : camelCase(prop);
    out.push(`${key}: '${val.replace(/'/g, "\\'")}'`);
  });
  return out.length ? `{{ ${out.join(", ")} }}` : null;
}

function mapAttrName(name) {
  const lower = name.toLowerCase();
  if (ATTR_MAP[lower]) return ATTR_MAP[lower];
  if (lower.startsWith("data-") || lower.startsWith("aria-")) return lower;
  if (lower.startsWith("on") && lower.length > 2) return "on" + lower.charAt(2).toUpperCase() + lower.slice(3);
  if (/[-:]/.test(lower)) return camelCase(lower);
  return name;
}

function escapeText(t) {
  return t
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\{/g, "&#123;")
    .replace(/\}/g, "&#125;");
}

function serializeAttrs(el) {
  const parts = [];
  for (const attr of Array.from(el.attributes)) {
    const rawName = attr.name;
    const value = attr.value;
    if (rawName.toLowerCase() === "style") {
      const obj = styleToObject(value);
      if (obj) parts.push(`style=${obj}`);
      continue;
    }
    const name = mapAttrName(rawName);
    if (value === "") parts.push(name);
    else if (value.includes('"')) parts.push(`${name}={${JSON.stringify(value)}}`);
    else parts.push(`${name}="${value}"`);
  }
  return parts;
}

function indent(n) { return "  ".repeat(n); }

function keepNode(node) {
  if (node.nodeType === 3) return node.textContent.trim().length > 0;
  return node.nodeType === 1 || node.nodeType === 8;
}

function serializeNode(node, depth, lines) {
  if (node.nodeType === 1) {
    const tag = node.tagName.toLowerCase();
    if (tag === "script" || tag === "style") {
      const attrs = serializeAttrs(node);
      const open = `<${tag}${attrs.length ? " " + attrs.join(" ") : ""}>`;
      const raw = node.textContent;
      if (!raw.trim()) { lines.push(indent(depth) + open.replace(/>$/, " />")); return; }
      const safe = raw.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
      lines.push(indent(depth) + open + "{`");
      safe.split("\n").forEach(l => lines.push(l));
      lines.push("`}" + `</${tag}>`);
      return;
    }

    const attrs = serializeAttrs(node);
    const attrStr = attrs.length ? " " + attrs.join(" ") : "";
    const children = Array.from(node.childNodes).filter(keepNode);

    if (children.length === 0) { lines.push(indent(depth) + `<${tag}${attrStr} />`); return; }

    if (children.length === 1 && children[0].nodeType === 3) {
      const txt = escapeText(children[0].textContent.trim());
      lines.push(indent(depth) + `<${tag}${attrStr}>${txt}</${tag}>`);
      return;
    }

    lines.push(indent(depth) + `<${tag}${attrStr}>`);
    children.forEach(c => serializeNode(c, depth + 1, lines));
    lines.push(indent(depth) + `</${tag}>`);
    return;
  }

  if (node.nodeType === 3) {
    const txt = node.textContent.trim();
    if (txt) lines.push(indent(depth) + escapeText(txt));
    return;
  }

  if (node.nodeType === 8) {
    const c = node.textContent.replace(/\*\//g, "* /").trim();
    lines.push(indent(depth) + `{/* ${c} */}`);
  }
}

function rootsToJsx(roots, depth) {
  const lines = [];
  const multi = roots.length !== 1;
  if (multi) lines.push(indent(depth) + "<>");
  roots.forEach(r => serializeNode(r, depth + (multi ? 1 : 0), lines));
  if (multi) lines.push(indent(depth) + "</>");
  return lines.join("\n");
}

export function sanitizeName(s) {
  let n = (s || "").replace(/[^A-Za-z0-9_$]/g, "");
  if (!n) return "";
  if (/^[0-9]/.test(n)) n = "S" + n;
  return n.charAt(0).toUpperCase() + n.slice(1);
}

function pascal(s) {
  const parts = (s || "").replace(/^[0-9]+[a-z]?\s+/i, "").replace(/[^A-Za-z0-9]+/g, " ").trim().split(/\s+/);
  const name = parts.filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join("");
  return /^[0-9]/.test(name) ? "S" + name : name;
}

function sectionName(el, i, used) {
  let base = "";
  if (el.id) base = pascal(el.id);
  else if (el.getAttribute && el.getAttribute("data-screen-label")) base = pascal(el.getAttribute("data-screen-label"));
  else if (typeof el.className === "string" && el.className.trim()) base = pascal(el.className.trim().split(/\s+/)[0]);
  if (!base) base = pascal(el.tagName) + "Section";
  if (!base) base = "Section" + (i + 1);
  let name = base, k = 2;
  while (used.has(name)) name = base + (k++);
  used.add(name);
  return name;
}

// Bare arrow component (no export) — matches the requested section style.
export function arrowComponent(name, inner) {
  return `const ${name} = () => {\n  return (\n${inner}\n  )\n}`;
}

// Standalone section file for the zip (needs an export to be importable).
export function sectionFile(name, inner) {
  return arrowComponent(name, inner) + `\n\nexport default ${name}\n`;
}

// Parent/page component. withImports=true adds `import X from './X'` lines (zip);
// false assumes the section consts live in the same file (single-file output).
export function pageCode(parentName, sections, withImports) {
  const imports = withImports
    ? sections.map(s => `import ${s.name} from './${s.name}'`).join("\n") + "\n\n"
    : "";
  const inner = "    <>\n" + sections.map(s => `      <${s.name} />`).join("\n") + "\n    </>";
  return imports + `export default function ${parentName}() {\n  return (\n${inner}\n  )\n}\n`;
}

// Returns { combined, sections, parent } — sections/parent are null when not splitting.
export function generate(html, opts) {
  const doc = new DOMParser().parseFromString(html, "text/html");

  if (opts.split) {
    const els = Array.from(doc.body.childNodes)
      .filter(n => n.nodeType === 1 && !NON_SECTION.has(n.tagName)); // drop <script>/<style>/etc.
    const used = new Set();
    const parentName = sanitizeName(opts.name || doc.title || "Page") || "Page";
    used.add(parentName);
    const sections = els.map((el, i) => ({ name: sectionName(el, i, used), inner: rootsToJsx([el], 2) }));

    // Single-file: bare section consts (no export) + page default export.
    const combined = sections.map(s => arrowComponent(s.name, s.inner)).join("\n\n") +
      "\n\n" + pageCode(parentName, sections, false);

    return { combined, sections, parent: { name: parentName } };
  }

  let roots;
  if (opts.bodyOnly) {
    roots = Array.from(doc.body.childNodes).filter(keepNode);
    if (roots.length === 0 && doc.head) roots = Array.from(doc.head.childNodes).filter(keepNode);
  } else {
    roots = Array.from(doc.documentElement.childNodes).filter(keepNode);
  }
  const depth = opts.component ? 2 : 0;
  const jsx = rootsToJsx(roots, depth);
  if (opts.component) {
    const name = sanitizeName(opts.name) || "Component";
    return { combined: arrowComponent(name, jsx) + `\n\nexport default ${name}\n`, sections: null, parent: null };
  }
  return { combined: jsx + "\n", sections: null, parent: null };
}
