import { WriteForm } from '../../../components/write-form';
import { apiGet } from '../../../lib/api';

type WritePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function qp(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function WritePage({ searchParams }: WritePageProps) {
  const params = await searchParams;
  const boTable = qp(params.bo_table) ?? 'free';
  const mode = (qp(params.w) ?? '') as '' | 'u' | 'r';
  const wrId = qp(params.wr_id);

  const query = new URLSearchParams();
  query.set('bo_table', boTable);
  if (mode) {
    query.set('w', mode);
  }
  if (wrId) {
    query.set('wr_id', wrId);
  }

  const data = await apiGet<{
    ok: boolean;
    post?: { subject: string; content: string };
  }>(`/bbs/write?${query.toString()}`);

  return (
    <WriteForm
      boTable={boTable}
      mode={mode}
      wrId={wrId}
      defaultSubject={data.post?.subject}
      defaultContent={data.post?.content}
    />
  );
}
