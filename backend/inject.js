const fs = require('fs');
let code = fs.readFileSync('docling-service/app.py', 'utf8');

const classMatch = 'class DoclingParser:';
if (!code.includes(classMatch)) {
    console.log('DoclingParser not found');
    process.exit(1);
}

const cleanMethod = `
    def _clean_line_items(self, result: Dict):
        '''Scrubs unwanted metadata (SKU, dimensions, Qty, Allocated by) from product descriptions.'''
        for item in result.get('line_items', []):
            desc = item.get('description', '')
            if not desc:
                continue
            
            # Remove dimensions like 150x200 or 1500 X 2000
            desc = re.sub(r'\\b\\d{2,4}\\s*[xX]\\s*\\d{2,4}\\b', '', desc)
            
            # Remove explicit SKU from description if we know it
            sku = item.get('sku', '')
            if sku and sku in desc:
                desc = desc.replace(sku, '')
            
            # Specific user request: 'AUBURN CNR PC FAB L/G' should not have 'allocated by' etc
            desc = re.sub(r'(?i)\\b(?:allocated|alloc)\\s+by.*$', '', desc)
            desc = re.sub(r'(?i)\\bqty\\b\\s*\\d*', '', desc)
            
            # Remove explicit pricing or trailing numbers
            desc = re.sub(r'(?i)\\$?\\d+\\.\\d{2}.*$', '', desc)
            
            # Clean up SQU code references (sometimes spelled SQU or SKU)
            desc = re.sub(r'(?i)\\b(?:SQU|SKU)\\s*code\\s*[:\\-]?\\s*[A-Z0-9\\-]+', '', desc)
            
            item['description'] = desc.strip(' -,\\t\\n\\r')
`;

code = code.replace(classMatch, classMatch + '\n' + cleanMethod);

const targetCall = '        self._calculate_billing_and_location(result)';
if (code.includes(targetCall)) {
    code = code.replace(targetCall, targetCall + '\n        self._clean_line_items(result)');
}

fs.writeFileSync('docling-service/app.py', code, 'utf8');
console.log('Successfully injected _clean_line_items into app.py!');
