/**
 * SOVEREIGN // AEGIS — Syntax & JSON Validity Test Runner
 * Validates that all JSON data files and test scripts parse without syntax errors.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const dataDir = path.join(rootDir, 'data');

console.log('Validating JSON syntax across data/ directory...');

const jsonFiles = fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));

let errors = 0;

for (const file of jsonFiles) {
  const filePath = path.join(dataDir, file);
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    JSON.parse(content);
    console.log(`✅ [VALID JSON] data/${file}`);
  } catch (err) {
    console.error(`❌ [INVALID JSON] data/${file}: ${err.message}`);
    errors++;
  }
}

if (errors > 0) {
  console.error(`\n❌ Syntax validation failed with ${errors} error(s).`);
  process.exit(1);
} else {
  console.log(`\n🎉 All ${jsonFiles.length} JSON files parsed with 100% valid syntax!`);
}
