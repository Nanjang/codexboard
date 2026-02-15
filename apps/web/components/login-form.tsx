'use client';

import { FormEvent, useMemo, useState } from 'react';

export function LoginForm() {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const apiBase = useMemo(() => process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000', []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage('Logging in...');

    const response = await fetch(`${apiBase}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ loginId, password })
    });
    const body = await response.json();

    if (!response.ok) {
      setMessage(body.message ?? 'Login failed');
      return;
    }

    setMessage(`Logged in: ${body.user?.name ?? body.user?.loginId ?? ''}`);
  };

  return (
    <form className="card" onSubmit={submit}>
      <h2>Login</h2>
      <label>
        Login ID
        <input value={loginId} onChange={(event) => setLoginId(event.target.value)} />
      </label>
      <label>
        Password
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      <div className="row">
        <button type="submit">Login</button>
        <span className="muted">{message}</span>
      </div>
    </form>
  );
}
