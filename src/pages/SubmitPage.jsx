import { useEffect, useMemo, useState } from 'react';
import {
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase.js';
import { compressImage } from '../utils/compress.js';
import PhotoItem from '../components/PhotoItem.jsx';
import Lightbox from '../components/Lightbox.jsx';
import { uploadImageToCloudinary } from '../utils/mediaUpload.js';

function getDeadlineState() {
  const now = new Date();
  const deadline = new Date(now);
  deadline.setHours(23, 59, 0, 0);
  return {
    isClosed: now > deadline,
    deadline,
  };
}

function formatCount(submissions, quota) {
  return `${submissions}/${quota}장`;
}

function sanitizeFileName(fileName) {
  return fileName.replace(/[^\w.-]+/g, '_');
}

function SubmitPage({ teamName, onBack }) {
  const [team, setTeam] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [lightboxUrl, setLightboxUrl] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [{ isClosed }, setDeadlineState] = useState(getDeadlineState);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setDeadlineState(getDeadlineState());
    }, 30000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    let unsubscribe = () => {};

    async function loadTeam() {
      const teamDoc = await getDoc(doc(db, 'teams', teamName));
      if (teamDoc.exists()) {
        setTeam(teamDoc.data());
      }

      unsubscribe = onSnapshot(doc(db, 'submissions', teamName), (snapshot) => {
        const data = snapshot.data();
        setPhotos(Array.isArray(data?.photos) ? data.photos : []);
      });
    }

    loadTeam();

    return () => unsubscribe();
  }, [teamName]);

  const quota = team?.quota ?? 0;
  const remaining = Math.max(quota - photos.length, 0);
  const isLocked = isClosed || remaining === 0 || busy;
  const statusText = useMemo(
    () => formatCount(photos.length, quota),
    [photos.length, quota],
  );

  async function handleUpload(event) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';

    if (!files.length || remaining === 0 || isClosed) {
      return;
    }

    const allowedFiles = files.slice(0, remaining);

    if (files.length > allowedFiles.length) {
      setNotice(`잔여 매수만큼만 업로드했습니다. (${allowedFiles.length}장)`);
    } else {
      setNotice('');
    }

    setBusy(true);

    try {
      const uploaded = [];

      for (const file of allowedFiles) {
        const compressedBlob = await compressImage(file);
        const safeName = sanitizeFileName(file.name || 'photo.jpg');
        const uploadedAsset = await uploadImageToCloudinary({
          file: new File([compressedBlob], safeName, {
            type: 'image/jpeg',
          }),
          teamName,
        });

        uploaded.push({
          url: uploadedAsset.url,
          fileName: safeName,
          uploadedAt: new Date().toISOString(),
          assetId: uploadedAsset.assetId,
          publicId: uploadedAsset.publicId,
        });
      }

      await runTransaction(db, async (transaction) => {
        const submissionRef = doc(db, 'submissions', teamName);
        const snapshot = await transaction.get(submissionRef);
        const currentPhotos = Array.isArray(snapshot.data()?.photos)
          ? snapshot.data().photos
          : [];

        transaction.set(
          submissionRef,
          {
            photos: [...currentPhotos, ...uploaded],
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      });
    } catch (error) {
      console.error(error);
      setNotice('업로드 중 오류가 발생했습니다.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(photo) {
    if (isClosed || busy) {
      return;
    }

    setBusy(true);

    try {
      await runTransaction(db, async (transaction) => {
        const submissionRef = doc(db, 'submissions', teamName);
        const snapshot = await transaction.get(submissionRef);
        const currentPhotos = Array.isArray(snapshot.data()?.photos)
          ? snapshot.data().photos
          : [];

        transaction.set(
          submissionRef,
          {
            photos: currentPhotos.filter((item) => item.url !== photo.url),
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      });
    } catch (error) {
      console.error(error);
      setNotice('삭제 중 오류가 발생했습니다.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel submit-page">
      <header className="submit-header">
        <div>
          <p className="eyebrow-text">팀장 이름</p>
          <h1 className="page-title small">{teamName}</h1>
        </div>
        <div className="count-chip">{statusText}</div>
      </header>

      {isClosed ? (
        <p className="deadline-banner">사진 접수가 마감되었습니다</p>
      ) : (
        <p className="helper-text">오늘 23:59까지 업로드와 삭제가 가능합니다.</p>
      )}

      <label className={`upload-button ${isLocked ? 'disabled' : ''}`}>
        <input
          type="file"
          accept="image/*"
          multiple
          disabled={isLocked}
          onChange={handleUpload}
        />
        {remaining === 0 ? '할당 매수를 모두 제출했습니다' : '사진 업로드'}
      </label>

      {notice ? <p className="helper-text">{notice}</p> : null}
      <p className="helper-text">
        삭제하면 제출 목록에서는 제거되지만 외부 이미지 저장소의 원본 파일은 자동 삭제되지 않습니다.
      </p>

      <div className="photo-list">
        {photos.length ? (
          photos.map((photo) => (
            <PhotoItem
              key={photo.url}
              photo={photo}
              disabled={isClosed || busy}
              onPreview={setLightboxUrl}
              onDelete={handleDelete}
            />
          ))
        ) : (
          <div className="empty-state">
            <p>아직 제출된 사진이 없습니다.</p>
          </div>
        )}
      </div>

      <button className="ghost-button" type="button" onClick={onBack}>
        이름 입력으로 돌아가기
      </button>

      <Lightbox imageUrl={lightboxUrl} onClose={() => setLightboxUrl('')} />
    </section>
  );
}

export default SubmitPage;
