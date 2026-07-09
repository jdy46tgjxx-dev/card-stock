(function () {
  "use strict";

  const MAX_SIDE = 1200;
  const JPEG_QUALITY = 0.75;
  const MAX_COMPRESSED_BYTES = 1.8 * 1024 * 1024;

  function readAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("画像を読み込めませんでした。"));
      reader.readAsDataURL(file);
    });
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("画像形式を確認してください。"));
      image.src = src;
    });
  }

  function bytesFromDataURL(dataURL) {
    const base64 = dataURL.split(",")[1] || "";
    return Math.ceil((base64.length * 3) / 4);
  }

  async function compressImage(file) {
    if (!file || !file.type.startsWith("image/")) {
      throw new Error("画像ファイルを選択してください。");
    }

    const source = await readAsDataURL(file);
    const image = await loadImage(source);
    const scale = Math.min(1, MAX_SIDE / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    const dataURL = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    if (bytesFromDataURL(dataURL) > MAX_COMPRESSED_BYTES) {
      throw new Error("画像が大きすぎます。少し小さい画像で撮影または選択してください。");
    }

    return {
      dataURL,
      width,
      height,
      bytes: bytesFromDataURL(dataURL),
      type: "image/jpeg"
    };
  }

  window.CardStockImage = {
    compressImage
  };
})();
