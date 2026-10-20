/* 기상송 — 공통 유틸과 컴포넌트 렌더 함수. 모든 페이지가 <head>에서 불러온다. 전역 WS 네임스페이스에 붙인다. */
(function () {
  const WS = (window.WS = window.WS || {});
  const TZ = 'Asia/Seoul';
  const DOW = ['일', '월', '화', '수', '목', '금', '토'];

  /* ---------- 날짜 (기준 시간대 Asia/Seoul, API 형식 YYYY-MM-DD) ---------- */
  function todayISO() {
    // en-CA 형식이 YYYY-MM-DD
    return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  }

  function parseISO(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return { y, m, d };
  }

  function isValidISO(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return false;
    const dt = new Date(`${iso}T00:00:00Z`);
    return !isNaN(dt) && dt.toISOString().slice(0, 10) === iso;
  }

  function addDays(iso, n) {
    const { y, m, d } = parseISO(iso);
    return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
  }

  function dowOf(iso) {
    const { y, m, d } = parseISO(iso);
    return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  }

  function daysInMonth(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }

  function monthOf(iso) { return iso.slice(0, 7); }

  function shiftMonth(month, n) {
    const [y, m] = month.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
  }

  // "10월 21일 수요일"
  function formatDate(iso) {
    const { m, d } = parseISO(iso);
    return `${m}월 ${d}일 ${DOW[dowOf(iso)]}요일`;
  }
  // "2026년 10월 21일 수요일"
  function formatDateFull(iso) { return `${parseISO(iso).y}년 ${formatDate(iso)}`; }
  // "10월 21일"
  function formatDateShort(iso) { const { m, d } = parseISO(iso); return `${m}월 ${d}일`; }
  // "2026년 10월"
  function formatMonth(month) { const [y, m] = month.split('-').map(Number); return `${y}년 ${m}월`; }

  // createdAt(ISO 타임스탬프) → "10/18 07:12" (Asia/Seoul)
  function formatTime(ts) {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: TZ, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(new Date(ts));
    const { month, day, hour, minute } = Object.fromEntries(parts.map((p) => [p.type, p.value]));
    return `${Number(month)}/${day} ${hour}:${minute}`;
  }

  /* ---------- 문자열 ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function param(name) { return new URLSearchParams(location.search).get(name); }

  // 다른 쿼리(?mockFail= 등)는 그대로 두고 name만 바꾼다. 빈 값이면 지운다.
  function setParam(name, value, push) {
    const params = new URLSearchParams(location.search);
    if (value) params.set(name, value); else params.delete(name);
    const qs = params.toString();
    history[push ? 'pushState' : 'replaceState'](null, '', qs ? `?${qs}` : location.pathname);
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
      if (!v) return '신청 날짜를 선택해 주세요.';
      if (!isValidISO(v)) return '날짜 형식이 올바르지 않아요.';
      if (v < today) return '지난 날짜는 신청할 수 없어요.';
      return '';
    }
    if (!v) return `${FIELD_NAMES[name]} 입력해 주세요.`;
    if (v.length > LIMITS[name]) return `${LIMITS[name]}자 이내로 입력해 주세요.`;
    return '';
  }

  /* ---------- StatusMessage ---------- */
  // 오류 배너를 그리고, onRetry가 있으면 "다시 시도" 버튼을 연결
  function showError(el, title, body, onRetry) {
    el.innerHTML = `<div class="ws-banner ws-banner-error" role="alert">${icon.alert}<div><b>${esc(title)}</b><br>${esc(body)}` +
      (onRetry ? `<div class="ws-banner-actions"><button type="button" class="ws-btn ws-btn-secondary ws-btn-sm" data-retry>다시 시도</button></div>` : '') +
      `</div></div>`;
    if (onRetry) el.querySelector('[data-retry]').addEventListener('click', onRetry);
  }

  function emptyState(title, text, action) {
    return `<div class="ws-empty ws-empty-sm"><div class="ws-empty-icon">${icon.music}</div><h3>${esc(title)}</h3><p>${esc(text)}</p>` +
      (action ? `<a class="ws-btn ws-btn-primary ws-btn-sm" href="${esc(action.href)}">${esc(action.label)}</a>` : '') +
      `</div>`;
  }

  function skelList(rows) {
    const row = '<div class="ws-skel-row"><div class="ws-skel ws-skel-order"></div>' +
      '<div><div class="ws-skel ws-skel-line-title"></div><div class="ws-skel ws-skel-line-sub"></div></div></div>';
    return `<div class="ws-skel-list">${row.repeat(rows)}</div>`;
  }

  /* ---------- RequestList ---------- */
  // requests: [{songTitle, artist, applicantName, createdAt}] (접수 순)
  function requestList(requests, opts) {
    const isToday = opts && opts.isToday;
    return '<ol class="ws-list">' + requests.map((r, i) => {
      const first = i === 0;
      return `<li class="ws-list-item${first ? ' is-first' : ''}">` +
        `<span class="ws-list-order">${i + 1}</span>` +
        `<div class="ws-list-body"><div class="ws-list-title-row"><span class="ws-list-title">${esc(r.songTitle)}</span>` +
        (first && isToday ? '<span class="ws-badge">오늘의 대표곡</span>' : '') +
        `</div><div class="ws-list-sub">${esc(r.artist)} · 신청자 ${esc(r.applicantName)}</div></div>` +
        `<span class="ws-list-time">${esc(formatTime(r.createdAt))}</span></li>`;
    }).join('') + '</ol>';
  }

  /* ---------- Button 제출 상태 (FR-07) ---------- */
  function setBusy(btn, busy, busyLabel) {
    if (busy) {
      btn.dataset.label = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = `<span class="ws-spinner" aria-hidden="true"></span> ${esc(busyLabel)}`;
    } else {
      btn.disabled = false;
      if (btn.dataset.label) btn.innerHTML = btn.dataset.label;
    }
  }

  /* ---------- 날짜가 바뀌면 알림 (페이지를 연 채로 자정을 넘길 때) ---------- */
  // 탭 복귀·창 포커스 때와 1분마다 오늘 날짜를 비교해서, 바뀌었으면 cb(새 날짜)를 부른다.
  function onDayChange(cb) {
    let current = todayISO();
    const check = () => {
      const now = todayISO();
      if (now !== current) { current = now; cb(now); }
    };
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
    window.addEventListener('focus', check);
    setInterval(check, 60000);
  }

  /* ---------- NavBar: <ws-nav active="main|request|calendar"> ---------- */
  const NAV_ITEMS = [
    ['main', 'index.html', '오늘의 기상송'],
    ['request', 'request.html', '신청하기'],
    ['calendar', 'calendar.html', '신청 현황'],
  ];

  class WsNav extends HTMLElement {
    connectedCallback() {
      if (this.firstElementChild) return;
      const active = this.getAttribute('active');
      const links = NAV_ITEMS.map(([key, href, label]) =>
        `<a href="${href}"${key === active ? ' aria-current="page"' : ''}>${label}</a>`).join('');
      this.innerHTML = '<header class="ws-nav"><div class="ws-container ws-nav-inner">' +
        '<a class="ws-logo" href="index.html"><i class="ws-logo-mark" aria-hidden="true"></i><span>기상송</span></a>' +
        `<nav class="ws-menu" aria-label="주요 메뉴">${links}</nav></div></header>`;
    }
  }
  if (!customElements.get('ws-nav')) customElements.define('ws-nav', WsNav);

  Object.assign(WS, {
    onDayChange,
    todayISO, isValidISO, addDays, dowOf, daysInMonth, monthOf, shiftMonth, parseISO,
    formatDate, formatDateFull, formatDateShort, formatMonth, formatTime,
    esc, param, setParam, icon, showError, emptyState, skelList, requestList, setBusy,
    LIMITS, FIELDS, validateField,
    DOW,
    BROADCAST_TIME: '오전 6:50',
  });
})();
