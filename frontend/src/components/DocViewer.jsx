import { useState } from "react";

export default function DocViewer({ onLoaded }) {
  const [htmlContent, setHtmlContent] = useState(null);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file || !file.name.endsWith(".docx")) {
      alert("Поддерживаются только .docx");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("http://localhost:8000/upload-docx", {
      method: "POST",
      body: formData,
    });

    const html = await res.text();
    setHtmlContent(html);
    onLoaded(); // активация печати
  };

  return (
    <div>
      <input
        type="file"
        accept=".docx"
        onChange={handleFileChange}
        className="text-sm"
      />
    </div>
  );
}
