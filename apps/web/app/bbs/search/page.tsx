import Link from 'next/link';
import { apiGet } from '../../../lib/api';

type SearchPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function qp(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

type SearchResponse = {
  ok: boolean;
  posts: Array<{
    id: number;
    subject: string;
    name: string;
    board: { boTable: string; subject: string };
  }>;
  page: number;
  totalPage: number;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const keyword = qp(params.stx) ?? '';
  const sfl = qp(params.sfl) ?? 'subject';
  const page = qp(params.page) ?? '1';

  const query = new URLSearchParams();
  if (keyword) {
    query.set('stx', keyword);
  }
  query.set('sfl', sfl);
  query.set('page', page);

  const data = await apiGet<SearchResponse>(`/bbs/search?${query.toString()}`);

  return (
    <main className="card">
      <h2>Global Search</h2>
      <form method="get" className="row" style={{ marginBottom: 12 }}>
        <input name="stx" defaultValue={keyword} placeholder="keyword" />
        <select name="sfl" defaultValue={sfl}>
          <option value="subject">Subject</option>
          <option value="content">Content</option>
          <option value="name">Author</option>
        </select>
        <button type="submit">Search</button>
      </form>

      <ul>
        {data.posts.map((post) => (
          <li key={`${post.board.boTable}-${post.id}`}>
            <Link href={`/bbs/board?bo_table=${post.board.boTable}&wr_id=${post.id}`}>
              [{post.board.subject}] {post.subject}
            </Link>{' '}
            <span className="muted">by {post.name}</span>
          </li>
        ))}
      </ul>
      <p className="muted">
        page {data.page} / {data.totalPage}
      </p>
    </main>
  );
}
