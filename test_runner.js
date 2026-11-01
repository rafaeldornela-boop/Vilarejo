const fs = require('fs');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync('index.html', 'utf8');
const dom = new JSDOM(html, { runScripts: 'dangerously', resources: 'usable', url: 'http://localhost:3000' });
setTimeout(() => {
  const win = dom.window;
  console.log("Window is", !!win);
  const res = win.VilarejoTest.runStressTests();
  console.log(`\n=== SUÍTE DE TESTES ECONÔMICOS E BANCÁRIOS (Vilarejo - index.html) ===\n`);
  res.results.forEach(r => {
    if (r.passed) {
      console.log(`  ✓ ${r.name}`);
    } else {
      console.log(`  ✗ ${r.name}: ${JSON.stringify(r.detail || r.error)}`);
    }
  });
  console.log(`\nResultado Final: ${res.passed} / ${res.total} testes aprovados.\n`);
  if (res.passed !== res.total) {
    process.exit(1);
  }
}, 2000);

