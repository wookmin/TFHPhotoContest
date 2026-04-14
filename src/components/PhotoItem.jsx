function PhotoItem({ photo, onPreview, onDelete, disabled }) {
  return (
    <article className="photo-item">
      <button
        type="button"
        className="thumb-button"
        onClick={() => onPreview(photo.url)}
      >
        <img src={photo.url} alt={photo.fileName} className="thumb-image" />
      </button>
      <div className="photo-meta">
        <strong>{photo.fileName}</strong>
        <span>{new Date(photo.uploadedAt).toLocaleString('ko-KR')}</span>
      </div>
      <button
        type="button"
        className="danger-button"
        disabled={disabled}
        onClick={() => onDelete(photo)}
      >
        삭제
      </button>
    </article>
  );
}

export default PhotoItem;
