import numpy as np
import pandas as pd
import joblib

from sklearn.model_selection import train_test_split
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.metrics import accuracy_score

from mord import LogisticAT

def remove_constant_columns(X_train, X_test, tol=1e-10):
    ptp = np.ptp(X_train, axis=0)
    keep = ptp > tol
    return X_train[:, keep], X_test[:, keep], keep

df = pd.read_csv("data/dataset_empresas_features.csv")

cat_cols = [
    "SUPERVISOR", "REGIÓN", "DEPARTAMENTO DOMICILIO",
    "CIUDAD DOMICILIO", "CIIU", "MACROSECTOR",
]
num_cols = [
    "INGRESOS OPERACIONALES","GANANCIA (PÉRDIDA)",
    "TOTAL ACTIVOS","TOTAL PASIVOS","TOTAL PATRIMONIO",
    "ratio_endeudamiento","margen_ganancia","apalancamiento","roa",
]
target = "nivel_solidez"

X = df[cat_cols + num_cols].copy()
y = df[target].astype(int)

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

preprocess = ColumnTransformer(
    transformers=[
        ("num", StandardScaler(), num_cols),
        ("cat", OneHotEncoder(handle_unknown="ignore"), cat_cols),
    ],
    remainder="drop",
)

Xt_train = preprocess.fit_transform(X_train).toarray()
Xt_test  = preprocess.transform(X_test).toarray()

Xt_train, Xt_test, keep_mask = remove_constant_columns(Xt_train, Xt_test, tol=1e-10)

model = LogisticAT(alpha=1.0)
model.fit(Xt_train, y_train)

pred = model.predict(Xt_test)
acc = accuracy_score(y_test, pred)

bundle = {
    "preprocess": preprocess,
    "keep_mask": keep_mask,
    "model": model,
    "cat_cols": cat_cols,
    "num_cols": num_cols,
    "target": target,
    "acc": float(acc),
}

joblib.dump(bundle, "ordinal_solidez_bundle.pkl")
print("✅ Guardado: ordinal_solidez_bundle.pkl")
print("Accuracy (holdout):", acc)
