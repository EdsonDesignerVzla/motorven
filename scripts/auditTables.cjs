const fs = require('fs');
const content = fs.readFileSync('src/services/pdfReportService.js', 'utf8');

const regex = /autoTable\(\s*(\w+\.?\w*),\s*\{([\s\S]*?)\n\s*\}\);/g;
let match;
let count = 0;
const issues = [];

while ((match = regex.exec(content)) !== null) {
  count++;
  const tableConfig = match[2];
  const hasTop = /margin:\s*\{[^}]*top:\s*22/.test(tableConfig);
  const hasBottom = /margin:\s*\{[^}]*bottom:\s*26/.test(tableConfig);
  
  const colMatches = [...tableConfig.matchAll(/cellWidth:\s*([\d\.]+)/g)];
  let totalWidth = 0;
  for (const cm of colMatches) {
    totalWidth += parseFloat(cm[1]);
  }
  
  const isWidthValid = colMatches.length === 0 || (totalWidth >= 170 && totalWidth <= 180.5);
  
  if (!hasTop || !hasBottom || (colMatches.length > 0 && !isWidthValid)) {
    issues.push({
      tableIndex: count,
      hasTop,
      hasBottom,
      totalWidth: totalWidth.toFixed(1)
    });
  }
  
  console.log(`Table ${count}: hasTop=${hasTop}, hasBottom=${hasBottom}, sumCellWidths=${totalWidth.toFixed(1)} mm`);
}

console.log(`\nAudit complete: ${count} tables scanned. Issues found: ${issues.length}`);
if (issues.length > 0) {
  console.log('Issues:', JSON.stringify(issues, null, 2));
}
