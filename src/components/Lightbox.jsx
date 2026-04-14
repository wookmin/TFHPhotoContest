function Lightbox({ imageUrl, onClose }) {
  if (!imageUrl) {
    return null;
  }

  return (
    <div className="lightbox" role="presentation" onClick={onClose}>
      <button
        type="button"
        className="lightbox-close"
        onClick={onClose}
      >
        닫기
      </button>
      <img
        className="lightbox-image"
        src={imageUrl}
        alt="전체 화면 미리보기"
        onClick={(event) => event.stopPropagation()}
      />
    </div>
  );
}

export default Lightbox;
