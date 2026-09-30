# 예정 소스 경계

아직 실행 소스는 없습니다. 부트스트랩 시 다음 경계로 구성합니다.

| 모듈 | 책임 |
| --- | --- |
| `app` | 라우팅, 관리 레이아웃, 운영자 세션 |
| `features/members` | 회원 조회와 계정 연결 검토 |
| `features/access` | 서버 범위와 이용 정지 관리 |
| `features/sync` | Sheets 동기화 상태와 재시도 |
| `features/audit` | 관리 변경 기록 조회 |
| `shared/api` | 세션·CSRF·인가 오류 처리 |
| `shared/ui` | 표, 필터, 변경 확인 UI |

API 모델은 `passport-contracts`의 특정 버전 배포본을 사용합니다. 프론트의 역할 검사는 사용자 안내용이고, 실제 인가는 API가 수행합니다. Google Sheets 쓰기 클라이언트와 Discord OAuth는 포함하지 않습니다.
