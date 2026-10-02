# 소스 구성

- `main.tsx`: React 진입점
- `App.tsx`: 세션·MFA 상태, 화면 전환, 만료 시 데이터 제거
- `AccessGate.tsx`: 학교 로그인 시작, 최초 등록, 인증 앱 코드 확인
- `MembersView.tsx`: 통합 검색·회원 구분·정렬·커서 페이지 목록, 행 확장과 접근 제한 수정, 계정 해제·회원 삭제 확인
- `RosterView.tsx`: 명부 미리보기와 검토한 내용 반영
- `AuditView.tsx`: 최근 운영 기록
- `Dialog.tsx`: 포커스를 가두는 네이티브 확인 대화상자
- `api.ts`: 같은 출처의 API 호출, CSRF와 오류 처리
- `types.ts`: 관리자 API 응답 타입과 표시 도우미
- `ui.tsx`: 로그인 브랜드, 개발 표시와 공통 앱 레이아웃
- `styles.css`: 반응형 화면 스타일

학교 자격 증명이나 API 서비스 비밀값은 브라우저 코드에 포함하지 않습니다.

회원 검색은 서버에서 실명·전체 학번·게임 이름·Discord 이름/ID를 함께 확인합니다. 학번 전체 검색은 HMAC 대조를 유지하며, 관리자 응답의 `studentId`는 학교에서 검증해 암호화 저장한 전체 학번입니다. 목록 요약과 상세의 `학번` 항목에 표시하고, `null` 또는 구 API의 누락 값은 `학교 재인증 필요`로 안내합니다. `admissionYear`에서 전체 학번을 추정하지 않습니다. 검색어와 학번을 URL, 로컬 저장소에 저장하지 않습니다. 삭제 시 이름 확인과 서버 revision 검증을 사용하고, 자기 계정·마지막 관리자 삭제는 API에서 거부합니다. 구글시트 원본 회원 명부와 Passport 계정 삭제는 별개입니다.

`StatsView.tsx`는 `/admin/stats`의 전체·서버 통계를 표시하고, 회원을 펼친 뒤 ‘플레이 기록’을 누르면 `/admin/members/:id/stats`로 해당 회원 기록을 조회합니다. 공개 통계 페이지는 만들지 않습니다. 권한 만료 시 통계와 회원 편집 화면을 제거합니다.

`StatisticsHistory.tsx`는 기간과 일별 수신 기록을 표시합니다. `StatsView.tsx`의 엑셀 다운로드는 CSRF와 쓰기 권한을 요구하며 페이지 이탈 시 요청을 중단합니다. `ManualSettingsView.tsx`는 revision을 사용한 Notion 문서 설정, `ObservabilityView.tsx`는 개인정보 없는 운영 지표, `ServiceCredentialsView.tsx`는 총괄 운영자 전용 연결 키 발급·회수를 제공합니다. 발급 키는 컴포넌트 메모리에만 두고 이동 시 삭제합니다.
