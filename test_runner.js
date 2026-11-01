const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('index.html', 'utf8');
const scriptCode = fs.readFileSync('script.js', 'utf8');

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  url: 'http://localhost:3000'
});

const win = dom.window;

// Executa script.js real no contexto DOM da aplicação
win.eval(scriptCode);

if (!win.VilarejoTest || typeof win.VilarejoTest.runStressTests !== 'function') {
  console.error("Erro fatal: window.VilarejoTest não foi inicializado.");
  process.exit(1);
}

const res = win.VilarejoTest.runStressTests();
console.log(`\n=== SUÍTE DE TESTES ECONÔMICOS E BANCÁRIOS (Vilarejo - script.js) ===\n`);
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
