'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, Maximize2 } from 'lucide-react';
import { api, fileUrl } from '@/lib/client/api';
import { fileExtension, type FileRef } from '@/lib/types';

type Link = { url: string; name: string; content_type: string };
type Kind = 'image' | 'pdf' | 'docx' | 'text' | 'office' | 'none';

const MAX_PDF_PAGES = 40;

function kindOf(file: Pick<FileRef, 'name' | 'content_type'>): Kind {
  const ext = fileExtension(file.name);
  if (file.content_type?.startsWith('image/')) return 'image';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'docx') return 'docx';
  if (ext === 'txt' || ext === 'csv') return 'text';
  if (ext === 'pptx' || ext === 'xlsx') return 'office';
  return 'none';
}

export function canPreview(file: Pick<FileRef, 'name' | 'content_type'>) {
  return kindOf(file) !== 'none';
}

// Word files become HTML in the browser. Links are kept only when they point to a web page.
function cleanHtml(html: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script, style, iframe, object, embed, form').forEach((el) => el.remove());
  doc.querySelectorAll('*').forEach((el) => {
    for (const attr of [...el.attributes]) {
      if (attr.name.startsWith('on')) el.removeAttribute(attr.name);
    }
    if (el.tagName === 'A') {
      const href = el.getAttribute('href') ?? '';
      if (/^https?:/i.test(href)) {
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noreferrer');
      } else el.removeAttribute('href');
    }
    if (el.tagName === 'IMG' && !/^data:image\//i.test(el.getAttribute('src') ?? '')) el.remove();
  });
  return doc.body.innerHTML;
}

function PdfPages({ url }: { url: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [note, setNote] = useState('Opening PDF…');

  useEffect(() => {
    let cancelled = false;
    let destroy = () => {};
    (async () => {
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf/pdf.worker.min.mjs';
      const task = pdfjs.getDocument({ url });
      destroy = () => void task.destroy();
      const pdf = await task.promise;
      const total = Math.min(pdf.numPages, MAX_PDF_PAGES);
      const host = box.current;
      if (!host || cancelled) return;
      host.replaceChildren();
      const width = host.clientWidth || 600;
      for (let n = 1; n <= total && !cancelled; n++) {
        setNote(`Page ${n} of ${pdf.numPages}`);
        const page = await pdf.getPage(n);
        const base = page.getViewport({ scale: 1 });
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const viewport = page.getViewport({ scale: (width / base.width) * ratio });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.setAttribute('aria-label', `Page ${n}`);
        host.appendChild(canvas);
        await page.render({ canvasContext: canvas.getContext('2d')!, canvas, viewport }).promise;
      }
      if (!cancelled) setNote(pdf.numPages > total ? `Showing the first ${total} of ${pdf.numPages} pages. Open the file to see the rest.` : '');
    })().catch(() => {
      if (!cancelled) setNote('This PDF could not be shown here. Open the file instead.');
    });
    return () => {
      cancelled = true;
      destroy();
    };
  }, [url]);

  return (
    <>
      <div ref={box} className="pdf-pages" />
      {note && <p className="muted preview-note">{note}</p>}
    </>
  );
}

function Body({ link, kind }: { link: Link; kind: Kind }) {
  const [content, setContent] = useState<string | null>(null);
  const [problem, setProblem] = useState('');

  useEffect(() => {
    if (kind !== 'docx' && kind !== 'text') return;
    let cancelled = false;
    (async () => {
      const response = await fetch(link.url);
      if (!response.ok) throw new Error();
      if (kind === 'text') {
        const text = await response.text();
        if (!cancelled) setContent(text);
        return;
      }
      const module = await import('mammoth/mammoth.browser');
      const mammoth = (module as unknown as { default?: typeof module }).default ?? module;
      const result = await mammoth.convertToHtml({ arrayBuffer: await response.arrayBuffer() });
      if (!cancelled) setContent(cleanHtml(result.value));
    })().catch(() => {
      if (!cancelled) setProblem('This file could not be shown here. Open the file instead.');
    });
    return () => {
      cancelled = true;
    };
  }, [link.url, kind]);

  if (problem) return <p className="muted preview-note">{problem}</p>;
  switch (kind) {
    case 'image':
      return <img className="preview-image" src={link.url} alt={link.name} />;
    case 'pdf':
      return <PdfPages url={link.url} />;
    case 'office':
      return (
        <iframe
          className="preview-frame"
          title={link.name}
          src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(link.url)}`}
        />
      );
    case 'text':
      return content === null ? <p className="muted preview-note">Opening…</p> : <pre className="preview-text">{content}</pre>;
    case 'docx':
      return content === null ? (
        <p className="muted preview-note">Opening…</p>
      ) : (
        <div className="preview-doc" dangerouslySetInnerHTML={{ __html: content }} />
      );
    default:
      return <p className="muted preview-note">This type of file can't be shown here. Download it to open it.</p>;
  }
}

// Shows an uploaded file in the page. The signed link lasts ten minutes, so it is fetched when the preview opens.
export function FilePreview({ file, onExpand, tall }: { file: FileRef; onExpand?: () => void; tall?: boolean }) {
  const kind = kindOf(file);
  const [link, setLink] = useState<Link | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (kind === 'none') return;
    let cancelled = false;
    setLink(null);
    api<Link>(`${fileUrl(file.id)}?preview=1`)
      .then((l) => !cancelled && setLink(l))
      .catch((e) => !cancelled && setError((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, [file.id, kind]);

  return (
    <figure className={'preview' + (tall ? ' tall' : '')}>
      <div className="preview-body">
        {kind === 'none' ? (
          <p className="muted preview-note">This type of file can't be shown here. Download it to open it.</p>
        ) : error ? (
          <p className="error preview-note">{error}</p>
        ) : link ? (
          <Body link={link} kind={kind} />
        ) : (
          <p className="muted preview-note">Opening…</p>
        )}
      </div>
      <figcaption>
        <span>{file.name}</span>
        {onExpand && kind !== 'none' && (
          <button type="button" className="icon-btn" onClick={onExpand} aria-label={`Open ${file.name} full size`} title="Full size">
            <Maximize2 size={16} />
          </button>
        )}
        <a className="icon-btn" href={fileUrl(file.id)} aria-label={`Download ${file.name}`} title="Download">
          <Download size={16} />
        </a>
      </figcaption>
    </figure>
  );
}
