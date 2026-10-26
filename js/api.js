/* =====================================================================
 * 기상송 — API 클라이언트 (서버와 데이터를 주고받는 창구)
 * ---------------------------------------------------------------------
 * 이 파일이 하는 일
 *   화면(HTML)은 서버 주소나 통신 방법을 몰라도 되도록,
 *   "서버에 물어보는 일"을 전부 이 파일의 WS.api 에 모아 둔다.
 *   화면 코드는 WS.api.getToday() 처럼 부르기만 하면 된다.
 *
 * 응답 형식 (백엔드 API 명세서와 같다)
 *   GET  /api/today                 → { date, requestCount, song: { id, title, artist, applicantName } | null }
 *   GET  /api/calendar?month=YYYY-MM → { month, days: [{ date, requestCount, songs: [{ id, title, artist }] }] }  (그 달 모든 날짜)
 *   GET  /api/requests?date=YYYY-MM-DD → { date, requests: [{ id, date, songTitle, artist, applicantName, createdAt }] }  (접수 순 = id 오름차순)
 *   POST /api/requests { date, songTitle, artist, applicantName }
 *        201 → { id, date, songTitle, artist, applicantName, createdAt }  (createdAt 은 UTC 시각)
 *        400 → { code: 'VALIDATION_ERROR', message, field }  (field 는 틀린 입력칸 이름, 없으면 null)
 *   그 밖의 오류(404·500 등)는 message 가 없어서 기본 문구 "요청을 처리하지 못했어요."를 쓴다.
 *
 * 비동기(async / await) 간단 설명
 *   서버 응답은 바로 오지 않고 시간이 걸린다. async 가 붙은 함수는 "나중에 결과가 오는 함수"이고,
 *   부르는 쪽에서 await 를 붙이면 결과가 올 때까지 기다렸다가 다음 줄로 넘어간다.
 *   실패하면 throw 로 오류가 던져지므로, 부르는 쪽은 try { ... } catch (e) { ... } 로 받는다.
 * ===================================================================== */
(function () {
  // common.js 에서 만든 WS 상자를 그대로 이어서 쓴다.
  const WS = window.WS || {};
  window.WS = WS;

  const API_BASE = 'http://localhost:8080'; // ← 백엔드 서버 주소. 배포할 때 그 주소로 바꾼다

  // 오류 객체를 만든다. 기본 Error 에 두 가지 정보를 더 붙인다.
  //   status : HTTP 상태 코드 (0 = 인터넷 연결 실패, 400 = 입력 오류, 500 = 서버 오류 …)
  //   field  : 어느 입력 칸이 문제인지 (예: 'artist'). 화면이 그 칸 아래에 오류를 띄우는 데 쓴다.
  function apiError(status, message, field) {
    const err = new Error(message);
    err.status = status;
    err.field = field || null;
    return err;
  }

  // 서버에 요청을 보내고, 받은 JSON 데이터를 돌려준다.
  //   method : 'GET'(가져오기) 또는 'POST'(새로 만들기)
  //   path   : 서버 주소 뒤에 붙는 경로 (예: '/api/today')
  //   body   : POST 로 보낼 데이터 객체. GET 이면 넘기지 않는다.
  // 실패하면 apiError 를 throw 한다.
  async function http(method, path, body) {
    // fetch 에 넘길 설정. 보낼 데이터가 있으면 JSON 문자열로 바꿔 담는다.
    const options = { method: method };
    if (body) {
      options.headers = { 'Content-Type': 'application/json' }; // "JSON 보낸다"고 서버에 알림
      options.body = JSON.stringify(body);                       // 객체 → JSON 문자열
    }

    // 요청 보내기. 여기서 실패하면 서버까지 가지도 못한 것(서버 꺼짐, 인터넷 끊김 등)이다.
    let res;
    try {
      res = await fetch(API_BASE + path, options);
    } catch (e) {
      throw apiError(0, '네트워크에 연결하지 못했어요.');
    }

    // 응답 본문을 JSON 으로 읽는다. 본문이 비었거나 JSON 이 아니면 null 로 둔다.
    let data = null;
    try {
      data = await res.json();
    } catch (e) {
      data = null; // 본문이 JSON이 아님 (예: CORS 403 "Invalid CORS request")
    }

    // res.ok 는 상태 코드가 200~299(성공)일 때 true.
    // 실패면 서버가 보내 준 message / field 를 오류에 담아 던진다. (없으면 기본 문장)
    if (!res.ok) {
      let message = '요청을 처리하지 못했어요.';
      let field = null;
      if (data && data.message) message = data.message;
      if (data && data.field) field = data.field;
      throw apiError(res.status, message, field);
    }
    return data;
  }

  // 화면이 부를 함수 4개. 각각 위의 응답 형식 표와 1:1로 대응한다.
  // encodeURIComponent : 주소에 넣을 값에 특수문자가 있어도 깨지지 않게 변환한다.
  WS.api = {
    // 오늘의 기상송 (메인 화면 큰 카드)
    getToday: function () {
      return http('GET', '/api/today');
    },
    // 한 달 치 날짜별 신청 요약 (달력 화면, 메인의 "이번 주")
    getCalendar: function (month) {
      return http('GET', '/api/calendar?month=' + encodeURIComponent(month));
    },
    // 하루 치 신청 목록 (날짜 상세, 신청 화면 오른쪽, 완료 화면)
    getRequests: function (date) {
      return http('GET', '/api/requests?date=' + encodeURIComponent(date));
    },
    // 새 신청 저장 (신청 화면의 "신청하기" 버튼)
    createRequest: function (body) {
      return http('POST', '/api/requests', body);
    },
  };
})();
