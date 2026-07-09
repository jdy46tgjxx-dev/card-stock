(function () {
  "use strict";

  const MAX_SIDE = 1200;
  const JPEG_QUALITY = 0.75;
  const MAX_COMPRESSED_BYTES = 1.8 * 1024 * 1024;
  const CARD_RATIO = 91 / 55;

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

  function fitSize(width, height, maxSide) {
    const scale = Math.min(1, maxSide / Math.max(width, height));
    return {
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale))
    };
  }

  function drawToJpeg(source, width, height) {
    const size = fitSize(width, height, MAX_SIDE);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d", { alpha: false });
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, size.width, size.height);
    context.imageSmoothingQuality = "high";
    context.drawImage(source, 0, 0, width, height, 0, 0, size.width, size.height);
    const dataURL = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    if (bytesFromDataURL(dataURL) > MAX_COMPRESSED_BYTES) {
      throw new Error("画像が大きすぎます。少し小さい画像で撮影または選択してください。");
    }
    return {
      dataURL,
      width: size.width,
      height: size.height,
      bytes: bytesFromDataURL(dataURL),
      type: "image/jpeg"
    };
  }

  async function compressImage(file) {
    if (!file || !file.type.startsWith("image/")) throw new Error("画像ファイルを選択してください。");
    const source = await readAsDataURL(file);
    const image = await loadImage(source);
    return drawToJpeg(image, image.width, image.height);
  }

  function cropToCardFrame(sourceCanvas) {
    const sourceWidth = sourceCanvas.width;
    const sourceHeight = sourceCanvas.height;
    let cropWidth = Math.round(sourceWidth * 0.86);
    let cropHeight = Math.round(cropWidth / CARD_RATIO);
    if (cropHeight > sourceHeight * 0.72) {
      cropHeight = Math.round(sourceHeight * 0.72);
      cropWidth = Math.round(cropHeight * CARD_RATIO);
    }
    const sx = Math.max(0, Math.round((sourceWidth - cropWidth) / 2));
    const sy = Math.max(0, Math.round((sourceHeight - cropHeight) / 2));
    const canvas = document.createElement("canvas");
    canvas.width = cropWidth;
    canvas.height = cropHeight;
    const context = canvas.getContext("2d", { alpha: false });
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, cropWidth, cropHeight);
    context.drawImage(sourceCanvas, sx, sy, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
    return drawToJpeg(canvas, cropWidth, cropHeight);
  }

  function captureVideoFrame(video, shouldCrop) {
    const canvas = document.createElement("canvas");
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(video, 0, 0, width, height);
    return shouldCrop ? cropToCardFrame(canvas) : drawToJpeg(canvas, width, height);
  }

  async function dataURLToPreparedCanvas(dataURL) {
    const image = await loadImage(dataURL);
    const size = fitSize(image.width, image.height, 1600);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d", { alpha: false });
    context.filter = "contrast(1.12) brightness(1.05) grayscale(1)";
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, size.width, size.height);
    context.drawImage(image, 0, 0, size.width, size.height);
    return canvas;
  }

  window.CardStockImage = {
    compressImage,
    captureVideoFrame,
    dataURLToPreparedCanvas
  };
})();
