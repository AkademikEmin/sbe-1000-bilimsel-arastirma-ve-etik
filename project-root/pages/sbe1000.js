import Head from "next/head";
import Script from "next/script";

/**
 * Next.js (pages router) wrapper page for the static SBE1000 "Ders Bilgi Paketi" app.
 *
 * Place your static assets under: /public/assets/
 *   - /public/assets/styles.css
 *   - /public/assets/data.js      (must set window.COURSE_DATA = {...})
 *   - /public/assets/app.js
 *
 * Then add this file under: /pages/sbe1000.js  (or /pages/sbe1000/index.js)
 *
 * Notes:
 * - data.js MUST load before app.js.
 * - If you deploy under a sub-path (e.g., GitHub Pages repo), use Next.js basePath + assetPrefix accordingly.
 */
export default function SBE1000() {
  const v = "2026-01-13"; // cache-bust version; change when you update assets

  return (
    <>
      <Head>
        <title>SBE 1000 — Ders Bilgi Paketi</title>
        <meta name="description" content="SBE 1000 Lisansüstü Portal — Ders Bilgi Paketi" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {/* CSS */}
      <link rel="stylesheet" href={`/assets/styles.css?v=${encodeURIComponent(v)}`} />

      {/* Ensure data is defined before the app boots */}
      <Script src={`/assets/data.js?v=${encodeURIComponent(v)}`} strategy="beforeInteractive" />
      <Script src={`/assets/app.js?v=${encodeURIComponent(v)}`} strategy="afterInteractive" />

      {/* Static app mount point: this markup matches your existing index.html */}
      <div className="app">
        <aside className="sidebar">
          <div className="brand">
            <div className="logo">🎓</div>
            <div>
              <div className="title">SBE 1000</div>
              <div className="subtitle">LİSANSÜSTÜ PORTAL</div>
              <div className="dept">İlahiyat Fakültesi / Felsefe ve Din Bilimleri (Lisansüstü Portal)</div>
            </div>
          </div>

          <div className="nav-section">
            <div className="nav-header">MASAÜSTÜ</div>
            <nav className="nav">
              <button className="nav-item active" data-view="home">🏛️ Giriş &amp; Künye</button>
              <button className="nav-item" data-view="outcomes">⚖️ Başarı Ölçütleri</button>
              <button className="nav-item" data-view="resources">📚 Kaynaklar</button>
            </nav>
          </div>

          <div className="nav-section">
            <div className="nav-header">14 HAFTALIK MÜFREDAT</div>
            <div id="weekMenu" className="week-menu" />
          </div>

          <div className="nav-section">
            <div className="nav-header">UYGULAMA MODÜLLERİ</div>
            <nav className="nav">
              <button className="nav-item" data-view="lab">🧪 Analiz Laboratuvarı</button>
              <button className="nav-item" data-view="quizzes">📝 Muhakeme Quizleri</button>
              <button className="nav-item" data-view="assignments">📋 Ödev Şablonları</button>
            </nav>
          </div>

          <div className="nav-section">
            <div className="nav-header">Ders PDF'i</div>
            <a className="pdf-link" href="/assets/DERS_BILGI_PAKETI_1.pdf" target="_blank" rel="noreferrer">
              📄 PDF’yi aç
            </a>
          </div>
        </aside>

        <main className="main">
          <header className="topbar">
            <h1 id="pageTitle">Ders Bilgi Paketi</h1>
            <div className="meta">
              <span id="ects">AKTS: 7</span>
              <span id="term">Güz / Bahar Dönemi</span>
            </div>
          </header>

          <section id="content" className="content" />
        </main>
      </div>
    </>
  );
}
