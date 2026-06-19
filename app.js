// ============================================================
// app.js - LÓGICA PRINCIPAL DE LA APLICACIÓN
//
// ¿Qué hace este archivo?
// - Maneja el login con PIN (NO necesita Firebase)
// - Conecta con Firebase después del login
// - CRUD (Crear, Leer, Actualizar, Eliminar) de ingredientes
// - Escucha cambios en Firebase en tiempo real
// ============================================================

// ============================================================
// PARTE 1: VARIABLES GLOBALES
//
// Declaramos las variables de Firebase AQUÍ arriba sin valor.
// db e ingredientesRef empiezan como null.
// Se llenarán cuando Firebase se inicialice correctamente.
// ============================================================

let db = null;
let ingredientesRef = null;
let editandoId = null;
let ingredientesData = [];

// ============================================================
// PARTE 2: LOGIN (NO necesita Firebase)
// Estas funciones funcionan aunque Firebase esté caído.
// ============================================================

// ============================================================
// FUNCIÓN: verificarPin()
//
// ¿Qué hace?
//   Toma el PIN que el usuario escribió y lo compara con "1285".
//   Si es correcto, inicia Firebase y muestra la app.
//
// ¿Por qué no necesita Firebase?
//   Solo compara texto y manipula HTML. No toca la base de datos.
// ============================================================

function verificarPin() {
  const pinIngresado = document.getElementById("pin-input").value;

  if (pinIngresado === "1285") {
    sessionStorage.setItem("autenticado", "true");

    document.getElementById("login-screen").classList.add("hidden");
    document.getElementById("app-screen").classList.remove("hidden");

    document.getElementById("pin-input").value = "";

    // Ahora sí, intentamos conectar con Firebase
    inicializarFirebase();
  } else {
    alert("PIN incorrecto. Intenta de nuevo.");
    document.getElementById("pin-input").value = "";
    document.getElementById("pin-input").focus();
  }
}

// ============================================================
// Permitir presionar ENTER en el input del PIN
// ============================================================

document.getElementById("pin-input").addEventListener("keypress", function(e) {
  if (e.key === "Enter") {
    verificarPin();
  }
});

// ============================================================
// FUNCIÓN: cerrarSesion()
//
// ¿Qué hace?
//   Borra la sesión y vuelve a la pantalla de login.
// ============================================================

function cerrarSesion() {
  sessionStorage.removeItem("autenticado");

  document.getElementById("login-screen").classList.remove("hidden");
  document.getElementById("app-screen").classList.add("hidden");
  document.getElementById("pin-input").value = "";
}

// ============================================================
// VERIFICAR SESIÓN AL CARGAR LA PÁGINA
//
// Si ya estamos autenticados (sessionStorage), pasamos directo
// a la app e intentamos conectar con Firebase.
// ============================================================

if (sessionStorage.getItem("autenticado") === "true") {
  document.getElementById("login-screen").classList.add("hidden");
  document.getElementById("app-screen").classList.remove("hidden");
  inicializarFirebase();
}

// ============================================================
// PARTE 3: FIREBASE
// Todo lo que sigue necesita la conexión a Firebase.
// ============================================================

// ============================================================
// FUNCIÓN: inicializarFirebase()
//
// ¿Qué hace?
//   1. Intenta conectar con Firebase usando las credenciales
//   2. Si falla, muestra un error visible en pantalla
//   3. Si funciona, configura el listener de cambios (onSnapshot)
//      y los eventos del formulario
//
// ¿Por qué está separado?
//   Para que el login funcione aunque Firebase esté caído o
//   no configurado. Así el usuario ve el error y sabe qué hacer.
// ============================================================

function inicializarFirebase() {
  try {
    // firebase.initializeApp() conecta con tu proyecto Firebase
    firebase.initializeApp(firebaseConfig);

    // firebase.firestore() devuelve el objeto para manejar la BD
    db = firebase.firestore();

    // Apuntamos a la colección "ingredientes"
    ingredientesRef = db.collection("ingredientes");

    // Si llegamos aquí, Firebase funciona. Configuramos todo.
    configurarListener();
    configurarEventos();
    cerrarError();

  } catch (error) {
    // Si algo falla, mostramos el error en la pantalla
    mostrarError("Error al conectar con Firebase: " + error.message +
      ". ¿Abriste con Live Server (http://) y no con doble clic (file://)?");
  }
}

// ============================================================
// FUNCIÓN: configurarListener()
//
// ¿Qué hace?
//   Configura onSnapshot, un "vigilante" que escucha cambios
//   en Firebase en tiempo real y actualiza la tabla automáticamente.
// ============================================================

function configurarListener() {
  ingredientesRef.onSnapshot(function(snapshot) {
    if (sessionStorage.getItem("autenticado") !== "true") return;

    ingredientesData = [];

    snapshot.forEach(function(doc) {
      ingredientesData.push({
        id: doc.id,
        nombre: doc.data().nombre,
        precio: Number(doc.data().precio),
        unidad: doc.data().unidad,
        cantidad: Number(doc.data().cantidad),
        fecha: doc.data().fecha || null
      });
    });

    renderTabla();
  }, function(error) {
    mostrarError("Error de conexión con Firebase: " + error.message);
  });
}

// ============================================================
// FUNCIÓN: renderTabla()
//
// ¿Qué hace?
//   Toma los datos de ingredientesData, aplica el filtro de
//   búsqueda y el ordenamiento seleccionado, y dibuja la tabla.
//   Se llama cada vez que cambia el filtro, el orden, o llegan
//   datos nuevos de Firebase.
// ============================================================

function renderTabla() {
  const lista = document.getElementById("ingredientes-lista");
  const emptyMsg = document.getElementById("sin-ingredientes");

  let datos = [...ingredientesData];

  // 1. FILTRAR por nombre
  const textoBusqueda = document.getElementById("filtro-buscar").value.trim().toLowerCase();
  if (textoBusqueda) {
    datos = datos.filter(function(item) {
      return item.nombre.toLowerCase().includes(textoBusqueda);
    });
  }

  // 2. ORDENAR según la opción seleccionada
  const orden = document.getElementById("filtro-orden").value;

  datos.sort(function(a, b) {
    switch (orden) {
      case "nombre-asc":
        return a.nombre.localeCompare(b.nombre);
      case "nombre-desc":
        return b.nombre.localeCompare(a.nombre);
      case "precio-asc":
        return a.precio - b.precio;
      case "precio-desc":
        return b.precio - a.precio;
      case "fecha-asc":
        if (!a.fecha && !b.fecha) return 0;
        if (!a.fecha) return 1;
        if (!b.fecha) return -1;
        return a.fecha.localeCompare(b.fecha);
      case "fecha-desc":
        if (!a.fecha && !b.fecha) return 0;
        if (!a.fecha) return 1;
        if (!b.fecha) return -1;
        return b.fecha.localeCompare(a.fecha);
      default:
        return 0;
    }
  });

  // 3. RENDERIZAR la tabla
  lista.innerHTML = "";

  if (datos.length === 0) {
    emptyMsg.classList.remove("hidden");
    if (textoBusqueda) {
      emptyMsg.textContent = 'No se encontraron ingredientes con "' + textoBusqueda + '"';
    } else {
      emptyMsg.textContent = "No hay ingredientes. ¡Agrega el primero!";
    }
    return;
  }
  emptyMsg.classList.add("hidden");

  datos.forEach(function(item) {
    const precios = calcularPrecios(item.precio, item.cantidad, item.unidad);

    const fila = document.createElement("tr");

    fila.innerHTML = `
      <td>${item.nombre}</td>
      <td>$${item.precio.toFixed(0)}</td>
      <td>${item.unidad}</td>
      <td>${item.cantidad}</td>
      <td><strong>${precios.porGramo}</strong></td>
      <td><strong>${precios.porLibra}</strong></td>
      <td><strong>${precios.porKilo}</strong></td>
      <td class="acciones">
        <button class="btn-editar" data-id="${item.id}">Editar</button>
        <button class="btn-eliminar" data-id="${item.id}">Eliminar</button>
      </td>
    `;

    lista.appendChild(fila);
  });
}

// ============================================================
// FUNCIÓN: aplicarFiltros()
//
// ¿Qué hace?
//   Se llama desde los onChange/onInput del HTML cuando el
//   usuario escribe en el buscador o cambia el orden.
//   Simplemente vuelve a renderizar con los filtros actuales.
// ============================================================

function aplicarFiltros() {
  renderTabla();
}

// ============================================================
// FUNCIÓN: calcularPrecios(precio, cantidad, unidad)
//
// ¿Qué hace?
//   Convierte el precio total a precio por gramo, libra y kilo
//   sin importar la unidad en la que se compró.
//
//   Fórmulas:
//     g  → precio ÷ cantidad
//     lb → precio ÷ (cantidad × 500)
//     kg → precio ÷ (cantidad × 1000)
//     cc → precio ÷ cantidad  (no hay conversión de peso)
//
//   Luego calcula:
//     $/g  = precio / gramos
//     $/lb = precio / (gramos / 500)
//     $/kg = precio / (gramos / 1000)
// ============================================================

function calcularPrecios(precio, cantidad, unidad) {
  let gramos = 0;

  switch (unidad) {
    case 'g':
      gramos = cantidad;
      break;
    case 'lb':
      gramos = cantidad * 500;
      break;
    case 'kg':
      gramos = cantidad * 1000;
      break;
    case 'cc':
    case 'ml':
      gramos = cantidad;
      break;
  }

  if (gramos === 0) {
    return {
      porGramo: "$0.00",
      porLibra: "$0.00",
      porKilo: "$0.00"
    };
  }

  return {
    porGramo: "$" + (precio / gramos).toFixed(2),
    porLibra: "$" + (precio / (gramos / 500)).toFixed(2),
    porKilo: "$" + (precio / (gramos / 1000)).toFixed(2)
  };
}

// ============================================================
// FUNCIÓN: configurarEventos()
//
// ¿Qué hace?
//   Conecta los eventos del formulario y la tabla
//   con sus respectivas funciones.
// ============================================================

function configurarEventos() {
  // Escuchar envío del formulario (click en Guardar o Enter)
  document.getElementById("ingredientes-form").addEventListener("submit", function(e) {
    guardarIngrediente(e);
  });

  // Escuchar clic en Cancelar
  document.getElementById("cancelar-btn").addEventListener("click", function() {
    cancelarEdicion();
  });

  // Delegación de eventos en la tabla
  document.getElementById("ingredientes-tabla").addEventListener("click", function(e) {
    const btn = e.target.closest("button");
    if (!btn) return;

    const id = btn.dataset.id;
    if (!id) return;

    if (btn.classList.contains("btn-editar")) {
      const fila = btn.closest("tr");
      const celdas = fila.cells;
      const nombre = celdas[0].textContent;
      const precio = parseFloat(celdas[1].textContent.replace("$", ""));
      const unidad = celdas[2].textContent;
      const cantidad = parseFloat(celdas[3].textContent);

      editarIngrediente(id, { nombre, precio, unidad, cantidad });

    } else if (btn.classList.contains("btn-eliminar")) {
      eliminarIngrediente(id);
    }
  });
}

// ============================================================
// PARTE 4: FUNCIONES CRUD
// Todas necesitan que ingredientesRef esté inicializado.
// ============================================================

// ============================================================
// FUNCIÓN: guardarIngrediente(evento)
//
// ¿Qué hace?
//   Toma los datos del formulario y los guarda en Firebase.
//   Si editandoId es null: CREA un nuevo documento (.add()).
//   Si editandoId tiene un ID: ACTUALIZA (.update()).
// ============================================================

function guardarIngrediente(evento) {
  evento.preventDefault();

  if (!ingredientesRef) {
    mostrarError("Firebase no está conectado. Revisa tu configuración.");
    return;
  }

  const nombre = document.getElementById("nombre-input").value.trim();
  const precio = parseFloat(document.getElementById("precio-input").value);
  const unidad = document.getElementById("unidad-select").value;
  const cantidad = parseFloat(document.getElementById("cantidad-input").value);

  if (!nombre || isNaN(precio) || !unidad || isNaN(cantidad) || precio < 0 || cantidad < 0) {
    alert("Todos los campos son obligatorios y deben ser válidos.");
    return;
  }

  const ingrediente = {
    nombre: nombre,
    precio: precio,
    unidad: unidad,
    cantidad: cantidad,
    fecha: new Date().toISOString()
  };

  if (editandoId) {
    ingredientesRef.doc(editandoId).update(ingrediente).catch(function(error) {
      mostrarError("Error al actualizar: " + error.message);
    });
    editandoId = null;
    document.getElementById("form-titulo").textContent = "Agregar ingrediente";
  } else {
    ingredientesRef.add(ingrediente).catch(function(error) {
      mostrarError("Error al guardar: " + error.message);
    });
  }

  document.getElementById("ingredientes-form").reset();
  document.getElementById("cancelar-btn").classList.add("hidden");
}

// ============================================================
// FUNCIÓN: editarIngrediente(id, datos)
//
// ¿Qué hace?
//   Prepara el formulario para EDITAR un ingrediente existente.
//   Rellena los inputs y guarda el ID del documento.
// ============================================================

function editarIngrediente(id, datos) {
  editandoId = id;

  document.getElementById("nombre-input").value = datos.nombre;
  document.getElementById("precio-input").value = datos.precio;
  document.getElementById("unidad-select").value = datos.unidad;
  document.getElementById("cantidad-input").value = datos.cantidad;

  document.getElementById("form-titulo").textContent = "Editar ingrediente";
  document.getElementById("cancelar-btn").classList.remove("hidden");

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ============================================================
// FUNCIÓN: eliminarIngrediente(id)
//
// ¿Qué hace?
//   Elimina un ingrediente de Firebase previa confirmación.
// ============================================================

function eliminarIngrediente(id) {
  if (!ingredientesRef) {
    mostrarError("Firebase no está conectado.");
    return;
  }

  if (confirm("¿Estás seguro de eliminar este ingrediente?")) {
    ingredientesRef.doc(id).delete().catch(function(error) {
      mostrarError("Error al eliminar: " + error.message);
    });
  }
}

// ============================================================
// FUNCIÓN: cancelarEdicion()
//
// ¿Qué hace?
//   Cancela la edición actual y vuelve a modo "agregar nuevo".
// ============================================================

function cancelarEdicion() {
  editandoId = null;
  document.getElementById("ingredientes-form").reset();
  document.getElementById("cancelar-btn").classList.add("hidden");
  document.getElementById("form-titulo").textContent = "Agregar ingrediente";
}

// ============================================================
// FUNCIÓN: mostrarError(mensaje)
//
// ¿Qué hace?
//   Muestra un mensaje de error visible en la parte superior
//   de la pantalla, para que sepas qué falló sin tener que
//   abrir la consola del navegador.
// ============================================================

function mostrarError(mensaje) {
  document.getElementById("error-text").textContent = mensaje;
  document.getElementById("error-bar").classList.remove("hidden");
}

function cerrarError() {
  document.getElementById("error-bar").classList.add("hidden");
}
