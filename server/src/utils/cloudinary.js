const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/** 폴더별 multer-cloudinary 업로더 생성 */
function createUploader(folder) {
  const storage = new CloudinaryStorage({
    cloudinary,
    params: {
      folder,
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
      transformation: [{ quality: 'auto', fetch_format: 'auto' }],
    },
  });
  return multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });
}

/** Cloudinary URL에서 public_id 추출 후 삭제 */
async function deleteFromCloudinary(imageUrl) {
  if (!imageUrl || !imageUrl.includes('cloudinary.com')) return;
  try {
    // URL 예시: https://res.cloudinary.com/cloud/image/upload/v123/routinemon/daily/filename.jpg
    const match = imageUrl.match(/\/upload\/(?:v\d+\/)?(.+)\.[^.]+$/);
    if (!match) return;
    const publicId = match[1];
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error('[Cloudinary] 파일 삭제 실패:', err.message);
  }
}

module.exports = { cloudinary, createUploader, deleteFromCloudinary };
