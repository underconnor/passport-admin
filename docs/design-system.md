# 화면 기준과 에셋

Passport 사용자·관리자 웹은 ALMS v4 A의 중립 회색·블루 UI를 기준으로 구성합니다. 로그인은 410px 중앙 카드, 로그인 후 화면은 216px 사이드바와 64px 상단 바를 사용합니다. 서비스 내용과 실제 동작에 맞게 메뉴·카드를 구성하며 LMS의 수업 데이터나 미리보기 동작은 가져오지 않습니다.

## 기준값

| 항목 | 값 |
| --- | --- |
| 배경 / 표면 | `#F9FAFB` / `#FFFFFF` |
| 본문 / 보조 글자 | `#191F28` / `#6B7684` |
| 경계선 | `#E5E8EB` |
| 주 동작 / hover | `#1B64DA` / `#1957C2` |
| 선택 메뉴 | `#F2F4F6` 배경, `#191F28` 글자 |
| 카드 | 반경 12px, 안쪽 여백 20px |
| 버튼 | 높이 40px, 반경 6px |
| 개발 환경 표시 | 높이 28px 상단 띠 |
| 본문 / 제목 | 14px / 26px, 굵기 400·500·700 |

디자인 기준 Figma: 파일 `ddqn2JJ4KwNATJlSErNrmW`, v4 A 로그인 `99:2`, 대시보드 `99:32`. 기존 녹색 배경, 장식 스탬프, 마케팅 카드는 사용하지 않습니다.

## 글꼴

사용자의 별도 요청에 따라 원본 디자인의 Noto Sans KR 대신 **Pretendard**를 적용합니다. 실제 글꼴 파일을 두 저장소에 각각 포함하며 다른 저장소나 외부 CDN에 의존하지 않습니다.

- 출처: [Pretendard 공식 저장소 v1.3.9](https://github.com/orioncactus/pretendard/tree/v1.3.9)
- 원본: `packages/pretendard/dist/web/variable/woff2/PretendardVariable.woff2`
- 로컬: `public/assets/PretendardVariable.woff2`
- 라이선스: `public/assets/Pretendard-LICENSE.txt` (SIL Open Font License 1.1)
- 브라우저 family: `Pretendard Variable`, 가변 굵기 100–900

## 아이콘

Figma가 제공한 SVG를 로컬 파일로 보관합니다. 임시 Figma 에셋 URL을 실행 코드에 사용하지 않습니다. 원본 root 크기인 브랜드 22×22, 메뉴·동작 아이콘 18×18을 유지하며 SVG를 다시 그리거나 경로를 변경하지 않습니다.

- `brand.svg`: 로그인·사이드바 브랜드
- `dashboard.svg`: 내 계정·운영 현황 메뉴
- `check.svg`: Minecraft 연결 메뉴
- `settings.svg`: Discord ID 메뉴
- `book.svg`: 접속 서버 메뉴
- `logout.svg`: 로그아웃
- `arrow.svg`: 주 동작 버튼

사용자가 제공한 디자인을 서비스에 맞게 적용한 것이며 학교 공식 서비스라는 표시는 하지 않습니다. 개발용 가상 신원, 미구현 학교 인증, 관리자 접근 제한은 실제 API 상태에 맞게 표시합니다.
