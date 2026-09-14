const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  let file;
  try { file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname)); }
  catch { res.writeHead(400).end(); return; }
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    res.end(data);
  });
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ channel: process.env.PMCRWF_TEST_CHANNEL || undefined, headless: true });
    for (const suite of ['derived', 'effects', 'filters', 'hosting']) {
      const context = await browser.newContext();
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`http://127.0.0.1:${server.address().port}/tests/${suite}.html`);
      await page.waitForFunction(() => /\d+ passed, \d+ failed/.test(document.querySelector('#results')?.textContent), null, { timeout: 30000 });
      const result = await page.locator('#results').innerText();
      console.log(suite + ': ' + result.split('\n').filter(line => /FAIL|passed, .*failed/.test(line)).join('\n'));
      if (!/\b0 failed\b/.test(result) || errors.length) { console.error(errors); process.exitCode = 1; }
      await context.close();
    }
    const context = await browser.newContext({ acceptDownloads: true });
    const page = await context.newPage();
    const errors = [], dialogs = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', async dialog => { dialogs.push(dialog.message()); await dialog.accept(); });
    await page.goto(`http://127.0.0.1:${server.address().port}/character-sheet.html`);
    await page.locator('#score-str').waitFor();
    await page.locator('#char-name').fill('Immediate reload');
    await page.reload();
    assert.equal(await page.locator('#char-name').inputValue(), 'Immediate reload');
    const rejection = page.waitForEvent('dialog');
    await page.locator('#file-import').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{"fields":{"char-name":"Wrong"},"classes":{}}') });
    await rejection;
    assert.equal(await page.locator('#char-name').inputValue(), 'Immediate reload');
    assert(dialogs.some(message => message.includes('Could not import character')));
    await page.locator('#file-import').setInputFiles({ name: 'valid.json', mimeType: 'application/json', buffer: Buffer.from('{"fields":{"char-name":"Imported hero","score-str":"16"},"classes":[{"name":"Fighter","lvl":3}]}') });
    await page.waitForFunction(() => document.querySelector('#char-name').value === 'Imported hero');
    assert.equal(await page.locator('#score-str').inputValue(), '16');
    await page.reload();
    assert.equal(await page.locator('#char-name').inputValue(), 'Imported hero');
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#btn-export').click();
    const download = await downloadPromise;
    assert.equal(download.suggestedFilename(), 'Imported hero.json');
    assert.equal(JSON.parse(fs.readFileSync(await download.path(), 'utf8')).fields['char-name'], 'Imported hero');
    await page.locator('#btn-reset').click();
    assert.equal(await page.locator('#score-str').inputValue(), '10');
    assert.equal(await page.locator('#speed').inputValue(), '30');
    assert.equal(await page.locator('#char-size').inputValue(), 'M');

    // Hold the native reader's result until after the user selects another character.
    await page.evaluate(() => {
      const NativeReader = window.FileReader;
      window.FileReader = class extends NativeReader {
        readAsText(file) {
          const onload = this.onload;
          this.onload = event => { window.releaseImport = () => onload.call(this, event); };
          super.readAsText(file);
        }
      };
    });
    await page.locator('#file-import').setInputFiles({ name: 'slow.json', mimeType: 'application/json', buffer: Buffer.from('{"fields":{"char-name":"Wrong target"}}') });
    await page.waitForFunction(() => typeof window.releaseImport === 'function');
    await page.evaluate(() => { addCharacter({ fields: { 'char-name': 'Other hero' } }); window.releaseImport(); });
    assert.equal(await page.locator('#char-name').inputValue(), 'Other hero');
    assert(dialogs.some(message => message.includes('active character changed')));
    await page.evaluate(() => {
      document.querySelector('#char-name').value = 'Hidden save'; scheduleSave();
      Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
      delete document.visibilityState;
    });
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('charsheet-roster')).chars.find(c => c.id === ROSTER.activeId).state.fields['char-name']), 'Hidden save');
    assert.deepEqual(errors, []);
    console.log('Full app: import/rejection, reload persistence, export download, reset, delayed import switching, and hidden-tab save passed; no browser errors.');
    await context.close();
  } finally { await browser?.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
