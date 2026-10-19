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

- `css/tokens.css` — 디자인 토큰 (tokens.json에서 생성)
- `css/bundle.css` — 디자인 시스템 컴포넌트 스타일 (원본 그대로, 수정 금지)
- `css/app.css` — 보조 스타일
- `js/common.js` — 날짜(Asia/Seoul)·이스케이프·공통 렌더 함수
- `js/api.js` — API 클라이언트. 응답 형식은 파일 상단 주석 참고

## 백엔드 연결

지금은 `js/api.js`의 `USE_MOCK = true`라서 브라우저 localStorage에 저장하는 목 서버로 동작한다.
백엔드가 준비되면 `USE_MOCK = false`, `API_BASE`를 서버 주소로 바꾼다.

목 모드에서 URL에 `?mockFail=1`을 붙이면 모든 요청이 실패해 오류 화면을 확인할 수 있다.
목 데이터를 초기화하려면 개발자 도구에서 `localStorage.removeItem('wakesong.requests.v1')`.
