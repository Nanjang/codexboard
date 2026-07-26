import type { DeployInfo } from '../types'
import { PublicLayout } from './layout'

interface LegalPageProps {
  appName: string
  deployInfo: DeployInfo
  contactEmail?: string
}

export function PrivacyPage({ appName, deployInfo, contactEmail }: LegalPageProps) {
  return (
    <PublicLayout appName={appName} deployInfo={deployInfo} documentTitle="개인정보처리방침">
      <main class="legal-shell">
        <article class="legal-card">
          <a class="text-link" href="/login">
            ← 로그인으로 돌아가기
          </a>
          <h1>개인정보처리방침</h1>
          <p class="legal-lead">
            이 문서는 {appName} 기본 배포본의 예시입니다. 실제 운영자는 서비스 명칭, 연락처, 보유기간과 관련
            법령에 맞게 배포 전에 검토·수정해야 합니다.
          </p>

          <h2>수집 항목과 목적</h2>
          <p>
            Google 로그인 과정에서 Google 계정 고유 식별자, 이메일 주소와 이메일 확인 여부를 받아 회원을
            식별하고 서비스 접근 권한을 확인합니다. Google 비밀번호와 프로필 이미지는 수집하지 않습니다.
          </p>

          <h2>서비스 이용 정보</h2>
          <p>
            회원 닉네임, 공용 게시글과 댓글, 개인 작업 티켓, 로그인 세션 정보가 Cloudflare D1에 저장됩니다.
            개인 작업 티켓은 해당 회원만 조회·수정하도록 접근 조건을 적용합니다.
          </p>

          <h2>보유 및 삭제</h2>
          <p>
            운영 목적에 필요한 기간 동안 보유하며, 계정 삭제 요청이나 서비스 종료 시 관련 법적 보존 의무가
            없는 정보는 삭제합니다. 운영자는 실제 보유기간을 이 문서에 명시해야 합니다.
          </p>

          <h2>외부 처리자</h2>
          <p>인증에는 Google, 애플리케이션 실행과 데이터 저장에는 Cloudflare 서비스를 사용합니다.</p>

          <h2>문의</h2>
          <p>{contactEmail ? <a href={`mailto:${contactEmail}`}>{contactEmail}</a> : '운영자 연락처를 입력하세요.'}</p>
        </article>
      </main>
    </PublicLayout>
  )
}

export function TermsPage({ appName, deployInfo, contactEmail }: LegalPageProps) {
  return (
    <PublicLayout appName={appName} deployInfo={deployInfo} documentTitle="이용약관">
      <main class="legal-shell">
        <article class="legal-card">
          <a class="text-link" href="/login">
            ← 로그인으로 돌아가기
          </a>
          <h1>이용약관</h1>
          <p class="legal-lead">
            이 문서는 {appName} 기본 배포본의 예시입니다. 실제 운영 정책과 관할 법령에 맞게 배포 전에 검토·수정해야
            합니다.
          </p>

          <h2>서비스 내용</h2>
          <p>
            로그인 회원에게 공용 자유게시판, 개발, 뉴스, 문의 게시판과 회원 본인만 사용하는 간단한 작업
            티켓 보드를 제공합니다. 로그인 전 손님용 홈에는 자유게시판, 개발, 뉴스의 최근 글 정보가
            표시됩니다.
          </p>

          <h2>회원의 책임</h2>
          <p>
            회원은 타인의 권리를 침해하거나 불법적인 내용을 게시해서는 안 되며, 계정과 로그인 세션을 안전하게
            관리해야 합니다.
          </p>

          <h2>운영 조치</h2>
          <p>
            운영자는 보안, 법적 의무, 서비스 안정성 또는 운영 정책 위반을 이유로 콘텐츠를 삭제하거나 계정 접근을
            제한할 수 있습니다.
          </p>

          <h2>서비스 변경과 종료</h2>
          <p>운영상 필요한 경우 기능을 변경하거나 서비스를 종료할 수 있으며, 중요한 변경은 적절한 방식으로 알립니다.</p>

          <h2>문의</h2>
          <p>{contactEmail ? <a href={`mailto:${contactEmail}`}>{contactEmail}</a> : '운영자 연락처를 입력하세요.'}</p>
        </article>
      </main>
    </PublicLayout>
  )
}
