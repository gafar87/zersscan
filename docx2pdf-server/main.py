from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import subprocess, uuid, os, platform

app = FastAPI()

# 👇 Разрешаем запросы с фронтенда
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/convert-docx")
async def convert_docx(file: UploadFile = File(...)):
    temp_id = str(uuid.uuid4())
    input_path = f"/tmp/{temp_id}.docx"
    output_path = f"/tmp/{temp_id}.pdf"

    with open(input_path, "wb") as f:
        f.write(await file.read())

    soffice_cmd = "soffice"
    if platform.system() == "Darwin":
        soffice_cmd = "/Applications/LibreOffice.app/Contents/MacOS/soffice"

    subprocess.run([
        soffice_cmd,
        "--headless",
        "--convert-to", "pdf",
        "--outdir", "/tmp",
        input_path
    ], check=True)

    os.remove(input_path)

    return FileResponse(output_path, media_type="application/pdf", filename="converted.pdf")
