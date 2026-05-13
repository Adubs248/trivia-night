// client/src/components/shared/MediaDisplay.jsx
export default function MediaDisplay({ url, type }) {
  if (!url) return null;
  return (
    <div className="media-display">
      {type === 'image' && <img src={url} alt="Question media" />}
      {type === 'audio' && <audio controls src={url} />}
      {type === 'video' && <video controls src={url} />}
    </div>
  );
}
