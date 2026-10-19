/* 기상송 — 공통 유틸과 컴포넌트 렌더 함수. 전역 WS 네임스페이스에 붙인다. */
(function () {
  const WS = (window.WS = window.WS || {});
  const TZ = 'Asia/Seoul';
  const DOW = ['일', '월', '화', '수', '목', '금', '토'];

  /* ---------- 날짜 (기준 시간대 Asia/Seoul, API 형식 YYYY-MM-DD) ---------- */
  function pad(n) { return String(n).padStart(2, '0'); }

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
    const { y, m, d } = parseISO(iso);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  }

  function addDays(iso, n) {
    const { y, m, d } = parseISO(iso);
    const dt = new Date(Date.UTC(y, m - 1, d + n));
    return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
  }

  function dowOf(iso) {
    const { y, m, d } = parseISO(iso);
    return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  }

  function daysInMonth(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }

  function monthOf(iso) { return iso.slice(0, 7); }

  function shiftMonth(month, n) {
    const [y, m] = month.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1 + n, 1));
    return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}`;
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
    const get = (t) => parts.find((p) => p.type === t).value;
    return `${Number(get('month'))}/${get('day')} ${get('hour')}:${get('minute')}`;
  }

  /* ---------- 문자열 ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function param(name) { return new URLSearchParams(location.search).get(name); }

  /* ---------- 아이콘 (선 아이콘, stroke 2, 둥근 끝) ---------- */
  const icon = {
    plus: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    music: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
    info: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
    alert: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5h.01"/></svg>',
    prev: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>',
    next: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>',
    check: '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  };

  /* ---------- StatusMessage ---------- */
  function errorBanner(title, body, withRetry) {
    return `<div class="ws-banner ws-banner-error" role="alert">${icon.alert}<div><b>${esc(title)}</b><br>${esc(body)}` +
      (withRetry ? `<div class="ws-banner-actions"><button type="button" class="ws-btn ws-btn-secondary ws-btn-sm" data-retry>다시 시도</button></div>` : '') +
      `</div></div>`;
  }

  function emptyState(title, text, action) {
    return `<div class="ws-empty ws-empty-sm"><div class="ws-empty-icon">${icon.music}</div><h3>${esc(title)}</h3><p>${esc(text)}</p>` +
      (action ? `<a class="ws-btn ws-btn-primary ws-btn-sm" href="${esc(action.href)}">${esc(action.label)}</a>` : '') +
      `</div>`;
  }

  function skelList(rows) {
    let html = '<div class="ws-skel-list">';
    for (let i = 0; i < rows; i++) {
      html += '<div class="ws-skel-row"><div class="ws-skel" style="width:36px;height:36px;border-radius:50%"></div>' +
        '<div><div class="ws-skel" style="height:20px;width:60%"></div><div class="ws-skel" style="height:16px;width:40%;margin-top:8px"></div></div></div>';
    }
    return html + '</div>';
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

  Object.assign(WS, {
    todayISO, isValidISO, addDays, dowOf, daysInMonth, monthOf, shiftMonth, parseISO,
    formatDate, formatDateFull, formatDateShort, formatMonth, formatTime,
    esc, param, icon, errorBanner, emptyState, skelList, requestList, setBusy,
    BROADCAST_TIME: '오전 6:50',
  });
})();
