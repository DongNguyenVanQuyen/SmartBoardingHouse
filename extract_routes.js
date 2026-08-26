
const fs = require("fs");
const path = require("path");

const routesDir = path.join(__dirname, "src", "routes");
const files = fs.readdirSync(routesDir);

let output = "# Chi Ti?t ??y ?? C¨¢c API Routes\n\n";

files.forEach(file => {
  const filePath = path.join(routesDir, file);
  const content = fs.readFileSync(filePath, "utf-8");
  
  output += `## File: \`${file}\`\n\n`;
  
  const regex = /router\.(get|post|put|patch|delete)\(\s*(["\047`])(.*?)\2\s*,\s*(.*?)\)/g;
  let match;
  let count = 0;
  while ((match = regex.exec(content)) !== null) {
    const method = match[1].toUpperCase();
    const route = match[3];
    const handlers = match[4].replace(/[\r\n\s]+/g, " ");
    output += `- **${method}** \`${route}\`\n  - Handlers: \`${handlers}\`\n`;
    count++;
  }
  if (count === 0) {
    output += "- Kh?ng t¨¬m th?y route n¨¤o theo c?u tr¨²c chu?n.\n";
  }
  output += "\n";
});

fs.writeFileSync(path.join(__dirname, "routes_dump.md"), output);
console.log("Done");

