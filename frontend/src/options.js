export const OPTIONS = {

  supervisores: [
    "SUPERFINANCIERA",
    "SUPERSALUD",
    "SUPERSERVICIOS",
    "SUPERSOCIEDADES",
    "SUPERTRANSPORTE",
    "SUPERVIGILANCIA"
  ],

  regiones: [
    "ANTIOQUIA",
    "BOGOTÁ - CUNDINAMARCA",
    "CENTRO - ORIENTE",
    "COSTA ATLÁNTICA",
    "COSTA PACÍFICA",
    "EJE CAFETERO",
    "OTROS"
  ],

  departamentos: [
    "AMAZONAS",
    "ANTIOQUIA",
    "ARAUCA",
    "ATLANTICO",
    "BOGOTA D.C.",
    "BOLIVAR",
    "BOYACA",
    "CALDAS",
    "CAQUETA",
    "CASANARE",
    "CAUCA",
    "CESAR",
    "CHOCO",
    "CORDOBA",
    "CUNDINAMARCA",
    "GUAINIA",
    "GUAJIRA",
    "GUAVIARE",
    "HUILA",
    "MAGDALENA",
    "META",
    "NARIÑO",
    "NORTE DE SANTANDER",
    "PUTUMAYO",
    "QUINDIO",
    "RISARALDA",
    "SAN ANDRES Y PROVIDENCIA",
    "SANTANDER",
    "SUCRE",
    "TOLIMA",
    "VALLE",
    "VALLE DEL CAUCA",
    "VALLEDUPAR",
    "VAUPES",
    "VICHADA"
  ],

  macrosector: [
    "AGROPECUARIO",
    "COMERCIO",
    "CONSTRUCCIÓN",
    "MANUFACTURA",
    "MINERO",
    "SERVICIOS"
  ],

  /*
  🔥 IMPORTANTE:
  Para que CIUDAD dependa del departamento,
  aquí puedes agregar las ciudades que más usaste
  en el entrenamiento.

  Puedes ampliarlo luego sin romper nada.
  */

  ciudadesPorDepartamento: {

    "TOLIMA": [
      "IBAGUE",
      "ESPINAL",
      "MELGAR",
      "HONDA"
    ],

    "ATLANTICO": [
      "BARRANQUILLA",
      "SOLEDAD",
      "MALAMBO"
    ],

    "CUNDINAMARCA": [
      "BOGOTA D.C.",
      "SOACHA",
      "CHIA"
    ],

    "VALLE DEL CAUCA": [
      "CALI",
      "PALMIRA",
      "BUENAVENTURA"
    ],

    "ANTIOQUIA": [
      "MEDELLIN",
      "ENVIGADO",
      "RIONEGRO"
    ],

    "SANTANDER": [
      "BUCARAMANGA",
      "FLORIDABLANCA"
    ],

    "RISARALDA": [
      "PEREIRA",
      "DOSQUEBRADAS"
    ],

    "QUINDIO": [
      "ARMENIA"
    ],

    "NARIÑO": [
      "PASTO"
    ],

    "MAGDALENA": [
      "SANTA MARTA"
    ]
  }

};
