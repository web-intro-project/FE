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
  const WS = (window.WS = window.WS || {});

  const USE_MOCK = true;
  const API_BASE = '';

  class ApiError extends Error {
    constructor(status, message, field) {
      super(message);
      this.status = status;
      this.field = field || null;
    }
  }

  /* ---------- 실서버 ---------- */
  async function http(method, path, body) {
    let res;
    try {
      res = await fetch(API_BASE + path, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      throw new ApiError(0, '네트워크에 연결하지 못했어요.');
    }
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new ApiError(res.status, (data && data.message) || '요청을 처리하지 못했어요.', data && data.field);
    return data;
  }

  /* ---------- 목 서버 ---------- */
  const KEY = 'wakesong.requests.v1';

  // 디자인 시스템 미리보기의 예시 데이터
  const SEED = [
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
  ].map(([date, songTitle, artist, applicantName, createdAt], i) => ({ id: i + 1, date, songTitle, artist, applicantName, createdAt }));

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* 저장소를 못 쓰면 예시 데이터로 */ }
    return SEED.slice();
  }

  function save(rows) {
    try { localStorage.setItem(KEY, JSON.stringify(rows)); } catch (e) { /* 무시: 새로고침 시 사라짐 */ }
  }

  let rows = load();

  function byDate(date) {
    return rows.filter((r) => r.date === date).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  }

  function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }

  async function mock(handler) {
    await delay(250 + Math.random() * 250);
    if (WS.param('mockFail') === '1') throw new ApiError(500, '서버 오류');
    return handler();
  }

  // 클라이언트 폼과 같은 규칙(WS.validateField)으로 검사. 첫 오류만 돌려준다.
  function validate(body) {
    const today = WS.todayISO();
    for (const field of WS.FIELDS) {
      const message = WS.validateField(field, body[field], today);
      if (message) return { field, message };
    }
    return null;
  }

  const mockApi = {
    getToday: () => mock(() => {
      const date = WS.todayISO();
      const list = byDate(date);
      const first = list[0];
      return {
        date,
        requestCount: list.length,
        song: first ? { title: first.songTitle, artist: first.artist, applicantName: first.applicantName } : null,
      };
    }),

    getCalendar: (month) => mock(() => {
      const [y, m] = month.split('-').map(Number);
      const days = [];
      for (let d = 1; d <= WS.daysInMonth(y, m); d++) {
        const date = `${month}-${String(d).padStart(2, '0')}`;
        const list = byDate(date);
        days.push({ date, requestCount: list.length, songs: list.map((r) => ({ title: r.songTitle, artist: r.artist })) });
      }
      return { month, days };
    }),

    getRequests: (date) => mock(() => ({ date, requests: byDate(date) })),

    createRequest: (body) => mock(() => {
      const clean = {
        date: body.date,
        songTitle: (body.songTitle || '').trim(),
        artist: (body.artist || '').trim(),
        applicantName: (body.applicantName || '').trim(),
      };
      const err = validate(clean);
      if (err) throw new ApiError(400, err.message, err.field);
      const row = { id: rows.reduce((max, r) => Math.max(max, r.id), 0) + 1, ...clean, createdAt: new Date().toISOString() };
      rows = rows.concat(row);
      save(rows);
      return row;
    }),
  };

  const httpApi = {
    getToday: () => http('GET', '/api/today'),
    getCalendar: (month) => http('GET', `/api/calendar?month=${encodeURIComponent(month)}`),
    getRequests: (date) => http('GET', `/api/requests?date=${encodeURIComponent(date)}`),
    createRequest: (body) => http('POST', '/api/requests', body),
  };

  WS.api = USE_MOCK ? mockApi : httpApi;
  WS.ApiError = ApiError;
})();
