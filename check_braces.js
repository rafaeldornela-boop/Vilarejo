const fs = require('fs');
const content = fs.readFileSync('script_all.js', 'utf8');
let braces = 0;
for (let char of content) {
    if (char === '{') braces++;
    else if (char === '}') braces--;
}
console.log("Brace balance:", braces);
