# Macro Tracker

App web para registrar calorías, macros (proteína, carbohidratos, grasa) y agua desde el teléfono. Se instala en la pantalla de inicio y funciona sin conexión.

**Abrir la app:** https://noeergas-cpu.github.io/Macro-Tracker/

## Qué incluye

- **8.789 alimentos sin conexión** de la base USDA SR28 (ingredientes, frutas, verduras, carnes, lácteos, platos preparados, comida rápida y de restaurantes), con nombres en español y porciones caseras (taza, pieza, rebanada…).
- **Millones de productos de marca** con búsqueda en línea en [Open Food Facts](https://world.openfoodfacts.org).
- **Escáner de código de barras** con la cámara, o escribiendo el número. Usa los valores por porción de la etiqueta cuando Open Food Facts los tiene y muestra el código para que compruebes que es tu producto.
- **Corregir con la etiqueta:** Open Food Facts lo llena la gente y a veces trae otra versión del producto o le faltan datos. Copia la tabla del empaque una vez y la app usa tus datos cada vez que escanees ese código. Si un código no existe, puedes añadirlo igual.
- **Añadir rápido** para cualquier comida con sus calorías y macros, y **Mis alimentos** para guardarla.
- **Todos los nutrientes:** fibra, azúcares, grasas saturadas, mono y poliinsaturadas, colesterol, 10 minerales (sodio, potasio, calcio, hierro, magnesio, fósforo, zinc, cobre, manganeso, selenio), 13 vitaminas (A, C, D, E, K, B1, B2, B3, B5, B6, folato, B12 y colina) y carotenoides. Cada uno con su meta o límite diario para un hombre de 19 a 30 años; la fibra y la grasa saturada se ajustan a tus calorías.
- Anillo de calorías, anillos de macros, agua, historial de 7 días y diario por comida (Desayuno, Comida, Cena, Snacks). Toca un alimento del diario para cambiar la cantidad.
- Objetivos editables en Ajustes. Los macros se fijan como porcentaje de tus calorías (proteína y carbohidratos 4 cal/g, grasa 9 cal/g), así que si cambias las calorías los gramos se recalculan solos. Por defecto: 2110 cal con 34 % proteína (179 g), 39 % carbohidratos (206 g) y 27 % grasa (63 g), y 3,7 L de agua.
- Modo claro y oscuro.
- Copia de seguridad con un código (`MT1:…`) para guardar o mover tus datos, e importación de códigos `MTA:…` con comidas que te prepare Claude.

## Instalar en el teléfono

**iPhone (Safari):** abre el enlace, toca el botón Compartir y elige **Añadir a pantalla de inicio**.

**Android (Chrome):** abre el enlace, toca el menú ⋮ y elige **Instalar app** o **Añadir a pantalla de inicio**.

Usa siempre la app desde el icono. En iPhone, la app instalada guarda sus datos aparte de Safari.

**Actualizaciones:** la app busca la versión nueva cada vez que la abres con conexión y se recarga sola. Puedes ver la versión al final de Ajustes.

## Tus datos

Tu diario se guarda solo en tu teléfono (almacenamiento local del navegador). No se sube a este repositorio ni a ningún servidor. Haz una copia de seguridad desde Ajustes de vez en cuando.

## Para desarrolladores

Sitio estático sin compilación: `index.html`, `css/`, `js/`, `sw.js` (modo sin conexión) y `manifest.webmanifest`.

`data/foods.json` se genera con `tools/build_foods.py` a partir de los archivos `ABBREV.txt` y `FOOD_DES.txt` de SR28. Las traducciones al español están en `tools/glossary_es.py`.

```
python3 tools/build_foods.py <carpeta con SR28> data/foods.json
```

Si cambias los archivos de la app, sube la versión de `CACHE` en `sw.js` para que los teléfonos descarguen la nueva versión.

## Fuentes y licencias

- USDA, Agricultural Research Service. National Nutrient Database for Standard Reference, Release 28 (2015). Dominio público.
- Open Food Facts, datos bajo licencia [ODbL](https://opendatacommons.org/licenses/odbl/1-0/).
- Lector de códigos [ZXing](https://github.com/zxing-js/library) 0.21.3, licencia Apache 2.0 (`vendor/`).

Aviso: esta app no sustituye el consejo médico. Consulta con tu médico antes de empezar una dieta nueva.
