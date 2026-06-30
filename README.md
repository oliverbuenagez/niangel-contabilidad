# NIANGEL — Control de Ingredientes y Producción para Panadería

Sistema web para administrar ingredientes, recetas, producción, ventas y estadísticas de una panadería. Construido con JavaScript vanilla + Firebase.

## Módulos

- **Ingredientes** — CRUD con precio por unidad, precio por gramo/lb/kg.
- **Recetas** — Arma recetas a partir de ingredientes, calcula costo por pan y rentabilidad.
- **Producción** — Escala recetas por peso o por panes, agrega costos adicionales, calcula ganancia.
- **Historial** — Producciones registradas con filtros por período, gráfico de ganancias.
- **Ventas** — Clientes + registro de ventas con múltiples productos.
- **Estadísticas** — Dashboard con ventas, producción, rentabilidad neta y gráficos.

## Tecnologías

- HTML + CSS + JavaScript (vanilla, sin frameworks)
- Firebase Firestore + Firebase Hosting

## Local

Abre `index.html` con **Live Server** (no funciona con doble clic por politicas de seguridad de Firebase).

## Despliegue

```bash
firebase deploy
```

## Configuración de Firebase

1. Copia `firebase-config.example.js` como `firebase-config.js`.
2. Reemplaza las claves con las de tu proyecto Firebase.

## PIN de acceso por defecto

`1285`

## Ayuda en consola

Abre DevTools y escribe `ayuda()` para ver funciones de mantenimiento disponibles.
