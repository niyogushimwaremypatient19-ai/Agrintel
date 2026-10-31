const fs = require('fs');

// Test case sensitivity
console.log('Testing case mapping:');
const crops = ['banana', 'dry_beans', 'irish_potatoes', 'maize', 'cassava', 'rice', 'tomatoes'];
const mapping = {
  banana: 'BANANA',
  dry_beans: 'BEAN',
  irish_potatoes: 'IRISH_POTATO',
  maize: 'MAIZE',
  cassava: 'CASSAVA',
  rice: 'RICE',
  tomatoes: 'TOMATO',
};

// Check getAuditRecordsForCrop in econometric-audit.ts:
const code = fs.readFileSync('./src/lib/data/econometric-audit.ts', 'utf8');
// Let's see what getAuditRecordsForCrop does
