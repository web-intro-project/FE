/* 기상송 — API 클라이언트.
 *
 * USE_MOCK = true  : 백엔드 없이 브라우저 localStorage에 저장하는 목(mock) 서버로 동작.
 * USE_MOCK = false : API_BASE의 실제 서버로 fetch.
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
 */
(function () {
  const WS = window.WS || {};
  window.WS = WS;

  const USE_MOCK = true;
  const API_BASE = '';

  // 오류 객체: message 외에 status(HTTP 상태 코드)와 field(문제가 된 입력 칸)를 붙인다
  function apiError(status, message, field) {
    const err = new Error(message);
    err.status = status;
    err.field = field || null;
    return err;
  }

  /* ---------- 실서버 ---------- */
  async function http(method, path, body) {
    const options = { method: method };
    if (body) {
      options.headers = { 'Content-Type': 'application/json' };
      options.body = JSON.stringify(body);
    }

    let res;
    try {
      res = await fetch(API_BASE + path, options);
    } catch (e) {
      throw apiError(0, '네트워크에 연결하지 못했어요.');
    }

    let data = null;
    try {
      data = await res.json();
    } catch (e) {
      data = null; // 본문이 JSON이 아님
    }

    if (!res.ok) {
      let message = '요청을 처리하지 못했어요.';
      let field = null;
      if (data && data.message) message = data.message;
      if (data && data.field) field = data.field;
      throw apiError(res.status, message, field);
    }
    return data;
  }

  const httpApi = {
    getToday: function () {
      return http('GET', '/api/today');
    },
    getCalendar: function (month) {
      return http('GET', '/api/calendar?month=' + encodeURIComponent(month));
    },
    getRequests: function (date) {
      return http('GET', '/api/requests?date=' + encodeURIComponent(date));
    },
    createRequest: function (body) {
      return http('POST', '/api/requests', body);
    },
  };

  /* ---------- 목 서버 ---------- */
  const KEY = 'wakesong.requests.v1';

  // 디자인 시스템 미리보기의 예시 데이터: [날짜, 곡 제목, 가수, 신청자, 접수 시각]
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

  function makeSeed() {
    const list = [];
    for (let i = 0; i < SEED_ROWS.length; i++) {
      const s = SEED_ROWS[i];
      list.push({ id: i + 1, date: s[0], songTitle: s[1], artist: s[2], applicantName: s[3], createdAt: s[4] });
    }
    return list;
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      // 저장소를 못 쓰면 예시 데이터로
    }
    return makeSeed();
  }

  function save(list) {
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
    } catch (e) {
      // 무시: 새로고침 시 사라짐
    }
  }

  const rows = load();

  // 해당 날짜의 신청을 접수 순서(createdAt 오름차순)로
  function byDate(date) {
    const list = [];
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].date === date) list.push(rows[i]);
    }
    list.sort(function (a, b) {
      return Date.parse(a.createdAt) - Date.parse(b.createdAt);
    });
    return list;
  }

  function delay(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  // 실제 서버처럼 잠깐 기다린다. ?mockFail=1 이면 실패시킨다.
  async function mockWait() {
    await delay(250 + Math.random() * 250);
    if (WS.param('mockFail') === '1') throw apiError(500, '서버 오류');
  }

  // 클라이언트 폼과 같은 규칙(WS.validateField)으로 검사. 첫 오류만 돌려준다.
  function validate(body) {
    const today = WS.todayISO();
    for (let i = 0; i < WS.FIELDS.length; i++) {
      const field = WS.FIELDS[i];
      const message = WS.validateField(field, body[field], today);
      if (message) return { field: field, message: message };
    }
    return null;
  }

  function nextId() {
    let max = 0;
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].id > max) max = rows[i].id;
    }
    return max + 1;
  }

  const mockApi = {
    getToday: async function () {
      await mockWait();
      const date = WS.todayISO();
      const list = byDate(date);

      let song = null;
      if (list.length > 0) {
        const first = list[0];
        song = { title: first.songTitle, artist: first.artist, applicantName: first.applicantName };
      }
      return { date: date, requestCount: list.length, song: song };
    },

    getCalendar: async function (month) {
      await mockWait();
      const y = Number(month.slice(0, 4));
      const m = Number(month.slice(5, 7));
      const lastDay = WS.daysInMonth(y, m);

      const days = [];
      for (let d = 1; d <= lastDay; d++) {
        let date = month + '-' + d;
        if (d < 10) date = month + '-0' + d;

        const list = byDate(date);
        const songs = [];
        for (let i = 0; i < list.length; i++) {
          songs.push({ title: list[i].songTitle, artist: list[i].artist });
        }
        days.push({ date: date, requestCount: list.length, songs: songs });
      }
      return { month: month, days: days };
    },

    getRequests: async function (date) {
      await mockWait();
      return { date: date, requests: byDate(date) };
    },

    createRequest: async function (body) {
      await mockWait();

      // 앞뒤 공백을 지운 값만 저장한다
      const clean = {};
      for (let i = 0; i < WS.FIELDS.length; i++) {
        const field = WS.FIELDS[i];
        clean[field] = (body[field] || '').trim();
      }

      const err = validate(clean);
      if (err) throw apiError(400, err.message, err.field);

      const row = {
        id: nextId(),
        date: clean.date,
        songTitle: clean.songTitle,
        artist: clean.artist,
        applicantName: clean.applicantName,
        createdAt: new Date().toISOString(),
      };
      rows.push(row);
      save(rows);
      return row;
    },
  };

  if (USE_MOCK) WS.api = mockApi;
  else WS.api = httpApi;
})();
