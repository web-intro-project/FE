/* =====================================================================
 * 기상송 — API 클라이언트 (서버와 데이터를 주고받는 창구)
 * ---------------------------------------------------------------------
 * 이 파일이 하는 일
 *   화면(HTML)은 서버 주소나 통신 방법을 몰라도 되도록,
 *   "서버에 물어보는 일"을 전부 이 파일의 WS.api 에 모아 둔다.
 *   화면 코드는 WS.api.getToday() 처럼 부르기만 하면 된다.
 *
 * 두 가지 모드
 *   USE_MOCK = true  : 백엔드 없이 브라우저 localStorage에 저장하는 목(mock, 가짜) 서버로 동작.
 *                      백엔드가 아직 없어도 화면을 끝까지 만들고 시험해 볼 수 있다.
 *   USE_MOCK = false : API_BASE의 실제 서버로 fetch(인터넷 요청)를 보낸다.
 *   두 모드 모두 함수 이름과 돌려주는 모양이 똑같아서, 화면 코드는 고칠 필요가 없다.
 *
 * 응답 형식 (실서버도 같은 모양으로 맞춘다)
 *   GET  /api/today                 → { date, requestCount, song: { title, artist, applicantName } | null }
 *   GET  /api/calendar?month=YYYY-MM → { month, days: [{ date, requestCount, songs: [{ title, artist }] }] }
 *   GET  /api/requests?date=YYYY-MM-DD → { date, requests: [{ id, date, songTitle, artist, applicantName, createdAt }] }  (createdAt 오름차순)
 *   POST /api/requests { date, songTitle, artist, applicantName }
 *        201 → { id, date, songTitle, artist, applicantName, createdAt }
 *        400 → { message, field }
 *
 * 목 모드에서 URL에 ?mockFail=1 을 붙이면 모든 요청이 500으로 실패한다 (오류 화면 확인용).
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

  const USE_MOCK = true; // ← 실제 서버가 준비되면 false 로 바꾼다
  const API_BASE = '';   // ← 실제 서버 주소 (예: 'https://api.example.com'). 비우면 같은 사이트로 요청

  // 오류 객체를 만든다. 기본 Error 에 두 가지 정보를 더 붙인다.
  //   status : HTTP 상태 코드 (0 = 인터넷 연결 실패, 400 = 입력 오류, 500 = 서버 오류 …)
  //   field  : 어느 입력 칸이 문제인지 (예: 'artist'). 화면이 그 칸 아래에 오류를 띄우는 데 쓴다.
  function apiError(status, message, field) {
    const err = new Error(message);
    err.status = status;
    err.field = field || null;
    return err;
  }

  /* =================================================================
   * 1. 실서버 (USE_MOCK = false 일 때 사용)
   * ================================================================= */

  // 실제 서버에 요청을 보내고, 받은 JSON 데이터를 돌려준다.
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

    // 요청 보내기. 여기서 실패하면 서버까지 가지도 못한 것(인터넷 끊김 등)이다.
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
      data = null; // 본문이 JSON이 아님
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

  // 화면이 부를 함수 4개 (실서버 버전). 각각 위의 응답 형식 표와 1:1로 대응한다.
  // encodeURIComponent : 주소에 넣을 값에 특수문자가 있어도 깨지지 않게 변환한다.
  const httpApi = {
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

  /* =================================================================
   * 2. 목 서버 (USE_MOCK = true 일 때 사용)
   * -----------------------------------------------------------------
   * 실제 서버 대신 브라우저 안에서 흉내 내는 가짜 서버.
   * 신청 데이터는 브라우저의 localStorage(브라우저에 남는 작은 저장 공간)에 저장한다.
   * 그래서 새로고침해도 신청한 곡이 남아 있다. (다른 컴퓨터·브라우저와는 공유되지 않음)
   * 초기화: 개발자 도구 콘솔에서 localStorage.removeItem('wakesong.requests.v1')
   * ================================================================= */
  const KEY = 'wakesong.requests.v1'; // localStorage 에 저장할 때 쓰는 이름표

  // 처음 열었을 때 보여 줄 예시 데이터 (디자인 시스템 미리보기와 같은 내용)
  // 한 줄 = 신청 1건: [날짜, 곡 제목, 가수, 신청자, 접수 시각]
  const SEED_ROWS = [
    ['2026-10-01', 'Hype Boy', 'NewJeans', '정민재', '2026-09-30T21:10:00+09:00'],
    ['2026-10-02', '좋은 날', '아이유', '김서연', '2026-10-01T07:40:00+09:00'],
    ['2026-10-06', '사건의 지평선', '윤하', '이도윤', '2026-10-05T08:02:00+09:00'],
    ['2026-10-06', 'Love wins all', '아이유', '최하은', '2026-10-05T19:20:00+09:00'],
    ['2026-10-08', 'Super Shy', 'NewJeans', '박준호', '2026-10-07T22:15:00+09:00'],
    ['2026-10-13', 'Ditto', 'NewJeans', '김서연', '2026-10-12T07:55:00+09:00'],
    ['2026-10-15', '밤편지', '아이유', '정민재', '2026-10-14T23:01:00+09:00'],
    ['2026-10-19', '밤양갱', '비비 (BIBI)', '박준호', '2026-10-18T07:12:00+09:00'],
    ['2026-10-19', 'Supernova', 'aespa', '이도윤', '2026-10-18T08:40:00+09:00'],
    ['2026-10-19', 'APT.', '로제', '최하은', '2026-10-18T12:05:00+09:00'],
    ['2026-10-20', 'Magnetic', '아일릿', '김서연', '2026-10-18T09:30:00+09:00'],
    ['2026-10-20', 'How Sweet', 'NewJeans', '정민재', '2026-10-18T21:47:00+09:00'],
    ['2026-10-21', '한 페이지가 될 수 있게', 'DAY6', '김서연', '2026-10-18T07:12:00+09:00'],
    ['2026-10-21', 'Welcome to the Show', 'DAY6', '이도윤', '2026-10-18T08:40:00+09:00'],
    ['2026-10-21', '예뻤어', 'DAY6', '최하은', '2026-10-18T12:05:00+09:00'],
    ['2026-10-21', 'Small girl', '이영지', '정민재', '2026-10-18T19:33:00+09:00'],
    ['2026-10-23', '청춘만화', '이무진', '박준호', '2026-10-18T20:11:00+09:00'],
    ['2026-10-27', '에피소드', '이무진', '최하은', '2026-10-18T22:30:00+09:00'],
    ['2026-10-30', '첫 만남은 계획대로 되지 않아', 'TWS', '이도윤', '2026-10-19T06:58:00+09:00'],
  ];

  // 위의 배열 한 줄을 서버가 주는 것과 같은 모양의 객체로 바꾼다.
  // 번호(id)는 1부터 차례로 붙인다.
  // 예: ['2026-10-01', 'Hype Boy', ...] → { id: 1, date: '2026-10-01', songTitle: 'Hype Boy', ... }
  function makeSeed() {
    const list = [];
    for (let i = 0; i < SEED_ROWS.length; i++) {
      const s = SEED_ROWS[i];
      list.push({ id: i + 1, date: s[0], songTitle: s[1], artist: s[2], applicantName: s[3], createdAt: s[4] });
    }
    return list;
  }

  // 저장된 신청 목록을 불러온다. 저장된 게 없으면 예시 데이터로 시작한다.
  // localStorage 에는 문자열만 저장되므로 JSON.parse 로 다시 배열로 바꾼다.
  // (사생활 보호 모드 등에서 localStorage 를 못 쓰면 오류가 나므로 try 로 감싼다)
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      // 저장소를 못 쓰면 예시 데이터로
    }
    return makeSeed();
  }

  // 신청 목록 전체를 localStorage 에 저장한다. (배열 → JSON 문자열)
  function save(list) {
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
    } catch (e) {
      // 무시: 새로고침 시 사라짐
    }
  }

  // 목 서버의 "데이터베이스" 역할. 페이지가 열릴 때 한 번 불러와서 메모리에 들고 있는다.
  const rows = load();

  // 해당 날짜의 신청만 골라서 접수 순서(createdAt 오름차순, 먼저 신청한 게 앞)로 정렬한다.
  function byDate(date) {
    const list = [];
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].date === date) list.push(rows[i]);
    }
    // sort 에 비교 함수를 넘긴다. (C의 qsort 와 같은 방식)
    // 음수를 돌려주면 a가 앞, 양수면 b가 앞. Date.parse 는 시각을 밀리초 숫자로 바꾼다.
    list.sort(function (a, b) {
      return Date.parse(a.createdAt) - Date.parse(b.createdAt);
    });
    return list;
  }

  // ms 밀리초 동안 기다린다. (await delay(300) → 0.3초 쉬기)
  // Promise 는 "나중에 끝나는 일"을 나타내는 객체. setTimeout 이 끝나면 resolve 로 완료를 알린다.
  function delay(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  // 목 서버의 모든 함수가 맨 처음 부르는 준비 단계.
  //  - 진짜 서버처럼 0.25~0.5초 기다린다. (로딩 스켈레톤이 실제로 보이는지 확인하려고)
  //  - 주소에 ?mockFail=1 이 있으면 일부러 500 오류를 던진다. (오류 화면 확인용)
  async function mockWait() {
    await delay(250 + Math.random() * 250); // Math.random() = 0 이상 1 미만의 무작위 수
    if (WS.param('mockFail') === '1') throw apiError(500, '서버 오류');
  }

  // 신청 내용을 검사한다. 클라이언트 폼과 같은 규칙(WS.validateField)을 쓴다.
  // 문제가 있으면 첫 번째 오류 하나만 { field, message } 로 돌려주고, 없으면 null.
  // 진짜 서버도 이렇게 400 응답에 { message, field } 를 담아 보내기로 약속돼 있다.
  function validate(body) {
    const today = WS.todayISO();
    for (let i = 0; i < WS.FIELDS.length; i++) {
      const field = WS.FIELDS[i];
      const message = WS.validateField(field, body[field], today);
      if (message) return { field: field, message: message };
    }
    return null;
  }

  // 새 신청에 붙일 번호: 지금까지 가장 큰 번호 + 1
  function nextId() {
    let max = 0;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].id > max) max = rows[i].id;
    }
    return max + 1;
  }

  // 화면이 부를 함수 4개 (목 서버 버전). 실서버 버전(httpApi)과 이름·결과 모양이 똑같다.
  const mockApi = {
    // 오늘의 기상송: 오늘 신청 중 가장 먼저 접수된 곡이 대표곡이다.
    getToday: async function () {
      await mockWait();
      const date = WS.todayISO();
      const list = byDate(date);

      let song = null; // 오늘 신청이 하나도 없으면 null
      if (list.length > 0) {
        const first = list[0];
        song = { title: first.songTitle, artist: first.artist, applicantName: first.applicantName };
      }
      return { date: date, requestCount: list.length, song: song };
    },

    // 한 달 치 요약: 1일부터 말일까지 하루씩, 신청 건수와 곡 목록을 담는다.
    // 예: getCalendar('2026-10') → { month: '2026-10', days: [{ date: '2026-10-01', requestCount: 1, songs: [...] }, ... 31개] }
    getCalendar: async function (month) {
      await mockWait();
      const y = Number(month.slice(0, 4));
      const m = Number(month.slice(5, 7));
      const lastDay = WS.daysInMonth(y, m); // 그 달의 마지막 날 (28~31)

      const days = [];
      for (let d = 1; d <= lastDay; d++) {
        // 날짜 문자열 만들기: 한 자리 날짜는 앞에 0 (예: "2026-10-05")
        let date = month + '-' + d;
        if (d < 10) date = month + '-0' + d;

        // 그날 신청곡의 제목·가수만 뽑는다 (달력에는 신청자 이름이 필요 없음)
        const list = byDate(date);
        const songs = [];
        for (let i = 0; i < list.length; i++) {
          songs.push({ title: list[i].songTitle, artist: list[i].artist });
        }
        days.push({ date: date, requestCount: list.length, songs: songs });
      }
      return { month: month, days: days };
    },

    // 하루 치 신청 목록 (접수 순)
    getRequests: async function (date) {
      await mockWait();
      return { date: date, requests: byDate(date) };
    },

    // 새 신청 저장. 순서: 공백 정리 → 검사 → 번호·시각 붙여 저장 → 저장된 신청 돌려주기
    createRequest: async function (body) {
      await mockWait();

      // 앞뒤 공백을 지운 값만 저장한다 (예: "  밤편지 " → "밤편지")
      const clean = {};
      for (let i = 0; i < WS.FIELDS.length; i++) {
        const field = WS.FIELDS[i];
        clean[field] = (body[field] || '').trim();
      }

      // 규칙에 어긋나면 400 오류 (화면은 field 를 보고 해당 칸에 빨간 글씨를 띄운다)
      const err = validate(clean);
      if (err) throw apiError(400, err.message, err.field);

      const row = {
        id: nextId(),
        date: clean.date,
        songTitle: clean.songTitle,
        artist: clean.artist,
        applicantName: clean.applicantName,
        createdAt: new Date().toISOString(), // 지금 시각 (예: "2026-10-20T01:19:43.181Z")
      };
      rows.push(row); // 메모리 목록에 추가하고
      save(rows);     // 브라우저 저장소에도 기록
      return row;
    },
  };

  // 설정에 따라 둘 중 하나를 WS.api 로 내보낸다. 화면 코드는 어느 쪽인지 신경 쓰지 않는다.
  if (USE_MOCK) WS.api = mockApi;
  else WS.api = httpApi;
})();
