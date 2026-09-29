'use client';

import { Tip } from '../guide';
import { QaArt } from '../illustrations';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, MessagesSquare, Paperclip, Plus, RefreshCw, Send, Trash2 } from 'lucide-react';
import { api, checkFile, fileUrl, uploadFile } from '@/lib/client/api';
import { ago } from '@/lib/time';
import type { FileRef, Post } from '@/lib/types';
import { attempt, useHub } from '../hub';
import { Avatar, Empty, Field, FileChip, FileView, PageHead, PreviewSheet, Sheet } from '../ui';

const MAX_FILES = 4;

// In a thread every file shows in place; the feed keeps small thumbnails and chips that open a preview.
function Attachments({ files, full }: { files: FileRef[]; full?: boolean }) {
  const [viewing, setViewing] = useState<FileRef | null>(null);
  if (!files.length) return null;
  if (full) {
    return (
      <div className="attachments full">
        {files.map((f) => (
          <FileView key={f.id} file={f} />
        ))}
      </div>
    );
  }
  return (
    <div className="attachments">
      {files.map((f) =>
        f.content_type.startsWith('image/') ? (
          <button key={f.id} type="button" onClick={() => setViewing(f)} title={`Preview ${f.name}`}>
            <img src={fileUrl(f.id, true)} alt={f.name} loading="lazy" />
          </button>
        ) : (
          <FileChip key={f.id} file={f} />
        ),
      )}
      {viewing && <PreviewSheet file={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

function FilePicker({ files, onChange, disabled, onError }: { files: File[]; onChange: (files: File[]) => void; disabled?: boolean; onError: (message: string) => void }) {
  return (
    <div className="row">
      {files.map((f, i) => (
        <FileChip key={i} file={{ name: f.name, size: f.size, content_type: f.type }} onRemove={() => onChange(files.filter((_, n) => n !== i))} />
      ))}
      {files.length < MAX_FILES && (
        <label className="btn small upload-label">
          <Paperclip size={16} /> Attach
          <input
            type="file"
            multiple
            disabled={disabled}
            accept="image/*,.pdf,.docx,.pptx,.xlsx,.txt,.csv,.zip"
            onChange={(e) => {
              const chosen = Array.from(e.target.files ?? []);
              e.target.value = '';
              const problem = chosen.map((f) => checkFile(f, 'post')).find(Boolean);
              if (problem) return onError(problem);
              if (files.length + chosen.length > MAX_FILES) return onError(`Attach up to ${MAX_FILES} files.`);
              onError('');
              onChange([...files, ...chosen]);
            }}
          />
        </label>
      )}
    </div>
  );
}

export function Discussions() {
  const hub = useHub();
  const { me, params, go, member, label } = hub;
  const threadId = params.get('post');
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [thread, setThread] = useState<{ post: Post; replies: Post[] } | null>(null);
  const [error, setError] = useState('');
  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [reply, setReply] = useState('');
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    try {
      if (threadId) setThread(await api(`/api/posts?id=${threadId}`));
      else setPosts(await api('/api/posts'));
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }, [threadId]);

  useEffect(() => {
    setThread(null);
    load();
    const timer = setInterval(() => document.visibilityState === 'visible' && load(), 20_000);
    return () => clearInterval(timer);
  }, [load]);

  async function send(isReply: boolean) {
    setBusy(true);
    setFormError('');
    try {
      const chosen = isReply ? replyFiles : files;
      const fileIds = [];
      for (const f of chosen) fileIds.push(await uploadFile(f, 'post'));
      const result = await api<{ threadId: string }>('/api/posts', {
        body: isReply ? { parentId: threadId, body: reply, fileIds } : { title, body, fileIds },
      });
      if (isReply) {
        setReply('');
        setReplyFiles([]);
        await load();
      } else {
        setComposing(false);
        setTitle('');
        setBody('');
        setFiles([]);
        go('posts', { post: result.threadId });
      }
      hub.toast(isReply ? 'Reply posted.' : 'Posted. The group has been notified.');
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function remove(post: Post, isThread: boolean) {
    if (!confirm(isThread ? 'Delete this post and all its replies?' : 'Delete this reply?')) return;
    attempt(
      hub,
      async () => {
        await api('/api/posts', { method: 'DELETE', body: { id: post.id } });
        if (isThread) go('posts');
        else await load();
      },
      'Deleted.',
    );
  }

  const meta = (post: Post, tag?: string) => (
    <div className="post-meta">
      <Avatar member={member(post.member_id)} />
      <div>
        <strong>
          {label(post.member_id)}
          {tag && <span className="badge yellow">{tag}</span>}
        </strong>
        <small>{ago(post.created_at)}</small>
      </div>
      {(post.member_id === me.memberId || me.isLeader) && (
        <button className="icon-btn" style={{ width: 38, height: 38 }} onClick={() => remove(post, !post.parent_id)} aria-label="Delete">
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );

  if (threadId) {
    return (
      <>
        <button className="link-btn" style={{ marginBottom: 18 }} onClick={() => go('posts')}>
          <ArrowLeft size={17} /> All discussions
        </button>
        {error && <p className="error">{error}</p>}
        {!thread ? (
          !error && <p className="muted">Loading…</p>
        ) : (
          <>
            <article className="card post" style={{ marginBottom: 22 }}>
              {meta(thread.post)}
              <h3>{thread.post.title}</h3>
              <p className="post-body">{thread.post.body}</p>
              <Attachments files={thread.post.attachments} full />
            </article>

            <div className="row" style={{ marginBottom: 12 }}>
              <h3>
                Comments and answers <span className="muted">({thread.replies.length})</span>
              </h3>
              <span className="spacer" />
              <button className="icon-btn" onClick={load} aria-label="Refresh">
                <RefreshCw size={17} />
              </button>
            </div>
            <div className="replies" style={{ marginBottom: 22 }}>
              {thread.replies.map((r) => (
                <div key={r.id} className="reply post">
                  {meta(r, r.member_id === thread.post.member_id ? 'Posted this' : undefined)}
                  <p className="post-body">{r.body}</p>
                  <Attachments files={r.attachments} full />
                </div>
              ))}
              {!thread.replies.length && <Empty>No replies yet. Ask a question or share an answer.</Empty>}
            </div>

            <section className="card">
              <div className="form">
                <Field label={`Reply as ${me.name}`} wide>
                  <textarea
                    rows={4}
                    maxLength={20000}
                    value={reply}
                    disabled={busy}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Add a comment, ask a follow-up question, or answer…"
                  />
                </Field>
                <div className="wide">
                  <FilePicker files={replyFiles} onChange={setReplyFiles} disabled={busy} onError={setFormError} />
                </div>
                {formError && <p className="error wide">{formError}</p>}
                <div className="wide row end">
                  <button className="btn primary" onClick={() => send(true)} disabled={busy || !reply.trim()}>
                    <Send size={17} /> {busy ? 'Posting…' : 'Post reply'}
                  </button>
                </div>
              </div>
            </section>
          </>
        )}
      </>
    );
  }

  return (
    <>
      <PageHead
        eyebrow="Ask and share"
        title="Discussions"
        text="Post a question, a file or an image. Everyone can comment and answer, including the person who posted."
        action={
          <button className="btn primary" onClick={() => setComposing(true)}>
            <Plus size={18} /> New post
          </button>
        }
      />
      <Tip id="posts" art={QaArt} title="Ask the group">
        Post a question, file or photo. Anyone can reply, including you on your own post.
      </Tip>
      {error && <p className="error">{error}</p>}
      <div className="grid">
        {posts?.map((p) => (
          <article key={p.id} className="card post">
            {meta(p)}
            <button style={{ textAlign: 'left' }} onClick={() => go('posts', { post: p.id })}>
              <h3>{p.title}</h3>
            </button>
            <p className="post-body clamp">{p.body}</p>
            <Attachments files={p.attachments} />
            <button className="link-btn" onClick={() => go('posts', { post: p.id })}>
              <MessagesSquare size={17} /> {p.replies ? `${p.replies} ${p.replies === 1 ? 'reply' : 'replies'}` : 'Reply'}
            </button>
          </article>
        ))}
        {posts && !posts.length && (
          <div className="card">
            <Empty icon={<MessagesSquare size={30} />}>No posts yet. Start the first discussion.</Empty>
          </div>
        )}
        {!posts && !error && <p className="muted">Loading…</p>}
      </div>

      <Sheet
        open={composing}
        onClose={() => setComposing(false)}
        busy={busy}
        title="New post"
        subtitle={`Posting as ${me.name}. The group gets a notification.`}
        footer={
          <>
            <button className="btn" onClick={() => setComposing(false)} disabled={busy}>
              Cancel
            </button>
            <button className="btn primary" onClick={() => send(false)} disabled={busy || !title.trim() || !body.trim()}>
              <Send size={17} /> {busy ? 'Posting…' : 'Post'}
            </button>
          </>
        }
      >
        <div className="form">
          <Field label="Title" wide>
            <input value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} placeholder="What would you like to ask or share?" />
          </Field>
          <Field label="Message" wide>
            <textarea rows={6} maxLength={20000} value={body} onChange={(e) => setBody(e.target.value)} />
          </Field>
          <Field label="Images or files (optional)" wide group hint={`Up to ${MAX_FILES} files, 10 MB each.`}>
            <FilePicker files={files} onChange={setFiles} disabled={busy} onError={setFormError} />
          </Field>
          {formError && <p className="error wide">{formError}</p>}
        </div>
      </Sheet>
    </>
  );
}
