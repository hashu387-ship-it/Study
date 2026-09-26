'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, FileText, LoaderCircle, Upload, X } from 'lucide-react';
import { checkFile } from '@/lib/client/api';
import { extractText } from '@/lib/client/extract';
import type { FileRef } from '@/lib/types';
import { FileChip } from '../ui';

const TITLES = ['', 'Knowledge and understanding', 'Application of knowledge', 'Reasoned advice'];

export function SoeLevel({
  level,
  value,
  onChange,
  file,
  pending,
  onPending,
  disabled,
}: {
  level: 1 | 2 | 3;
  value: string;
  onChange: (text: string) => void;
  file: FileRef | null;
  pending: File | null;
  onPending: (file: File | null) => void;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<{ text: string; file: File; method: string } | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  async function read(chosen: File | undefined) {
    if (!chosen) return;
    const problem = checkFile(chosen, 'soe');
    if (problem) return setError(problem);
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setError('');
    setPreview(null);
    setBusy(true);
    try {
      const result = await extractText(chosen, setMessage, abort.signal);
      if (abort.signal.aborted) return;
      if (!result.text.trim()) throw new Error('No readable text was found. Try a clearer file, or paste your SOE below.');
      if (result.text.length > 30000) throw new Error('That is more than 30,000 characters. Split it by level and upload each part.');
      setPreview({ ...result, file: chosen });
    } catch (e) {
      if (!abort.signal.aborted) setError((e as Error).message || 'That file could not be read. Paste your text instead.');
    } finally {
      if (controller.current === abort) setBusy(false);
    }
  }

  const words = value.trim() ? value.trim().split(/\s+/).length : 0;

  return (
    <section className="soe-level">
      <div className="soe-level-head">
        <span className="medallion">L{level}</span>
        <div>
          <h3>Level {level}</h3>
          <p className="muted small">{TITLES[level]}</p>
        </div>
        {!disabled && (
          <label className="btn small upload-label">
            <Upload size={16} /> Upload
            <input
              type="file"
              accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.webp,image/*"
              disabled={busy}
              aria-label={`Upload a file for Level ${level}`}
              onChange={(e) => {
                read(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
        )}
      </div>

      {!disabled && (
        <p className="muted small">Paste your text below, or upload a PDF, Word file, text file or photo and we'll turn it into text for you to check.</p>
      )}

      {busy && (
        <div className="status-line" role="status">
          <LoaderCircle className="spin" size={18} />
          <span style={{ flex: 1 }}>{message}</span>
          <button
            type="button"
            className="icon-btn"
            style={{ width: 34, height: 34 }}
            onClick={() => {
              controller.current?.abort();
              setBusy(false);
            }}
            aria-label="Cancel conversion"
          >
            <X size={16} />
          </button>
        </div>
      )}
      {error && <p className="error">{error}</p>}

      {preview && (
        <div className="preview">
          <div className="row">
            <FileText size={18} />
            <strong className="small">Check the converted text</strong>
            <span className="badge">{preview.method}</span>
          </div>
          <p className="small">Fix any names, numbers or line breaks the conversion got wrong, then use it.</p>
          <div className="field">
            <textarea
              aria-label={`Converted text for Level ${level}`}
              rows={8}
              maxLength={30000}
              value={preview.text}
              onChange={(e) => setPreview({ ...preview, text: e.target.value })}
            />
          </div>
          <div className="row end">
            <button type="button" className="btn small" onClick={() => setPreview(null)}>
              Discard
            </button>
            <button
              type="button"
              className="btn small primary"
              disabled={!preview.text.trim()}
              onClick={() => {
                onChange(preview.text);
                onPending(preview.file);
                setPreview(null);
              }}
            >
              <Check size={16} /> {value.trim() ? 'Replace my text with this' : 'Use this text'}
            </button>
          </div>
        </div>
      )}

      <div className="field">
        {disabled ? (
          <div className="inset pre small" style={{ minHeight: 60 }}>
            {value || <span className="muted">Not added yet.</span>}
          </div>
        ) : (
          <textarea
            aria-label={`Level ${level} SOE text`}
            rows={7}
            maxLength={30000}
            value={value}
            placeholder={`Paste your Level ${level} statement of experience here…`}
            onChange={(e) => onChange(e.target.value)}
          />
        )}
      </div>

      <div className="record-foot">
        <span>{words} words</span>
        {pending ? (
          <FileChip file={{ name: pending.name, size: pending.size }} onRemove={() => onPending(null)} />
        ) : file ? (
          <FileChip file={file} />
        ) : null}
      </div>
    </section>
  );
}
