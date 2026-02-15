import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="card">
      <h1>CodexBoard</h1>
      <p className="muted">Single-site multi-board service bootstrap.</p>
      <div className="row">
        <Link href="/bbs/board?bo_table=free">Open Free Board</Link>
        <Link href="/bbs/write?bo_table=free">Write Post</Link>
      </div>
    </main>
  );
}
