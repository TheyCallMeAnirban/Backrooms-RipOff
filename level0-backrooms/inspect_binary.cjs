const fs = require('fs');

const buf = fs.readFileSync('level0-backrooms/asset/Creep.fbx');
console.log('FBX magic:', buf.slice(0, 23).toString('latin1'));

// Binary FBX parsing: find all property strings in the node tree
let offset = 27; // after header
const names = new Set();
const strings = [];

// Quick scanner for 7-bit ASCII strings > 3 chars
let cur = [];
for (let i = 0; i < buf.length; i++) {
  const b = buf[i];
  if (b >= 32 && b <= 126) {
    cur.push(String.fromCharCode(b));
  } else {
    if (cur.length >= 4) {
      const s = cur.join('');
      if (s.includes('Mesh') || s.includes('Geometry') || s.includes('Root') || s.includes('Hips') || s.includes('Spine') || s.includes('Arm') || s.includes('Leg')) {
        strings.push(s);
      }
    }
    cur = [];
  }
}

console.log('Sample structural tokens in binary FBX:', [...new Set(strings)].slice(0, 30));

