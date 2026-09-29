// Turns an uploaded SOE (PDF, Word, text or photo) into editable text, entirely in the browser.
import { fileExtension } from '@/lib/types';

export type Extraction = { text: string; method: string };

type Progress = (message: string) => void;

const MAX_PDF_PAGES = 25;

async function recognise(image: Blob | HTMLCanvasElement, progress: Progress, signal: AbortSignal) {
  progress('Preparing text recognition (first time can take a moment)…');
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng', 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') progress(`Reading text from the image · ${Math.round(m.progress * 100)}%`);
    },
  });
  const stop = () => void worker.terminate();
  signal.addEventListener('abort', stop);
  try {
    const result = await worker.recognize(image);
    // Text recognition often reads a standalone capital "I" as "|", and SOEs are written in the first person.
    return (result.data.text as string).replace(/(^|\s)\|(?=\s)/gm, '$1I');
  } finally {
    signal.removeEventListener('abort', stop);
    await worker.terminate().catch(() => {});
  }
}

// Phone photos can be very large; shrinking them makes recognition much faster.
async function downscale(file: File): Promise<Blob | HTMLCanvasElement> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 2200 / Math.max(bitmap.width, bitmap.height));
    if (scale === 1) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvas;
  } catch {
    return file;
  }
}

async function fromPdf(file: File, progress: Progress, signal: AbortSignal): Promise<Extraction> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf/pdf.worker.min.mjs';
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const pdf = await task.promise;
  try {
    if (pdf.numPages > MAX_PDF_PAGES) throw new Error(`That PDF has ${pdf.numPages} pages. Upload ${MAX_PDF_PAGES} pages or fewer.`);
    const pages: string[] = [];
    let scanned = false;
    for (let n = 1; n <= pdf.numPages; n++) {
      if (signal.aborted) throw new Error('Conversion cancelled.');
      progress(`Reading page ${n} of ${pdf.numPages}…`);
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      let text = content.items
        .map((item) => ('str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : ''))
        .join('')
        .replace(/[ \t]+\n/g, '\n')
        .trim();
      // A page with almost no text layer is probably a scan, so read it as an image.
      if (text.replace(/\s/g, '').length < 20) {
        scanned = true;
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        await page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport }).promise;
        text = (await recognise(canvas, progress, signal)).trim();
        canvas.width = 0;
        canvas.height = 0;
      }
      pages.push(text);
      page.cleanup();
    }
    return { text: pages.join('\n\n').trim(), method: scanned ? 'PDF with scanned pages' : 'PDF' };
  } finally {
    await task.destroy();
  }
}

async function fromDocx(file: File): Promise<Extraction> {
  const module = await import('mammoth/mammoth.browser');
  const mammoth = (module as unknown as { default?: typeof module }).default ?? module;
  const result = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
  // Walk the HTML so paragraphs and list items keep their line breaks.
  const doc = new DOMParser().parseFromString(result.value, 'text/html');
  const blocks = new Set(['P', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'TR', 'DIV']);
  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
    if (!(node instanceof Element)) return '';
    if (node.tagName === 'BR') return '\n';
    const inner = Array.from(node.childNodes).map(walk).join('');
    if (node.tagName === 'LI') return '• ' + inner + '\n';
    if (blocks.has(node.tagName)) return inner + '\n\n';
    if (node.tagName === 'TD' || node.tagName === 'TH') return inner + '\t';
    return inner;
  };
  return { text: walk(doc.body).replace(/\n{3,}/g, '\n\n').trim(), method: 'Word document' };
}

export async function extractText(file: File, progress: Progress, signal: AbortSignal): Promise<Extraction> {
  const ext = fileExtension(file.name);
  progress('Opening your file…');
  if (ext === 'txt') return { text: (await file.text()).trim(), method: 'Text file' };
  if (ext === 'docx') return fromDocx(file);
  if (ext === 'pdf') return fromPdf(file, progress, signal);
  if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
    const text = await recognise(await downscale(file), progress, signal);
    return { text: text.trim(), method: 'Photo (English text recognition)' };
  }
  throw new Error('Use a PDF, Word (.docx), text file or photo.');
}
