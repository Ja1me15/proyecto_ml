from functools import lru_cache
import numpy as np
import pandas as pd
import joblib
from pathlib import Path
from typing import Optional, Dict, Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from catboost import CatBoostClassifier

# =========================
# Paths
# =========================
BASE_DIR = Path(__file__).resolve().parent
MODELS_DIR = BASE_DIR / "models"

DATASET_PATH = (BASE_DIR.parent / "data" / "dataset_empresas_limpio.csv")
CATBOOST_PATH = MODELS_DIR / "catboost_riesgo_noleak_balanced.cbm"
NGBOOST_PATH  = MODELS_DIR / "ngboost_desempeno_bundle.pkl"
ORDINAL_PATH  = MODELS_DIR / "ordinal_solidez_bundle.pkl"

CAT_COLS_CONTEXT = [
    "SUPERVISOR", "REGIÓN", "DEPARTAMENTO DOMICILIO",
    "CIUDAD DOMICILIO", "CIIU", "MACROSECTOR"
]
NUM_COLS_CONTEXT = ["Año de Corte"]

EPS = 1e-9

# =========================
# API init
# =========================
app = FastAPI(title="Scoring Financiero API", version="1.0")

# CORS para frontend (Render/Vercel/Local)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # para demo/diplomado
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================
# Input schema
# =========================
class PredictRequest(BaseModel):

    # Contexto
    SUPERVISOR: str
    REGIÓN: str
    DEPARTAMENTO_DOMICILIO: str = Field(..., alias="DEPARTAMENTO DOMICILIO")
    CIUDAD_DOMICILIO: str = Field(..., alias="CIUDAD DOMICILIO")
    CIIU: str
    MACROSECTOR: str
    Año_de_Corte: int = Field(..., alias="Año de Corte")

    # Contables
    INGRESOS_OPERACIONALES: float = Field(..., alias="INGRESOS OPERACIONALES")
    GANANCIA_PERDIDA: float = Field(..., alias="GANANCIA (PÉRDIDA)")
    TOTAL_ACTIVOS: float = Field(..., alias="TOTAL ACTIVOS")
    TOTAL_PASIVOS: float = Field(..., alias="TOTAL PASIVOS")
    TOTAL_PATRIMONIO: float = Field(..., alias="TOTAL PATRIMONIO")

    class Config:
        populate_by_name = True

# =========================
# Load models once
# =========================
cat_model: Optional[CatBoostClassifier] = None
ngb_bundle: Optional[Dict[str, Any]] = None
ord_bundle: Optional[Dict[str, Any]] = None

@app.on_event("startup")
def load_models():

    global cat_model, ngb_bundle, ord_bundle

    if not CATBOOST_PATH.exists():
        raise FileNotFoundError(f"Falta: {CATBOOST_PATH}")

    if not NGBOOST_PATH.exists():
        raise FileNotFoundError(f"Falta: {NGBOOST_PATH}")

    if not ORDINAL_PATH.exists():
        raise FileNotFoundError(f"Falta: {ORDINAL_PATH}")

    cat_model = CatBoostClassifier()
    cat_model.load_model(str(CATBOOST_PATH))

    ngb_bundle = joblib.load(NGBOOST_PATH)
    ord_bundle = joblib.load(ORDINAL_PATH)

    print("✅ Modelos cargados correctamente")

# =========================
# Helpers
# =========================
def compute_ratios(row: dict) -> dict:

    activos = float(row["TOTAL ACTIVOS"])
    pasivos = float(row["TOTAL PASIVOS"])
    patrimonio = float(row["TOTAL PATRIMONIO"])
    ingresos = float(row["INGRESOS OPERACIONALES"])
    ganancia = float(row["GANANCIA (PÉRDIDA)"])

    ratios = {
        "ratio_endeudamiento": pasivos / (activos + EPS),
        "margen_ganancia": ganancia / (ingresos + EPS),
        "apalancamiento": activos / (abs(patrimonio) + EPS),
        "roa": ganancia / (activos + EPS),
    }

    return ratios


def run_models(row: dict):

    # CatBoost
    X_cat = pd.DataFrame([row], columns=CAT_COLS_CONTEXT + NUM_COLS_CONTEXT)
    proba_riesgo = float(cat_model.predict_proba(X_cat)[:, 1][0])

    # NGBoost
    pre_ngb = ngb_bundle["preprocess"]
    ngb = ngb_bundle["model"]
    y_scaler = ngb_bundle["y_scaler"]
    cat_cols_ngb = ngb_bundle["cat_cols"]
    num_cols_ngb = ngb_bundle["num_cols"]

    X_ngb = pd.DataFrame([row], columns=cat_cols_ngb + num_cols_ngb)

    Xt = pre_ngb.transform(X_ngb)
    Xt = Xt.toarray() if hasattr(Xt, "toarray") else Xt

    pred_s = ngb.predict(Xt)

    indice = float(
        y_scaler.inverse_transform(
            np.array(pred_s).reshape(-1, 1)
        ).ravel()[0]
    )

    # Ordinal
    pre_ord = ord_bundle["preprocess"]
    keep_mask = ord_bundle["keep_mask"]
    ord_model = ord_bundle["model"]
    cat_cols_ord = ord_bundle["cat_cols"]
    num_cols_ord = ord_bundle["num_cols"]

    X_ord = pd.DataFrame([row], columns=cat_cols_ord + num_cols_ord)

    Xt2 = pre_ord.transform(X_ord)
    Xt2 = Xt2.toarray() if hasattr(Xt2, "toarray") else Xt2
    Xt2 = Xt2[:, keep_mask]

    solidez = int(ord_model.predict(Xt2)[0])

    return proba_riesgo, indice, solidez


@lru_cache(maxsize=1)
def load_options_from_dataset():

    # Si no existe el dataset en el servidor, no rompe la API
    if not DATASET_PATH.exists():
        return {
            "supervisores": [],
            "regiones": [],
            "departamentos": [],
            "macrosector": [],
        }, {}

    df = pd.read_csv(DATASET_PATH)

    def clean_series(s):
        return (
            s.astype(str)
            .str.strip()
            .replace({"nan": np.nan, "None": np.nan})
            .dropna()
        )

    options = {
        "supervisores": sorted(clean_series(df["SUPERVISOR"]).unique().tolist()),
        "regiones": sorted(clean_series(df["REGIÓN"]).unique().tolist()),
        "departamentos": sorted(clean_series(df["DEPARTAMENTO DOMICILIO"]).unique().tolist()),
        "macrosector": sorted(clean_series(df["MACROSECTOR"]).unique().tolist()),
    }

    dept_city = {}

    if "CIUDAD DOMICILIO" in df.columns:

        tmp = df[["DEPARTAMENTO DOMICILIO", "CIUDAD DOMICILIO"]].copy()

        tmp["DEPARTAMENTO DOMICILIO"] = clean_series(tmp["DEPARTAMENTO DOMICILIO"])
        tmp["CIUDAD DOMICILIO"] = clean_series(tmp["CIUDAD DOMICILIO"])

        tmp = tmp.dropna()

        for d, group in tmp.groupby("DEPARTAMENTO DOMICILIO"):
            dept_city[str(d)] = sorted(
                group["CIUDAD DOMICILIO"]
                .astype(str)
                .str.strip()
                .unique()
                .tolist()
            )

    return options, dept_city


# =========================
# Routes
# =========================
@app.get("/")
def root():
    return {"mensaje": "API de Scoring Financiero funcionando"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/options")
def options():
    options, _ = load_options_from_dataset()
    return options


@app.get("/cities")
def cities(departamento: str):
    _, dept_city = load_options_from_dataset()
    departamento = (departamento or "").strip()
    return {"departamento": departamento, "ciudades": dept_city.get(departamento, [])}


@app.post("/predict")
def predict(payload: PredictRequest):

    row = {
        "SUPERVISOR": payload.SUPERVISOR.strip(),
        "REGIÓN": payload.REGIÓN.strip(),
        "DEPARTAMENTO DOMICILIO": payload.DEPARTAMENTO_DOMICILIO.strip(),
        "CIUDAD DOMICILIO": payload.CIUDAD_DOMICILIO.strip(),
        "CIIU": str(payload.CIIU).strip(),
        "MACROSECTOR": payload.MACROSECTOR.strip(),
        "Año de Corte": int(payload.Año_de_Corte),
        "INGRESOS OPERACIONALES": float(payload.INGRESOS_OPERACIONALES),
        "GANANCIA (PÉRDIDA)": float(payload.GANANCIA_PERDIDA),
        "TOTAL ACTIVOS": float(payload.TOTAL_ACTIVOS),
        "TOTAL PASIVOS": float(payload.TOTAL_PASIVOS),
        "TOTAL PATRIMONIO": float(payload.TOTAL_PATRIMONIO),
    }

    ratios = compute_ratios(row)
    row.update(ratios)

    proba, indice, solidez = run_models(row)

    return {
        "proba_riesgo": proba,
        "indice_desempeno": indice,
        "nivel_solidez": solidez,
        "ratios": ratios
    }