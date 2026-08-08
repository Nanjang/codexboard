import type { DeployInfo } from '../types'
import { PublicLayout } from './layout'

export function DeploymentStatusPage({ appName, deployInfo }: { appName: string; deployInfo: DeployInfo }) {
  return (
    <PublicLayout appName={appName} deployInfo={deployInfo} documentTitle="배포 상태">
      <main class="deployment-status-page" data-deployment-status data-deployment-manifest-url="/assets/asset-manifest.json">
        <header class="deployment-status-header">
          <p class="eyebrow">운영 확인</p>
          <h1>배포 상태</h1>
          <p>현재 배포된 워커와 정적 자산의 무결성을 확인합니다.</p>
        </header>

        <section class="deployment-status-card" aria-labelledby="deployment-status-title">
          <div class="deployment-status-card-heading">
            <h2 id="deployment-status-title">정적 자산 검사</h2>
            <span class="deployment-status-state" data-deployment-status-state role="status">확인 중…</span>
          </div>
          <p class="deployment-status-message" data-deployment-status-message>배포 매니페스트를 읽고 있습니다.</p>
          <dl class="deployment-status-meta">
            <div>
              <dt>워커 버전</dt>
              <dd>{deployInfo.version}</dd>
            </div>
            <div>
              <dt>매니페스트 생성</dt>
              <dd data-deployment-generated-at>확인 중…</dd>
            </div>
            <div>
              <dt>검사 대상</dt>
              <dd data-deployment-file-count>확인 중…</dd>
            </div>
          </dl>
          <div class="deployment-status-results" data-deployment-results aria-live="polite"></div>
          <p class="deployment-status-footnote">
            이 페이지는 브라우저에서 실제 배포된 자산을 다시 받아 SHA-256 값을 비교합니다.
          </p>
        </section>
      </main>
    </PublicLayout>
  )
}
