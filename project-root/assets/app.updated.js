(() => {
  const $ = (sel, root = document) => root.querySelector(sel);

  const state = {
    view: "home",      // home | grading | resources | lab | quiz | tasks | week | calendar
    weekIndex: 0
  };

  const DATA = window.COURSE_DATA || {};

  // ---------- Date helpers ----------
  const pad = (n) => String(n).padStart(2, "0");
  const toDate = (dateStr, timeStr = "00:00") => {
    if (!dateStr) return null;
    const t = timeStr || "00:00";
    // Local time (browser). If you need strict TZ, set user browser TZ accordingly.
    const [y, m, d] = dateStr.split("-").map(Number);
    const [hh, mm] = t.split(":").map(Number);
    const dt = new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0);
    return Number.isNaN(dt.getTime()) ? null : dt;
  };
  const fmtDate = (dt) => {
    if (!dt) return "—";
    return `${pad(dt.getDate())}.${pad(dt.getMonth() + 1)}.${dt.getFullYear()}`;
  };
  const fmtDateTime = (dt) => {
    if (!dt) return "—";
    return `${fmtDate(dt)} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
  };
  const diffParts = (target, now = new Date()) => {
    if (!target) return null;
    const ms = target.getTime() - now.getTime();
    const sign = ms >= 0 ? 1 : -1;
    const abs = Math.abs(ms);
    const days = Math.floor(abs / (24 * 3600 * 1000));
    const hours = Math.floor((abs % (24 * 3600 * 1000)) / (3600 * 1000));
    const mins = Math.floor((abs % (3600 * 1000)) / (60 * 1000));
    return { sign, days, hours, mins, ms };
  };

  // ---------- ICS (Add to calendar) ----------
  const icsEscape = (s = "") =>
    String(s)
      .replace(/\\/g, "\\\\")
      .replace(/\n/g, "\\n")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");

  const toICSDateTime = (dt) => {
    // Floating local time format: YYYYMMDDTHHMMSS
    return `${dt.getFullYear()}${pad(dt.getMonth() + 1)}${pad(dt.getDate())}T${pad(dt.getHours())}${pad(dt.getMinutes())}00`;
  };

  const downloadTextFile = (filename, text) => {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const buildICS = () => {
    const cal = DATA.calendar || {};
    const weekly = cal.weeklyClass || {};
    const milestones = Array.isArray(cal.milestones) ? cal.milestones : [];
    const weeks = Array.isArray(DATA.weeks) ? DATA.weeks : [];
    const start = toDate(cal.semesterStart, weekly.time || "10:00");
    const end = toDate(cal.semesterEnd, "23:59");

    const events = [];

    // Weekly course sessions inferred from semesterStart + weeks length (optional)
    if (weekly.enabled && start) {
      const byday = ["SU","MO","TU","WE","TH","FR","SA"][weekly.dayOfWeek ?? 2] || "WE";
      const duration = Number(weekly.durationMinutes || 50);
      const occurrences = weeks.length || 14;

      // Build N occurrences from the first occurrence aligned to dayOfWeek
      const first = new Date(start.getTime());
      const dow = first.getDay();
      const targetDow = Number(weekly.dayOfWeek ?? 2);
      const delta = (targetDow - dow + 7) % 7;
      first.setDate(first.getDate() + delta);

      for (let i = 0; i < occurrences; i++) {
        const dtStart = new Date(first.getTime());
        dtStart.setDate(first.getDate() + i * 7);
        const dtEnd = new Date(dtStart.getTime() + duration * 60000);
        if (end && dtStart > end) break;

        const title = weeks[i]?.title ? `SBE 1000 – ${weeks[i].title}` : `SBE 1000 – Ders (${i + 1}. hafta)`;
        events.push({
          title,
          start: dtStart,
          end: dtEnd,
          location: weekly.location || "",
          description: (weeks[i]?.summary || "").trim()
        });
      }
    }

    // Milestones
    for (const m of milestones) {
      const dt = toDate(m.date, m.time || "10:00");
      if (!dt) continue;
      const dtEnd = new Date(dt.getTime() + 60 * 60000); // 1h default
      events.push({
        title: m.title || "Akademik Etkinlik",
        start: dt,
        end: dtEnd,
        location: m.location || "",
        description: m.description || ""
      });
    }

    const dtstamp = toICSDateTime(new Date());
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//SBE1000//Course Calendar//TR",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH"
    ];

    events.forEach((e, idx) => {
      const uid = `sbe1000-${idx + 1}-${Date.now()}@local`;
      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${uid}`);
      lines.push(`DTSTAMP:${dtstamp}`);
      lines.push(`DTSTART:${toICSDateTime(e.start)}`);
      lines.push(`DTEND:${toICSDateTime(e.end)}`);
      lines.push(`SUMMARY:${icsEscape(e.title)}`);
      if (e.location) lines.push(`LOCATION:${icsEscape(e.location)}`);
      const desc = e.description ? icsEscape(e.description) : "";
      if (desc) lines.push(`DESCRIPTION:${desc}`);
      lines.push("END:VEVENT");
    });

    lines.push("END:VCALENDAR");
    return lines.join("\r\n");
  };

  // ---------- Rendering ----------
  const setTitle = (t) => { const el = $("#view-title"); if (el) el.textContent = t; };

  const setActiveNav = (id) => {
    const all = document.querySelectorAll("[data-nav]");
    all.forEach(btn => btn.classList.remove("ring-2","ring-stone-300","bg-stone-100"));
    const el = document.getElementById(id);
    if (el) el.classList.add("ring-2","ring-stone-300","bg-stone-100");
  };

  const renderCard = ({ title, body, footer }) => `
    <section class="bg-white rounded-2xl shadow-sm border border-stone-200 p-6 mb-6">
      ${title ? `<h2 class="text-lg font-semibold text-stone-900 mb-3">${title}</h2>` : ""}
      ${body || ""}
      ${footer ? `<div class="pt-4 mt-4 border-t border-stone-200">${footer}</div>` : ""}
    </section>
  `;

  const renderHome = () => {
    setTitle("Ders Bilgi Paketi");
    const outcomes = Array.isArray(DATA.outcomes) ? DATA.outcomes : [];
    const intro = DATA.intro || {};
    const body = `
      <div class="prose max-w-none">
        ${intro.html || intro.text || ""}
      </div>
      ${outcomes.length ? `
        <div class="mt-6">
          <h3 class="text-base font-semibold text-stone-900 mb-2">Başarı Ölçütleri (Öğrenme Çıktıları)</h3>
          <ul class="list-disc pl-5 text-stone-700">
            ${outcomes.map(o => `<li>${o}</li>`).join("")}
          </ul>
        </div>` : ""}
    `;
    $("#content-container").innerHTML = renderCard({ title: "Giriş & Künye", body });
  };

  const renderGrading = () => {
    setTitle("Başarı Ölçütleri");
    const a = DATA.assessment || {};
    const rows = Array.isArray(a.items) ? a.items : [];
    const table = rows.length ? `
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-stone-600">
              <th class="py-2 pr-4">Bileşen</th>
              <th class="py-2 pr-4">Açıklama</th>
              <th class="py-2 pr-4">Ağırlık</th>
            </tr>
          </thead>
          <tbody class="text-stone-800">
            ${rows.map(r => `
              <tr class="border-t border-stone-200">
                <td class="py-2 pr-4 font-medium">${r.name || ""}</td>
                <td class="py-2 pr-4">${r.description || ""}</td>
                <td class="py-2 pr-4">${r.weight || ""}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>` : `<p class="text-stone-600">Değerlendirme bileşenleri tanımlı değil.</p>`;

    $("#content-container").innerHTML = renderCard({ title: "Değerlendirme", body: `<div class="prose max-w-none">${a.html || ""}</div>${table}`});
  };

  const renderResources = () => {
    setTitle("Kaynaklar");
    const r = DATA.resources || {};
    const body = `
      <div class="prose max-w-none">
        ${r.html || r.text || "<p>Kaynaklar tanımlı değil.</p>"}
      </div>
      ${DATA.pdfPath ? `
        <div class="mt-6">
          <a class="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-stone-200 hover:bg-stone-50 text-stone-800"
             href="${DATA.pdfPath}" target="_blank" rel="noopener">
            Ders PDF'i
          </a>
          <p class="text-xs text-stone-500 mt-2">Not: PDF yolunun gerçek dosya adıyla birebir eşleşmesi gerekir.</p>
        </div>` : ""}
    `;
    $("#content-container").innerHTML = renderCard({ title: "Kaynaklar", body });
  };

  const renderWeeks = (weekIndex = 0) => {
    const weeks = Array.isArray(DATA.weeks) ? DATA.weeks : [];
    const w = weeks[weekIndex];
    if (!w) {
      $("#content-container").innerHTML = renderCard({ title: "14 Haftalık Müfredat", body: `<p class="text-stone-600">Haftalık içerik bulunamadı.</p>`});
      return;
    }
    setTitle(`${w.week}. Hafta`);
    const body = `
      <div class="flex flex-col gap-3">
        <div>
          <div class="text-xs text-stone-500">Başlık</div>
          <div class="text-xl font-semibold text-stone-900">${w.title || ""}</div>
        </div>
        ${w.summary ? `<div class="text-stone-700">${w.summary}</div>` : ""}
        <div class="prose max-w-none">
          ${w.html || ""}
        </div>
      </div>
    `;
    $("#content-container").innerHTML = renderCard({ title: `${w.week}. Hafta İçeriği`, body });
  };

  const renderLab = () => {
    setTitle("Analiz Laboratuvarı");
    const items = Array.isArray(DATA.labs) ? DATA.labs : [];
    const body = items.length
      ? `<ul class="space-y-3">
          ${items.map(it => `
            <li class="p-4 rounded-xl border border-stone-200">
              <div class="font-semibold text-stone-900">${it.title || ""}</div>
              ${it.description ? `<div class="text-stone-700 mt-1">${it.description}</div>` : ""}
              ${it.link ? `<div class="mt-2"><a class="text-stone-900 underline" href="${it.link}" target="_blank" rel="noopener">Aç</a></div>` : ""}
            </li>`).join("")}
        </ul>`
      : `<p class="text-stone-600">Laboratuvar içerikleri tanımlı değil.</p>`;
    $("#content-container").innerHTML = renderCard({ title: "Analiz Laboratuvarı", body });
  };

  const renderQuiz = () => {
    setTitle("Muhakeme Quizleri");
    const items = Array.isArray(DATA.quizzes) ? DATA.quizzes : [];
    const body = items.length
      ? `<ul class="space-y-3">
          ${items.map(it => `
            <li class="p-4 rounded-xl border border-stone-200">
              <div class="font-semibold text-stone-900">${it.title || ""}</div>
              ${it.description ? `<div class="text-stone-700 mt-1">${it.description}</div>` : ""}
              ${it.link ? `<div class="mt-2"><a class="text-stone-900 underline" href="${it.link}" target="_blank" rel="noopener">Başlat</a></div>` : ""}
            </li>`).join("")}
        </ul>`
      : `<p class="text-stone-600">Quiz içerikleri tanımlı değil.</p>`;
    $("#content-container").innerHTML = renderCard({ title: "Muhakeme Quizleri", body });
  };

  const renderTasks = () => {
    setTitle("Ödev Şablonları");
    const items = Array.isArray(DATA.tasks) ? DATA.tasks : [];
    const body = items.length
      ? `<ul class="space-y-3">
          ${items.map(it => `
            <li class="p-4 rounded-xl border border-stone-200">
              <div class="font-semibold text-stone-900">${it.title || ""}</div>
              ${it.description ? `<div class="text-stone-700 mt-1">${it.description}</div>` : ""}
              ${it.file ? `<div class="mt-2"><a class="text-stone-900 underline" href="${it.file}" target="_blank" rel="noopener">İndir</a></div>` : ""}
            </li>`).join("")}
        </ul>`
      : `<p class="text-stone-600">Ödev şablonları tanımlı değil.</p>`;
    $("#content-container").innerHTML = renderCard({ title: "Ödev Şablonları", body });
  };

  const renderCalendar = () => {
    setTitle("Takvim & Geri Sayım");
    const cal = DATA.calendar || {};
    const weekly = cal.weeklyClass || {};
    const milestones = Array.isArray(cal.milestones) ? cal.milestones : [];
    const now = new Date();

    // Determine next milestone
    const milestoneDates = milestones
      .map(m => ({ ...m, dt: toDate(m.date, m.time || "10:00") }))
      .filter(m => m.dt)
      .sort((a,b) => a.dt - b.dt);

    const nextMilestone = milestoneDates.find(m => m.dt >= now) || null;

    // Determine "current week" progress
    const weeks = Array.isArray(DATA.weeks) ? DATA.weeks : [];
    const semesterStart = toDate(cal.semesterStart, weekly.time || "10:00");
    let currentWeek = null;
    if (semesterStart && weeks.length) {
      const deltaDays = Math.floor((now - semesterStart) / (24*3600*1000));
      currentWeek = Math.min(weeks.length, Math.max(1, Math.floor(deltaDays / 7) + 1));
    }

    const countdownCard = (label, dt, hint) => {
      const parts = diffParts(dt, now);
      const value = !parts ? "—" : (parts.sign >= 0
        ? `${parts.days}g ${parts.hours}s ${parts.mins}d`
        : `Geçti: ${parts.days}g ${parts.hours}s ${parts.mins}d`);
      return `
        <div class="p-4 rounded-2xl border border-stone-200 bg-white">
          <div class="text-xs text-stone-500">${label}</div>
          <div class="text-2xl font-semibold text-stone-900 mt-1">${value}</div>
          <div class="text-sm text-stone-700 mt-2">${fmtDateTime(dt)}</div>
          ${hint ? `<div class="text-xs text-stone-500 mt-2">${hint}</div>` : ""}
        </div>
      `;
    };

    // Guess next class from weekly schedule
    let nextClass = null;
    if (weekly.enabled && semesterStart) {
      const targetDow = Number(weekly.dayOfWeek ?? 2);
      const t = weekly.time || "10:00";
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0,0,0,0);
      const todayDow = today.getDay();
      const delta = (targetDow - todayDow + 7) % 7;
      nextClass = toDate(
        `${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate()+delta)}`,
        t
      );
      if (nextClass && nextClass < now) nextClass.setDate(nextClass.getDate() + 7);
    }

    const body = `
      ${cal.notes ? `<div class="mb-4 p-4 rounded-2xl bg-stone-50 border border-stone-200 text-stone-700">${cal.notes}</div>` : ""}

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        ${countdownCard("Bir sonraki ders", nextClass, weekly.enabled ? "Haftalık ders günü/saatine göre hesaplanır." : "weeklyClass.enabled = true yapın.")}
        ${countdownCard("Bir sonraki kilometre taşı", nextMilestone ? nextMilestone.dt : null, nextMilestone ? nextMilestone.title : "calendar.milestones ekleyin.")}
        ${countdownCard("Dönem bitişi", toDate(cal.semesterEnd, "23:59"), "semesterEnd alanına göre.")}
      </div>

      ${currentWeek ? `
        <div class="mb-6">
          <div class="flex items-center justify-between mb-2">
            <div class="text-sm font-semibold text-stone-900">Haftalık İlerleme</div>
            <div class="text-xs text-stone-500">${currentWeek} / ${weeks.length}. hafta</div>
          </div>
          <div class="w-full h-3 bg-stone-100 rounded-full overflow-hidden border border-stone-200">
            <div class="h-3 bg-stone-400" style="width:${Math.round((currentWeek/weeks.length)*100)}%"></div>
          </div>
        </div>` : ""}

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div class="p-5 rounded-2xl border border-stone-200 bg-white">
          <div class="text-sm font-semibold text-stone-900 mb-3">Kilometre Taşları</div>
          ${milestoneDates.length ? `
            <ol class="space-y-3">
              ${milestoneDates.map(m => `
                <li class="flex items-start gap-3">
                  <div class="mt-1 w-2 h-2 rounded-full bg-stone-400"></div>
                  <div>
                    <div class="text-stone-900 font-medium">${m.title || "Etkinlik"}</div>
                    <div class="text-sm text-stone-600">${fmtDateTime(m.dt)} ${m.location ? `• ${m.location}` : ""}</div>
                    ${m.description ? `<div class="text-sm text-stone-700 mt-1">${m.description}</div>` : ""}
                  </div>
                </li>`).join("")}
            </ol>` : `<div class="text-stone-600 text-sm">Milestone tanımlı değil.</div>`}
        </div>

        <div class="p-5 rounded-2xl border border-stone-200 bg-white">
          <div class="text-sm font-semibold text-stone-900 mb-3">Takvime Ekle</div>
          <p class="text-sm text-stone-700">
            Aşağıdaki buton, haftalık ders oturumlarını (weeks uzunluğu kadar) ve kilometre taşlarını tek bir <code>.ics</code> dosyası olarak üretir.
          </p>
          <div class="mt-4 flex flex-wrap gap-2">
            <button id="btn-download-ics" class="px-4 py-2 rounded-xl border border-stone-200 hover:bg-stone-50 text-stone-900">
              .ics indir
            </button>
            <button id="btn-show-config" class="px-4 py-2 rounded-xl border border-stone-200 hover:bg-stone-50 text-stone-900">
              Yapılandırma ipuçları
            </button>
          </div>
          <div id="cal-config" class="hidden mt-4 text-sm text-stone-700">
            <ul class="list-disc pl-5 space-y-1">
              <li><code>data.js</code> içinde <code>calendar.semesterStart</code> ve <code>calendar.semesterEnd</code> tarihlerini güncelleyin.</li>
              <li><code>calendar.weeklyClass.dayOfWeek</code> (0=PAZ … 6=CMT) ve <code>time</code> değerini ders saatinize göre ayarlayın.</li>
              <li>Sınav/ödev tarihlerini <code>calendar.milestones</code> listesine ekleyin.</li>
              <li>PDF yolu: <code>pdfPath</code> gerçek dosya adıyla birebir aynı olmalı.</li>
            </ul>
          </div>
        </div>
      </div>
    `;

    $("#content-container").innerHTML = renderCard({ title: "Takvim & Geri Sayım", body });

    const btn = $("#btn-download-ics");
    if (btn) btn.addEventListener("click", () => {
      const ics = buildICS();
      downloadTextFile("SBE1000-takvim.ics", ics);
    });

    const cfg = $("#cal-config");
    const btnCfg = $("#btn-show-config");
    if (btnCfg && cfg) btnCfg.addEventListener("click", () => cfg.classList.toggle("hidden"));
  };

  const buildWeekMenu = () => {
    const menu = $("#week-menu");
    if (!menu) return;
    const weeks = Array.isArray(DATA.weeks) ? DATA.weeks : [];
    menu.innerHTML = weeks.map((w, i) => `
      <button class="w-full text-left px-3 py-2 rounded-xl hover:bg-stone-50 text-stone-800"
              data-week="${i}">
        <div class="text-xs text-stone-500">${w.week}. hafta</div>
        <div class="text-sm font-medium">${w.title || ""}</div>
      </button>
    `).join("");

    menu.querySelectorAll("[data-week]").forEach(btn => {
      btn.addEventListener("click", () => {
        state.view = "week";
        state.weekIndex = Number(btn.getAttribute("data-week")) || 0;
        setActiveNav("nav-home"); // keep home highlighted
        render();
      });
    });
  };

  const wireNav = () => {
    const bind = (id, view) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.setAttribute("data-nav", "1");
      el.addEventListener("click", () => {
        state.view = view;
        setActiveNav(id);
        render();
      });
    };

    bind("nav-home", "home");
    bind("nav-grading", "grading");
    bind("nav-resources", "resources");
    bind("nav-lab", "lab");
    bind("nav-quiz", "quiz");
    bind("nav-tasks", "tasks");
    bind("nav-calendar", "calendar");
  };

  const render = () => {
    switch (state.view) {
      case "home": return renderHome();
      case "grading": return renderGrading();
      case "resources": return renderResources();
      case "lab": return renderLab();
      case "quiz": return renderQuiz();
      case "tasks": return renderTasks();
      case "calendar": return renderCalendar();
      case "week": return renderWeeks(state.weekIndex);
      default: return renderHome();
    }
  };

  document.addEventListener("DOMContentLoaded", () => {
    buildWeekMenu();
    wireNav();
    // Default view
    setActiveNav("nav-home");
    render();
  });
})();
