// database/migrations/run.js
// Script separado pra rodar migrations manualmente: `npm run migrate`

const { runMigrations, seedData } = require('./migrations');

console.log('=== Float DB Migration ===');
runMigrations();
seedData();
console.log('=== Done ===');
process.exit(0);
