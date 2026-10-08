// Scroll'a bağlı webp kare dizisi + metin katmanları.
// Kareler frames/<desktop|mobile>/0001.webp… şeklinde, sayısı frames/manifest.json'da.
(() => {
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const section = document.getElementById('scrolly');
  const loader = document.getElementById('loader');
  const loaderPct = document.getElementById('loaderPct');
  const progressBar = document.getElementById('progressBar');
  const beats = [...document.querySelectorAll('.beat')];
  const ingredients = [...document.querySelectorAll('.ingredients li')];

  const FADE = 0.035;        // metinlerin giriş/çıkış süresi (scroll ilerlemesi cinsinden)
  const SMOOTHING = 0.14;    // 0–1: küçüldükçe kare geçişi daha yumuşak/gecikmeli
  const READY_AT = 0.35;     // karelerin bu oranı yüklenince yükleme ekranı kalkar
  const VIDEO_END = 0.88;    // video bu ilerlemede biter, sonrası dürüm görseline geçiş
  const finale = document.getElementById('finale');

  const set = window.matchMedia('(max-width: 760px)').matches ? 'mobile' : 'desktop';
  let frames = [];
  let count = 0;
  let current = 0;           // ekrandaki (yumuşatılmış) kare
  let target = 0;            // scroll'un istediği kare
  let lastDrawn = -1;

  document.body.classList.add('is-loading');

  fetch('frames/manifest.json')
    .then((r) => r.json())
    .then(({ count: n }) => {
      count = n;
      frames = new Array(n);
      preload();
    });

  // İlk kare hemen, sonra her 8. kare (kaba önizleme), sonra kalanlar: scroll erken başlasa bile boşluk olmaz
  function preload() {
    const order = [0];
    for (let i = 8; i < count; i += 8) order.push(i);
    for (let i = 1; i < count; i++) if (i % 8) order.push(i);

    let loaded = 0;
    let revealed = false;
    let next = 0;
    const PARALLEL = 6;

    const loadNext = () => {
      if (next >= order.length) return;
      const i = order[next++];
      const img = new Image();
      img.decoding = 'async';
      img.src = `frames/${set}/${String(i + 1).padStart(4, '0')}.webp`;
      img.onload = img.onerror = () => {
        if (img.naturalWidth) frames[i] = img;
        loaded++;
        loaderPct.textContent = `${Math.round((loaded / count) * 100)}%`;
        if (i === 0) { resize(); draw(0); }
        if (!revealed && loaded / count >= READY_AT) {
          revealed = true;
          loader.classList.add('is-done');
          document.body.classList.remove('is-loading');
        }
        lastDrawn = -1; // yeni kare geldi, mevcut konum için daha yakın kare olabilir
        loadNext();
      };
    };
    for (let k = 0; k < PARALLEL; k++) loadNext();
  }

  // Henüz yüklenmemiş kare istenirse en yakın yüklü kareyi kullan
  function nearestLoaded(i) {
    if (frames[i]) return frames[i];
    for (let d = 1; d < count; d++) {
      if (frames[i - d]) return frames[i - d];
      if (frames[i + d]) return frames[i + d];
    }
    return null;
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
    lastDrawn = -1;
  }

  // object-fit: cover mantığıyla çiz
  function draw(i) {
    const img = nearestLoaded(i);
    if (!img) return;
    const cw = canvas.width, ch = canvas.height;
    const scale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
    const w = img.naturalWidth * scale, h = img.naturalHeight * scale;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
  }

  function scrollProgress() {
    const rect = section.getBoundingClientRect();
    const total = section.offsetHeight - window.innerHeight;
    return Math.min(1, Math.max(0, -rect.top / total));
  }

  // Her metin bloğu kendi aralığında belirir, kayar, kaybolur
  function updateBeats(p) {
    for (const el of beats) {
      const a = parseFloat(el.dataset.in);
      const b = parseFloat(el.dataset.out);
      let o = 0;
      if (p >= a && p <= b) {
        const fadeIn = a <= 0 ? 1 : Math.min(1, (p - a) / FADE);
        const fadeOut = b >= 1 ? 1 : Math.min(1, (b - p) / FADE);
        o = Math.min(fadeIn, fadeOut);
      }
      const shift = (1 - o) * 24 * (p < (a + b) / 2 ? 1 : -1);
      el.style.opacity = o;
      el.style.translate = `0 ${shift}px`;
      el.classList.toggle('is-active', o > 0.5);
    }
    for (const li of ingredients) li.classList.toggle('is-on', p >= parseFloat(li.dataset.at));
  }

  function tick() {
    if (count) {
      const p = scrollProgress();
      target = Math.min(1, p / VIDEO_END) * (count - 1);
      current += (target - current) * SMOOTHING;
      if (Math.abs(target - current) < 0.01) current = target;
      const idx = Math.round(current);
      if (idx !== lastDrawn) { draw(idx); lastDrawn = idx; }
      updateBeats(p);
      const f = Math.min(1, Math.max(0, (p - VIDEO_END) / 0.07));
      finale.style.opacity = f;
      finale.style.transform = `scale(${1.06 - f * 0.06})`;
      progressBar.style.transform = `scaleX(${p})`;
    }
    requestAnimationFrame(tick);
  }

  window.addEventListener('resize', resize);
  requestAnimationFrame(tick);
})();
