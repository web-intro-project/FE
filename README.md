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

- `css/style.css` — 페이지가 불러오는 유일한 CSS. 폰트와 아래 세 파일을 `@import`
  - `css/tokens.css` — 디자인 토큰 (tokens.json에서 생성)
  - `css/bundle.css` — 디자인 시스템 컴포넌트 스타일. 원본에서 줄바꿈·들여쓰기만 정리했고 규칙은 수정 금지
  - `css/app.css` — 보조 스타일 (스켈레톤 등)
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
