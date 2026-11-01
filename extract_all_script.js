const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');
const scriptMatch = content.match(/<script>([\s\S]*)<\/script>/);
if (scriptMatch) {
    fs.writeFileSync('script_all.js', scriptMatch[1]);
}
