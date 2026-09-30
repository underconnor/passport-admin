# Passport Admin

운영자가 회원 상태, 서버별 접근 권한, 계정 연결과 감사 기록을 관리하는 별도 웹입니다.

**현재 상태: 개발 준비 문서만 작성했습니다.** 실행 코드, 패키지 설정, 빌드 설정, 배포 환경은 아직 없습니다.

## 역할

- 학교 검증 결과와 Google Sheets 회원 명부 매칭 결과를 조회합니다.
- 서버별 접근 범위, 일시 정지, 운영자 조치 사유를 관리합니다.
- Google Sheets 동기화 상태와 오류를 확인하고 재동기화를 요청합니다.
- Minecraft 계정 연결과 계정 충돌을 검토합니다.
- 사용자가 직접 입력한 Discord ID를 소유권 미확인 정보로 조회합니다.
- 운영자 변경 기록과 권한 회수 결과를 확인합니다.

접근에는 명시적으로 부여된 운영자 역할과 MFA가 필요합니다. 화면 숨김만으로 권한을 제한하지 않고 `passport-api`가 모든 관리 요청을 검사합니다. Google Sheets 원본에 쓰는 기능은 만들지 않습니다.

## 예정 스택

- React + TypeScript + Vite
- `passport-api`가 관리하는 HttpOnly 세션 쿠키
- 운영자 로그인에서 확인된 MFA 상태와 명시적인 관리 권한
- `passport-contracts`의 버전이 고정된 API 계약·타입 배포본

## 다음 구현 순서

1. 운영자 권한과 MFA 요구 조건을 API 계약으로 확정합니다.
2. 관리자 웹의 로그인·접근 차단 기반을 만듭니다.
3. 회원·동기화 상태 조회를 구현합니다.
4. 서버 접근 정책·정지·연결 관리와 감사 기록을 구현합니다.
5. 권한 부족, MFA 미충족, 오래된 데이터에서의 변경을 검증합니다.

세부 범위는 [구현 계획](docs/implementation-plan.md), 소스 경계는 [src 안내](src/README.md)를 참고하세요.

## 관련 저장소

개인 계정의 관련 저장소입니다.

- [passport-api](https://github.com/underconnor/passport-api): 관리자 인가와 감사 기록
- [passport-contracts](https://github.com/underconnor/passport-contracts): API 계약과 배포 타입
- [passport-web](https://github.com/underconnor/passport-web): 사용자 웹
- [passport-velocity](https://github.com/underconnor/passport-velocity): 서버 접근 정책 적용

각 저장소는 독립적으로 빌드·배포합니다. 다른 저장소의 `../src`를 직접 import하지 않습니다.
