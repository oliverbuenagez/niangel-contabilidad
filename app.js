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
let recetasRef = null;
let recetasData = [];
let recetaEditandoId = null;

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

    // Apuntamos a las colecciones
    ingredientesRef = db.collection("ingredientes");
    recetasRef = db.collection("recetas");

    // Si llegamos aquí, Firebase funciona. Configuramos todo.
    configurarListener();
    configurarListenerRecetas();
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
// FUNCIÓN: configurarListenerRecetas()
//
// ¿Qué hace?
//   Escucha cambios en la colección "recetas" y actualiza la
//   lista de recetas en tiempo real.
// ============================================================

function configurarListenerRecetas() {
  recetasRef.onSnapshot(function(snapshot) {
    if (sessionStorage.getItem("autenticado") !== "true") return;

    recetasData = [];

    snapshot.forEach(function(doc) {
      const data = doc.data();
      recetasData.push({
        id: doc.id,
        nombre: data.nombre,
        ingredientes: data.ingredientes || [],
        fecha: data.fecha || null
      });
    });

    renderRecetas();
  }, function(error) {
    mostrarError("Error al cargar recetas: " + error.message);
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
    actualizarResumen([]);
    return;
  }
  emptyMsg.classList.add("hidden");

  datos.forEach(function(item) {
    const precios = calcularPrecios(item.precio, item.cantidad, item.unidad);

    const fila = document.createElement("tr");

    fila.innerHTML = `
      <td><span class="nombre-ingrediente">${item.nombre}</span></td>
      <td class="precio-col">$${item.precio.toFixed(0)}</td>
      <td class="unidad-col"><span class="unidad-tag ${item.unidad}">${item.unidad}</span></td>
      <td style="text-align:center"><span class="cantidad-num">${item.cantidad}</span></td>
      <td class="precio-unitario">${precios.porGramo}</td>
      <td class="precio-unitario">${precios.porLibra}</td>
      <td class="precio-unitario">${precios.porKilo}</td>
      <td class="acciones">
        <button class="btn-editar" data-id="${item.id}">Editar</button>
        <button class="btn-eliminar" data-id="${item.id}">Eliminar</button>
      </td>
    `;

    lista.appendChild(fila);
  });

  actualizarResumen(datos);
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
// FUNCIÓN: actualizarResumen(datos)
//
// ¿Qué hace?
//   Muestra el total de ingredientes en la lista.
// ============================================================

function actualizarResumen(datos) {
  document.getElementById("resumen-total-valor").textContent = datos.length;
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
    case 'u':
      gramos = cantidad;
      break;
    case 'val':
      return {
        porGramo: "$" + precio.toFixed(0),
        porLibra: "$" + precio.toFixed(0),
        porKilo: "$" + precio.toFixed(0)
      };
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

  // Cuando se selecciona "Valor ($)" auto-pone cantidad 1
  document.getElementById("unidad-select").addEventListener("change", function() {
    if (this.value === "val") {
      document.getElementById("cantidad-input").value = 1;
    }
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

  // ============================================================
  // EVENTOS DE PESTAÑAS
  // ============================================================

  document.querySelectorAll(".tab").forEach(function(tab) {
    tab.addEventListener("click", function() {
      document.querySelectorAll(".tab").forEach(function(t) { t.classList.remove("active"); });
      document.querySelectorAll(".tab-panel").forEach(function(p) { p.classList.remove("active"); });

      tab.classList.add("active");
      document.getElementById("seccion-" + tab.dataset.tab).classList.add("active");
    });
  });

  // ============================================================
  // EVENTOS DE RECETAS
  // ============================================================

  // Botón "Agregar ingrediente" en el formulario de receta
  document.getElementById("agregar-ingrediente-btn").addEventListener("click", function() {
    agregarFilaIngrediente();
  });

  // Guardar receta
  document.getElementById("receta-form").addEventListener("submit", function(e) {
    guardarReceta(e);
  });

  // Cancelar edición de receta
  document.getElementById("cancelar-editar-receta-btn").addEventListener("click", function() {
    cancelarEditarReceta();
  });

  // Delegación de eventos en los ingredientes de receta (cambios, quitar)
  document.getElementById("receta-ingredientes-container").addEventListener("change", function() {
    actualizarCostosReceta();
  });

  document.getElementById("receta-ingredientes-container").addEventListener("input", function() {
    actualizarCostosReceta();
  });

  // Costo adicional
  document.getElementById("receta-costo-adicional").addEventListener("input", function() {
    actualizarCostosReceta();
  });

  document.getElementById("receta-ingredientes-container").addEventListener("click", function(e) {
    if (e.target.classList.contains("btn-quitar-ingr")) {
      e.target.closest(".receta-ingr-row").remove();
      actualizarCostosReceta();
      mostrarMsgRecetaVacia();
    }
  });

  // Delegación de eventos en la lista de recetas
  document.getElementById("recetas-container").addEventListener("click", function(e) {
    const header = e.target.closest(".receta-card-header");
    if (header) {
      const body = header.nextElementSibling;
      if (body) {
        body.classList.toggle("open");
      }
      return;
    }

    const btn = e.target.closest("button");
    if (!btn) return;

    const id = btn.dataset.id;
    if (!id) return;

    if (btn.classList.contains("btn-editar")) {
      editarReceta(id);
    } else if (btn.classList.contains("btn-eliminar")) {
      eliminarReceta(id);
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
// PARTE 5: RECETAS
// ============================================================

// ============================================================
// FUNCIÓN: agregarFilaIngrediente(datos)
//
// ¿Qué hace?
//   Agrega una fila de ingrediente en el formulario de receta.
//   Si datos tiene valores, rellena los campos (para editar).
// ============================================================

function agregarFilaIngrediente(datos) {
  const container = document.getElementById("receta-ingredientes-container");
  const emptyMsg = container.querySelector(".empty-receta-msg");
  if (emptyMsg) emptyMsg.remove();

  const index = Date.now();

  const row = document.createElement("div");
  row.className = "receta-ingr-row";

  const selectId = "receta-ingr-select-" + index;
  const cantidadId = "receta-ingr-cantidad-" + index;
  const unidadId = "receta-ingr-unidad-" + index;

  let optionsHtml = '<option value="">Seleccionar...</option>';
  ingredientesData.forEach(function(ing) {
    if (ing.unidad === "val") return;
    const selected = (datos && datos.ingredienteId === ing.id) ? "selected" : "";
    optionsHtml += '<option value="' + ing.id + '" ' + selected + '>' + ing.nombre + '</option>';
  });

  const cantidadVal = datos ? datos.cantidad : "";
  const unidadVal = datos ? datos.unidad : "g";

  row.innerHTML = `
    <div class="form-group" style="flex:2;min-width:120px">
      <label for="${selectId}">Ingrediente</label>
      <select id="${selectId}" class="receta-ingr-select">
        ${optionsHtml}
      </select>
    </div>
    <div class="form-group">
      <label for="${cantidadId}">Cantidad</label>
      <input type="number" id="${cantidadId}" class="receta-ingr-cantidad" value="${cantidadVal}" step="0.1" min="0" placeholder="0" />
    </div>
    <div class="form-group">
      <label for="${unidadId}">Unidad</label>
      <select id="${unidadId}" class="receta-ingr-unidad">
        <option value="g" ${unidadVal === 'g' ? 'selected' : ''}>g</option>
        <option value="lb" ${unidadVal === 'lb' ? 'selected' : ''}>lb</option>
        <option value="kg" ${unidadVal === 'kg' ? 'selected' : ''}>kg</option>
        <option value="cc" ${unidadVal === 'cc' ? 'selected' : ''}>cc</option>
        <option value="u" ${unidadVal === 'u' ? 'selected' : ''}>u</option>
      </select>
    </div>
    <div class="receta-ingr-costo">$0.00</div>
    <button type="button" class="btn-quitar-ingr" title="Quitar">✕</button>
  `;

  container.appendChild(row);

  if (datos) {
    setTimeout(function() {
      actualizarCostosReceta();
    }, 50);
  }
}

// ============================================================
// FUNCIÓN: mostrarMsgRecetaVacia()
//
// ¿Qué hace?
//   Muestra el mensaje de vacío si no hay filas de ingredientes.
// ============================================================

function mostrarMsgRecetaVacia() {
  const container = document.getElementById("receta-ingredientes-container");
  if (container.children.length === 0) {
    container.innerHTML = '<p class="empty-receta-msg">Agrega ingredientes a la receta</p>';
    document.getElementById("receta-total-costo").textContent = "$0.00";
  }
}

// ============================================================
// FUNCIÓN: actualizarCostosReceta()
//
// ¿Qué hace?
//   Recorre todas las filas de ingredientes y calcula el costo
//   de cada una. Luego actualiza el total de la receta.
// ============================================================

function actualizarCostosReceta() {
  const rows = document.querySelectorAll("#receta-ingredientes-container .receta-ingr-row");
  let total = 0;

  rows.forEach(function(row) {
    const select = row.querySelector(".receta-ingr-select");
    const cantidadInput = row.querySelector(".receta-ingr-cantidad");
    const unidadSelect = row.querySelector(".receta-ingr-unidad");
    const costoSpan = row.querySelector(".receta-ingr-costo");

    if (!select || !cantidadInput || !unidadSelect || !costoSpan) return;

    const ingredienteId = select.value;
    const cantidad = parseFloat(cantidadInput.value);
    const unidad = unidadSelect.value;

    if (!ingredienteId || isNaN(cantidad) || cantidad <= 0) {
      costoSpan.textContent = "$0.00";
      return;
    }

    const costo = calcularCostoIngrediente(ingredienteId, cantidad, unidad);
    costoSpan.textContent = "$" + costo.toFixed(2);
    total += costo;
  });

  const adicional = parseFloat(document.getElementById("receta-costo-adicional").value) || 0;
  total += adicional;

  document.getElementById("receta-total-costo").textContent = "$" + total.toFixed(2);
}

// ============================================================
// FUNCIÓN: calcularCostoIngrediente(ingredienteId, cantidad, unidad)
//
// ¿Qué hace?
//   Calcula cuánto cuesta usar X cantidad de un ingrediente
//   en una receta, basado en el precio original del ingrediente.
//
//   Fórmula:
//     costo = (precioIngrediente / gramosComprados) * gramosUsados
// ============================================================

function calcularCostoIngrediente(ingredienteId, cantidad, unidad) {
  const base = ingredientesData.find(function(i) { return i.id === ingredienteId; });
  if (!base || base.unidad === "val") return 0;

  let gramosUsados = 0;
  switch (unidad) {
    case 'g': gramosUsados = cantidad; break;
    case 'lb': gramosUsados = cantidad * 500; break;
    case 'kg': gramosUsados = cantidad * 1000; break;
    case 'cc':
    case 'ml':
    case 'u': gramosUsados = cantidad; break;
  }

  let gramosBase = 0;
  switch (base.unidad) {
    case 'g': gramosBase = base.cantidad; break;
    case 'lb': gramosBase = base.cantidad * 500; break;
    case 'kg': gramosBase = base.cantidad * 1000; break;
    case 'cc':
    case 'ml':
    case 'u': gramosBase = base.cantidad; break;
  }

  if (gramosBase === 0 || gramosUsados === 0) return 0;

  return (base.precio / gramosBase) * gramosUsados;
}

// ============================================================
// FUNCIÓN: guardarReceta(evento)
//
// ¿Qué hace?
//   Guarda o actualiza una receta en Firebase.
// ============================================================

function guardarReceta(evento) {
  evento.preventDefault();

  if (!recetasRef) {
    mostrarError("Firebase no está conectado.");
    return;
  }

  const nombre = document.getElementById("receta-nombre-input").value.trim();
  if (!nombre) {
    alert("El nombre de la receta es obligatorio.");
    return;
  }

  const rows = document.querySelectorAll("#receta-ingredientes-container .receta-ingr-row");
  if (rows.length === 0) {
    alert("Agrega al menos un ingrediente a la receta.");
    return;
  }

  const ingredientes = [];
  let algunValido = false;

  rows.forEach(function(row, idx) {
    const select = row.querySelector(".receta-ingr-select");
    const cantidadInput = row.querySelector(".receta-ingr-cantidad");
    const unidadSelect = row.querySelector(".receta-ingr-unidad");

    const ingredienteId = select.value;
    const cantidad = parseFloat(cantidadInput.value);
    const unidad = unidadSelect.value;

    if (!ingredienteId || isNaN(cantidad) || cantidad <= 0) return;

    const base = ingredientesData.find(function(i) { return i.id === ingredienteId; });
    if (!base) return;

    const costo = calcularCostoIngrediente(ingredienteId, cantidad, unidad);

    ingredientes.push({
      ingredienteId: ingredienteId,
      nombre: base.nombre,
      cantidad: cantidad,
      unidad: unidad,
      costo: costo
    });

    algunValido = true;
  });

  if (!algunValido) {
    alert("Completa todos los ingredientes con valores válidos.");
    return;
  }

  const costoAdicional = parseFloat(document.getElementById("receta-costo-adicional").value) || 0;

  const receta = {
    nombre: nombre,
    ingredientes: ingredientes,
    costoAdicional: costoAdicional,
    fecha: new Date().toISOString()
  };

  if (recetaEditandoId) {
    recetasRef.doc(recetaEditandoId).update(receta).catch(function(error) {
      mostrarError("Error al actualizar receta: " + error.message);
    });
    recetaEditandoId = null;
  } else {
    recetasRef.add(receta).catch(function(error) {
      mostrarError("Error al guardar receta: " + error.message);
    });
  }

  // Limpiar formulario
  document.getElementById("receta-form").reset();
  document.getElementById("receta-ingredientes-container").innerHTML = '<p class="empty-receta-msg">Agrega ingredientes a la receta</p>';
  document.getElementById("receta-total-costo").textContent = "$0.00";
  document.getElementById("receta-costo-adicional").value = "";
  document.getElementById("cancelar-editar-receta-btn").classList.add("hidden");
  document.querySelector("#receta-form-section h2").textContent = "Nueva receta";
  recetaEditandoId = null;
}

// ============================================================
// FUNCIÓN: renderRecetas()
//
// ¿Qué hace?
//   Muestra la lista de recetas guardadas con sus costos.
//   Cada receta se expande para ver sus ingredientes.
// ============================================================

function renderRecetas() {
  const container = document.getElementById("recetas-container");
  const emptyMsg = document.getElementById("sin-recetas");

  if (recetasData.length === 0) {
    container.innerHTML = "";
    emptyMsg.classList.remove("hidden");
    return;
  }
  emptyMsg.classList.add("hidden");

  // Ordenar por fecha descendente
  const ordenadas = [...recetasData].sort(function(a, b) {
    if (!a.fecha && !b.fecha) return 0;
    if (!a.fecha) return 1;
    if (!b.fecha) return -1;
    return b.fecha.localeCompare(a.fecha);
  });

  container.innerHTML = "";

  ordenadas.forEach(function(receta) {
    const costoAdicional = receta.costoAdicional || 0;
    const total = receta.ingredientes.reduce(function(sum, ing) {
      return sum + (ing.costo || 0);
    }, 0) + costoAdicional;

    const fecha = receta.fecha
      ? new Date(receta.fecha).toLocaleDateString("es-ES", { day: "numeric", month: "short" })
      : "";

    let ingredientesHtml = "";
    receta.ingredientes.forEach(function(ing) {
      ingredientesHtml += `
        <tr>
          <td>${ing.nombre}</td>
          <td>${ing.cantidad} ${ing.unidad}</td>
          <td>$${ing.costo.toFixed(2)}</td>
        </tr>
      `;
    });

    if (costoAdicional > 0) {
      ingredientesHtml += `
        <tr style="border-top:2px solid #e5e7eb;font-weight:600">
          <td>Costo adicional</td>
          <td></td>
          <td>$${costoAdicional.toFixed(2)}</td>
        </tr>
      `;
    }

    const card = document.createElement("div");
    card.className = "receta-card";
    card.innerHTML = `
      <div class="receta-card-header">
        <div>
          <div class="receta-nombre">${receta.nombre}</div>
          <div class="receta-fecha">${fecha}</div>
        </div>
        <div class="receta-info">
          <span class="receta-costo">$${total.toFixed(2)}</span>
          <span style="font-size:0.8rem;color:#9ca3af">▼</span>
        </div>
      </div>
      <div class="receta-card-body">
        <table class="receta-ingredientes-list">
          <thead>
            <tr>
              <th>Ingrediente</th>
              <th>Cantidad</th>
              <th>Costo</th>
            </tr>
          </thead>
          <tbody>
            ${ingredientesHtml}
          </tbody>
        </table>
        <div class="receta-card-actions">
          <button class="btn-editar" data-id="${receta.id}">Editar</button>
          <button class="btn-eliminar" data-id="${receta.id}">Eliminar</button>
        </div>
      </div>
    `;

    container.appendChild(card);
  });
}

// ============================================================
// FUNCIÓN: cancelarEditarReceta()
//
// ¿Qué hace?
//   Cancela la edición de receta y vuelve al estado inicial.
// ============================================================

function cancelarEditarReceta() {
  recetaEditandoId = null;
  document.getElementById("receta-form").reset();
  document.getElementById("receta-ingredientes-container").innerHTML = '<p class="empty-receta-msg">Agrega ingredientes a la receta</p>';
  document.getElementById("receta-total-costo").textContent = "$0.00";
  document.getElementById("receta-costo-adicional").value = "";
  document.getElementById("cancelar-editar-receta-btn").classList.add("hidden");
  document.querySelector("#receta-form-section h2").textContent = "Nueva receta";
}

// ============================================================
// FUNCIÓN: editarReceta(id)
//
// ¿Qué hace?
//   Carga los datos de una receta en el formulario para editarla.
// ============================================================

function editarReceta(id) {
  const receta = recetasData.find(function(r) { return r.id === id; });
  if (!receta) {
    mostrarError("Receta no encontrada.");
    return;
  }

  recetaEditandoId = id;

  // Cambiar a pestaña Recetas
  document.querySelectorAll(".tab").forEach(function(t) { t.classList.remove("active"); });
  document.querySelectorAll(".tab-panel").forEach(function(p) { p.classList.remove("active"); });
  document.querySelector('.tab[data-tab="recetas"]').classList.add("active");
  document.getElementById("seccion-recetas").classList.add("active");

  // Limpiar el formulario
  document.getElementById("receta-form").reset();
  document.getElementById("receta-ingredientes-container").innerHTML = "";

  // Rellenar nombre
  document.getElementById("receta-nombre-input").value = receta.nombre;

  // Cambiar título y mostrar botón cancelar
  document.querySelector("#receta-form-section h2").textContent = "Editar receta";
  document.getElementById("cancelar-editar-receta-btn").classList.remove("hidden");

  // Rellenar costo adicional
  if (receta.costoAdicional) {
    document.getElementById("receta-costo-adicional").value = receta.costoAdicional;
  }

  // Agregar filas de ingredientes
  receta.ingredientes.forEach(function(ing) {
    agregarFilaIngrediente({
      ingredienteId: ing.ingredienteId,
      cantidad: ing.cantidad,
      unidad: ing.unidad
    });
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ============================================================
// FUNCIÓN: eliminarReceta(id)
//
// ¿Qué hace?
//   Elimina una receta de Firebase previa confirmación.
// ============================================================

function eliminarReceta(id) {
  if (!recetasRef) {
    mostrarError("Firebase no está conectado.");
    return;
  }

  if (confirm("¿Estás seguro de eliminar esta receta?")) {
    recetasRef.doc(id).delete().catch(function(error) {
      mostrarError("Error al eliminar receta: " + error.message);
    });
  }
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
