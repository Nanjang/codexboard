# 작업 에이전트 지침

- 커밋 직전에 `npm run build:client`를 실행해 브라우저 자산을 최신 상태로 만든다.
- `npm run assets:manifest`를 실행해 `public/assets/asset-manifest.json`을 갱신하고, manifest 파일을 커밋에 포함한다.
- 커밋 전 `npm run assets:manifest:check`를 실행해 manifest가 현재 `public` 정적 자산과 일치하는지 확인한다.
- 저장소 전용 hook을 활성화한 경우 위 과정은 `.githooks/pre-commit`에서 자동으로 실행된다.
