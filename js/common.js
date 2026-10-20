/* 기상송 — 공통 유틸과 컴포넌트 렌더 함수. 모든 페이지가 <head>에서 불러온다. 전역 WS 네임스페이스에 붙인다. */
(function () {
  const WS = window.WS || {};
  window.WS = WS;

  const TZ = 'Asia/Seoul';
  const DOW = ['일', '월', '화', '수', '목', '금', '토'];

  /* ---------- 날짜 (기준 시간대 Asia/Seoul, API 형식 YYYY-MM-DD) ---------- */

  // 7 → "07"
  function pad2(n) {
    if (n < 10) return '0' + n;
    return String(n);
  }

  // 연, 월, 일 숫자 → "YYYY-MM-DD"
  function makeISO(y, m, d) {
    return y + '-' + pad2(m) + '-' + pad2(d);
  }

  function todayISO() {
    // en-CA 형식이 YYYY-MM-DD
    const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
    return fmt.format(new Date());
  }

  // "2026-10-21" → { y: 2026, m: 10, d: 21 }
  function parseISO(iso) {
    const y = Number(iso.slice(0, 4));
    const m = Number(iso.slice(5, 7));
    const d = Number(iso.slice(8, 10));
    return { y: y, m: m, d: d };
  }

  function isLeapYear(y) {
    return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  }

  function daysInMonth(y, m) {
    if (m === 2) {
      if (isLeapYear(y)) return 29;
      return 28;
    }
    if (m === 4 || m === 6 || m === 9 || m === 11) return 30;
    return 31;
  }

  // "YYYY-MM-DD" 형식이고 실제로 있는 날짜인지
  function isValidISO(iso) {
    if (typeof iso !== 'string' || iso.length !== 10) return false;
    for (let i = 0; i < 10; i++) {
      const c = iso[i];
      if (i === 4 || i === 7) {
        if (c !== '-') return false;
      } else if (c < '0' || c > '9') {
        return false;
      }
    }
    const p = parseISO(iso);
    if (p.m < 1 || p.m > 12) return false;
    if (p.d < 1 || p.d > daysInMonth(p.y, p.m)) return false;
    return true;
  }

  // "YYYY-MM" 형식이고 1~12월인지
  function isValidMonth(month) {
    if (typeof month !== 'string' || month.length !== 7) return false;
    return isValidISO(month + '-01');
  }

  function addDays(iso, n) {
    const p = parseISO(iso);
    const dt = new Date(Date.UTC(p.y, p.m - 1, p.d + n));
    return makeISO(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
  }

  // 0 = 일요일 … 6 = 토요일
  function dowOf(iso) {
    const p = parseISO(iso);
    return new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
  }

  // "2026-10-21" → "2026-10"
  function monthOf(iso) {
    return iso.slice(0, 7);
  }

  // "2026-10"에서 n달 이동. 예: shiftMonth("2026-12", 1) → "2027-01"
  function shiftMonth(month, n) {
    const y = Number(month.slice(0, 4));
    const m = Number(month.slice(5, 7));
    const total = y * 12 + (m - 1) + n; // 0년 1월부터 센 달 수
    const newY = Math.floor(total / 12);
    const newM = total - newY * 12 + 1;
    return newY + '-' + pad2(newM);
  }

  // "10월 21일 수요일"
  function formatDate(iso) {
    const p = parseISO(iso);
    return p.m + '월 ' + p.d + '일 ' + DOW[dowOf(iso)] + '요일';
  }

  // "2026년 10월 21일 수요일"
  function formatDateFull(iso) {
    return parseISO(iso).y + '년 ' + formatDate(iso);
  }

  // "10월 21일"
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

  // createdAt(ISO 타임스탬프) → "10/18 07:12" (Asia/Seoul)
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
    return Number(month) + '/' + day + ' ' + hour + ':' + minute;
  }

  /* ---------- 문자열 ---------- */

  // HTML에 넣기 전에 특수문자를 바꾼다 (XSS 방지)
  function esc(value) {
    if (value === null || value === undefined) return '';
    const s = String(value);
    let out = '';
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === '&') out += '&amp;';
      else if (c === '<') out += '&lt;';
      else if (c === '>') out += '&gt;';
      else if (c === '"') out += '&quot;';
      else if (c === "'") out += '&#39;';
      else out += c;
    }
    return out;
  }

  // 같은 문자열을 count번 이어 붙인다
  function repeatStr(s, count) {
    let out = '';
    for (let i = 0; i < count; i++) out += s;
    return out;
  }

  function param(name) {
    return new URLSearchParams(location.search).get(name);
  }

  // 다른 쿼리(?mockFail= 등)는 그대로 두고 name만 바꾼다. 빈 값이면 지운다.
  // push가 true면 방문 기록을 새로 남기고, 아니면 현재 기록을 바꾼다.
  function setParam(name, value, push) {
    const params = new URLSearchParams(location.search);
    if (value) params.set(name, value);
    else params.delete(name);

    const qs = params.toString();
    let url = location.pathname;
    if (qs) url = '?' + qs;

    if (push) history.pushState(null, '', url);
    else history.replaceState(null, '', url);
  }

  /* ---------- 아이콘 (선 아이콘, stroke 2, 둥근 끝) ---------- */
  const icon = {
    plus: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    music: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
    info: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
    alert: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5h.01"/></svg>',
  };

  /* ---------- 신청 입력 검증 (클라이언트 폼과 목 서버가 같이 쓴다, FR-06) ---------- */
  const LIMITS = { songTitle: 100, artist: 100, applicantName: 20 };
  const FIELD_NAMES = { songTitle: '곡 제목을', artist: '가수를', applicantName: '신청자 이름을' };
  const FIELDS = ['date', 'songTitle', 'artist', 'applicantName'];

  // 오류 메시지를 돌려주고, 문제가 없으면 ''
  function validateField(name, value, today) {
    const v = (value || '').trim();

    if (name === 'date') {
      if (v === '') return '신청 날짜를 선택해 주세요.';
      if (!isValidISO(v)) return '날짜 형식이 올바르지 않아요.';
      if (v < today) return '지난 날짜는 신청할 수 없어요.';
      return '';
    }

    if (v === '') return FIELD_NAMES[name] + ' 입력해 주세요.';
    if (v.length > LIMITS[name]) return LIMITS[name] + '자 이내로 입력해 주세요.';
    return '';
  }

  /* ---------- StatusMessage ---------- */

  // 오류 배너를 그리고, onRetry가 있으면 "다시 시도" 버튼을 연결
  function showError(el, title, body, onRetry) {
    let html = '<div class="ws-banner ws-banner-error" role="alert">' + icon.alert +
      '<div><b>' + esc(title) + '</b><br>' + esc(body);
    if (onRetry) {
      html += '<div class="ws-banner-actions"><button type="button" class="ws-btn ws-btn-secondary ws-btn-sm" data-retry>다시 시도</button></div>';
    }
    html += '</div></div>';
    el.innerHTML = html;

    if (onRetry) {
      el.querySelector('[data-retry]').addEventListener('click', onRetry);
    }
  }

  // action: { href, label } 이 있으면 버튼을 붙인다
  function emptyState(title, text, action) {
    let html = '<div class="ws-empty ws-empty-sm"><div class="ws-empty-icon">' + icon.music + '</div>' +
      '<h3>' + esc(title) + '</h3><p>' + esc(text) + '</p>';
    if (action) {
      html += '<a class="ws-btn ws-btn-primary ws-btn-sm" href="' + esc(action.href) + '">' + esc(action.label) + '</a>';
    }
    html += '</div>';
    return html;
  }

  function skelList(rows) {
    const row = '<div class="ws-skel-row"><div class="ws-skel ws-skel-order"></div>' +
      '<div><div class="ws-skel ws-skel-line-title"></div><div class="ws-skel ws-skel-line-sub"></div></div></div>';
    return '<div class="ws-skel-list">' + repeatStr(row, rows) + '</div>';
  }

  /* ---------- RequestList ---------- */
  // requests: [{songTitle, artist, applicantName, createdAt}] (접수 순)
  // isToday가 true면 첫 곡에 "오늘의 대표곡" 배지를 단다
  function requestList(requests, isToday) {
    let html = '<ol class="ws-list">';
    for (let i = 0; i < requests.length; i++) {
      const r = requests[i];
      const first = (i === 0);

      if (first) html += '<li class="ws-list-item is-first">';
      else html += '<li class="ws-list-item">';

      html += '<span class="ws-list-order">' + (i + 1) + '</span>';
      html += '<div class="ws-list-body"><div class="ws-list-title-row"><span class="ws-list-title">' + esc(r.songTitle) + '</span>';
      if (first && isToday) html += '<span class="ws-badge">오늘의 대표곡</span>';
      html += '</div><div class="ws-list-sub">' + esc(r.artist) + ' · 신청자 ' + esc(r.applicantName) + '</div></div>';
      html += '<span class="ws-list-time">' + esc(formatTime(r.createdAt)) + '</span></li>';
    }
    html += '</ol>';
    return html;
  }

  /* ---------- Button 제출 상태 (FR-07) ---------- */
  function setBusy(btn, busy, busyLabel) {
    if (busy) {
      btn.dataset.label = btn.innerHTML; // 원래 글자를 기억해 둔다
      btn.disabled = true;
      btn.innerHTML = '<span class="ws-spinner" aria-hidden="true"></span> ' + esc(busyLabel);
    } else {
      btn.disabled = false;
      if (btn.dataset.label) btn.innerHTML = btn.dataset.label;
    }
  }

  /* ---------- 날짜가 바뀌면 알림 (페이지를 연 채로 자정을 넘길 때) ---------- */
  // 탭 복귀·창 포커스 때와 1분마다 오늘 날짜를 비교해서, 바뀌었으면 cb(새 날짜)를 부른다.
  function onDayChange(cb) {
    let current = todayISO();

    function check() {
      const now = todayISO();
      if (now !== current) {
        current = now;
        cb(now);
      }
    }

    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) check();
    });
    window.addEventListener('focus', check);
    setInterval(check, 60000);
  }

  /* ---------- NavBar: <ws-nav active="main|request|calendar"> ---------- */
  const NAV_ITEMS = [
    { key: 'main', href: 'index.html', label: '오늘의 기상송' },
    { key: 'request', href: 'request.html', label: '신청하기' },
    { key: 'calendar', href: 'calendar.html', label: '신청 현황' },
  ];

  // 커스텀 태그 <ws-nav>를 쓰려면 HTMLElement를 상속한 클래스가 필요하다.
  // 페이지에 태그가 붙으면 connectedCallback이 불려 메뉴를 그린다.
  class WsNav extends HTMLElement {
    connectedCallback() {
      if (this.firstElementChild) return; // 이미 그렸으면 다시 그리지 않는다

      const active = this.getAttribute('active');
      let links = '';
      for (let i = 0; i < NAV_ITEMS.length; i++) {
        const item = NAV_ITEMS[i];
        if (item.key === active) links += '<a href="' + item.href + '" aria-current="page">' + item.label + '</a>';
        else links += '<a href="' + item.href + '">' + item.label + '</a>';
      }

      this.innerHTML = '<header class="ws-nav"><div class="ws-container ws-nav-inner">' +
        '<a class="ws-logo" href="index.html"><i class="ws-logo-mark" aria-hidden="true"></i><span>기상송</span></a>' +
        '<nav class="ws-menu" aria-label="주요 메뉴">' + links + '</nav></div></header>';
    }
  }
  if (!customElements.get('ws-nav')) customElements.define('ws-nav', WsNav);

  /* ---------- 내보내기 ---------- */
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
  WS.BROADCAST_TIME = '오전 6:50';
})();
