from fastapi import FastAPI, UploadFile, File
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import mammoth
import io  # ✅ обязательно!

app = FastAPI()

# 🔓 Включаем CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/upload-docx")
async def upload_docx(file: UploadFile = File(...)):
    try:
        if not file.filename.endswith(".docx"):
            return JSONResponse(status_code=400, content={"error": "Only .docx files are supported."})

        contents = await file.read()

        result = mammoth.convert_to_html(io.BytesIO(contents))
        html_content = result.value

        return HTMLResponse(content=html_content, media_type="text/html")

    except Exception as e:
        print("❌ Ошибка при конвертации:", str(e))
        return JSONResponse(status_code=500, content={"error": str(e)})
