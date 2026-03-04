# ==========================================
# MODELO ORDINAL - NIVEL DE SOLIDEZ (0-3)
# - Intenta statsmodels OrderedModel
# - Quita columnas constantes (agresivo)
# - Fallback automático a mord si statsmodels falla
# - Métricas: Accuracy + Quadratic Weighted Kappa (QWK)
# ==========================================

import numpy as np
import pandas as pd

from sklearn.model_selection import train_test_split
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.metrics import accuracy_score

# ---------- Métrica pro: Quadratic Weighted Kappa ----------
def quadratic_weighted_kappa(y_true, y_pred, min_rating=0, max_rating=3):
    y_true = np.asarray(y_true, dtype=int)
    y_pred = np.asarray(y_pred, dtype=int)

    n = max_rating - min_rating + 1
    # Matriz de confusión
    O = np.zeros((n, n), dtype=float)
    for a, b in zip(y_true, y_pred):
        O[a - min_rating, b - min_rating] += 1

    # Histograms
    act_hist = np.bincount(y_true - min_rating, minlength=n).astype(float)
    pred_hist = np.bincount(y_pred - min_rating, minlength=n).astype(float)

    # Matriz esperada
    E = np.outer(act_hist, pred_hist) / O.sum()

    # Pesos cuadráticos
    W = np.zeros((n, n), dtype=float)
    for i in range(n):
        for j in range(n):
            W[i, j] = ((i - j) ** 2) / ((n - 1) ** 2)

    num = (W * O).sum()
    den = (W * E).sum()
    return 1.0 - (num / den if den != 0 else 0.0)

# ---------- Remover columnas constantes (más agresivo) ----------
def remove_constant_columns(X_train, X_test, tol=1e-12):
    # constante si (max-min) ~ 0
    ptp = np.ptp(X_train, axis=0)  # peak-to-peak
    keep = ptp > tol
    return X_train[:, keep], X_test[:, keep], keep

# ==========================================
# 1) Cargar dataset
# ==========================================
df = pd.read_csv("data/dataset_empresas_features.csv")

cat_cols = [
    "SUPERVISOR",
    "REGIÓN",
    "DEPARTAMENTO DOMICILIO",
    "CIUDAD DOMICILIO",
    "CIIU",
    "MACROSECTOR",
]

num_cols = [
    "INGRESOS OPERACIONALES",
    "GANANCIA (PÉRDIDA)",
    "TOTAL ACTIVOS",
    "TOTAL PASIVOS",
    "TOTAL PATRIMONIO",
    "ratio_endeudamiento",
    "margen_ganancia",
    "apalancamiento",
    "roa",
]

target = "nivel_solidez"

X = df[cat_cols + num_cols].copy()
y = df[target].astype(int)

# ==========================================
# 2) Split estratificado
# ==========================================
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

# ==========================================
# 3) Preprocesamiento
# ==========================================
preprocess = ColumnTransformer(
    transformers=[
        ("num", StandardScaler(), num_cols),
        ("cat", OneHotEncoder(handle_unknown="ignore"), cat_cols),
    ],
    remainder="drop",
)

Xt_train = preprocess.fit_transform(X_train)
Xt_test  = preprocess.transform(X_test)

# statsmodels y mord trabajan mejor con denso aquí
Xt_train = Xt_train.toarray()
Xt_test  = Xt_test.toarray()

# Quitar columnas constantes (agresivo)
Xt_train, Xt_test, keep_mask = remove_constant_columns(Xt_train, Xt_test, tol=1e-10)

print("Dimensiones después de quitar constantes:", Xt_train.shape, Xt_test.shape)

# ==========================================
# 4) Intento A: statsmodels OrderedModel
# ==========================================
try:
    from statsmodels.miscmodels.ordinal_model import OrderedModel

    print("\nEntrenando OrderedModel (statsmodels)...\n")
    model = OrderedModel(y_train, Xt_train, distr="logit")
    res = model.fit(method="bfgs", disp=False)

    probs = res.model.predict(res.params, exog=Xt_test)
    y_pred = np.argmax(probs, axis=1)

    acc = accuracy_score(y_test, y_pred)
    qwk = quadratic_weighted_kappa(y_test, y_pred, 0, 3)

    print("✅ statsmodels OK")
    print("Accuracy:", acc)
    print("QWK:", qwk)

    with open("ordinal_solidez_summary.txt", "w", encoding="utf-8") as f:
        f.write(res.summary().as_text())
    print("✅ Guardado: ordinal_solidez_summary.txt")

except ValueError as e:
    print("\n⚠️ statsmodels falló por constante/rank:", e)
    print("➡️ Usando fallback: mord (ordinal regression)\n")

    # ==========================================
    # 5) Fallback B: mord LogisticAT (ordinal)
    # ==========================================
    from mord import LogisticAT

    clf = LogisticAT(alpha=1.0)  # alpha controla regularización
    clf.fit(Xt_train, y_train)

    y_pred = clf.predict(Xt_test)

    acc = accuracy_score(y_test, y_pred)
    qwk = quadratic_weighted_kappa(y_test, y_pred, 0, 3)

    print("✅ mord OK")
    print("Accuracy:", acc)
    print("QWK:", qwk)

    # Guardar "resumen" básico
    with open("ordinal_solidez_summary.txt", "w", encoding="utf-8") as f:
        f.write("Modelo: mord.LogisticAT\n")
        f.write(f"Accuracy: {acc}\n")
        f.write(f"QWK: {qwk}\n")
        f.write("Nota: statsmodels OrderedModel rechazó una constante/rank en el diseño.\n")

    print("✅ Guardado: ordinal_solidez_summary.txt")
