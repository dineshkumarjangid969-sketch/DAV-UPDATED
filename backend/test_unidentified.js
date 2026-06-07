const fs = require('fs');
const { normalizeOrderExtraction } = require('./server.js');

const rawMarkdown = `
<!-- image -->

<!-- image -->

<!-- image -->

<!-- image -->

<!-- image -->

<!-- image -->

TAPE CONTENTS 04/06/202610:39:08

40907

P/O Response 264405

Version:1

POR Status:Accepted

Response From:1507 KEVIN

HN FURNITURE WAIRAU PARK

Supplier Invoice: 5214306

GAUCHO 1E FAB BLK

Accepted

CBGCORECEFBBLK

ORD:1@

TOT:

RES:1@

TOT:

Back Ord:1

Est.Ship:

Order

Response

Total Ex.GST

Total Incl.GST

End of Report

<!-- image -->
`;

const doclings = [{
  raw_markdown: rawMarkdown,
  raw_tables: [],
  line_items: [] // assuming docling line items failed, testing the new logic
}];

const res = normalizeOrderExtraction("", "", "", "", doclings);
console.log(JSON.stringify(res.products, null, 2));
