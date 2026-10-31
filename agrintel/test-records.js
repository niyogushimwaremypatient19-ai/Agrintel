const { ECONOMETRIC_AUDIT_DATA, getLatestAuditRecords, getAuditRecordsForCrop } = require('./src/lib/data/econometric-audit.ts');

console.log('Total audit records:', ECONOMETRIC_AUDIT_DATA.length);
console.log('Latest audit records:', getLatestAuditRecords().length);
console.log('Records for "banana":', getAuditRecordsForCrop('banana').length);
console.log('Records for "BANANA":', getAuditRecordsForCrop('BANANA').length);
console.log('Records for "dry_beans":', getAuditRecordsForCrop('dry_beans').length);
console.log('Records for "BEAN":', getAuditRecordsForCrop('BEAN').length);

const sampleLatest = getLatestAuditRecords();
console.log('Sample latest record:', sampleLatest[0]);
