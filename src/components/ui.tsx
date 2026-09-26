'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Eye, FileText, Image as ImageIcon, X } from 'lucide-react';
import { formatSize } from '@/lib/client/api';
import type { FileRef, Member } from '@/lib/types';
import { FilePreview } from './FilePreview';
import { EmptyArt } from './illustrations';

export function initials(name: string) {
  return name
    .replace(/[^\p{L}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
}

export function Avatar({ member, size, faded, title }: { member?: Pick<Member, 'name' | 'is_leader'> | null; size?: 'sm' | 'lg'; faded?: boolean; title?: string }) {
  const name = member?.name ?? '?';
  return (
    <span className={['avatar', size, member?.is_leader ? 'blue' : '', faded ? 'faded' : ''].join(' ')} title={title ?? name} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

// Bottom sheet on phones, centred dialog on larger screens. Uses the native <dialog> for focus handling.
export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  busy,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="sheet"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current && !busy) onClose();
      }}
    >
      {open && (
        <div className="sheet-inner">
          <div className="sheet-head">
            <div>
              <h2>{title}</h2>
              {subtitle && <p>{subtitle}</p>}
            </div>
            <button className="icon-btn" onClick={onClose} disabled={busy} aria-label="Close">
              <X size={20} />
            </button>
          </div>
          <div className="sheet-body">{children}</div>
          {footer && <div className="sheet-foot">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

// Use group for fields holding several controls, so clicking the label doesn't press the first button.
export function Field({ label, hint, wide, group, children }: { label: string; hint?: ReactNode; wide?: boolean; group?: boolean; children: ReactNode }) {
  const className = 'field' + (wide ? ' wide' : '');
  const inner = (
    <>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </>
  );
  return group ? (
    <div className={className} role="group" aria-label={label}>
      {inner}
    </div>
  ) : (
    <label className={className}>{inner}</label>
  );
}

export function Select({
  value,
  onChange,
  options,
  disabled,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  options: (string | { value: string; label: string })[];
  disabled?: boolean;
  label?: string;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} aria-label={label}>
      {options.map((o) => {
        const v = typeof o === 'string' ? o : o.value;
        return (
          <option key={v} value={v}>
            {typeof o === 'string' ? o : o.label}
          </option>
        );
      })}
    </select>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone =
    status === 'Completed' || status === 'Ready' || status === 'Presented'
      ? 'green'
      : status === 'Needs Revision'
        ? 'red'
        : status === 'Draft' || status === 'In progress' || status === 'Ready to Practise'
          ? 'amber'
          : status === 'Practised'
            ? ''
            : 'grey';
  return <span className={'badge ' + tone}>{status}</span>;
}

type ChipFile = FileRef | { name: string; size: number; content_type?: string; id?: string };

// Saved files open in a preview rather than downloading.
export function FileChip({ file, onRemove }: { file: ChipFile; onRemove?: () => void }) {
  const [open, setOpen] = useState(false);
  const isImage = file.content_type?.startsWith('image/');
  const saved = !onRemove && 'id' in file && file.id ? (file as FileRef) : null;
  const body = (
    <>
      {isImage ? <ImageIcon size={15} /> : <FileText size={15} />}
      <span>{file.name}</span>
      <small className="muted">{formatSize(file.size)}</small>
      {saved && <Eye size={14} />}
    </>
  );
  if (onRemove) {
    return (
      <span className="file-chip">
        {body}
        <button type="button" onClick={onRemove} aria-label={`Remove ${file.name}`}>
          <X size={14} />
        </button>
      </span>
    );
  }
  if (saved) {
    return (
      <>
        <button type="button" className="file-chip" onClick={() => setOpen(true)} title={`Preview ${file.name}`}>
          {body}
        </button>
        {open && <PreviewSheet file={saved} onClose={() => setOpen(false)} />}
      </>
    );
  }
  return <span className="file-chip">{body}</span>;
}

export function PreviewSheet({ file, onClose }: { file: FileRef; onClose: () => void }) {
  return (
    <Sheet open onClose={onClose} title={file.name} subtitle={formatSize(file.size)}>
      <FilePreview file={file} tall />
    </Sheet>
  );
}

// An inline preview with a button to see it full size.
export function FileView({ file }: { file: FileRef }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <FilePreview file={file} onExpand={() => setOpen(true)} />
      {open && <PreviewSheet file={file} onClose={() => setOpen(false)} />}
    </>
  );
}

// Empty screens show a small line drawing; pass art={false} for tight spaces.
export function Empty({ children, art = true }: { icon?: ReactNode; art?: boolean; children: ReactNode }) {
  return (
    <div className="empty">
      {art && <EmptyArt size={140} />}
      <div>{children}</div>
    </div>
  );
}

export function PageHead({ eyebrow, title, text, action }: { eyebrow: string; title: string; text?: ReactNode; action?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h2>{title}</h2>
        {text && <p>{text}</p>}
      </div>
      {action}
    </div>
  );
}
