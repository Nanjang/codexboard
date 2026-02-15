import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'CodexBoard',
  description: 'Gnuboard-compatible board service'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <header className="row" style={{ marginBottom: 16 }}>
            <Link href="/">
              <strong>CodexBoard</strong>
            </Link>
            <Link href="/bbs/board?bo_table=free">Board</Link>
            <Link href="/bbs/write?bo_table=free">Write</Link>
            <Link href="/bbs/search">Search</Link>
            <Link href="/login">Login</Link>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
