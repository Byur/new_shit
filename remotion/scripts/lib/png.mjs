/**
 * Minimal, dependency-free PNG reader plus the pixel measurements used for
 * frame-level QA of rendered stills.
 *
 * There is no vision model available in this environment, so "looking at" a
 * frame means measuring it: where ink actually lands, whether anything crosses
 * the safe margins, whether a frame is empty, and how much two consecutive
 * frames differ.
 */
import fs from 'node:fs';
import zlib from 'node:zlib';

export const decodePng = (file) => {
  const buf = fs.readFileSync(file);
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error(`${file}: not a PNG`);
  let off = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idat = [];
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    off += 12 + len;
  }
  if (interlace !== 0) throw new Error('interlaced PNG not supported');
  if (bitDepth !== 8) throw new Error(`bit depth ${bitDepth} not supported`);
  const channels = {0: 1, 2: 3, 4: 2, 6: 4}[colorType];
  if (!channels) throw new Error(`colour type ${colorType} not supported`);

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(height * stride);
  let pos = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[pos++];
    const line = raw.subarray(pos, pos + stride);
    pos += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y === 0 ? null : out.subarray((y - 1) * stride, y * stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? cur[x - channels] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= channels ? prev[x - channels] : 0;
      let v = line[x];
      if (filter === 1) v = (v + a) & 255;
      else if (filter === 2) v = (v + b) & 255;
      else if (filter === 3) v = (v + ((a + b) >> 1)) & 255;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        const pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        v = (v + pred) & 255;
      } else if (filter !== 0) throw new Error(`filter ${filter} not supported`);
      cur[x] = v;
    }
  }
  return {width, height, channels, data: out};
};

export const luma = (img, x, y) => {
  const i = (y * img.width + x) * img.channels;
  const d = img.data;
  if (img.channels >= 3) return 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
  return d[i];
};

/**
 * The page background is a near-black gradient, so "ink" is defined as any
 * pixel meaningfully brighter than the darkest background value. That captures
 * text, chart furniture and coloured tags, and ignores the gradient itself.
 */
export const INK_THRESHOLD = 34;

export const analyze = (img, opts = {}) => {
  const threshold = opts.threshold ?? INK_THRESHOLD;
  const margin = opts.margin ?? 24;
  const {width, height} = img;

  let sum = 0;
  let min = 255;
  let max = 0;
  let ink = 0;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let edgeInk = 0;

  const rowInk = new Int32Array(height);
  const colInk = new Int32Array(width);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const l = luma(img, x, y);
      sum += l;
      if (l < min) min = l;
      if (l > max) max = l;
      if (l > threshold) {
        ink++;
        rowInk[y]++;
        colInk[x]++;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
        if (x < margin || y < margin || x >= width - margin || y >= height - margin) {
          edgeInk++;
        }
      }
    }
  }

  return {
    width,
    height,
    meanLuma: sum / (width * height),
    minLuma: min,
    maxLuma: max,
    inkRatio: ink / (width * height),
    inkBox: maxX < 0 ? null : {x0: minX, y0: minY, x1: maxX, y1: maxY},
    edgeInk,
    rowInk,
    colInk,
  };
};

/** Mean absolute luminance difference between two same-sized frames. */
export const frameDelta = (a, b) => {
  if (a.width !== b.width || a.height !== b.height) throw new Error('size mismatch');
  let sum = 0;
  const n = a.width * a.height;
  for (let i = 0; i < n; i++) {
    const ia = i * a.channels;
    const ib = i * b.channels;
    const la =
      0.2126 * a.data[ia] + 0.7152 * a.data[ia + 1] + 0.0722 * a.data[ia + 2];
    const lb =
      0.2126 * b.data[ib] + 0.7152 * b.data[ib + 1] + 0.0722 * b.data[ib + 2];
    sum += Math.abs(la - lb);
  }
  return sum / n;
};

/**
 * Ink coverage inside a named rectangle, used to assert that a region which
 * should carry content actually does, and that a region which should stay
 * clear is not covered by a stray element.
 */
export const regionInk = (img, rect, threshold = INK_THRESHOLD) => {
  let ink = 0;
  let total = 0;
  for (let y = rect.y0; y < rect.y1; y++) {
    for (let x = rect.x0; x < rect.x1; x++) {
      total++;
      if (luma(img, x, y) > threshold) ink++;
    }
  }
  return {ink, total, ratio: total === 0 ? 0 : ink / total};
};

/** Encode a PNG (used for contact sheets and diff images). */
export const encodePng = (width, height, rgb) => {
  const stride = width * 3;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const chunk = (type, body) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(body.length, 0);
    head.write(type, 4, 'ascii');
    const crcBuf = Buffer.concat([head.subarray(4, 8), body]);
    let crc = ~0;
    for (let i = 0; i < crcBuf.length; i++) {
      crc ^= crcBuf[i];
      for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
    const tail = Buffer.alloc(4);
    tail.writeUInt32BE((~crc) >>> 0, 0);
    return Buffer.concat([head, body, tail]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, {level: 6})),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

export const toRgb = (img) => {
  const out = Buffer.alloc(img.width * img.height * 3);
  for (let i = 0; i < img.width * img.height; i++) {
    const s = i * img.channels;
    out[i * 3] = img.data[s];
    out[i * 3 + 1] = img.channels >= 3 ? img.data[s + 1] : img.data[s];
    out[i * 3 + 2] = img.channels >= 3 ? img.data[s + 2] : img.data[s];
  }
  return out;
};
