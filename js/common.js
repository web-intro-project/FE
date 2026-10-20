/* =====================================================================
 * 기상송 — 공통 유틸과 컴포넌트 렌더 함수
 * ---------------------------------------------------------------------
 * 이 파일이 하는 일
 *   여러 페이지(index, request, complete, calendar, date)가 똑같이 쓰는
 *   함수들을 한곳에 모아 둔 "공용 도구 상자"다.
 *     1) 날짜 계산·표시   (오늘 날짜, n일 뒤, "10월 21일 수요일" 같은 글자 만들기)
 *     2) 문자열·URL 도구  (HTML 특수문자 바꾸기, 주소창 ?date= 읽고 쓰기)
 *     3) 화면 조각 만들기 (오류 배너, 빈 화면 안내, 로딩 스켈레톤, 신청 목록)
 *     4) 입력 검증       (신청 폼과 목 서버가 같은 규칙을 쓰도록)
 *     5) 상단 메뉴 <ws-nav>
 *
 * 어떻게 쓰나
 *   모든 HTML의 <head>에서 이 파일을 가장 먼저 불러온다.
 *   여기서 만든 함수는 전역 객체 WS에 붙여 두므로,
 *   다른 파일에서는 WS.todayISO(), WS.esc() 처럼 꺼내 쓴다.
 *
 * 날짜 기준
 *   학교(기숙사)는 한국에 있으므로 모든 "오늘"은 한국 시간(Asia/Seoul) 기준이다.
 *   사용자의 컴퓨터 시간대가 달라도 한국 날짜로 계산된다.
 *   날짜는 서버와 주고받는 형식 그대로 "YYYY-MM-DD" 문자열로 다룬다.
 *   (예: "2026-10-21") 이 형식은 글자 순서대로 비교해도 날짜 순서와 같아서
 *   "2026-10-20" < "2026-10-21" 처럼 문자열 비교로 앞뒤를 알 수 있다.
 * ===================================================================== */

// (function () { ... })(); 는 "바로 실행되는 함수"다.
// 안에서 만든 변수·함수가 바깥(전역)으로 새어 나가지 않게 감싸는 용도.
// 바깥에 보여 줄 것만 맨 아래에서 WS 객체에 직접 붙인다.
(function () {
  // WS = 이 프로젝트 전용 "이름표 상자". 이미 있으면 그대로 쓰고, 없으면 새로 만든다.
  // window.WS 에 넣어 두면 다른 <script>에서도 WS 로 접근할 수 있다.
  const WS = window.WS || {};
  window.WS = WS;

  const TZ = 'Asia/Seoul';                              // 기준 시간대: 한국
  const DOW = ['일', '월', '화', '수', '목', '금', '토']; // 요일 이름. 0 = 일요일 … 6 = 토요일

  /* =================================================================
   * 1. 날짜 (기준 시간대 Asia/Seoul, API 형식 YYYY-MM-DD)
   * ================================================================= */

  // 한 자리 숫자 앞에 0을 붙여 두 자리로 만든다.
  // 예: 7 → "07", 12 → "12"
  function pad2(n) {
    if (n < 10) return '0' + n;
    return String(n);
  }

  // 연, 월, 일 숫자 세 개를 "YYYY-MM-DD" 문자열로 합친다.
  // 예: makeISO(2026, 3, 5) → "2026-03-05"
  function makeISO(y, m, d) {
    return y + '-' + pad2(m) + '-' + pad2(d);
  }

  // 오늘 날짜(한국 시간)를 "YYYY-MM-DD"로 돌려준다.
  // Intl.DateTimeFormat 은 브라우저에 들어 있는 날짜 서식 도구다.
  // timeZone 을 'Asia/Seoul'로 주면 컴퓨터 시간대와 상관없이 한국 날짜가 나온다.
  // 'en-CA'(캐나다 영어) 서식이 마침 "YYYY-MM-DD" 모양이라서 그대로 쓴다.
  function todayISO() {
    const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
    return fmt.format(new Date()); // new Date() = 지금 이 순간
  }

  // "YYYY-MM-DD" 문자열을 숫자 세 개로 쪼갠다.
  // 예: "2026-10-21" → { y: 2026, m: 10, d: 21 }
  // slice(시작, 끝) 은 문자열의 [시작, 끝) 구간을 잘라 낸다. (끝 글자는 포함 안 함)
  //   위치: 0123456789
  //         2026-10-21
  function parseISO(iso) {
    const y = Number(iso.slice(0, 4));  // "2026"
    const m = Number(iso.slice(5, 7));  // "10"
    const d = Number(iso.slice(8, 10)); // "21"
    return { y: y, m: m, d: d };
  }

  // 윤년인지 확인한다. (2월이 29일까지 있는 해)
  // 규칙: 4로 나누어떨어지면 윤년, 단 100으로 나누어떨어지면 평년,
  //       그래도 400으로 나누어떨어지면 다시 윤년. (예: 2000년 윤년, 1900년 평년)
  function isLeapYear(y) {
    return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  }

  // y년 m월이 며칠까지 있는지 돌려준다. (28 / 29 / 30 / 31)
  // 달력 칸 수를 정하거나, "2026-02-30" 같은 없는 날짜를 걸러 낼 때 쓴다.
  function daysInMonth(y, m) {
    if (m === 2) {
      if (isLeapYear(y)) return 29;
      return 28;
    }
    if (m === 4 || m === 6 || m === 9 || m === 11) return 30; // 30일까지 있는 달
    return 31;                                                  // 나머지는 31일
  }

  // 문자열이 "YYYY-MM-DD" 형식이고, 달력에 실제로 있는 날짜인지 검사한다.
  // 주소창(?date=)으로 들어온 값은 아무 글자나 될 수 있으므로 꼭 검사한 뒤에 쓴다.
  // 예: "2026-10-21" → true, "2026-02-30" → false(없는 날), "abc" → false
  function isValidISO(iso) {
    // 문자열이 아니거나 길이가 10글자가 아니면 바로 탈락
    if (typeof iso !== 'string' || iso.length !== 10) return false;

    // 글자를 하나씩 검사: 4번째·7번째 칸은 '-', 나머지는 숫자 '0'~'9' 여야 한다.
    for (let i = 0; i < 10; i++) {
      const c = iso[i];
      if (i === 4 || i === 7) {
        if (c !== '-') return false;
      } else if (c < '0' || c > '9') { // 글자도 C처럼 크기 비교가 된다
        return false;
      }
    }

    // 모양은 맞으니 숫자로 바꿔서 월·일 범위를 확인한다.
    const p = parseISO(iso);
    if (p.m < 1 || p.m > 12) return false;                    // 월은 1~12
    if (p.d < 1 || p.d > daysInMonth(p.y, p.m)) return false; // 일은 그 달의 마지막 날까지
    return true;
  }

  // 문자열이 "YYYY-MM" 형식이고 1~12월인지 검사한다. (달력 화면의 ?month= 검사용)
  // 뒤에 "-01"을 붙여 그 달 1일이 올바른 날짜인지로 대신 확인한다.
  function isValidMonth(month) {
    if (typeof month !== 'string' || month.length !== 7) return false;
    return isValidISO(month + '-01');
  }

  // 날짜에 n일을 더한다. (n이 음수면 뺀다)
  // 예: addDays("2026-10-31", 1) → "2026-11-01" (월이 자동으로 넘어감)
  // Date.UTC(연, 월-1, 일) 로 날짜를 만들면 "32일" 같은 넘치는 값을
  // 브라우저가 알아서 다음 달로 넘겨 준다. 월은 0부터 세므로 m - 1 을 넣는다.
  // UTC(세계 표준시)로 계산하는 이유: 컴퓨터 시간대의 영향을 받지 않게 하려고.
  function addDays(iso, n) {
    const p = parseISO(iso);
    const dt = new Date(Date.UTC(p.y, p.m - 1, p.d + n));
    return makeISO(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
  }

  // 그 날짜의 요일 번호를 돌려준다. 0 = 일요일 … 6 = 토요일
  // DOW[dowOf(iso)] 처럼 쓰면 요일 이름이 된다.
  function dowOf(iso) {
    const p = parseISO(iso);
    return new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
  }

  // 날짜에서 "연-월" 부분만 잘라 낸다.
  // 예: "2026-10-21" → "2026-10"
  function monthOf(iso) {
    return iso.slice(0, 7);
  }

  // "YYYY-MM"에서 n달 앞/뒤로 이동한다. 달력의 ◀ ▶ 버튼에서 쓴다.
  // 예: shiftMonth("2026-12", 1) → "2027-01", shiftMonth("2026-01", -1) → "2025-12"
  // 계산 방법: 연·월을 "0년 1월부터 몇 번째 달인지" 하나의 숫자로 바꾼 뒤
  //           n을 더하고, 다시 12로 나눠 연(몫)과 월(나머지)로 되돌린다.
  function shiftMonth(month, n) {
    const y = Number(month.slice(0, 4));
    const m = Number(month.slice(5, 7));
    const total = y * 12 + (m - 1) + n;  // 0년 1월부터 센 달 수
    const newY = Math.floor(total / 12); // 몫 = 연도
    const newM = total - newY * 12 + 1;  // 나머지 + 1 = 월 (1~12)
    return newY + '-' + pad2(newM);
  }

  /* ---- 화면에 보여 줄 날짜 글자 만들기 ---- */

  // "2026-10-21" → "10월 21일 수요일"
  function formatDate(iso) {
    const p = parseISO(iso);
    return p.m + '월 ' + p.d + '일 ' + DOW[dowOf(iso)] + '요일';
  }

  // "2026-10-21" → "2026년 10월 21일 수요일"
  function formatDateFull(iso) {
    return parseISO(iso).y + '년 ' + formatDate(iso);
  }

  // "2026-10-21" → "10월 21일"
  function formatDateShort(iso) {
    const p = parseISO(iso);
    return p.m + '월 ' + p.d + '일';
  }

  // "2026-10" → "2026년 10월"
  function formatMonth(month) {
    const y = Number(month.slice(0, 4));
    const m = Number(month.slice(5, 7));
    return y + '년 ' + m + '월';
  }

  // 신청 접수 시각(서버가 주는 ISO 타임스탬프)을 "10/18 07:12" 모양으로 바꾼다.
  // 예: "2026-10-17T22:12:00Z"(세계 표준시) → 한국 시간으로 "10/18 07:12"
  // formatToParts 는 서식 결과를 [{ type: 'month', value: '10' }, { type: 'day', ... }, ...]
  // 처럼 조각 배열로 돌려준다. 필요한 조각만 골라 원하는 모양으로 다시 붙인다.
  function formatTime(ts) {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: TZ, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
    });
    const parts = fmt.formatToParts(new Date(ts));

    let month = '', day = '', hour = '', minute = '';
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (part.type === 'month') month = part.value;
      else if (part.type === 'day') day = part.value;
      else if (part.type === 'hour') hour = part.value;
      else if (part.type === 'minute') minute = part.value;
    }
    // Number("07") → 7 : 월은 앞의 0을 떼고 보여 준다 ("10/18", "9/03")
    return Number(month) + '/' + day + ' ' + hour + ':' + minute;
  }

  /* =================================================================
   * 2. 문자열·URL 도구
   * ================================================================= */

  // HTML에 넣기 전에 특수문자를 안전한 글자로 바꾼다. (XSS 방지)
  //
  // 왜 필요한가?
  //   이 프로젝트는 innerHTML 에 HTML 문자열을 넣어서 화면을 그린다.
  //   사용자가 곡 제목에 "<script>나쁜코드</script>" 를 적으면 그게 그대로
  //   HTML로 해석돼 실행될 수 있다. 그래서 사용자가 입력한 값은 전부
  //   esc() 를 거쳐 "<" → "&lt;" 처럼 "글자로만 보이는" 형태로 바꾼 뒤 넣는다.
  //
  // 예: esc('<b>안녕</b>') → '&lt;b&gt;안녕&lt;/b&gt;' (화면에는 <b>안녕</b> 글자 그대로 보임)
  function esc(value) {
    if (value === null || value === undefined) return ''; // 값이 없으면 빈 문자열
    const s = String(value);                               // 숫자 등도 문자열로
    let out = '';
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === '&') out += '&amp;';
      else if (c === '<') out += '&lt;';
      else if (c === '>') out += '&gt;';
      else if (c === '"') out += '&quot;';
      else if (c === "'") out += '&#39;';
      else out += c; // 평범한 글자는 그대로
    }
    return out;
  }

  // 같은 문자열을 count번 이어 붙인다.
  // 예: repeatStr('ab', 3) → 'ababab'
  // 스켈레톤(로딩 중 회색 상자)이나 달력 빈칸을 여러 개 만들 때 쓴다.
  function repeatStr(s, count) {
    let out = '';
    for (let i = 0; i < count; i++) out += s;
    return out;
  }

  // 주소창의 쿼리 값을 읽는다. 없으면 null.
  // 예: 주소가 "date.html?date=2026-10-21" 이면 param('date') → "2026-10-21"
  function param(name) {
    return new URLSearchParams(location.search).get(name);
  }

  // 주소창의 쿼리 값 하나를 바꾼다. (페이지를 새로 불러오지 않고 주소만 바뀜)
  // - 다른 쿼리(예: 테스트용 ?mockFail=1)는 그대로 둔다.
  // - value가 빈 값이면 그 쿼리를 아예 지운다.
  // - push가 true  → 방문 기록을 새로 남긴다. (브라우저 "뒤로 가기"로 이전 값에 돌아갈 수 있음)
  //   push가 false → 지금 기록을 덮어쓴다. (뒤로 가기 기록이 쌓이지 않음)
  // 이렇게 해 두면 새로고침하거나 주소를 공유해도 같은 화면이 나온다.
  function setParam(name, value, push) {
    const params = new URLSearchParams(location.search);
    if (value) params.set(name, value);
    else params.delete(name);

    const qs = params.toString();   // 예: "date=2026-10-21&mockFail=1"
    let url = location.pathname;    // 쿼리가 하나도 없으면 "?" 없이 경로만
    if (qs) url = '?' + qs;

    if (push) history.pushState(null, '', url);
    else history.replaceState(null, '', url);
  }

  /* =================================================================
   * 3. 화면 조각 만들기
   * ================================================================= */

  /* ---------- 아이콘 (선 아이콘, stroke 2, 둥근 끝) ----------
   * SVG 그림을 문자열로 들고 있다가 HTML 안에 끼워 넣는다.
   * aria-hidden="true" : 화면 낭독기(시각장애인용)가 그림을 읽지 않도록 숨김. */
  const icon = {
    plus: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',                                                                          // + (신청하기 버튼)
    music: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>', // 음표
    info: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',                                                    // ⓘ 안내
    alert: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5h.01"/></svg>',                                                  // ! 경고
  };

  /* ---------- 신청 입력 검증 (클라이언트 폼과 목 서버가 같이 쓴다, FR-06) ----------
   * 신청 폼(request.html)과 가짜 서버(api.js의 목 서버)가 "같은 규칙"으로 검사해야
   * 화면에서는 통과했는데 서버에서는 거절되는 일이 없다. 그래서 규칙을 여기 한 곳에만 둔다. */
  const LIMITS = { songTitle: 100, artist: 100, applicantName: 20 };                         // 칸별 최대 글자 수
  const FIELD_NAMES = { songTitle: '곡 제목을', artist: '가수를', applicantName: '신청자 이름을' }; // 오류 문장에 들어갈 이름
  const FIELDS = ['date', 'songTitle', 'artist', 'applicantName'];                           // 검사 순서 = 화면 위→아래 순서

  // 한 칸(name)의 값(value)을 검사해서 오류 문장을 돌려준다. 문제가 없으면 '' (빈 문자열)
  // today 는 "오늘" 날짜. 지난 날짜로 신청하지 못하게 비교할 때 쓴다.
  // 예: validateField('artist', '   ', '2026-10-20') → '가수를 입력해 주세요.'
  function validateField(name, value, today) {
    const v = (value || '').trim(); // 앞뒤 공백은 없는 것으로 친다

    // 날짜 칸 검사
    if (name === 'date') {
      if (v === '') return '신청 날짜를 선택해 주세요.';
      if (!isValidISO(v)) return '날짜 형식이 올바르지 않아요.';
      if (v < today) return '지난 날짜는 신청할 수 없어요.'; // 문자열 비교 = 날짜 비교
      return '';
    }

    // 글자 칸(곡 제목·가수·신청자 이름) 검사
    if (v === '') return FIELD_NAMES[name] + ' 입력해 주세요.';
    if (v.length > LIMITS[name]) return LIMITS[name] + '자 이내로 입력해 주세요.';
    return '';
  }

  /* ---------- StatusMessage: 오류 / 빈 화면 / 로딩 ---------- */

  // el(화면의 한 영역) 안에 빨간 오류 배너를 그린다.
  // onRetry(함수)를 넘기면 "다시 시도" 버튼을 만들고, 누르면 그 함수를 다시 실행한다.
  // 예: WS.showError(listEl, '불러오지 못했어요.', '잠시 후 다시 시도해 주세요.', load);
  // role="alert" : 화면 낭독기가 오류가 생겼다고 바로 읽어 준다.
  function showError(el, title, body, onRetry) {
    let html = '<div class="ws-banner ws-banner-error" role="alert">' + icon.alert +
      '<div><b>' + esc(title) + '</b><br>' + esc(body);
    if (onRetry) {
      html += '<div class="ws-banner-actions"><button type="button" class="ws-btn ws-btn-secondary ws-btn-sm" data-retry>다시 시도</button></div>';
    }
    html += '</div></div>';
    el.innerHTML = html;

    // 방금 그린 버튼을 찾아서 클릭하면 onRetry 가 불리도록 연결
    if (onRetry) {
      el.querySelector('[data-retry]').addEventListener('click', onRetry);
    }
  }

  // 목록이 비었을 때 보여 줄 안내 화면 HTML을 만든다. (음표 아이콘 + 제목 + 설명)
  // action 에 { href: '이동할 주소', label: '버튼 글자' } 를 넘기면 버튼도 붙인다.
  function emptyState(title, text, action) {
    let html = '<div class="ws-empty ws-empty-sm"><div class="ws-empty-icon">' + icon.music + '</div>' +
      '<h3>' + esc(title) + '</h3><p>' + esc(text) + '</p>';
    if (action) {
      html += '<a class="ws-btn ws-btn-primary ws-btn-sm" href="' + esc(action.href) + '">' + esc(action.label) + '</a>';
    }
    html += '</div>';
    return html;
  }

  // 데이터를 불러오는 동안 보여 줄 "스켈레톤"(반짝이는 회색 상자) 목록을 rows 줄 만든다.
  // 실제 목록과 같은 크기라서, 데이터가 도착해도 화면이 덜컹거리지 않는다.
  function skelList(rows) {
    const row = '<div class="ws-skel-row"><div class="ws-skel ws-skel-order"></div>' +
      '<div><div class="ws-skel ws-skel-line-title"></div><div class="ws-skel ws-skel-line-sub"></div></div></div>';
    return '<div class="ws-skel-list">' + repeatStr(row, rows) + '</div>';
  }

  /* ---------- RequestList: 신청곡 목록 ----------
   * requests : [{ songTitle, artist, applicantName, createdAt }, ...] (접수 순서대로 정렬된 배열)
   * isToday  : true 면 첫 번째 곡에 "오늘의 대표곡" 배지를 단다.
   *            (오늘 날짜 목록일 때만. 가장 먼저 신청한 곡이 그날의 대표곡이다)
   * 만들어지는 모양:
   *   1  밤양갱  [오늘의 대표곡]        10/18 07:12
   *      비비 · 신청자 박준호
   *   2  Supernova                      10/18 08:40
   *      aespa · 신청자 이도윤 */
  function requestList(requests, isToday) {
    let html = '<ol class="ws-list">'; // <ol> = 번호 있는 목록
    for (let i = 0; i < requests.length; i++) {
      const r = requests[i];
      const first = (i === 0);

      // 첫 번째 줄은 강조 스타일(is-first)
      if (first) html += '<li class="ws-list-item is-first">';
      else html += '<li class="ws-list-item">';

      html += '<span class="ws-list-order">' + (i + 1) + '</span>'; // 순번 (1부터)
      html += '<div class="ws-list-body"><div class="ws-list-title-row"><span class="ws-list-title">' + esc(r.songTitle) + '</span>';
      if (first && isToday) html += '<span class="ws-badge">오늘의 대표곡</span>';
      html += '</div><div class="ws-list-sub">' + esc(r.artist) + ' · 신청자 ' + esc(r.applicantName) + '</div></div>';
      html += '<span class="ws-list-time">' + esc(formatTime(r.createdAt)) + '</span></li>'; // 접수 시각
    }
    html += '</ol>';
    return html;
  }

  /* ---------- Button 제출 상태 (FR-07) ----------
   * 서버에 보내는 동안 버튼을 잠그고 "신청 중…" + 빙글빙글 아이콘을 보여 준다.
   * 버튼을 여러 번 눌러 같은 신청이 두 번 들어가는 것을 막는 역할도 한다.
   * setBusy(btn, true, '신청 중…') → 잠금,  setBusy(btn, false) → 원래대로 */
  function setBusy(btn, busy, busyLabel) {
    if (busy) {
      btn.dataset.label = btn.innerHTML; // 원래 글자를 data-label 속성에 기억해 둔다
      btn.disabled = true;               // 클릭 막기
      btn.innerHTML = '<span class="ws-spinner" aria-hidden="true"></span> ' + esc(busyLabel);
    } else {
      btn.disabled = false;
      if (btn.dataset.label) btn.innerHTML = btn.dataset.label; // 기억해 둔 글자로 되돌리기
    }
  }

  /* ---------- 날짜가 바뀌면 알림 (페이지를 연 채로 자정을 넘길 때) ----------
   * 기숙사생이 밤 11시 50분에 페이지를 열어 두고 자정을 넘기면, 화면의 "오늘"이
   * 어제 날짜로 남아 있게 된다. 그래서 다음 세 경우에 오늘 날짜를 다시 확인하고,
   * 바뀌었으면 cb(새 날짜) 를 불러서 각 페이지가 화면을 새로 그리게 한다.
   *   1) 다른 탭에 갔다가 이 탭으로 돌아왔을 때 (visibilitychange)
   *   2) 다른 창을 보다가 이 창을 다시 눌렀을 때 (focus)
   *   3) 그냥 켜 둔 상태라도 1분마다 (setInterval)
   * 사용 예: WS.onDayChange(function (now) { today = now; load(); }); */
  function onDayChange(cb) {
    let current = todayISO(); // 마지막으로 확인한 날짜

    function check() {
      const now = todayISO();
      if (now !== current) { // 날짜가 바뀌었다!
        current = now;
        cb(now);
      }
    }

    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) check(); // 탭이 다시 보이게 됐을 때만
    });
    window.addEventListener('focus', check);
    setInterval(check, 60000);       // 60000ms = 1분
  }

  /* =================================================================
   * 4. 상단 메뉴: <ws-nav active="main|request|calendar">
   * -----------------------------------------------------------------
   * 모든 페이지 HTML에 <ws-nav active="..."></ws-nav> 한 줄만 쓰면
   * 로고 + 메뉴 3개짜리 상단 바가 그려진다. (메뉴 HTML을 5개 파일에 복사하지 않으려고)
   * active 값에 해당하는 메뉴는 "지금 보고 있는 페이지"로 표시된다.
   * ================================================================= */
  const NAV_ITEMS = [
    { key: 'main', href: 'index.html', label: '오늘의 기상송' },
    { key: 'request', href: 'request.html', label: '신청하기' },
    { key: 'calendar', href: 'calendar.html', label: '신청 현황' },
  ];

  // <ws-nav> 같은 나만의 HTML 태그(커스텀 요소)를 만들려면
  // 브라우저 규칙상 HTMLElement 를 상속한 class 가 필요하다.
  // 브라우저가 페이지에서 <ws-nav> 태그를 만나면 connectedCallback() 을 자동으로 불러 준다.
  class WsNav extends HTMLElement {
    connectedCallback() {
      if (this.firstElementChild) return; // 이미 그렸으면 다시 그리지 않는다

      const active = this.getAttribute('active'); // 예: "calendar"
      let links = '';
      for (let i = 0; i < NAV_ITEMS.length; i++) {
        const item = NAV_ITEMS[i];
        // aria-current="page" : 지금 페이지 메뉴라는 표시 (CSS가 이걸 보고 강조색을 칠한다)
        if (item.key === active) links += '<a href="' + item.href + '" aria-current="page">' + item.label + '</a>';
        else links += '<a href="' + item.href + '">' + item.label + '</a>';
      }

      this.innerHTML = '<header class="ws-nav"><div class="ws-container ws-nav-inner">' +
        '<a class="ws-logo" href="index.html"><i class="ws-logo-mark" aria-hidden="true"></i><span>기상송</span></a>' +
        '<nav class="ws-menu" aria-label="주요 메뉴">' + links + '</nav></div></header>';
    }
  }
  // 'ws-nav' 태그 이름에 위 class 를 등록한다. (두 번 등록하면 오류가 나므로 먼저 확인)
  if (!customElements.get('ws-nav')) customElements.define('ws-nav', WsNav);

  /* =================================================================
   * 내보내기: 다른 파일에서 WS.이름 으로 쓸 수 있게 붙인다.
   * 여기 없는 함수(pad2, makeISO, isLeapYear 등)는 이 파일 안에서만 쓰는 내부용이다.
   * ================================================================= */
  // 날짜
  WS.todayISO = todayISO;
  WS.isValidISO = isValidISO;
  WS.isValidMonth = isValidMonth;
  WS.addDays = addDays;
  WS.dowOf = dowOf;
  WS.daysInMonth = daysInMonth;
  WS.monthOf = monthOf;
  WS.shiftMonth = shiftMonth;
  WS.parseISO = parseISO;
  WS.formatDate = formatDate;
  WS.formatDateFull = formatDateFull;
  WS.formatDateShort = formatDateShort;
  WS.formatMonth = formatMonth;
  WS.formatTime = formatTime;
  WS.onDayChange = onDayChange;
  // 문자열·URL
  WS.esc = esc;
  WS.repeatStr = repeatStr;
  WS.param = param;
  WS.setParam = setParam;
  // 화면 조각
  WS.icon = icon;
  WS.showError = showError;
  WS.emptyState = emptyState;
  WS.skelList = skelList;
  WS.requestList = requestList;
  WS.setBusy = setBusy;
  // 입력 검증
  WS.LIMITS = LIMITS;
  WS.FIELDS = FIELDS;
  WS.validateField = validateField;
  // 상수
  WS.DOW = DOW;
  WS.BROADCAST_TIME = '오전 6:50'; // 기상송 방송 시각 (메인 화면 카드에 표시)
})();
