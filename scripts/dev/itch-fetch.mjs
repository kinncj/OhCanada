import { itchFreeDownload } from '../lib/itch.mjs';
const [page, name, out] = process.argv.slice(2);
console.log(await itchFreeDownload(page, name, out));
