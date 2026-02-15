import Link from 'next/link';
import { apiGet } from '../../../lib/api';

type BoardPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function qp(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

type BoardResponse = {
  ok: boolean;
  board: { subject: string; boTable: string };
  posts?: Array<{
    id: number;
    subject: string;
    name: string;
    createdAt: string;
    hit: number;
    reply: string;
  }>;
  notices?: Array<{ id: number; subject: string }>;
  post?: { id: number; subject: string; content: string; name: string; createdAt: string };
  comments?: Array<{ id: number; content: string; name: string; commentReply: string }>;
  page?: number;
  totalPage?: number;
};

export default async function BoardPage({ searchParams }: BoardPageProps) {
  const params = await searchParams;
  const boTable = qp(params.bo_table) ?? 'free';
  const wrId = qp(params.wr_id);
  const page = qp(params.page);
  const stx = qp(params.stx);

  const query = new URLSearchParams();
  query.set('bo_table', boTable);
  if (wrId) {
    query.set('wr_id', wrId);
  }
  if (page) {
    query.set('page', page);
  }
  if (stx) {
    query.set('stx', stx);
  }

  const data = await apiGet<BoardResponse>(`/bbs/board?${query.toString()}`);

  if (data.post) {
    return (
      <main className="card">
        <h2>{data.board.subject}</h2>
        <h3>{data.post.subject}</h3>
        <p className="muted">
          by {data.post.name} / {new Date(data.post.createdAt).toLocaleString()}
        </p>
        <article style={{ whiteSpace: 'pre-wrap', marginBottom: 20 }}>{data.post.content}</article>
        <div className="row" style={{ marginBottom: 20 }}>
          <Link href={`/bbs/write?bo_table=${boTable}&w=u&wr_id=${data.post.id}`}>Edit</Link>
          <Link href={`/bbs/write?bo_table=${boTable}&w=r&wr_id=${data.post.id}`}>Reply</Link>
          <Link href={`/bbs/board?bo_table=${boTable}`}>List</Link>
        </div>
        <h4>Comments</h4>
        <ul>
          {(data.comments ?? []).map((comment) => (
            <li key={comment.id}>
              [{comment.commentReply || '-'}] {comment.name}: {comment.content}
            </li>
          ))}
        </ul>
      </main>
    );
  }

  return (
    <main className="card">
      <h2>{data.board.subject}</h2>
      <div className="row" style={{ marginBottom: 16 }}>
        <Link href={`/bbs/write?bo_table=${boTable}`}>Write Post</Link>
      </div>

      {(data.notices ?? []).length > 0 && (
        <>
          <h4>Notices</h4>
          <ul>
            {data.notices?.map((notice) => (
              <li key={notice.id}>
                <Link href={`/bbs/board?bo_table=${boTable}&wr_id=${notice.id}`}>
                  [Notice] {notice.subject}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Subject</th>
            <th>Author</th>
            <th>Hits</th>
          </tr>
        </thead>
        <tbody>
          {(data.posts ?? []).map((post) => (
            <tr key={post.id}>
              <td>{post.id}</td>
              <td>
                <Link href={`/bbs/board?bo_table=${boTable}&wr_id=${post.id}`}>
                  {'-'.repeat(post.reply.length)} {post.subject}
                </Link>
              </td>
              <td>{post.name}</td>
              <td>{post.hit}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted" style={{ marginTop: 12 }}>
        page {data.page ?? 1} / {data.totalPage ?? 1}
      </p>
    </main>
  );
}
