// Barcode scanning with the camera: native BarcodeDetector when the browser has it, ZXing otherwise.
(function () {
  const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"];
  let stream = null, raf = 0, zxReader = null, stopped = true;

  function friendly(text) { const e = new Error(text); e.friendly = true; return e; }

  function loadZXing() {
    if (window.ZXing) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "vendor/zxing-0.21.3.min.js";
      s.onload = resolve;
      s.onerror = () => reject(friendly("No se pudo cargar el lector de códigos. Escribe el número del código."));
      document.head.appendChild(s);
    });
  }

  async function nativeSupported() {
    if (!("BarcodeDetector" in window)) return false;
    try {
      const f = await window.BarcodeDetector.getSupportedFormats();
      return FORMATS.some(x => f.includes(x));
    } catch (e) { return false; }
  }

  async function start(video, onCode) {
    stop();
    stopped = false;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw friendly("Este navegador no permite usar la cámara. Escribe el número del código.");
    }
    if (await nativeSupported()) {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      if (stopped) { stop(); return; }
      video.srcObject = stream;
      await video.play();
      const detector = new window.BarcodeDetector({ formats: FORMATS });
      const tick = async () => {
        if (stopped) return;
        try {
          const codes = await detector.detect(video);
          if (codes.length && !stopped) { const v = codes[0].rawValue; stop(); onCode(v); return; }
        } catch (e) { /* frame not ready */ }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return;
    }
    await loadZXing();
    if (stopped) return;
    const hints = new Map();
    hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [
      ZXing.BarcodeFormat.EAN_13, ZXing.BarcodeFormat.EAN_8, ZXing.BarcodeFormat.UPC_A,
      ZXing.BarcodeFormat.UPC_E, ZXing.BarcodeFormat.CODE_128,
    ]);
    zxReader = new ZXing.BrowserMultiFormatReader(hints, 250);
    await zxReader.decodeFromConstraints({ video: { facingMode: "environment" } }, video, (result) => {
      if (result && !stopped) { const v = result.getText(); stop(); onCode(v); }
    });
  }

  function stop() {
    stopped = true;
    cancelAnimationFrame(raf);
    if (zxReader) { try { zxReader.reset(); } catch (e) {} zxReader = null; }
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  }

  window.Scanner = { start, stop };
})();
