const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
const CLOUDINARY_FOLDER =
  import.meta.env.VITE_CLOUDINARY_FOLDER || 'tfh-photo-contest';

export function isMediaUploadConfigured() {
  return Boolean(CLOUDINARY_CLOUD_NAME && CLOUDINARY_UPLOAD_PRESET);
}

export async function uploadImageToCloudinary({ file, teamName }) {
  if (!isMediaUploadConfigured()) {
    throw new Error('Cloudinary 환경 변수가 설정되지 않았습니다.');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  formData.append('folder', `${CLOUDINARY_FOLDER}/${teamName}`);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    {
      method: 'POST',
      body: formData,
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`이미지 업로드 실패: ${errorText}`);
  }

  const data = await response.json();

  return {
    url: data.secure_url,
    assetId: data.asset_id,
    publicId: data.public_id,
  };
}
