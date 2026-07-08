const { chromium } = require('/Users/mbz/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const sanitizerSource = String.raw`
(function () {
  const ALLOWED_ELEMENTS = new Set([
    'a', 'abbr', 'address', 'article', 'aside', 'b', 'bdi', 'bdo', 'blockquote',
    'br', 'caption', 'cite', 'code', 'col', 'colgroup', 'data', 'dd', 'del',
    'details', 'dfn', 'div', 'dl', 'dt', 'em', 'figcaption', 'figure', 'footer',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'i', 'img', 'ins',
    'kbd', 'li', 'main', 'mark', 'nav', 'ol', 'p', 'pre', 'q', 'rb', 'rp',
    'rt', 'rtc', 'ruby', 's', 'samp', 'section', 'small', 'span', 'strong',
    'sub', 'summary', 'sup', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead',
    'time', 'tr', 'u', 'ul', 'var', 'wbr',
    'svg', 'g', 'defs', 'use', 'title', 'desc',
    'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'path',
    'text', 'tspan', 'textpath', 'image',
  ]);
  const HARD_DENY = new Set([
    'script', 'iframe', 'frame', 'frameset', 'object', 'embed', 'style',
    'link', 'meta', 'base', 'noscript', 'template', 'audio', 'video',
    'form', 'input', 'button', 'textarea', 'select', 'option',
    'animate', 'animatetransform', 'animatemotion', 'set',
  ]);
  const HARD_DENY_ATTRS = new Set([
    'srcdoc', 'sandbox', 'allow', 'formaction', 'background',
    'ping', 'http-equiv',
  ]);
  function isJavaScriptUrl(value) {
    if (!value) return false;
    var s = String(value);
    s = s.replace(/[\t\n\r]/g, '');
    while (s.length > 0 && s.charCodeAt(0) <= 32) s = s.slice(1);
    return s.toLowerCase().indexOf('javascript:') === 0;
  }
  function scrubUrlAttributes(el) {
    const attrs = Array.from(el.attributes);
    for (let i = 0; i < attrs.length; i++) {
      const a = attrs[i];
      const n = a.name.toLowerCase();
      if (n === 'href' || n === 'xlink:href' || n.endsWith(':href') || n === 'src') {
        if (isJavaScriptUrl(a.value)) el.removeAttribute(a.name);
      }
    }
  }
  function sanitize(root) {
    const drop = [];
    const walker = (root.ownerDocument || document).createTreeWalker(
      root, NodeFilter.SHOW_ELEMENT
    );
    let n;
    while ((n = walker.nextNode())) {
      const tag = n.tagName ? n.tagName.toLowerCase() : '';
      if (HARD_DENY.has(tag)) { drop.push(n); continue; }
      if (!ALLOWED_ELEMENTS.has(tag)) { drop.push(n); continue; }
      const attrs = Array.from(n.attributes);
      for (let i = 0; i < attrs.length; i++) {
        const a = attrs[i];
        const an = a.name.toLowerCase();
        if (an.indexOf('on') === 0) n.removeAttribute(a.name);
        else if (HARD_DENY_ATTRS.has(an)) n.removeAttribute(a.name);
      }
      scrubUrlAttributes(n);
    }
    drop.forEach(function (el) { try { el.remove(); } catch (_) {} });
  }
  window.setHTML = function setHTML(targetEl, raw) {
    const tpl = document.createElement('template');
    tpl.innerHTML = String(raw);
    sanitize(tpl.content);
    targetEl.replaceChildren(tpl.content);
  };
})();
`;

const payloads = [
  '<img src=x onerror=hit("img-onerror")>',
  '<svg onload=hit("svg-onload")></svg>',
  '<a href="javascript:hit(1)">x</a>',
  '<details open ontoggle=hit("toggle")><summary>x</summary></details>',
  '<svg><image href=x onerror=hit("svg-image-error")></image></svg>',
  '<math><mtext><table><mglyph><style><!--</style><img src=x onerror=hit("mxss1")>--></mglyph></table></mtext></math>',
  '<svg><p><style><img src=x onerror=hit("mxss2")></style></p></svg>',
  '<svg><style><!--</style><img src=x onerror=hit("mxss3")>--></svg>',
  '<svg><desc><![CDATA[</desc><img src=x onerror=hit("cdata")>]]></desc></svg>',
  '<svg><title></title><img src=x onerror=hit("svg-img")></svg>',
  '<svg><use href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 id=%22x%22 onload=%22parent.hit(`use-data-onload`)%22><rect width=%22100%22 height=%22100%22/></svg>#x"></use></svg>',
  '<svg><image href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 onload=%22parent.hit(`image-data-onload`)%22></svg>"></image></svg>',
  '<svg><use href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22><script>parent.hit(`use-data-script`)</script><rect id=%22x%22 width=%22100%22 height=%22100%22/></svg>#x"></use></svg>',
  '<svg><a href="data:text/html,<script>parent.hit(`a-data-script`)</script>">x</a></svg>',
  '<svg><a href="jav&#x0C;ascript:hit(`formfeed-js-url`)">x</a></svg>',
  '<svg><a href="jav&#x00;ascript:hit(`null-js-url`)">x</a></svg>',
  '<svg xml:base="javascript:hit(`xml-base-svg`)//"><a href="x">x</a></svg>',
  '<svg><a xml:base="javascript:hit(`xml-base-a`)//" href="x">x</a></svg>',
  '<svg xml:base="javascript:hit(`xml-base-use`)//"><use href="x"></use></svg>',
  '<svg xml:base="javascript:hit(`xml-base-image`)//"><image href="x"></image></svg>',
  '<svg xmlns:x="http://www.w3.org/1999/xlink" x:onload="hit(`prefixed-svg-onload`)"></svg>',
  '<svg><image href="x" x:onerror="hit(`prefixed-image-onerror`)" xmlns:x="urn:x"></image></svg>',
  '<svg xmlns:ev="http://www.w3.org/2001/xml-events"><rect width="10" height="10" ev:event="load" ev:handler="javascript:hit(`xml-events`)"></rect></svg>',
  '<svg><rect width="10" height="10" filter="url(javascript:hit(`filter-js`))"></rect></svg>',
  '<svg><rect width="10" height="10" style="filter:url(javascript:hit(`style-filter-js`))"></rect></svg>',
  '<svg><rect width="10" height="10" fill="url(javascript:hit(`fill-js`))"></rect></svg>',
  '<svg><rect width="10" height="10" clip-path="url(javascript:hit(`clip-js`))"></rect></svg>',
  '<svg><rect width="10" height="10" mask="url(javascript:hit(`mask-js`))"></rect></svg>',
  '<svg><rect width="10" height="10" style="background-image:url(javascript:hit(`css-bg-js`))"></rect></svg>',
  '<svg><use href="jav&#x0C;ascript:hit(`use-ff-js`)"></use></svg>',
  '<svg><image href="jav&#x0C;ascript:hit(`image-ff-js`)"></image></svg>',
  '<img src="jav&#x0C;ascript:hit(`img-ff-js`)">',
  '<svg><use href="jav&#x0B;ascript:hit(`use-vtab-js`)"></use></svg>',
  '<svg><image href="jav&#x0B;ascript:hit(`image-vtab-js`)"></image></svg>',
  '<div><template shadowrootmode="open"><img src=x onerror=hit(`dsd-img`)></template></div>',
  '<div><template shadowrootmode="open"><svg onload=hit(`dsd-svg`)></svg></template></div>',
  '<div><template shadowrootmode="open"><script>hit(`dsd-script`)</script></template></div>',
  '<svg><use href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22><g id=%22x%22><animate attributeName=%22opacity%22 from=%220%22 to=%221%22 begin=%220s%22 dur=%221s%22 onbegin=%22parent.hit(`use-data-animate-onbegin`)%22/></g></svg>#x"></use></svg>',
  '<svg><use href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22><svg id=%22x%22><animate attributeName=%22opacity%22 from=%220%22 to=%221%22 begin=%220s%22 dur=%221s%22 onbegin=%22parent.hit(`use-data-nested-animate`)%22/></svg></svg>#x"></use></svg>',
  '<svg><use href="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxnIGlkPSJ4Ij48YW5pbWF0ZSBhdHRyaWJ1dGVOYW1lPSJvcGFjaXR5IiBmcm9tPSIwIiB0bz0iMSIgYmVnaW49IjBzIiBkdXI9IjFzIiBvbmJlZ2luPSJwYXJlbnQuaGl0KCdiNjQtYW5pbWF0ZScpIi8+PC9nPjwvc3ZnPg==#x"></use></svg>',
];

(async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
  });
  const page = await browser.newPage();
  await page.setContent(`<!doctype html><meta charset="utf-8"><div id="preview"></div><script>${sanitizerSource}</script>`);

  const rows = [];
  for (const payload of payloads) {
    const row = await page.evaluate(async (payload) => {
      window.fired = false;
      window.hit = (value) => { window.fired = value || true; };
      const preview = document.getElementById('preview');
      preview.replaceChildren();
      window.setHTML(preview, payload);
      await new Promise(resolve => setTimeout(resolve, 100));
      return { payload, fired: window.fired, html: preview.innerHTML };
    }, payload);
    rows.push(row);
  }
  console.log(JSON.stringify(rows, null, 2));
  await browser.close();
})().catch(err => {
  console.error(err);
  process.exit(1);
});
