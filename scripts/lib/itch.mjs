/**
 * itch.io "name your own price" free-download flow for CC0 asset packs (no account needed).
 * The download key expires within ~90 s, so the whole flow runs in one go.
 */
export async function itchFreeDownload(pageUrl, uploadName, outFile) {
  const { writeFileSync } = await import('node:fs');
  const jar = new Map();
  const cookieHeader = () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  const remember = (res) => {
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [kv] = c.split(';');
      const i = kv.indexOf('=');
      jar.set(kv.slice(0, i), kv.slice(i + 1));
    }
  };
  const get = async (url) => {
    const res = await fetch(url, { headers: { cookie: cookieHeader() }, redirect: 'follow' });
    remember(res);
    return res;
  };
  const post = async (url, csrf) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { cookie: cookieHeader(), 'x-requested-with': 'XMLHttpRequest', 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ csrf_token: csrf }),
    });
    remember(res);
    return res.json();
  };
  const csrfOf = (html) => /csrf_token" value="([^"]+)"/.exec(html)?.[1] ?? '';
  const page = await (await get(pageUrl)).text();
  const licence = /Asset license<\/td><td><a[^>]*>([^<]+)</.exec(page)?.[1] ?? 'unknown';
  const dl = await post(`${pageUrl}/download_url`, csrfOf(page));
  if (!dl.url) throw new Error(`itch: no download url for ${pageUrl}: ${JSON.stringify(dl)}`);
  const dlPage = await (await get(dl.url)).text();
  const uploads = [...dlPage.matchAll(/data-upload_id="(\d+)"[\s\S]{0,400}?class="name">([^<]+)</g)].map((m) => ({ id: m[1], name: m[2] }));
  const upload = uploads.find((u) => u.name.includes(uploadName));
  if (!upload) throw new Error(`itch: upload "${uploadName}" not found; available: ${uploads.map((u) => u.name).join(', ')}`);
  const file = await post(`${pageUrl}/file/${upload.id}?source=game_download&after_download_lightbox=1&as_props=1`, csrfOf(dlPage));
  if (!file.url) throw new Error(`itch: no file url: ${JSON.stringify(file)}`);
  const bin = await fetch(file.url);
  if (!bin.ok) throw new Error(`itch: download failed ${bin.status}`);
  writeFileSync(outFile, Buffer.from(await bin.arrayBuffer()));
  return { licence, upload: upload.name };
}
