const fs = require('fs');
const content = fs.readFileSync('./src/lib/data/econometric-audit.ts', 'utf8');
const lines = content.split('\n');
const codes = new Set();
for (const line of lines) {
  const match = line.match(/"commodity_code":\s*"([^"]+)"/);
  if (match) codes.add(match[1]);
}
console.log('Audit commodity codes:', Array.from(codes));
