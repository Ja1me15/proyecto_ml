# ==========================================
# NGBOOST - INDICE DE DESEMPEÑO (REGRESION)
# Versión robusta (anti-overflow)
# ==========================================

import pandas as pd
import numpy as np

from sklearn.model_selection import train_test_split
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.pipeline import Pipeline
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

from ngboost import NGBRegressor
from ngboost.distns import Normal
import joblib

# --------- helpers ----------
def clip_series(s: pd.Series, qlow=0.01, qhigh=0.99):
    lo, hi = s.quantile(qlow), s.quantile(qhigh)
    return s.clip(lo, hi)

# 1) Cargar dataset
df = pd.read_csv("data/dataset_empresas_features.csv")

cat_cols = [
    "SUPERVISOR",
    "REGIÓN",
    "DEPARTAMENTO DOMICILIO",
    "CIUDAD DOMICILIO",
    "CIIU",
    "MACROSECTOR"
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
    "roa"
]

target = "indice_desempeno"

# 2) Limpiar infinitos/NaN por seguridad
df = df.replace([np.inf, -np.inf], np.nan).dropna(subset=num_cols + cat_cols + [target]).copy()

# 3) Winsorizar (recorte suave) para estabilidad
for c in num_cols:
    df[c] = clip_series(df[c], 0.01, 0.99)

df[target] = clip_series(df[target], 0.01, 0.99)

# 4) Split
X = df[cat_cols + num_cols].copy()
y = df[target].astype(float)

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

# 5) Preprocesamiento (X)
preprocess = ColumnTransformer([
    ("num", StandardScaler(), num_cols),
    ("cat", OneHotEncoder(handle_unknown="ignore"), cat_cols),
])

# 6) Escalado del target (y) para evitar overflow en la distribución Normal
y_scaler = StandardScaler()
y_train_s = y_scaler.fit_transform(y_train.to_numpy().reshape(-1, 1)).ravel()

# 7) Modelo NGBoost más conservador
ngb = NGBRegressor(
    Dist=Normal,
    n_estimators=300,        # menos árboles para estabilidad
    learning_rate=0.03,      # más bajo = más estable
    natural_gradient=True,
    random_state=42,
    verbose=True
)

# 8) Fit (X transformado, y escalado)
print("\nEntrenando NGBoost (robusto)...\n")
X_train_t = preprocess.fit_transform(X_train)
X_test_t  = preprocess.transform(X_test)

ngb.fit(X_train_t, y_train_s)

# 9) Predict (y des-escalado a escala original)
pred_s = ngb.predict(X_test_t)
pred = y_scaler.inverse_transform(pred_s.reshape(-1, 1)).ravel()

rmse = np.sqrt(mean_squared_error(y_test, pred))

print("\nRESULTADOS NGBOOST:")
print("MAE:", mean_absolute_error(y_test, pred))
print("RMSE:", rmse)
print("R2:", r2_score(y_test, pred))

# 10) Guardar todo (preprocess + ngb + y_scaler)
bundle = {
    "preprocess": preprocess,
    "model": ngb,
    "y_scaler": y_scaler,
    "cat_cols": cat_cols,
    "num_cols": num_cols,
    "target": target
}

joblib.dump(bundle, "ngboost_desempeno_bundle.pkl")
print("\n✅ Guardado: ngboost_desempeno_bundle.pkl")
