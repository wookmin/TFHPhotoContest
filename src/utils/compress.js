function loadImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = URL.createObjectURL(file);
  });
}

export async function compressImage(file) {
  const image = await loadImage(file);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const maxSize = 1100;
  const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
  const width = Math.round(image.width * scale);
  const height = Math.round(image.height * scale);

  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, 0, 0, width, height);

  URL.revokeObjectURL(image.src);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('이미지 압축에 실패했습니다.'));
          return;
        }

        resolve(blob);
      },
      'image/jpeg',
      0.78,
    );
  });
}
