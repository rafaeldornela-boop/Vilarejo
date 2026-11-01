const fs = require('fs');
const content = fs.readFileSync('index.html', 'utf8');
const match = content.match(/<script>(.*?)<\/script>/s);
if (match) {
    try {
        new Function(match[1]);
        console.log("Syntax is OK");
    } catch (e) {
        console.log("Syntax Error: " + e.message);
    }
} else {
    console.log("Script tag not found");
}
