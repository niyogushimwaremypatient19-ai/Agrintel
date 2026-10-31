const fs = require('fs');

// Read econometric-audit.ts and extract ECONOMETRIC_AUDIT_DATA
const content = fs.readFileSync('./src/lib/data/econometric-audit.ts', 'utf8');
const start = content.indexOf('export const ECONOMETRIC_AUDIT_DATA: DistrictAuditRecord[] = [');
const end = content.indexOf('];\n\nexport function getAuditRecordsForDistrict');
const jsonStr = content.substring(start + 'export const ECONOMETRIC_AUDIT_DATA: DistrictAuditRecord[] = '.length, end + 1);

const data = JSON.parse(jsonStr);
console.log('Parsed data count:', data.length);

function getAuditRecordsForCrop(commodityCode) {
  const norm = commodityCode.toUpperCase().replace(/\s+/g, '_');
  return data.filter((r) => r.commodity_code === norm || r.commodity_code === commodityCode);
}

function getLatestAuditRecords() {
  const latestMap = new Map();
  for (const record of data) {
    const key = `${record.district_code}_${record.commodity_code}`;
    const existing = latestMap.get(key);
    if (!existing || record.period_start > existing.period_start) {
      latestMap.set(key, record);
    }
  }
  return Array.from(latestMap.values());
}

console.log('banana (lowercase):', getAuditRecordsForCrop('banana').length);
console.log('BANANA:', getAuditRecordsForCrop('BANANA').length);
console.log('latest records:', getLatestAuditRecords().length);
