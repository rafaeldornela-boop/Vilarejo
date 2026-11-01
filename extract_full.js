const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');
const scriptMatch = content.match(/<script>([\s\S]*?)<\/script>/);
if (scriptMatch) {
    fs.writeFileSync('script_full.js', scriptMatch[1]);
    console.log("Script extracted");
} else {
    console.log("Script not found");
}
