'use client';

import { FormEvent, useMemo, useState } from 'react';

type WriteFormProps = {
  boTable: string;
  mode: '' | 'u' | 'r';
  wrId?: string;
  defaultSubject?: string;
  defaultContent?: string;
};

export function WriteForm({ boTable, mode, wrId, defaultSubject, defaultContent }: WriteFormProps) {
  const [subject, setSubject] = useState(defaultSubject ?? '');
  const [content, setContent] = useState(defaultContent ?? '');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string>('');
  const apiBase = useMemo(() => process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000', []);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage('Saving...');

    const tokenResponse = await fetch(`${apiBase}/bbs/write_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ bo_table: boTable })
    });
    const tokenBody = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenBody.token) {
      setMessage('Token issue failed');
      return;
    }

    const payload = new FormData();
    payload.append('bo_table', boTable);
    payload.append('token', tokenBody.token);
    payload.append('w', mode);
    payload.append('wr_subject', subject);
    payload.append('wr_content', content);
    if (wrId) {
      payload.append('wr_id', wrId);
    }
    if (name) {
      payload.append('wr_name', name);
    }
    if (password) {
      payload.append('wr_password', password);
    }

    const response = await fetch(`${apiBase}/bbs/write_update`, {
      method: 'POST',
      credentials: 'include',
      body: payload
    });
    const body = await response.json();
    if (!response.ok) {
      setMessage(body.message ?? 'Save failed');
      return;
    }

    if (body.url) {
      window.location.href = body.url;
      return;
    }
    setMessage('Saved');
  };

  return (
    <form className="card" onSubmit={onSubmit}>
      <h2>{mode === 'u' ? 'Edit Post' : mode === 'r' ? 'Reply Post' : 'Write Post'}</h2>
      <label>
        Subject
        <input value={subject} onChange={(event) => setSubject(event.target.value)} required />
      </label>
      <label>
        Content
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          rows={14}
          required
        />
      </label>
      <label>
        Guest Name
        <input value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <label>
        Guest Password
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      <div className="row">
        <button type="submit">Save</button>
        <span className="muted">{message}</span>
      </div>
    </form>
  );
}
