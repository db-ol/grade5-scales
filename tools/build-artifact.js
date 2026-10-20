// Builds a single self contained page (CSS, JS and fonts inlined) for a claude.ai artifact preview.
// Usage: node tools/build-artifact.js <output.html>
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = process.argv[2];
if (!out) {
  console.error('Usage: node tools/build-artifact.js <output.html>');
  process.exit(1);
}

const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const html = read('index.html');

let css = read('css/style.css').replace(/url\("\.\.\/fonts\/([^"]+)"\)/g, (_, file) => {
  const data = fs.readFileSync(path.join(root, 'fonts', file)).toString('base64');
  return `url("data:font/woff2;base64,${data}")`;
});

const title = (html.match(/<title>[\s\S]*?<\/title>/) || [''])[0];
const body = (html.match(/<body[^>]*>([\s\S]*)<\/body>/) || [])[1];
if (!body) throw new Error('index.html has no <body>');

// Inline every local script in order, drop everything that only matters on GitHub Pages.
const scripts = [...body.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
const inlineScripts = scripts
  .map(src => `<script>\n${read(src).replace(/<\/script/gi, '<\\/script')}\n</script>`)
  .join('\n');
const bodyNoScripts = body.replace(/<script src="[^"]+"><\/script>\s*/g, '');

const page = [
  title,
  '<meta name="claude:viewport-fit-sides" content="cover">',
  `<style>\n${css}\n</style>`,
  bodyNoScripts.trim(),
  inlineScripts
].join('\n');

fs.writeFileSync(out, page);
console.log(`Wrote ${out} (${(page.length / 1024).toFixed(0)} KB, ${scripts.length} scripts inlined)`);
