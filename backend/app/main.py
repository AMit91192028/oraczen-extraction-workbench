from fastapi import FastAPI

app = FastAPI(title="Extraction Workbench")


@app.get("/health")
def health_check():
    return {"status": "ok"}