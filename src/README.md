# 소스 구성

- `main.tsx`: React 진입점
- `App.tsx`: 세션·MFA 상태, 화면 전환, 만료 시 데이터 제거
- `AccessGate.tsx`: 학교 로그인 시작, 최초 등록, 인증 앱 코드 확인
- `MembersView.tsx`: 회원 목록, 접근 제한과 연결 해제 확인
- `RosterView.tsx`: 명부 미리보기와 검토한 내용 반영
- `AuditView.tsx`: 최근 운영 기록
- `Dialog.tsx`: 포커스를 가두는 네이티브 확인 대화상자
- `api.ts`: 같은 출처의 API 호출, CSRF와 오류 처리
- `types.ts`: 관리자 API 응답 타입과 표시 도우미
- `ui.tsx`: 로그인 브랜드, 개발 표시와 공통 앱 레이아웃
- `styles.css`: 반응형 화면 스타일

학교 자격 증명이나 API 서비스 비밀값은 브라우저 코드에 포함하지 않습니다.
