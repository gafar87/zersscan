import { useState, useRef } from "react";

export default function StampOverlay({ image, onImageUpload }) {
  const fileInputRef = useRef(null);
  const [stampVisible, setStampVisible] = useState(false);
  const [position, setPosition] = useState({ x: 50, y: 50 });
  const [isDragging, setIsDragging] = useState(false);
  const [size, setSize] = useState(120);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    onImageUpload(url);
    setStampVisible(true);
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - size / 2,
      y: e.clientY - size / 2,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div
      className="relative w-full h-full"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <div className="mb-4">
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded"
          onClick={() => fileInputRef.current.click()}
        >
          Загрузить печать
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageChange}
        />
      </div>

      {stampVisible && image && (
        <img
          src={image}
          alt="Печать"
          onMouseDown={handleMouseDown}
          style={{
            position: "absolute",
            top: position.y,
            left: position.x,
            width: size,
            height: size,
            cursor: "grab",
            opacity: 0.8,
            mixBlendMode: "multiply",
          }}
        />
      )}
    </div>
  );
}
