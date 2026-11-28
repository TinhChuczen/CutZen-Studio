(function () {
  // 1. Tự động bật khử tiếng ồn & tiếng vang của Micro khi ghi âm
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    const origGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = function (constraints) {
      if (constraints && constraints.audio) {
        const audioCfg = typeof constraints.audio === 'object' ? constraints.audio : {};
        constraints.audio = Object.assign({}, audioCfg, {
          noiseSuppression: true,
          echoCancellation: true,
          autoGainControl: true
        });
      }
      return origGetUserMedia(constraints);
    };
  }

  // 2. Bộ xử lý lọc tiếng hơi thở & điều chỉnh tông giọng (Thanh / Ấm / Trầm)
  let currentTone = 'warm'; // Mặc định: Trầm ấm

  function applyVoiceFilter(mediaEl) {
    if (!mediaEl || mediaEl.dataset.filtered) return;
    mediaEl.dataset.filtered = 'true';

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    mediaEl.addEventListener('play', function () {
      if (!mediaEl._ctx) {
        const ctx = new AudioCtx();
        const src = ctx.createMediaElementSource(mediaEl);

        // Cắt tiếng hơi thở trầm & tiếng ù quạt (dưới 120Hz)
        const breathCut = ctx.createBiquadFilter();
        breathCut.type = 'highpass';
        breathCut.frequency.value = 120;

        // Cắt tiếng xì hơi thở gắt ở dải cao (trên 6500Hz)
        const hissCut = ctx.createBiquadFilter();
        hissCut.type = 'lowpass';
        hissCut.frequency.value = 6500;

        // Bộ chỉnh màu giọng: Ấm / Thanh / Trầm
        const toneEQ = ctx.createBiquadFilter();
        toneEQ.type = 'peaking';

        // Nén động giúp giọng đều, không bị vỡ tiếng khi thở mạnh
        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.value = -24;
        compressor.ratio.value = 4;

        src.connect(breathCut);
        breathCut.connect(hissCut);
        hissCut.connect(toneEQ);
        toneEQ.connect(compressor);
        compressor.connect(ctx.destination);

        mediaEl._ctx = ctx;
        mediaEl._toneEQ = toneEQ;
      }

      if (mediaEl._ctx.state === 'suspended') mediaEl._ctx.resume();

      // Cập nhật thông số theo tông giọng người dùng chọn
      const eq = mediaEl._toneEQ;
      if (currentTone === 'clear') {
        eq.frequency.value = 2800; // Giọng thanh, sáng rõ
        eq.gain.value = 6;
      } else if (currentTone === 'deep') {
        eq.frequency.value = 180;  // Giọng trầm dày
        eq.gain.value = 7;
      } else {
        eq.frequency.value = 320;  // Giọng trầm ấm tự nhiên
        eq.gain.value = 5;
      }
    });
  }

  // 3. Tự động gắn bảng chọn tông giọng & áp dụng cho mọi âm thanh/videowindow.addEventListener('DOMContentLoaded', function () {
    const bar = document.createElement('div');
    bar.style.cssText = 'position:fixed;bottom:12px;right:12px;z-index:9999;background:#1e293b;color:#fff;padding:8px 12px;border-radius:10px;border:1px solid #38bdf8;font-size:13px;box-shadow:0 4px 12px rgba(0,0,0,0.4);';
    bar.innerHTML = '🎙️ Lọc hơi thở & Giọng: ' +
      '<select id="czVoiceTone" style="background:#0f172a;color:#38bdf8;border:1px solid #38bdf8;border-radius:6px;padding:3px 6px;font-weight:bold;">' +
      '<option value="warm">Trầm ấm</option>' +
      '<option value="clear">Thanh sáng</option>' +
      '<option value="deep">Trầm dày</option>' +
      '</select>';
    document.body.appendChild(bar);

    document.getElementById('czVoiceTone').addEventListener('change', function (e) {
      currentTone = e.target.value;
    });

    setInterval(function () {
      document.querySelectorAll('audio, video').forEach(applyVoiceFilter);
    }, 1000);
  });
)();
(function () {
  // 1. Tự động mở khóa mọi ô chọn tệp để nhận tất cả định dạng & nhiều file
  function unlockAllInputs() {
    document.querySelectorAll('input[type="file"]').forEach(function (inp) {
      inp.setAttribute('accept', '*/*');
      inp.removeAttribute('capture');
    });
  }

  // 2. Tự động tối ưu ảnh nặng (trên 3MB) giúp máy đời cũ không bị đơ
  function compressHeavyImage(file) {
    return new Promise(function (resolve) {
      if (!file.type.startsWith('image/') || file.size < 3 * 1024 * 1024) {
        return resolve(file);
      }
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = function () {
        const maxSide = 1920;
        let w = img.width, h = img.height;
        if (w > maxSide || h > maxSide) {
          if (w > h) { h = Math.round(h * maxSide / w); w = maxSide; }
          else { w = Math.round(w * maxSide / h); h = maxSide; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        canvas.toBlob(function (blob) {
          resolve(blob ? new File([blob], file.name, { type: 'image/jpeg' }) : file);
        }, 'image/jpeg', 0.85);
      };
      img.onerror = function () { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }

  // 3. Hỗ trợ kéo-thả tệp từ mọi thư mục trực tiếp vào trang web
  window.addEventListener('DOMContentLoaded', function () {
    unlockAllInputs();
    setInterval(unlockAllInputs, 1500);

    document.addEventListener('change', async function (e) {
      const inp = e.target;
      if (inp && inp.type === 'file' && inp.files && inp.files.length > 0 && !inp.dataset.processed) {
        const dt = new DataTransfer();
        let changed = false;
        for (let i = 0; i < inp.files.length; i++) {
          const f = inp.files[i];
          if (f.type.startsWith('image/') && f.size >= 3 * 1024 * 1024) {
            dt.items.add(await compressHeavyImage(f));
            changed = true;
          } else {
            dt.items.add(f);
          }
        }
        if (changed) {
          inp.dataset.processed = 'true';
          inp.files = dt.files;
          inp.dispatchEvent(new Event('change', { bubbles: true }));
          setTimeout(() => { delete inp.dataset.processed; }, 500);
        }
      }
    }, true);
  });
})();
