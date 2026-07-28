const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const root = 'e:/git/trpg/src/site/notes';
const idx = {};

function scan(d) {
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const e of entries) {
        const f = path.join(d, e.name);
        if (e.isDirectory()) {
            scan(f);
        } else if (e.name.endsWith('.md')) {
            try {
                const raw = fs.readFileSync(f, 'utf8');
                const parsed = matter(raw);
                let pl = parsed.data.permalink || '';
                if (!pl) {
                    try {
                        const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
                        if (fmMatch && fmMatch[1].trim().startsWith('{')) {
                            pl = JSON.parse(fmMatch[1].trim()).permalink || '';
                        }
                    } catch (_e) {}
                }
                if (!pl) return;
                if (!pl.startsWith('/')) pl = '/' + pl;
                if (!pl.endsWith('/')) pl += '/';

                const pageName = e.name.replace(/\.md$/i, '');
                const relPath = f
                    .replace(/\\/g, '/')
                    .replace(root.replace(/\\/g, '/'), '')
                    .replace(/^\/+/, '')
                    .replace(/\.md$/i, '');

                // Full-path index
                idx[relPath] = pl;

                // Page-name index (prefer longer permalink for duplicates)
                if (!idx[pageName] || idx[pageName].length < pl.length) {
                    idx[pageName] = pl;
                }
            } catch (_e) {}
        }
    }
}

scan(root);

// Check full-path keys
const keys = Object.keys(idx);
const fullPath23 = keys.filter(k => k.startsWith('TRPG规则/伯爵红茶/星图/'));
console.log('full-path in TRPG规则/伯爵红茶/星图/:', fullPath23);
for (const k of fullPath23) {
    console.log('  "' + k + '" -> ' + idx[k]);
}

// Page-name
console.log('\npage-name 隅纳:', idx['隅纳']);
console.log('page-name 首都:', idx['首都']);
console.log('page-name 大伊甸:', idx['大伊甸']);
console.log('\nTotal entries:', Object.keys(idx).length);

// Simulate normalizeLink
function simulateNormalize(link) {
    if (!link) return link;
    if (link.startsWith('http')) return link;
    let p = link.replace(/\.md$/i, '');
    if (p.includes('/')) {
        const normalized = p.replace(/^\/+|\/+$/g, '');
        if (idx[normalized]) return idx[normalized];
    }
    const bare = p.replace(/^\/+|\/+$/g, '');
    const pageName = bare.includes('/') ? bare.split('/').pop() : bare;
    if (idx[pageName]) return idx[pageName];
    if (!p.startsWith('/')) p = '/' + p;
    if (!p.endsWith('/') && !/\.[a-zA-Z0-9]+$/.test(p)) p += '/';
    return p;
}

console.log('\n=== normalizeLink ===');
console.log('隅纳 full-path:', simulateNormalize('TRPG规则/伯爵红茶/星图/隅纳'));
console.log('首都 short:', simulateNormalize('首都'));
console.log('大伊甸 short:', simulateNormalize('大伊甸'));
