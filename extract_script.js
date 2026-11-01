const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');
const match = content.match(/<script>([\s\S]*?)<\/script>/);
if (match) {
    fs.writeFileSync('script.js', match[1]);
}
