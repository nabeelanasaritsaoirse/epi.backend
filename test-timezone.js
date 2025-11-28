/**
 * Quick script to test server timezone
 * Run this to verify timezone is set correctly
 */

console.log('\n🕐 Server Timezone Information:\n');
console.log('Current Date (Server):', new Date());
console.log('Timezone String:', Intl.DateTimeFormat().resolvedOptions().timeZone);
console.log('Timezone Offset:', new Date().getTimezoneOffset() / -60, 'hours from UTC');
console.log('\nExpected for India:');
console.log('  - Timezone: Asia/Kolkata or Asia/Calcutta');
console.log('  - Offset: +5.5 hours from UTC (IST)');
console.log('\nCurrent Time in Different Formats:');
console.log('  - ISO:', new Date().toISOString());
console.log('  - Local String:', new Date().toLocaleString());
console.log('  - India String:', new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
console.log('\n');

// Test midnight calculation
const today = new Date();
today.setHours(0, 0, 0, 0);
const tomorrow = new Date(today);
tomorrow.setDate(tomorrow.getDate() + 1);

console.log('Today Midnight (00:00:00):', today.toISOString());
console.log('Tomorrow Midnight (00:00:00):', tomorrow.toISOString());
console.log('\n');
