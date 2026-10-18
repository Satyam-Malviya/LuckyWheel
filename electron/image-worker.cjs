const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { PDFDocument } = require('pdf-lib');

async function runImageTask() {
  const payloadJson = process.argv[2];
  if (!payloadJson) process.exit(1);
  const { task, filePath, files, outPath, actionId, options = {} } = JSON.parse(payloadJson);

  if (task === 'createPDF') {
    const pdfDoc = await PDFDocument.create();
    for (const f of files) {
      const pngBuffer = await sharp(f).png().toBuffer();
      const metadata = await sharp(pngBuffer).metadata();
      const img = await pdfDoc.embedPng(pngBuffer);
      const page = pdfDoc.addPage([metadata.width || 800, metadata.height || 1000]);
      page.drawImage(img, { x: 0, y: 0, width: metadata.width || 800, height: metadata.height || 1000 });
    }
    fs.writeFileSync(outPath, await pdfDoc.save());
    console.log(JSON.stringify({ ok: true, outPath }));
    return;
  }

  if (task === 'createCollage') {
    const cols = Math.ceil(Math.sqrt(files.length));
    const rows = Math.ceil(files.length / cols);
    const cellSize = 600;
    const gap = 24;
    const width = cols * cellSize + (cols + 1) * gap;
    const height = rows * cellSize + (rows + 1) * gap;
    const composites = [];
    for (let i = 0; i < files.length; i++) {
      const r = Math.floor(i / cols);
      const c = i % cols;
      const buf = await sharp(files[i]).resize(cellSize, cellSize, { fit: 'cover' }).png().toBuffer();
      composites.push({
        input: buf,
        left: gap + c * (cellSize + gap),
        top: gap + r * (cellSize + gap),
      });
    }
    await sharp({
      create: { width, height, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
    })
      .composite(composites)
      .png()
      .toFile(outPath);
    console.log(JSON.stringify({ ok: true, outPath }));
    return;
  }

  if (['jpg', 'jpeg', 'png', 'webp', 'avif', 'tiff', 'bmp', 'ico'].includes(actionId)) {
    let pipeline = sharp(filePath);
    if (actionId === 'jpg' || actionId === 'jpeg') pipeline = pipeline.jpeg({ quality: options.quality || 90 });
    else if (actionId === 'png') pipeline = pipeline.png({ compressionLevel: 8 });
    else if (actionId === 'webp') pipeline = pipeline.webp({ quality: options.quality || 88 });
    else if (actionId === 'avif') pipeline = pipeline.avif({ quality: options.quality || 80 });
    else if (actionId === 'tiff') pipeline = pipeline.tiff();
    else if (actionId === 'ico') pipeline = pipeline.resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png();
    else pipeline = pipeline.png();
    await pipeline.toFile(outPath);
    console.log(JSON.stringify({ ok: true, outPath }));
    return;
  }

  if (actionId === 'exactKb' || actionId === 'compress') {
    const targetBytes = (options.targetKb || 45) * 1024;
    let low = 10;
    let high = 95;
    let bestBuffer = null;
    const meta = await sharp(filePath).metadata();
    const width = meta.width || 1200;

    for (let attempt = 0; attempt < 7; attempt++) {
      const mid = Math.floor((low + high) / 2);
      const buf = await sharp(filePath)
        .resize({ width: Math.min(width, 1600), withoutEnlargement: true })
        .jpeg({ quality: mid, mozjpeg: true })
        .toBuffer();
      if (buf.length <= targetBytes) {
        bestBuffer = buf;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    if (!bestBuffer) {
      bestBuffer = await sharp(filePath)
        .resize({ width: 600, withoutEnlargement: true })
        .jpeg({ quality: 25 })
        .toBuffer();
    }
    fs.writeFileSync(outPath, bestBuffer);
    console.log(JSON.stringify({ ok: true, outPath }));
    return;
  }

  if (actionId === 'passportPhoto') {
    await sharp(filePath)
      .resize(413, 531, { fit: 'cover', position: 'attention' })
      .flatten({ background: options.bgColor || '#ffffff' })
      .jpeg({ quality: 92 })
      .toFile(outPath);
    console.log(JSON.stringify({ ok: true, outPath }));
    return;
  }

  if (actionId === 'removeMetadata') {
    await sharp(filePath).toFile(outPath);
    console.log(JSON.stringify({ ok: true, outPath }));
    return;
  }

  if (actionId === 'cropImage') {
    const meta = await sharp(filePath).metadata();
    const size = Math.min(meta.width || 800, meta.height || 800);
    await sharp(filePath).resize(size, size, { fit: 'cover' }).toFile(outPath);
    console.log(JSON.stringify({ ok: true, outPath }));
    return;
  }

  if (actionId === 'frameImage') {
    const inner = await sharp(filePath).resize(1000, 1000, { fit: 'inside' }).png().toBuffer();
    const innerMeta = await sharp(inner).metadata();
    const pad = 72;
    await sharp({
      create: {
        width: (innerMeta.width || 800) + pad * 2,
        height: (innerMeta.height || 800) + pad * 2,
        channels: 4,
        background: { r: 255, g: 82, b: 0, alpha: 1 },
      },
    })
      .composite([{ input: inner, left: pad, top: pad }])
      .png()
      .toFile(outPath);
    console.log(JSON.stringify({ ok: true, outPath }));
    return;
  }

  if (actionId === 'editImage') {
    await sharp(filePath).modulate({ brightness: 1.06, saturation: 1.18 }).sharpen().toFile(outPath);
    console.log(JSON.stringify({ ok: true, outPath }));
    return;
  }

  if (actionId === 'redactImage') {
    await sharp(filePath).blur(18).toFile(outPath);
    console.log(JSON.stringify({ ok: true, outPath }));
    return;
  }

  if (actionId === 'docScanner') {
    await sharp(filePath).grayscale().normalize().linear(1.4, -30).sharpen().jpeg({ quality: 92 }).toFile(outPath);
    console.log(JSON.stringify({ ok: true, outPath }));
    return;
  }

  await sharp(filePath).toFile(outPath);
  console.log(JSON.stringify({ ok: true, outPath }));
}

runImageTask().catch((err) => {
  console.error(err);
  process.exit(1);
});
