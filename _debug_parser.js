const fs = require('fs');
const d = fs.readFileSync('e:/git/trpg/_debug_js.txt', 'utf8');

// Load page index
let _pageIndexCache = null;
const el = d.match(/id="zm-data-em0tcGFnZS1pbmRleA__">([\s\S]*?)<\/script>/);
if (el && el[1]) {
    _pageIndexCache = JSON.parse(el[1]);
    console.log('Page index entries:', Object.keys(_pageIndexCache).length);
}

// Load markers
const m = d.match(/id="zm-data-VFJQ[^"]*">([\s\S]*?)<\/script>/);
if (m) {
    const j = JSON.parse(m[1]);
    j.markers.forEach(x => {
        const link = x.link || '';
        const tooltip = x.tooltip || '';
        console.log(`\nMarker: ${tooltip}`);
        console.log('  link value:', link);
        console.log('  has slash:', link.includes('/'));
        if (link.includes('/')) {
            console.log('  -> path norm:', '/' + link.replace(/\.md$/i, '') + '/');
        } else {
            const idx = _pageIndexCache ? _pageIndexCache[link] : 'no index';
            console.log('  -> index lookup:', idx);
        }
        
        // Also try: what if we look up by last segment
        const parts = link.split('/');
        const last = parts[parts.length - 1].replace(/\.md$/i, '');
        if (_pageIndexCache && _pageIndexCache[last]) {
            console.log('  -> index by last segment "' + last + '":', _pageIndexCache[last]);
        }
    });
}

// Verify: test if the index has correct entries
console.log('\nIndex check:');
console.log('  隅纳:', _pageIndexCache['隅纳']);
console.log('  首都:', _pageIndexCache['首都']);
console.log('  大伊甸:', _pageIndexCache['大伊甸']);
