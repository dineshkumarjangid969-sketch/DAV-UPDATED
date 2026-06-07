const { extractComingFrom, extractDestination } = require('./server.js');

const subject = 'Fwd: BT Invoice#3831158';
const from = 'Singh, Ninder <Ninder.Singh@nz.harveynorman.com>';
const body = 'Could you please organise attached from Mt Wellington.\n\nThanks\n\n\nBest Regards,\nNinder Singh\nPorirua | Furniture Proprietor\n*T: **04 230 6100*\n*E: **ninder.singh@nz.harveynorman.com* <chris.whiteman@nz.harveynorman.com>';

const combined = `[SUBJECT] ${subject}\n[FROM] ${from}\n[BODY] ${body}`;

console.log('ComingFrom:', extractComingFrom(combined));
console.log('Destination:', extractDestination(combined));
