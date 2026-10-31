const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('Vilarejo_simulacao_economica_v2.html', 'utf8');
const dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable', url: 'http://localhost:3000' });
setTimeout(() => {
  const win = dom.window;
  const res = win.VilarejoTest.runStressTests();
  console.log(`Passed: ${res.passed} / ${res.total}`);
  if (res.passed !== res.total) {
    res.results.forEach(r => { if (!r.passed) console.log('FAILED:', r.name, JSON.stringify(r.detail || r.error)); });
    process.exit(1);
  }
}, 500);
