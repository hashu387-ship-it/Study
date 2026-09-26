// Copies the PDF.js worker into public/ so the browser can load it from our own domain.
import fs from 'node:fs';
import path from 'node:path';

const source = path.join('node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.min.mjs');
const target = path.join('public', 'pdf', 'pdf.worker.min.mjs');

if (fs.existsSync(source)) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}
