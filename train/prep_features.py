import pandas as pd
import numpy as np

# Cargar dataset limpio
df = pd.read_csv("data/dataset_empresas_limpio.csv")

# Asegurar columnas numéricas
money_cols = [
    "INGRESOS OPERACIONALES",
    "GANANCIA (PÉRDIDA)",
    "TOTAL ACTIVOS",
    "TOTAL PASIVOS",
    "TOTAL PATRIMONIO"
]

for c in money_cols:
    df[c] = pd.to_numeric(df[c], errors="coerce")

# Evitar divisiones por cero
df = df.dropna(subset=money_cols)
df = df[(df["TOTAL ACTIVOS"] != 0) & (df["INGRESOS OPERACIONALES"] != 0)]

# ======================
# PASO 9 - FEATURES
# ======================
eps = 1e-9

df["ratio_endeudamiento"] = df["TOTAL PASIVOS"] / (df["TOTAL ACTIVOS"] + eps)
df["margen_ganancia"] = df["GANANCIA (PÉRDIDA)"] / (df["INGRESOS OPERACIONALES"] + eps)
df["apalancamiento"] = df["TOTAL ACTIVOS"] / (df["TOTAL PATRIMONIO"].abs() + eps)
df["roa"] = df["GANANCIA (PÉRDIDA)"] / (df["TOTAL ACTIVOS"] + eps)

# ======================
# TARGETS
# ======================
df["riesgo_financiero"] = (
    (df["ratio_endeudamiento"] > 0.7) |
    (df["margen_ganancia"] < 0) |
    (df["TOTAL PATRIMONIO"] < 0)
).astype(int)

df["indice_desempeno"] = (
    0.4 * df["roa"] +
    0.3 * df["margen_ganancia"] -
    0.3 * df["ratio_endeudamiento"]
)

def nivel_solidez(row):
    if row["ratio_endeudamiento"] > 0.8:
        return 0
    elif row["ratio_endeudamiento"] > 0.6:
        return 1
    elif row["margen_ganancia"] < 0.05:
        return 2
    else:
        return 3

df["nivel_solidez"] = df.apply(nivel_solidez, axis=1)

# Guardar dataset final
df.to_csv("data/dataset_empresas_features.csv", index=False)

print("✅ Dataset con FEATURES creado")
print(df.columns)
