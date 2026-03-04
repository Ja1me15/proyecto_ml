# ==========================================
# CATBOOST - RIESGO FINANCIERO (BINARIO)
# Versión SIN leakage fuerte:
#   - Usa SOLO contexto (sector/geografía/año)
#   - Balancea clases automáticamente
#   - Ajusta umbral para mejorar F1
#   - Reporta AUC y métricas
#   - Guarda modelo .cbm
# ==========================================

import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, roc_auc_score, f1_score, confusion_matrix
from catboost import CatBoostClassifier, Pool

# ---------- 1) Cargar dataset con features/targets ----------
df = pd.read_csv("data/dataset_empresas_features.csv")

print("Dataset cargado:", df.shape)
print("Distribución del target (riesgo_financiero):")
print(df["riesgo_financiero"].value_counts())

# ---------- 2) Variables (solo contexto + año) ----------
cat_cols = [
    "SUPERVISOR",
    "REGIÓN",
    "DEPARTAMENTO DOMICILIO",
    "CIUDAD DOMICILIO",
    "CIIU",
    "MACROSECTOR",
]
num_cols = ["Año de Corte"]

target = "riesgo_financiero"

X = df[cat_cols + num_cols].copy()
y = df[target].astype(int)

# ---------- 3) Split estratificado ----------
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

print("\nTrain shape:", X_train.shape, "| Test shape:", X_test.shape)

# ---------- 4) Pools CatBoost ----------
train_pool = Pool(X_train, y_train, cat_features=cat_cols)
test_pool  = Pool(X_test, y_test, cat_features=cat_cols)

# ---------- 5) Modelo (con balance de clases) ----------
model = CatBoostClassifier(
    iterations=1200,
    learning_rate=0.05,
    depth=6,
    loss_function="Logloss",
    eval_metric="AUC",
    random_seed=42,
    verbose=100,
    auto_class_weights="Balanced",   # ✅ mejora recall de clase 1
)

print("\nEntrenando modelo...\n")
model.fit(train_pool, eval_set=test_pool, use_best_model=True)

# ---------- 6) Predicciones ----------
proba = model.predict_proba(X_test)[:, 1]

auc = roc_auc_score(y_test, proba)
print("\nAUC:", auc)

# ---------- 7) Buscar mejor umbral (maximiza F1) ----------
best_thr, best_f1 = 0.5, -1
for thr in np.arange(0.10, 0.90, 0.01):
    pred_thr = (proba >= thr).astype(int)
    f1 = f1_score(y_test, pred_thr)
    if f1 > best_f1:
        best_f1 = f1
        best_thr = float(thr)

print("\nMejor umbral (max F1):", best_thr)
print("Mejor F1:", best_f1)

pred = (proba >= best_thr).astype(int)

# ---------- 8) Reporte final ----------
print("\nClassification report (con mejor umbral):")
print(classification_report(y_test, pred))

cm = confusion_matrix(y_test, pred)
print("Matriz de confusión [ [TN FP] [FN TP] ]:")
print(cm)

# ---------- 9) Guardar modelo ----------
model.save_model("catboost_riesgo_noleak_balanced.cbm")
print("\n✅ Modelo guardado: catboost_riesgo_noleak_balanced.cbm")
