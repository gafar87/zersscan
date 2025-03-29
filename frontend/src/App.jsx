import React, { useEffect, useState } from "react";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf";
import workerSrc from "pdfjs-dist/legacy/build/pdf.worker?url";

import mammoth from "mammoth";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

// Настройка воркера для PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

/**
 * Чем больше PDF_SCALE, тем выше качество рендеринга и больше итоговые страницы.
 * Если хочешь 1:1, ставь 1.0, но тогда на HiDPI-мониторе PDF может выглядеть «мыльным».
 * С 2.0 PDF будет чётким, и экспорт совпадёт пиксельно.
 */
const PDF_SCALE = 2.0;

export default function App() {
  // Тип документа: 'pdf' | 'docx' | null
  const [docType, setDocType] = useState(null);
  const [pdfPages, setPdfPages] = useState([]);
  const [pdfNumPages, setPdfNumPages] = useState(0);
  const [pdfCurrentPage, setPdfCurrentPage] = useState(1);
  const [docxHtml, setDocxHtml] = useState(null);
  
  const [stampsLibrary, setStampsLibrary] = useState([]);
  const [placedStamps, setPlacedStamps] = useState([]);
  const [activeStampIndex, setActiveStampIndex] = useState(null);
  
  // 👉 Имя загруженного файла
  const [uploadedFileName, setUploadedFileName] = useState(null);
  

  // ====================== Загрузка PDF ======================
  const loadPdf = async (file) => {
    setDocType("pdf");
    setPdfPages([]);
    setPdfNumPages(0);
    setPdfCurrentPage(1);
    setDocxHtml(null);

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    setPdfNumPages(pdf.numPages);

    // Постранично рендерим
    const pages = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const pageData = await pdf.getPage(p);
      const viewport = pageData.getViewport({ scale: PDF_SCALE });

      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");

      // Рендерим страницу в canvas
      await pageData.render({ canvasContext: ctx, viewport }).promise;

      pages.push({
        pageNumber: p,
        dataUrl: canvas.toDataURL("image/png"),
        width: canvas.width,
        height: canvas.height,
      });
    }
    setPdfPages(pages);
  };

  // ====================== Загрузка DOCX ======================
  const loadDocx = async (file) => {
    setDocType("docx");
    setPdfPages([]);
    setPdfNumPages(0);

    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.convertToHtml({ arrayBuffer });
    setDocxHtml(result.value);
  };

  // ====================== Селектор файла (PDF / DOCX) ======================
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
  
    setUploadedFileName(file.name);
  
    if (file.name.endsWith(".pdf")) {
      await loadPdf(file);
      setDocType("pdf");
    } else if (file.name.endsWith(".docx")) {
      const formData = new FormData();
      formData.append("file", file);
  
      try {
        const response = await fetch("http://localhost:8000/convert-docx", {
          method: "POST",
          body: formData,
        });
  
        if (!response.ok) {
          throw new Error("Ошибка при конвертации DOCX");
        }
  
        const blob = await response.blob();
        const pdfFile = new File([blob], "converted.pdf", { type: "application/pdf" });
  
        await loadPdf(pdfFile);
        setDocType("pdf");
      } catch (error) {
        alert("Ошибка при загрузке и конвертации документа.");
        console.error(error);
      }
    } else {
      alert("Поддерживаются только PDF и DOCX");
    }
  };
  
  

  // ====================== Загрузка печати в каталог ======================
  const handleStampUpload = (e) => {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith("image")) return;
    const src = URL.createObjectURL(file);

    setStampsLibrary((prev) => [
      ...prev,
      {
        id: Date.now(),
        src,
        size: 100,
        rotation: 0,
      },
    ]);
  };

  // ====================== Настройки печати в каталоге ======================
  const updateStampInLibrary = (stampId, changes) => {
    setStampsLibrary((prev) =>
      prev.map((st) => (st.id === stampId ? { ...st, ...changes } : st))
    );
  };

  // ====================== Добавить печать на страницу ======================
  const addStampToPage = (stampId) => {
    const libStamp = stampsLibrary.find((st) => st.id === stampId);
    if (!libStamp) return;

    const page = docType === "pdf" ? pdfCurrentPage : 1;
    setPlacedStamps((prev) => [
      ...prev,
      {
        libraryId: stampId,
        page,
        x: 50,
        y: 50,
        size: libStamp.size,
        rotation: libStamp.rotation,
      },
    ]);
  };

  // ====================== Удалить печать со страницы ======================
  const removePlacedStamp = (index) => {
    setPlacedStamps((prev) => prev.filter((_, i) => i !== index));
  };

  // ====================== Движение печати мышью ======================
  const handleMouseMove = (e) => {
    if (activeStampIndex === null) return;

    // Перетаскиваем конкретную печать
    setPlacedStamps((prev) =>
      prev.map((pst, i) => {
        if (i !== activeStampIndex) return pst;

        if (docType === "pdf") {
          const pageObj = pdfPages.find((p) => p.pageNumber === pst.page);
          if (!pageObj) return pst;

          const pageElem = document.getElementById(`pdf-page-${pst.page}`);
          if (!pageElem) return pst;

          const rect = pageElem.getBoundingClientRect();
          const newX = e.clientX - rect.left - pst.size / 2;
          const newY = e.clientY - rect.top - pst.size / 2;
          return { ...pst, x: newX, y: newY };
        } else {
          // docx
          const docxElem = document.getElementById("docx-container");
          if (!docxElem) return pst;

          const rect = docxElem.getBoundingClientRect();
          const newX = e.clientX - rect.left - pst.size / 2;
          const newY = e.clientY - rect.top - pst.size / 2;
          return { ...pst, x: newX, y: newY };
        }
      })
    );
  };

  const handleMouseUp = () => setActiveStampIndex(null);

  // ====================== Пагинация PDF ======================
  const goToPage = (pageNum) => {
    if (pageNum < 1 || pageNum > pdfNumPages) return;
    setPdfCurrentPage(pageNum);
  };

  const pagesPerGroup = 10;
  const currentGroup = Math.floor((pdfCurrentPage - 1) / pagesPerGroup);
  const groupStart = currentGroup * pagesPerGroup + 1;
  const groupEnd = Math.min(groupStart + pagesPerGroup - 1, pdfNumPages);
  const pageNumbers = [];
  for (let p = groupStart; p <= groupEnd; p++) {
    pageNumbers.push(p);
  }

  // ====================== Экспорт в PDF ======================
  const exportToPdf = async () => {
    const doc = new jsPDF({ unit: "px" });
    // Удаляем стартовую пустую страницу
    doc.deletePage(1);

    if (docType === "pdf") {
      for (let p = 1; p <= pdfNumPages; p++) {
        const pageObj = pdfPages.find((pg) => pg.pageNumber === p);
        if (!pageObj) continue;

        // Создаём временный canvas
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = pageObj.width;
        tempCanvas.height = pageObj.height;

        const ctx = tempCanvas.getContext("2d");

        // Рисуем страницу
        const baseImg = await loadImage(pageObj.dataUrl);
        ctx.drawImage(baseImg, 0, 0);

        // Рисуем печати
        const pageStamps = placedStamps.filter((st) => st.page === p);
        for (const stmp of pageStamps) {
          const libStamp = stampsLibrary.find((lib) => lib.id === stmp.libraryId);
          if (!libStamp) continue;

          const stampImg = await loadImage(libStamp.src);
          ctx.save();
          ctx.translate(stmp.x + stmp.size / 2, stmp.y + stmp.size / 2);
          ctx.rotate((stmp.rotation * Math.PI) / 180);

          // Прозрачность и mix-blend-mode
          ctx.globalAlpha = 0.85;
          ctx.globalCompositeOperation = "multiply";

          ctx.drawImage(stampImg, -stmp.size / 2, -stmp.size / 2, stmp.size, stmp.size);
          ctx.restore();

          // Сбрасываем blend mode
          ctx.globalCompositeOperation = "source-over";
        }

        const finalPageUrl = tempCanvas.toDataURL("image/png");
        doc.addPage([pageObj.width, pageObj.height]);
        doc.addImage(finalPageUrl, "PNG", 0, 0, pageObj.width, pageObj.height);
      }
    } else if (docType === "docx") {
      const docxElem = document.getElementById("docx-container");
      if (!docxElem) return;
      const shot = await html2canvas(docxElem);
      const imgData = shot.toDataURL("image/png");
      doc.addPage([shot.width, shot.height]);
      doc.addImage(imgData, "PNG", 0, 0, shot.width, shot.height);
    }

    doc.save("exported_document.pdf");
  };

  // ====================== Загрузка изображения (helper) ======================
  const loadImage = (src) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  };

  // ====================== JSX ======================
  return (
    <div
      className="flex flex-col h-screen"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Шапка */}
      <header className="bg-white px-4 py-3 border-b flex items-center justify-between">
        <h1 className="text-xl font-bold">СКИНЬ СКАН</h1>
        {uploadedFileName && (
  <span className="ml-4 text-gray-600 text-sm italic truncate max-w-[40%]">
    📁 {uploadedFileName}
  </span>
)}

        <button
          onClick={exportToPdf}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          Скачать PDF
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Левая панель */}
        <aside className="w-64 border-r p-3 bg-gray-50 space-y-4 overflow-auto">
{/* Загрузка документа */}
<div>
  <label className="block mb-1 font-medium"> </label>
  <div className="relative group">
    <button
      className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-3 rounded shadow text-sm text-left"
      onClick={() => document.getElementById("upload-doc-input").click()}
    >
      📄 Выбрать PDF / DOCX
    </button>
    <input
      id="upload-doc-input"
      type="file"
      accept=".pdf,.docx"
      onChange={handleFileUpload}
      className="hidden"
    />
  </div>
</div>

{/* Загрузка печати */}
<div>
  <label className="block mb-1 font-medium"> </label>
  <div className="relative group">
    <button
      className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 px-3 rounded shadow text-sm text-left"
      onClick={() => document.getElementById("upload-stamp-input").click()}
    >
      🖋️ Загрузить печать
    </button>
    <input
      id="upload-stamp-input"
      type="file"
      accept="image/*"
      onChange={handleStampUpload}
      className="hidden"
    />
  </div>
</div>


          {/* Каталог печатей */}
          {stampsLibrary.length > 0 && (
            <div className="space-y-3 text-sm">
              <p className="font-medium">Каталог печатей:</p>
              {stampsLibrary.map((st) => (
                <div key={st.id} className="bg-white border p-2 space-y-2">
                  {/* Превью печати */}
                  <div className="flex justify-center">
                    <img
                      src={st.src}
                      style={{
                        width: st.size,
                        height: st.size,
                        transform: `rotate(${st.rotation}deg)`,
                      }}
                      alt="stamp"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-700">
                      Размер: {st.size}px
                    </label>
                    <input
                      type="range"
                      min="50"
                      max="300"
                      value={st.size}
                      onChange={(e) =>
                        updateStampInLibrary(st.id, { size: parseInt(e.target.value) })
                      }
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-700">
                      Поворот: {st.rotation}°
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="360"
                      value={st.rotation}
                      onChange={(e) =>
                        updateStampInLibrary(st.id, { rotation: parseInt(e.target.value) })
                      }
                      className="w-full"
                    />
                  </div>

                  <button
                    onClick={() => addStampToPage(st.id)}
                    className="w-full bg-blue-500 hover:bg-blue-600 text-white rounded py-1"
                  >
                    Добавить на страницу
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Пагинация PDF */}
          {docType === "pdf" && pdfNumPages > 1 && (
            <div className="space-y-2 text-sm">
              <p className="font-medium">Страницы (PDF):</p>
              <div className="flex items-center flex-wrap gap-1">
                {groupStart > 1 && (
                  <button
                    onClick={() => goToPage(groupStart - 1)}
                    className="px-2 py-1 bg-gray-200 rounded"
                  >
                    «
                  </button>
                )}
                {pageNumbers.map((p) => (
                  <button
                    key={p}
                    onClick={() => goToPage(p)}
                    className={`px-2 py-1 rounded ${
                      p === pdfCurrentPage
                        ? "bg-blue-600 text-white"
                        : "bg-gray-200 hover:bg-gray-300"
                    }`}
                  >
                    {p}
                  </button>
                ))}
                {groupEnd < pdfNumPages && (
                  <button
                    onClick={() => goToPage(groupEnd + 1)}
                    className="px-2 py-1 bg-gray-200 rounded"
                  >
                    »
                  </button>
                )}
              </div>
            </div>
          )}
        </aside>

        {/* Правая часть */}
        <main className="flex-1 overflow-auto p-3 bg-gray-200">
          {docType === "pdf" ? (
            pdfPages.length > 0 ? (
              pdfPages.map((pg) => {
                const visible = pg.pageNumber === pdfCurrentPage;
                return (
                  <div
                    key={pg.pageNumber}
                    id={`pdf-page-${pg.pageNumber}`}
                    className={`mx-auto relative mb-4 border border-gray-300 ${
                      visible ? "block" : "hidden"
                    }`}
                    style={{ width: pg.width, height: pg.height }}
                  >
                    <img src={pg.dataUrl} alt={`page-${pg.pageNumber}`} />
                    {/* Размещённые печати на этой странице */}
                    {placedStamps
                      .filter((pst) => pst.page === pg.pageNumber)
                      .map((pst, i) => {
                        const libStamp = stampsLibrary.find((l) => l.id === pst.libraryId);
                        if (!libStamp) return null;

                        // Активны ли мы?
                        const isActive = i === activeStampIndex;

                        return (
                          <div
                            key={i}
                            style={{
                              position: "absolute",
                              top: pst.y,
                              left: pst.x,
                              width: pst.size,
                              height: pst.size,
                              transform: `rotate(${pst.rotation}deg)`,
                              opacity: 0.85,
                              mixBlendMode: "multiply",
                              cursor: "grab",
                              // Если активно, выделяем рамкой
                              outline: isActive ? "2px dashed #00f" : "none",
                            }}
                            onMouseDown={() => setActiveStampIndex(i)}
                          >
                            <img
                              src={libStamp.src}
                              alt={`stamp-${i}`}
                              style={{ width: "100%", height: "100%" }}
                            />
                            {/* Кнопка удаления */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation(); // чтобы не мешать drag
                                removePlacedStamp(i);
                              }}
                              style={{
                                position: "absolute",
                                top: 0,
                                right: 0,
                                backgroundColor: "red",
                                color: "white",
                                border: "none",
                                width: "20px",
                                height: "20px",
                                borderRadius: "50%",
                                cursor: "pointer",
                                fontSize: "12px",
                                lineHeight: "18px",
                              }}
                              title="Удалить печать"
                            >
                              x
                            </button>
                          </div>
                        );
                      })}
                  </div>
                );
              })
            ) : (
              <p className="text-center">Загрузите PDF</p>
            )
          ) : docType === "docx" ? (
            docxHtml ? (
              <div
                id="docx-container"
                className="relative mx-auto bg-white p-4 shadow-lg border border-gray-300"
                style={{ width: "80%", minHeight: 600 }}
              >
                <div
                  className="prose max-w-none"
                  dangerouslySetInnerHTML={{ __html: docxHtml }}
                />
                {/* Размещённые печати (page=1) */}
                {placedStamps
                  .filter((pst) => pst.page === 1)
                  .map((pst, i) => {
                    const libStamp = stampsLibrary.find((l) => l.id === pst.libraryId);
                    if (!libStamp) return null;
                    const isActive = i === activeStampIndex;

                    return (
                      <div
                        key={i}
                        style={{
                          position: "absolute",
                          top: pst.y,
                          left: pst.x,
                          width: pst.size,
                          height: pst.size,
                          transform: `rotate(${pst.rotation}deg)`,
                          opacity: 0.85,
                          mixBlendMode: "multiply",
                          cursor: "grab",
                          outline: isActive ? "2px dashed #00f" : "none",
                        }}
                        onMouseDown={() => setActiveStampIndex(i)}
                      >
                        <img
                          src={libStamp.src}
                          alt={`stamp-${i}`}
                          style={{ width: "100%", height: "100%" }}
                        />
                        {/* Кнопка удаления */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removePlacedStamp(i);
                          }}
                          style={{
                            position: "absolute",
                            top: 0,
                            right: 0,
                            backgroundColor: "red",
                            color: "white",
                            border: "none",
                            width: "20px",
                            height: "20px",
                            borderRadius: "50%",
                            cursor: "pointer",
                            fontSize: "12px",
                            lineHeight: "18px",
                          }}
                          title="Удалить печать"
                        >
                          x
                        </button>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <p className="text-center">Загрузите DOCX</p>
            )
          ) : (
            <p className="text-center">Загрузите документ (PDF / DOCX)</p>
          )}
        </main>
      </div>
    </div>
  );
}
