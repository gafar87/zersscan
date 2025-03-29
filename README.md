# 🖨️ ZersStamp — сервис наложения печатей на PDF

## 📦 Возможности

- Загрузка PDF и DOCX (с автоконвертацией в PDF)
- Добавление, перемещение, удаление печатей
- Несколько печатей за редактирование
- Скачивание итогового PDF

## 🧰 Стек

- React + TailwindCSS
- FastAPI
- LibreOffice (конвертация DOCX → PDF)

## 🚀 Запуск

```bash
cd docx2pdf-server
uvicorn main:app --host 0.0.0.0 --port 8000
