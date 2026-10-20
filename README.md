# FE

기상송 — 기숙사 아침 기상송 신청곡 게시판 프론트엔드. 디자인 시스템 "기상송"(`ws-` 클래스)을 그대로 따른다.

## 실행

빌드 없이 정적 파일로 동작한다. 아무 정적 서버로 열면 된다.

```bash
python3 -m http.server 8000   # → http://localhost:8000
```

## 화면

| 화면 | 파일 | 쿼리 |
|---|---|---|
| S-01 메인 | `index.html` | |
| S-02 신청 | `request.html` | `?date=YYYY-MM-DD` |
| S-03 완료 | `complete.html` | `?id=` (신청 직후에만, 아니면 메인으로) |
| S-04 캘린더 | `calendar.html` | `?month=YYYY-MM` |
| S-05 날짜 상세 | `date.html` | `?date=YYYY-MM-DD` |

## 구조

- CSS — 모든 페이지가 `css/common.css`를 먼저, 그다음 자기 페이지 파일을 불러온다
  ```html
  <link rel="stylesheet" href="css/common.css">
  <link rel="stylesheet" href="css/pages/index.css">
  ```
  - `css/tokens.css` — 디자인 토큰 (색·간격·모서리 등 변수, tokens.json에서 생성). `common.css`가 `@import`
  - `css/common.css` — 여러 페이지가 같이 쓰는 것: 기본·레이아웃, 상단 메뉴, 버튼, 카드, 배지, 오류 배너·빈 화면·스켈레톤, 신청 목록
  - `css/pages/index.css` — 메인: 오늘의 기상송 카드, 이번 주 목록
  - `css/pages/request.css` — 신청: 폼, 입력 칸
  - `css/pages/complete.css` — 완료: 체크 아이콘, 요약 표
  - `css/pages/calendar.css` — 캘린더: 달력 칸, 월 이동 버튼, 범례
  - `css/pages/date.css` — 날짜 상세: 뒤로 가기 링크
  - 한 페이지에서만 쓰는 스타일은 그 페이지 파일에, 두 페이지 이상 쓰면 `common.css`에 둔다
- `js/common.js` — `<head>`에서 불러온다. 날짜(Asia/Seoul)·이스케이프·공통 렌더 함수, 상단 메뉴 `<ws-nav active="main|request|calendar">`, 자정 넘김 감지 `WS.onDayChange`
- `js/api.js` — API 클라이언트. 응답 형식은 파일 상단 주석 참고

## 코드 작성 규칙

C 언어에 익숙한 사람도 바로 읽을 수 있도록 쉬운 문법만 쓴다.

- 반복은 `for (let i = 0; i < n; i++)`. `map`·`filter`·`forEach`·`reduce`·`find`·`repeat` 같은 메서드 체인은 쓰지 않는다
- 함수는 `function` 키워드로 만든다. 화살표 함수(`=>`)는 쓰지 않는다
- 문자열은 `+`로 잇는다. 템플릿 문자열(`` ` ``)은 쓰지 않는다
- 구조 분해(`const { a } = obj`), 스프레드(`...`), `Object.fromEntries`, `Set`, `?.`, `??`는 쓰지 않는다
- 조건이 둘 이상 겹치면 삼항 연산자 대신 `if` / `else`
- 정규식 대신 글자 단위 검사 (`WS.isValidISO` 참고)
- 예외: 서버 요청은 `async` / `await`, 상단 메뉴 `<ws-nav>`는 브라우저 규칙상 `class`가 필요해서 그대로 쓴다

## 백엔드 연결

지금은 `js/api.js`의 `USE_MOCK = true`라서 브라우저 localStorage에 저장하는 목 서버로 동작한다.
백엔드가 준비되면 `USE_MOCK = false`, `API_BASE`를 서버 주소로 바꾼다.

목 모드에서 URL에 `?mockFail=1`을 붙이면 모든 요청이 실패해 오류 화면을 확인할 수 있다.
목 데이터를 초기화하려면 개발자 도구에서 `localStorage.removeItem('wakesong.requests.v1')`.
