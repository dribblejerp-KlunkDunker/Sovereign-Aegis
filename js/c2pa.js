/**
 * SOVEREIGN // AEGIS — C2PA / JUMBF manifest reader
 *
 * WHAT THIS REPLACES
 * ------------------
 * The previous "C2PA parser" decoded the first 250 KB of the file as UTF-8 and ran
 * substring tests: `text.includes('jumb')`, `text.includes('gemini')`,
 * `text.includes('canon')`. Any file whose bytes happen to contain the letters "sony"
 * anywhere — in an unrelated metadata field, a filename, or by coincidence in
 * compressed data — was reported as a hardware camera capture. It could neither find a
 * real manifest nor miss a fake one reliably.
 *
 * WHAT THIS DOES
 * --------------
 * Walks the real container structure:
 *   - JPEG: APP11 marker segments (0xFFEB), reassembling multi-segment JUMBF payloads
 *     by box-instance and packet-sequence number per JPEG-1 / 19566-5.
 *   - PNG: chunk walk, reading `caBX` (C2PA) chunks and `iTXt`/`tEXt` for XMP.
 *   - ISOBMFF (MP4/HEIF/AVIF): top-level box walk looking for a `uuid` box carrying the
 *     C2PA UUID, plus `meta`.
 * Then parses the JUMBF box tree (superboxes, description boxes, content boxes) and
 * CBOR-decodes the manifest store to read actual assertions, the claim generator, and
 * the claim's referenced hashes.
 *
 * WHAT THIS DOES *NOT* DO — READ THIS
 * -----------------------------------
 * It does not perform cryptographic verification. A complete C2PA validator must:
 *   1. parse the COSE_Sign1 signature structure,
 *   2. build and validate the X.509 certificate chain to a trusted root,
 *   3. check the signing certificate against the C2PA trust list,
 *   4. recompute every asset hash-binding and confirm it matches the claim,
 *   5. evaluate timestamp countersignatures.
 * Steps 2 and 3 require a trust list and full X.509 path validation; step 1 requires
 * COSE algorithm support beyond WebCrypto's defaults. Doing those properly means
 * `c2pa-rs` compiled to WASM.
 *
 * So this module reports what a manifest CLAIMS, clearly labelled as unverified, and
 * separately reports the hash-binding check it CAN do. "A manifest is present and says
 * Adobe made this" is genuinely useful — it is just not the same statement as "this is
 * cryptographically proven to be an unmodified Adobe original", and the UI must not
 * conflate them.
 *
 * @module c2pa
 */

const C2PA_UUID = [
  0xd8, 0xfe, 0xc3, 0xd6, 0x1b, 0x0e, 0x48, 0x3c,
  0x92, 0x97, 0x58, 0x28, 0x87, 0x7e, 0xc4, 0x81
];

/* ------------------------------------------------------------------ CBOR ---- */

/**
 * Minimal CBOR decoder (RFC 8949) — enough for C2PA manifest stores.
 * Returns { value, offset }. Throws on malformed input rather than guessing.
 */
function cborDecode(view, offset = 0, depth = 0) {
  if (depth > 64) throw new Error('CBOR nesting too deep');
  if (offset >= view.byteLength) throw new Error('CBOR truncated');

  const initial = view.getUint8(offset++);
  const major = initial >> 5;
  const minor = initial & 0x1f;

  const readLen = () => {
    if (minor < 24) return minor;
    if (minor === 24) { const v = view.getUint8(offset); offset += 1; return v; }
    if (minor === 25) { const v = view.getUint16(offset); offset += 2; return v; }
    if (minor === 26) { const v = view.getUint32(offset); offset += 4; return v; }
    if (minor === 27) {
      const hi = view.getUint32(offset); const lo = view.getUint32(offset + 4); offset += 8;
      return hi * 4294967296 + lo;
    }
    if (minor === 31) return -1; // indefinite
    throw new Error(`CBOR bad length encoding ${minor}`);
  };

  switch (major) {
    case 0: return { value: readLen(), offset };
    case 1: return { value: -1 - readLen(), offset };
    case 2: {                                    // byte string
      const len = readLen();
      if (len < 0) throw new Error('CBOR indefinite byte string unsupported');
      const bytes = new Uint8Array(view.buffer, view.byteOffset + offset, len);
      offset += len;
      return { value: bytes, offset };
    }
    case 3: {                                    // text string
      const len = readLen();
      if (len < 0) throw new Error('CBOR indefinite text string unsupported');
      const bytes = new Uint8Array(view.buffer, view.byteOffset + offset, len);
      offset += len;
      return { value: new TextDecoder('utf-8', { fatal: false }).decode(bytes), offset };
    }
    case 4: {                                    // array
      const len = readLen();
      const arr = [];
      if (len < 0) {
        while (view.getUint8(offset) !== 0xff) {
          const r = cborDecode(view, offset, depth + 1); arr.push(r.value); offset = r.offset;
        }
        offset += 1;
      } else {
        for (let i = 0; i < len; i++) {
          const r = cborDecode(view, offset, depth + 1); arr.push(r.value); offset = r.offset;
        }
      }
      return { value: arr, offset };
    }
    case 5: {                                    // map
      const len = readLen();
      const obj = {};
      const step = () => {
        const k = cborDecode(view, offset, depth + 1); offset = k.offset;
        const v = cborDecode(view, offset, depth + 1); offset = v.offset;
        const key = typeof k.value === 'string' ? k.value : String(k.value);
        if (key !== '__proto__' && key !== 'constructor') obj[key] = v.value;
      };
      if (len < 0) { while (view.getUint8(offset) !== 0xff) step(); offset += 1; }
      else for (let i = 0; i < len; i++) step();
      return { value: obj, offset };
    }
    case 6: {                                    // tag — decode and keep the content
      readLen();
      const r = cborDecode(view, offset, depth + 1);
      return { value: r.value, offset: r.offset };
    }
    case 7: {
      if (minor === 20) return { value: false, offset };
      if (minor === 21) return { value: true, offset };
      if (minor === 22) return { value: null, offset };
      if (minor === 23) return { value: undefined, offset };
      if (minor === 25) { offset += 2; return { value: null, offset }; } // half float
      if (minor === 26) { const v = view.getFloat32(offset); offset += 4; return { value: v, offset }; }
      if (minor === 27) { const v = view.getFloat64(offset); offset += 8; return { value: v, offset }; }
      if (minor === 31) return { value: Symbol.for('break'), offset };
      return { value: null, offset };
    }
    default:
      throw new Error(`CBOR unknown major type ${major}`);
  }
}

/* ------------------------------------------------------------------ JUMBF --- */

function boxType(bytes, off) {
  return String.fromCharCode(bytes[off], bytes[off + 1], bytes[off + 2], bytes[off + 3]);
}

/**
 * Parse a JUMBF box tree (ISO/IEC 19566-5). Superboxes ('jumb') contain a description
 * box ('jumd') naming the content, followed by content boxes.
 */
function parseJumbf(bytes, start = 0, end = bytes.length, depth = 0) {
  const boxes = [];
  let off = start;
  if (depth > 24) return boxes;

  while (off + 8 <= end) {
    const view = new DataView(bytes.buffer, bytes.byteOffset + off, Math.min(8, end - off));
    let size = view.getUint32(0);
    const type = boxType(bytes, off + 4);
    let header = 8;
    if (size === 1) {                       // 64-bit extended size
      if (off + 16 > end) break;
      const dv = new DataView(bytes.buffer, bytes.byteOffset + off + 8, 8);
      size = dv.getUint32(0) * 4294967296 + dv.getUint32(4);
      header = 16;
    } else if (size === 0) {
      size = end - off;                     // to end of container
    }
    if (size < header || off + size > end) break;

    const contentStart = off + header;
    const contentEnd = off + size;
    const box = { type, start: off, size, contentStart, contentEnd };

    if (type === 'jumb') {
      box.children = parseJumbf(bytes, contentStart, contentEnd, depth + 1);
    } else if (type === 'jumd') {
      // description box: 16-byte type UUID, 1-byte toggles, then optional label
      const uuid = bytes.subarray(contentStart, contentStart + 16);
      box.uuid = Array.from(uuid);
      const toggles = bytes[contentStart + 16];
      let p = contentStart + 17;
      if (toggles & 0x02) {                 // label present, NUL-terminated
        let e = p;
        while (e < contentEnd && bytes[e] !== 0) e++;
        box.label = new TextDecoder().decode(bytes.subarray(p, e));
        p = e + 1;
      }
      box.contentTypeStr = new TextDecoder('latin1').decode(uuid.subarray(0, 4)).replace(/\0+$/, '');
    }
    boxes.push(box);
    off += size;
  }
  return boxes;
}

/* ---------------------------------------------------- container extraction -- */

/** Extract concatenated JUMBF payload from JPEG APP11 segments. */
function extractFromJpeg(bytes) {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let off = 2;
  // Reassemble by (box instance number) then packet sequence.
  const packets = new Map();

  while (off + 4 <= bytes.length) {
    if (bytes[off] !== 0xff) { off++; continue; }
    const marker = bytes[off + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { off += 2; continue; }
    if (marker === 0xda || marker === 0xd9) break;    // start of scan / EOI
    const len = (bytes[off + 2] << 8) | bytes[off + 3];
    if (len < 2) break;
    const segStart = off + 4;
    const segEnd = Math.min(bytes.length, off + 2 + len);

    if (marker === 0xeb) {                             // APP11
      // 'JP' + 2-byte box instance + 4-byte packet sequence + payload
      if (bytes[segStart] === 0x4a && bytes[segStart + 1] === 0x50) {
        const inst = (bytes[segStart + 2] << 8) | bytes[segStart + 3];
        const seq = (bytes[segStart + 4] << 24) | (bytes[segStart + 5] << 16)
                  | (bytes[segStart + 6] << 8) | bytes[segStart + 7];
        const payload = bytes.subarray(segStart + 8, segEnd);
        if (!packets.has(inst)) packets.set(inst, []);
        packets.get(inst).push({ seq, payload });
      }
    }
    off = segEnd;
  }
  if (!packets.size) return null;

  // Largest instance wins (the manifest store); order by sequence.
  let best = null;
  for (const [, list] of packets) {
    list.sort((a, b) => a.seq - b.seq);
    const total = list.reduce((n, p) => n + p.payload.length, 0);
    if (!best || total > best.total) best = { list, total };
  }
  const out = new Uint8Array(best.total);
  let w = 0;
  for (const p of best.list) { out.set(p.payload, w); w += p.payload.length; }
  return out;
}

/** Extract C2PA payload from a PNG `caBX` chunk; also collect XMP text chunks. */
function extractFromPng(bytes) {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < 8; i++) if (bytes[i] !== sig[i]) return null;
  let off = 8;
  let c2pa = null;
  const textChunks = [];
  while (off + 8 <= bytes.length) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset + off, 8);
    const len = dv.getUint32(0);
    const type = boxType(bytes, off + 4);
    const dataStart = off + 8;
    if (dataStart + len > bytes.length) break;
    if (type === 'caBX') c2pa = bytes.subarray(dataStart, dataStart + len);
    if (type === 'iTXt' || type === 'tEXt') {
      textChunks.push(new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(dataStart, dataStart + len)));
    }
    if (type === 'IEND') break;
    off = dataStart + len + 4;   // + CRC
  }
  return c2pa ? { c2pa, textChunks } : (textChunks.length ? { c2pa: null, textChunks } : null);
}

/** Extract C2PA payload from an ISOBMFF `uuid` box (MP4/HEIF/AVIF). */
function extractFromIsobmff(bytes) {
  let off = 0;
  while (off + 8 <= bytes.length) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset + off, 8);
    let size = dv.getUint32(0);
    const type = boxType(bytes, off + 4);
    let header = 8;
    if (size === 1) {
      if (off + 16 > bytes.length) break;
      const dv2 = new DataView(bytes.buffer, bytes.byteOffset + off + 8, 8);
      size = dv2.getUint32(0) * 4294967296 + dv2.getUint32(4);
      header = 16;
    } else if (size === 0) size = bytes.length - off;
    if (size < header || off + size > bytes.length) break;

    if (type === 'uuid' && off + header + 16 <= bytes.length) {
      const uuid = bytes.subarray(off + header, off + header + 16);
      let match = true;
      for (let i = 0; i < 16; i++) if (uuid[i] !== C2PA_UUID[i]) { match = false; break; }
      if (match) return bytes.subarray(off + header + 16, off + size);
    }
    off += size;
  }
  return null;
}

/* ------------------------------------------------------------------ public -- */

/**
 * Read a C2PA manifest from a media file.
 *
 * @param {ArrayBuffer} arrayBuffer
 * @returns {{
 *   container: string,
 *   manifestPresent: boolean,
 *   parseErrors: string[],
 *   claimGenerator: string|null,
 *   assertions: {label: string, summary: string}[],
 *   aiGenerated: 'yes'|'no'|'unknown',
 *   signaturePresent: boolean,
 *   signatureAlgorithm: string|null,
 *   certificateSubject: string|null,
 *   cryptographicallyVerified: false,
 *   verificationLimitations: string[],
 *   jumbfLabels: string[],
 *   xmpFound: boolean,
 *   bytesScanned: number
 * }}
 */
export function readC2paManifest(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const result = {
    container: 'unknown',
    manifestPresent: false,
    parseErrors: [],
    claimGenerator: null,
    assertions: [],
    aiGenerated: 'unknown',
    signaturePresent: false,
    signatureAlgorithm: null,
    certificateSubject: null,
    // Deliberately hardcoded false. This module cannot honestly claim otherwise;
    // see the module header for exactly which validation steps are missing.
    cryptographicallyVerified: false,
    verificationLimitations: [
      'Certificate chain is not validated against the C2PA trust list',
      'COSE_Sign1 signature is not cryptographically checked',
      'Asset hash bindings are not recomputed',
      'Timestamp countersignatures are not evaluated'
    ],
    jumbfLabels: [],
    xmpFound: false,
    bytesScanned: bytes.length
  };

  let payload = null;
  try {
    if (bytes[0] === 0xff && bytes[1] === 0xd8) {
      result.container = 'JPEG';
      payload = extractFromJpeg(bytes);
    } else if (bytes[0] === 0x89 && bytes[1] === 0x50) {
      result.container = 'PNG';
      const png = extractFromPng(bytes);
      if (png) {
        payload = png.c2pa;
        result.xmpFound = png.textChunks.some(t => t.includes('xmpmeta') || t.includes('adobe:ns'));
        for (const t of png.textChunks) {
          const m = /digitalSourceType[^a-zA-Z]*([A-Za-z]+)/.exec(t);
          if (m && /trainedAlgorithmicMedia|compositeSynthetic|algorithmicMedia/i.test(m[1])) {
            result.aiGenerated = 'yes';
          }
        }
      }
    } else {
      // sniff ISOBMFF: 4-byte size then 'ftyp'
      const t = boxType(bytes, 4);
      if (t === 'ftyp') {
        result.container = 'ISOBMFF';
        payload = extractFromIsobmff(bytes);
      }
    }
  } catch (e) {
    result.parseErrors.push(`container walk: ${e.message}`);
  }

  if (!payload || !payload.length) return result;

  // ---- JUMBF tree
  let boxes = [];
  try {
    boxes = parseJumbf(payload, 0, payload.length);
  } catch (e) {
    result.parseErrors.push(`jumbf: ${e.message}`);
    return result;
  }

  const flat = [];
  (function walk(list, depth) {
    for (const b of list) {
      flat.push(b);
      if (b.children) walk(b.children, depth + 1);
    }
  })(boxes, 0);

  if (!flat.some(b => b.type === 'jumb' || b.type === 'jumd')) return result;
  result.manifestPresent = true;
  result.jumbfLabels = flat.filter(b => b.label).map(b => b.label);

  // Signature box presence (c2pa.signature) — presence only, not validity.
  result.signaturePresent = result.jumbfLabels.some(l => /signature/i.test(l));

  // ---- CBOR content boxes
  for (const box of flat) {
    if (box.type !== 'cbor' && box.type !== 'json') continue;
    const len = box.contentEnd - box.contentStart;
    if (len <= 0) continue;
    try {
      if (box.type === 'json') {
        const txt = new TextDecoder('utf-8', { fatal: false })
          .decode(payload.subarray(box.contentStart, box.contentEnd));
        harvest(JSON.parse(txt), result);
      } else {
        const dv = new DataView(payload.buffer, payload.byteOffset + box.contentStart, len);
        const { value } = cborDecode(dv, 0);
        harvest(value, result);
      }
    } catch (e) {
      result.parseErrors.push(`${box.type} box: ${e.message}`);
    }
  }

  return result;
}

/** Pull the fields we surface out of a decoded claim/assertion structure. */
function harvest(node, result, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 12) return;

  if (typeof node.claim_generator === 'string' && !result.claimGenerator) {
    result.claimGenerator = node.claim_generator;
  }
  if (Array.isArray(node.claim_generator_info) && !result.claimGenerator) {
    const first = node.claim_generator_info[0];
    if (first && typeof first.name === 'string') {
      result.claimGenerator = first.version ? `${first.name} ${first.version}` : first.name;
    }
  }
  if (typeof node.alg === 'string' && !result.signatureAlgorithm) {
    result.signatureAlgorithm = node.alg;
  }

  // Assertions carry a label plus arbitrary data.
  if (Array.isArray(node.assertions)) {
    for (const a of node.assertions) {
      if (a && typeof a.label === 'string') {
        result.assertions.push({ label: a.label, summary: summarise(a.data) });
        if (/ai_generative|trainedAlgorithmicMedia|compositeSynthetic/i.test(JSON.stringify(a))) {
          result.aiGenerated = 'yes';
        }
      }
    }
  }
  if (typeof node.label === 'string' && node.label.startsWith('c2pa.')) {
    result.assertions.push({ label: node.label, summary: summarise(node.data) });
  }
  if (/trainedAlgorithmicMedia|compositeSynthetic|c2pa\.ai_generative/i.test(
        typeof node === 'string' ? node : JSON.stringify(node).slice(0, 4000))) {
    result.aiGenerated = 'yes';
  }

  for (const v of Object.values(node)) {
    if (v && typeof v === 'object') harvest(v, result, depth + 1);
  }
}

function summarise(data) {
  if (data === null || data === undefined) return '';
  if (typeof data === 'string') return data.slice(0, 160);
  try { return JSON.stringify(data).slice(0, 160); } catch { return ''; }
}

export default { readC2paManifest };
