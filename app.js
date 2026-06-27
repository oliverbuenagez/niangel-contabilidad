let db = null;
let ingredientesRef = null;
let editandoId = null;
let ingredientesData = [];
let recetasRef = null;
let recetasData = [];
let recetaEditandoId = null;
let produccionRef = null;
let produccionesData = [];
let historialPeriodo = "month";
let produccionEditandoId = null;
let historialOrden = { col: "fecha", dir: "desc" };
let historialPagina = 1;
let historialPorPagina = 50;
let clientesRef = null;
let clientesData = [];
let clienteEditandoId = null;
let ventasPeriodo = "month";
let ventasRef = null;
let ventasData = [];
let ventaEditandoId = null;

// ============================================================
// LOGIN
// ============================================================

function verificarPin() {
  const pinIngresado = document.getElementById("pin-input").value;
  if (pinIngresado === "1285") {
    sessionStorage.setItem("autenticado", "true");
    document.getElementById("login-screen").classList.add("hidden");
    document.getElementById("app-screen").classList.remove("hidden");
    document.getElementById("pin-input").value = "";
    inicializarFirebase();
  } else {
    mostrarToast("PIN incorrecto. Intenta de nuevo.", "error");
    document.getElementById("pin-input").value = "";
    document.getElementById("pin-input").focus();
  }
}

document.getElementById("pin-input").addEventListener("keypress", function(e) {
  if (e.key === "Enter") verificarPin();
});

function cerrarSesion() {
  sessionStorage.removeItem("autenticado");
  document.getElementById("login-screen").classList.remove("hidden");
  document.getElementById("app-screen").classList.add("hidden");
  document.getElementById("pin-input").value = "";
}

if (sessionStorage.getItem("autenticado") === "true") {
  document.getElementById("login-screen").classList.add("hidden");
  document.getElementById("app-screen").classList.remove("hidden");
  inicializarFirebase();
}

// ============================================================
// FIREBASE
// ============================================================

function inicializarFirebase() {
  try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    ingredientesRef = db.collection("ingredientes");
    recetasRef = db.collection("recetas");
    produccionRef = db.collection("produccion");
    clientesRef = db.collection("clientes");
    ventasRef = db.collection("ventas");
    configurarListener();
    configurarListenerRecetas();
    configurarListenerProducciones();
    configurarListenerClientes();
    configurarListenerVentas();
    configurarEventos();
    cerrarError();
  } catch (error) {
    mostrarError("Error al conectar con Firebase: " + error.message +
      ". ¿Abriste con Live Server (http://) y no con doble clic (file://)?");
  }
}

// ============================================================
// LISTENERS
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
    llenarSelectReceta();
  }, function(error) {
    mostrarError("Error de conexión con Firebase: " + error.message);
  });
}

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
        costoAdicional: data.costoAdicional || 0,
        rinde: data.rinde || 0,
        precioVenta: data.precioVenta || 0,
        harinaTanda: data.harinaTanda || 0,
        fecha: data.fecha || null
      });
    });
    renderRecetas();
    llenarSelectReceta();
  }, function(error) {
    mostrarError("Error al cargar recetas: " + error.message);
  });
}

// ============================================================
// TABLA INGREDIENTES
// ============================================================

function renderTabla() {
  const lista = document.getElementById("ingredientes-lista");
  const emptyMsg = document.getElementById("sin-ingredientes");
  let datos = [...ingredientesData];

  const textoBusqueda = document.getElementById("filtro-buscar").value.trim().toLowerCase();
  if (textoBusqueda) {
    datos = datos.filter(function(item) {
      return item.nombre.toLowerCase().includes(textoBusqueda);
    });
  }

  const orden = document.getElementById("filtro-orden").value;
  datos.sort(function(a, b) {
    switch (orden) {
      case "nombre-asc": return a.nombre.localeCompare(b.nombre);
      case "nombre-desc": return b.nombre.localeCompare(a.nombre);
      case "precio-asc": return a.precio - b.precio;
      case "precio-desc": return b.precio - a.precio;
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
      default: return 0;
    }
  });

  lista.innerHTML = "";
  if (datos.length === 0) {
    emptyMsg.classList.remove("hidden");
    emptyMsg.textContent = textoBusqueda
      ? 'No se encontraron ingredientes con "' + textoBusqueda + '"'
      : "No hay ingredientes. ¡Agrega el primero!";
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

function aplicarFiltros() { renderTabla(); }

function actualizarResumen(datos) {
  document.getElementById("resumen-total-valor").textContent = datos.length;
}

// ============================================================
// CÁLCULOS
// ============================================================

function convertirAGramos(cantidad, unidad) {
  switch (unidad) {
    case 'g': return cantidad;
    case 'lb': return cantidad * 500;
    case 'kg': return cantidad * 1000;
    case 'cc':
    case 'ml':
    case 'u': return cantidad;
    default: return 0;
  }
}

var UMBRAL_MAX = 1e12;

function sanitizarNumero(val) {
  if (typeof val !== "number" || !isFinite(val)) return 0;
  if (Math.abs(val) > UMBRAL_MAX) return 0;
  return val;
}

function calcularPrecios(precio, cantidad, unidad) {
  let gramos = convertirAGramos(cantidad, unidad);

  if (unidad === 'val') {
    return {
      porGramo: "$" + precio.toFixed(0),
      porLibra: "$" + precio.toFixed(0),
      porKilo: "$" + precio.toFixed(0)
    };
  }

  if (gramos === 0) {
    return { porGramo: "$0.00", porLibra: "$0.00", porKilo: "$0.00" };
  }

  return {
    porGramo: "$" + (precio / gramos).toFixed(2),
    porLibra: "$" + (precio / (gramos / 500)).toFixed(2),
    porKilo: "$" + (precio / (gramos / 1000)).toFixed(2)
  };
}

function calcularCostoIngrediente(ingredienteId, cantidad, unidad) {
  const base = ingredientesData.find(function(i) { return i.id === ingredienteId; });
  if (!base || base.unidad === "val") return 0;

  const gramosUsados = convertirAGramos(cantidad, unidad);
  const gramosBase = convertirAGramos(base.cantidad, base.unidad);

  if (gramosBase === 0 || gramosUsados === 0) return 0;
  if (!isFinite(gramosBase) || !isFinite(gramosUsados)) return 0;
  return sanitizarNumero((base.precio / gramosBase) * gramosUsados);
}

// ============================================================
// EVENTOS
// ============================================================

function configurarEventos() {
  document.getElementById("ingredientes-form").addEventListener("submit", function(e) { guardarIngrediente(e); });
  document.getElementById("cancelar-btn").addEventListener("click", function() { cancelarEdicion(); });
  document.getElementById("unidad-select").addEventListener("change", function() {
    if (this.value === "val") document.getElementById("cantidad-input").value = 1;
  });

  document.getElementById("ingredientes-tabla").addEventListener("click", function(e) {
    const btn = e.target.closest("button");
    if (!btn) return;
    const id = btn.dataset.id;
    if (!id) return;
    if (btn.classList.contains("btn-editar")) {
      const fila = btn.closest("tr");
      const celdas = fila.cells;
      editarIngrediente(id, {
        nombre: celdas[0].textContent,
        precio: parseFloat(celdas[1].textContent.replace("$", "")),
        unidad: celdas[2].textContent,
        cantidad: parseFloat(celdas[3].textContent)
      });
    } else if (btn.classList.contains("btn-eliminar")) {
      eliminarIngrediente(id);
    }
  });

  // TABS
  document.querySelectorAll(".tab").forEach(function(tab) {
    tab.addEventListener("click", function() {
      document.querySelectorAll(".tab").forEach(function(t) { t.classList.remove("active"); });
      document.querySelectorAll(".tab-panel").forEach(function(p) { p.classList.remove("active"); });
      tab.classList.add("active");
      document.getElementById("seccion-" + tab.dataset.tab).classList.add("active");
      if (tab.dataset.tab === "produccion") {
        llenarSelectReceta();
        actualizarHistorial();
      }
      if (tab.dataset.tab === "ventas") {
        llenarSelectClienteVenta();
        // Si no hay fecha, poner hoy
        var fechaInput = document.getElementById("venta-fecha-input");
        if (fechaInput && !fechaInput.value) {
          fechaInput.value = fechaHoyLocal();
        }
      }
      if (tab.dataset.tab === "estadisticas") renderEstadisticas();
    });
  });

  // RECETAS
  document.getElementById("agregar-ingrediente-btn").addEventListener("click", function() {
    agregarFilaIngrediente();
  });
  document.getElementById("receta-form").addEventListener("submit", function(e) { guardarReceta(e); });
  document.getElementById("cancelar-editar-receta-btn").addEventListener("click", function() { cancelarEditarReceta(); });

  document.getElementById("receta-ingredientes-container").addEventListener("change", function() {
    actualizarCostosReceta();
  });
  document.getElementById("receta-ingredientes-container").addEventListener("input", function() {
    actualizarCostosReceta();
  });

  document.getElementById("receta-costo-adicional").addEventListener("input", function() { actualizarCostosReceta(); });
  document.getElementById("receta-costo-adicional").addEventListener("change", function() { actualizarCostosReceta(); });

  document.getElementById("receta-ingredientes-container").addEventListener("click", function(e) {
    if (e.target.classList.contains("btn-quitar-ingr")) {
      e.target.closest(".receta-ingr-row").remove();
      actualizarCostosReceta();
      mostrarMsgRecetaVacia();
    }
  });

  document.getElementById("recetas-container").addEventListener("click", function(e) {
    const header = e.target.closest(".receta-card-header");
    if (header) {
      const body = header.nextElementSibling;
      if (body) body.classList.toggle("open");
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

  // PRODUCCIÓN
  document.getElementById("produccion-receta-select").addEventListener("change", function() {
    cargarRecetaProduccion();
  });
  document.getElementById("produccion-cantidad").addEventListener("input", function() { calcularProduccion(); });
  document.getElementById("produccion-cantidad").addEventListener("change", function() { calcularProduccion(); });
  document.getElementById("produccion-unidad").addEventListener("change", function() { calcularProduccion(); });
  document.getElementById("produccion-costo-adicional").addEventListener("input", function() { calcularProduccion(); });
  document.getElementById("produccion-costo-adicional").addEventListener("change", function() { calcularProduccion(); });
  document.getElementById("produccion-form").addEventListener("submit", function(e) { guardarProduccion(e); });
  document.getElementById("cancelar-editar-produccion-btn").addEventListener("click", function() { cancelarEditarProduccion(); });

  // VENTAS
  document.getElementById("clientes-form").addEventListener("submit", function(e) { guardarCliente(e); });
  document.getElementById("cancelar-editar-cliente-btn").addEventListener("click", function() { cancelarEditarCliente(); });
  document.getElementById("ventas-form").addEventListener("submit", function(e) { guardarVenta(e); });
  document.getElementById("cancelar-editar-venta-btn").addEventListener("click", function() { cancelarEditarVenta(); });
  document.getElementById("agregar-item-venta-btn").addEventListener("click", function() { agregarItemVenta(); });
}

// ============================================================
// CRUD INGREDIENTES
// ============================================================

function guardarIngrediente(evento) {
  evento.preventDefault();
  if (!ingredientesRef) { mostrarError("Firebase no está conectado. Revisa tu configuración."); return; }

  const nombre = document.getElementById("nombre-input").value.trim();
  const precio = parseFloat(document.getElementById("precio-input").value);
  const unidad = document.getElementById("unidad-select").value;
  const cantidad = parseFloat(document.getElementById("cantidad-input").value);

  if (!nombre || isNaN(precio) || !unidad || isNaN(cantidad) || precio < 0 || cantidad < 0) {
    mostrarToast("Todos los campos son obligatorios y deben ser válidos.", "warning");
    return;
  }

  const ingrediente = { nombre, precio, unidad, cantidad, fecha: new Date().toISOString() };

  if (editandoId) {
    ingredientesRef.doc(editandoId).update(ingrediente).catch(function(error) { mostrarError("Error al actualizar: " + error.message); });
    editandoId = null;
    document.getElementById("form-titulo").textContent = "Agregar ingrediente";
  } else {
    ingredientesRef.add(ingrediente).catch(function(error) { mostrarError("Error al guardar: " + error.message); });
  }

  document.getElementById("ingredientes-form").reset();
  document.getElementById("cancelar-btn").classList.add("hidden");
}

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

function eliminarIngrediente(id) {
  if (!ingredientesRef) { mostrarError("Firebase no está conectado."); return; }
  if (confirm("¿Estás seguro de eliminar este ingrediente?")) {
    ingredientesRef.doc(id).delete().catch(function(error) { mostrarError("Error al eliminar: " + error.message); });
  }
}

function cancelarEdicion() {
  editandoId = null;
  document.getElementById("ingredientes-form").reset();
  document.getElementById("cancelar-btn").classList.add("hidden");
  document.getElementById("form-titulo").textContent = "Agregar ingrediente";
}

// ============================================================
// RECETAS
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
      <select id="${selectId}" class="receta-ingr-select">${optionsHtml}</select>
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
    setTimeout(function() { actualizarCostosReceta(); }, 50);
  }
}

function mostrarMsgRecetaVacia() {
  const container = document.getElementById("receta-ingredientes-container");
  if (container.children.length === 0) {
    container.innerHTML = '<p class="empty-receta-msg">Agrega ingredientes a la receta</p>';
    document.getElementById("receta-total-costo").textContent = "$0.00";
  }
}

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
    if (!ingredienteId || isNaN(cantidad) || cantidad <= 0) { costoSpan.textContent = "$0.00"; return; }

    const costo = calcularCostoIngrediente(ingredienteId, cantidad, unidad);
    costoSpan.textContent = "$" + costo.toFixed(2);
    total += costo;
  });

  const adicional = parseFloat(document.getElementById("receta-costo-adicional").value) || 0;
  total += adicional;
  document.getElementById("receta-total-costo").textContent = "$" + total.toFixed(2);
}

function guardarReceta(evento) {
  evento.preventDefault();
  if (!recetasRef) { mostrarError("Firebase no está conectado."); return; }

  const nombre = document.getElementById("receta-nombre-input").value.trim();
  if (!nombre) { mostrarToast("El nombre de la receta es obligatorio.", "warning"); return; }

  const rows = document.querySelectorAll("#receta-ingredientes-container .receta-ingr-row");
  if (rows.length === 0) { mostrarToast("Agrega al menos un ingrediente a la receta.", "warning"); return; }

  const ingredientes = [];
  let algunValido = false;

  rows.forEach(function(row) {
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
    ingredientes.push({ ingredienteId, nombre: base.nombre, cantidad, unidad, costo });
    algunValido = true;
  });

  if (!algunValido) { mostrarToast("Completa todos los ingredientes con valores válidos.", "warning"); return; }

  const costoAdicional = parseFloat(document.getElementById("receta-costo-adicional").value) || 0;
  const rinde = parseInt(document.getElementById("receta-rinde").value) || 0;
  const precioVenta = parseFloat(document.getElementById("receta-precio-venta").value) || 0;

  if (!rinde || !precioVenta) {
    mostrarToast("El número de panes por tanda y el precio de venta son obligatorios.", "warning");
    return;
  }
  let harinaTanda = 0;
  const harinaIng = ingredientes.find(function(i) {
    return i.nombre.toLowerCase().includes("harina");
  });
  if (harinaIng) {
    harinaTanda = convertirAGramos(harinaIng.cantidad, harinaIng.unidad);
  }
  if (!harinaTanda && ingredientes.length > 0) {
    harinaTanda = convertirAGramos(ingredientes[0].cantidad, ingredientes[0].unidad);
  }

  const receta = { nombre, ingredientes, costoAdicional, rinde, precioVenta, harinaTanda, fecha: new Date().toISOString() };

  if (recetaEditandoId) {
    recetasRef.doc(recetaEditandoId).update(receta).catch(function(error) { mostrarError("Error al actualizar receta: " + error.message); });
    recetaEditandoId = null;
  } else {
    recetasRef.add(receta).catch(function(error) { mostrarError("Error al guardar receta: " + error.message); });
  }

  document.getElementById("receta-form").reset();
  document.getElementById("receta-ingredientes-container").innerHTML = '<p class="empty-receta-msg">Agrega ingredientes a la receta</p>';
  document.getElementById("receta-total-costo").textContent = "$0.00";
  document.getElementById("receta-costo-adicional").value = "";
  document.getElementById("cancelar-editar-receta-btn").classList.add("hidden");
  document.querySelector("#receta-form-section h2").textContent = "Nueva receta";
  recetaEditandoId = null;
}

function renderRecetas() {
  const container = document.getElementById("recetas-container");
  const emptyMsg = document.getElementById("sin-recetas");

  if (recetasData.length === 0) {
    container.innerHTML = "";
    emptyMsg.classList.remove("hidden");
    return;
  }
  emptyMsg.classList.add("hidden");

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
      return sum + calcularCostoIngrediente(ing.ingredienteId, ing.cantidad, ing.unidad);
    }, 0) + costoAdicional;

    const fecha = receta.fecha
      ? new Date(receta.fecha).toLocaleDateString("es-ES", { day: "numeric", month: "short" })
      : "";

    let extraInfo = "";
    if (receta.rinde && receta.precioVenta) {
      const ingresoPorTanda = receta.rinde * receta.precioVenta;
      const costPerPan = total / receta.rinde;
      const profitPerPan = receta.precioVenta - costPerPan;
      extraInfo = `
        <div class="receta-extra-info">
          <span>${receta.harinaTanda ? receta.harinaTanda + 'g' : '—'} · ${receta.rinde} panes · $${receta.precioVenta}/pan</span>
          <span>Costo/pan: $${costPerPan.toFixed(0)}</span>
          <span>Ganancia/pan: $${profitPerPan.toFixed(0)}</span>
          <span class="receta-extra-ganancia">$${ingresoPorTanda.toFixed(0)}/tanda</span>
        </div>
      `;
    }

    let ingredientesHtml = "";
    receta.ingredientes.forEach(function(ing) {
      ingredientesHtml += `
        <tr>
          <td>${ing.nombre}</td>
          <td>${ing.cantidad} ${ing.unidad}</td>
          <td>$${calcularCostoIngrediente(ing.ingredienteId, ing.cantidad, ing.unidad).toFixed(2)}</td>
        </tr>
      `;
    });

    if (costoAdicional > 0) {
      ingredientesHtml += `<tr style="border-top:2px solid #e5e7eb;font-weight:600"><td>Gasto</td><td></td><td>$${costoAdicional.toFixed(2)}</td></tr>`;
    }

    const card = document.createElement("div");
    card.className = "receta-card";
    card.innerHTML = `
      <div class="receta-card-header">
        <div>
          <div class="receta-nombre">${receta.nombre}</div>
          <div class="receta-fecha">${fecha}</div>
          ${extraInfo}
        </div>
        <div class="receta-info">
          <span class="receta-costo">$${total.toFixed(2)}</span>
          <span style="font-size:0.85rem;color:#9ca3af">▼</span>
        </div>
      </div>
      <div class="receta-card-body">
        <table class="receta-ingredientes-list">
          <thead><tr><th>Ingrediente</th><th>Cantidad</th><th>Costo</th></tr></thead>
          <tbody>${ingredientesHtml}</tbody>
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

function cancelarEditarReceta() {
  recetaEditandoId = null;
  document.getElementById("receta-form").reset();
  document.getElementById("receta-ingredientes-container").innerHTML = '<p class="empty-receta-msg">Agrega ingredientes a la receta</p>';
  document.getElementById("receta-total-costo").textContent = "$0.00";
  document.getElementById("receta-costo-adicional").value = "";
  document.getElementById("cancelar-editar-receta-btn").classList.add("hidden");
  document.querySelector("#receta-form-section h2").textContent = "Nueva receta";
}

function editarReceta(id) {
  const receta = recetasData.find(function(r) { return r.id === id; });
  if (!receta) { mostrarError("Receta no encontrada."); return; }

  recetaEditandoId = id;

  document.querySelectorAll(".tab").forEach(function(t) { t.classList.remove("active"); });
  document.querySelectorAll(".tab-panel").forEach(function(p) { p.classList.remove("active"); });
  document.querySelector('.tab[data-tab="recetas"]').classList.add("active");
  document.getElementById("seccion-recetas").classList.add("active");

  document.getElementById("receta-form").reset();
  document.getElementById("receta-ingredientes-container").innerHTML = "";

  document.getElementById("receta-nombre-input").value = receta.nombre;
  document.querySelector("#receta-form-section h2").textContent = "Editar receta";
  document.getElementById("cancelar-editar-receta-btn").classList.remove("hidden");

  if (receta.costoAdicional) document.getElementById("receta-costo-adicional").value = receta.costoAdicional;
  if (receta.rinde) document.getElementById("receta-rinde").value = receta.rinde;
  if (receta.precioVenta) document.getElementById("receta-precio-venta").value = receta.precioVenta;

  receta.ingredientes.forEach(function(ing) {
    agregarFilaIngrediente({ ingredienteId: ing.ingredienteId, cantidad: ing.cantidad, unidad: ing.unidad });
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function eliminarReceta(id) {
  if (!recetasRef) { mostrarError("Firebase no está conectado."); return; }
  if (confirm("¿Estás seguro de eliminar esta receta?")) {
    recetasRef.doc(id).delete().catch(function(error) { mostrarError("Error al eliminar receta: " + error.message); });
  }
}

// ============================================================
// PRODUCCIÓN
// ============================================================

function llenarSelectReceta(selectedId) {
  const select = document.getElementById("produccion-receta-select");
  if (!select) return;
  var valueActual = selectedId || select.value;
  let html = '<option value="">Seleccionar receta...</option>';
  recetasData.forEach(function(r) {
    if (!r.rinde || !r.precioVenta || !r.harinaTanda) return;
    const selected = r.id === valueActual ? "selected" : "";
    html += '<option value="' + r.id + '" ' + selected + '>' + r.nombre + '</option>';
  });
  select.innerHTML = html;
}

function cargarRecetaProduccion() {
  const recetaId = document.getElementById("produccion-receta-select").value;
  const container = document.getElementById("produccion-ingredientes-container");
  const infoBox = document.getElementById("produccion-info");
  const resumenBox = document.getElementById("produccion-resumen");

  if (!recetaId) {
    container.innerHTML = '<p class="empty-prod-msg">Selecciona una receta para ver los ingredientes</p>';
    infoBox.classList.add("hidden");
    resumenBox.classList.add("hidden");
    document.getElementById("produccion-cantidad").value = "";
    return;
  }

  const receta = recetasData.find(function(r) { return r.id === recetaId; });
  if (!receta) return;

  infoBox.classList.remove("hidden");
  document.getElementById("prod-peso-tanda").textContent = receta.harinaTanda + " g";
  document.getElementById("prod-panes-tanda").textContent = receta.rinde + " panes";

  calcularProduccion();
}

function calcularProduccion() {
  const recetaId = document.getElementById("produccion-receta-select").value;
  const cantidad = parseFloat(document.getElementById("produccion-cantidad").value);
  const unidad = document.getElementById("produccion-unidad").value;
  const container = document.getElementById("produccion-ingredientes-container");
  const resumenBox = document.getElementById("produccion-resumen");

  if (!recetaId || isNaN(cantidad) || cantidad <= 0) {
    container.innerHTML = '<p class="empty-prod-msg">Ingresa una cantidad para calcular</p>';
    resumenBox.classList.add("hidden");
    return;
  }

  const receta = recetasData.find(function(r) { return r.id === recetaId; });
  if (!receta || !receta.harinaTanda || !receta.rinde) return;

  let gramosProducir = 0;
  let multiplicador = 0;

  if (unidad === "panes") {
    multiplicador = cantidad / receta.rinde;
    gramosProducir = receta.harinaTanda * multiplicador;
  } else {
    gramosProducir = convertirAGramos(cantidad, unidad);
    multiplicador = gramosProducir / receta.harinaTanda;
  }

  document.getElementById("prod-total-peso").textContent = Math.round(gramosProducir) + " g";
  document.getElementById("prod-total-panes").textContent = Math.round(multiplicador * receta.rinde) + " panes";
  document.getElementById("prod-multiplicador").textContent = multiplicador.toFixed(2) + "×";

  // Renderizar ingredientes escalados
  let html = "";
  let totalCosto = 0;

  receta.ingredientes.forEach(function(ing) {
    const cantEscalada = ing.cantidad * multiplicador;
    const costoEscalado = calcularCostoIngrediente(ing.ingredienteId, cantEscalada, ing.unidad);
    totalCosto += costoEscalado;

    let cantDisplay = cantEscalada;
    let unidDisplay = ing.unidad;
    if (cantEscalada >= 1000 && ing.unidad === "g") {
      cantDisplay = (cantEscalada / 1000).toFixed(2);
      unidDisplay = "kg";
    } else if (cantEscalada >= 500 && ing.unidad === "g") {
      cantDisplay = (cantEscalada / 500).toFixed(2);
      unidDisplay = "lb";
    }

    html += `
      <div class="prod-ingr-row">
        <span class="prod-ingr-nombre">${ing.nombre}</span>
        <span class="prod-ingr-base">${ing.cantidad} ${ing.unidad}</span>
        <span class="prod-ingr-arrow">→</span>
        <span class="prod-ingr-escala">${cantDisplay} ${unidDisplay}</span>
        <span class="prod-ingr-costo">$${costoEscalado.toFixed(2)}</span>
      </div>
    `;
  });

  container.innerHTML = html;

  // Resumen
  const costoAdicionalReceta = sanitizarNumero((receta.costoAdicional || 0) * multiplicador);
  const costoAdicionalExtra = sanitizarNumero(parseFloat(document.getElementById("produccion-costo-adicional").value) || 0);
  const costoAdicionalTotal = costoAdicionalReceta + costoAdicionalExtra;
  const panesProducidos = Math.round(sanitizarNumero(multiplicador * receta.rinde));
  const ingreso = sanitizarNumero(panesProducidos * receta.precioVenta);
  const costoTotal = sanitizarNumero(totalCosto + costoAdicionalTotal);
  const ganancia = sanitizarNumero(ingreso - costoTotal);
  const margen = sanitizarNumero(ingreso > 0 ? (ganancia / ingreso) * 100 : 0);

  document.getElementById("prod-costo-ingredientes").textContent = "$" + totalCosto.toFixed(2);
  document.getElementById("prod-costo-adicional-label").textContent = "$" + costoAdicionalTotal.toFixed(2);
  document.getElementById("prod-costo-total").textContent = "$" + costoTotal.toFixed(2);
  document.getElementById("prod-ingreso-panes").textContent = panesProducidos;
  document.getElementById("prod-precio-pan").textContent = receta.precioVenta;
  document.getElementById("prod-ingreso-total").textContent = "$" + ingreso.toFixed(2);
  document.getElementById("prod-ganancia").textContent = "$" + ganancia.toFixed(2);
  document.getElementById("prod-margen").textContent = margen.toFixed(1) + "%";

  resumenBox.classList.remove("hidden");
}

function editarProduccion(id) {
  var prod = produccionesData.find(function(p) { return p.id === id; });
  if (!prod) return;

  produccionEditandoId = id;
  document.getElementById("guardar-produccion-btn").textContent = "Actualizar producción";
  document.getElementById("cancelar-editar-produccion-btn").classList.remove("hidden");

  // Cambiar a pestaña Producción
  document.querySelectorAll(".tab").forEach(function(t) { t.classList.remove("active"); });
  document.querySelectorAll(".tab-panel").forEach(function(p) { p.classList.remove("active"); });
  document.querySelector('.tab[data-tab="produccion"]').classList.add("active");
  document.getElementById("seccion-produccion").classList.add("active");

  llenarSelectReceta(prod.recetaId);

  // Esperar a que se cargue la receta para setear valores
  setTimeout(function() {
    document.getElementById("produccion-cantidad").value = prod.cantidadProducida;
    document.getElementById("produccion-unidad").value = prod.unidadProduccion;
    if (prod.costoAdicionalExtra) {
      document.getElementById("produccion-costo-adicional").value = prod.costoAdicionalExtra;
    }
    cargarRecetaProduccion();
    calcularProduccion();
  }, 100);
}

function cancelarEditarProduccion() {
  produccionEditandoId = null;
  document.getElementById("guardar-produccion-btn").textContent = "Guardar producción";
  document.getElementById("cancelar-editar-produccion-btn").classList.add("hidden");
  document.getElementById("produccion-form").reset();
  document.getElementById("produccion-receta-select").value = "";
  document.getElementById("produccion-ingredientes-container").innerHTML = '<p class="empty-prod-msg">Selecciona una receta para ver los ingredientes</p>';
  document.getElementById("produccion-info").classList.add("hidden");
  document.getElementById("produccion-resumen").classList.add("hidden");
}

function guardarProduccion(evento) {
  evento.preventDefault();

  if (!produccionRef) { mostrarError("Firebase no está conectado."); return; }

  const recetaId = document.getElementById("produccion-receta-select").value;
  if (!recetaId) { mostrarToast("Selecciona una receta.", "warning"); return; }

  const receta = recetasData.find(function(r) { return r.id === recetaId; });
  if (!receta) return;

  const cantidad = parseFloat(document.getElementById("produccion-cantidad").value);
  const unidad = document.getElementById("produccion-unidad").value;
  if (isNaN(cantidad) || cantidad <= 0) { mostrarToast("Ingresa una cantidad válida.", "warning"); return; }

  let gramosProducir = 0;
  let multiplicador = 0;
  if (unidad === "panes") {
    multiplicador = cantidad / receta.rinde;
    gramosProducir = receta.harinaTanda * multiplicador;
  } else {
    gramosProducir = convertirAGramos(cantidad, unidad);
    multiplicador = gramosProducir / receta.harinaTanda;
  }

  const ingredientes = [];
  receta.ingredientes.forEach(function(ing) {
    const cantEscalada = ing.cantidad * multiplicador;
    const costoEscalado = calcularCostoIngrediente(ing.ingredienteId, cantEscalada, ing.unidad);
    ingredientes.push({
      ingredienteId: ing.ingredienteId,
      nombre: ing.nombre,
      cantidadBase: ing.cantidad,
      unidadBase: ing.unidad,
      cantidadEscalada: cantEscalada,
      costo: costoEscalado
    });
  });

  const costoAdicionalReceta = sanitizarNumero((receta.costoAdicional || 0) * multiplicador);
  const costoAdicionalExtra = sanitizarNumero(parseFloat(document.getElementById("produccion-costo-adicional").value) || 0);
  const costoAdicionalTotal = costoAdicionalReceta + costoAdicionalExtra;
  const totalIngredientes = sanitizarNumero(ingredientes.reduce(function(s, i) { return s + i.costo; }, 0));
  const costoTotal = sanitizarNumero(totalIngredientes + costoAdicionalTotal);
  const panesProducidos = Math.round(sanitizarNumero(multiplicador * receta.rinde));
  const ingreso = sanitizarNumero(panesProducidos * receta.precioVenta);
  const ganancia = sanitizarNumero(ingreso - costoTotal);
  const margen = sanitizarNumero(ingreso > 0 ? (ganancia / ingreso) * 100 : 0);
  var gramosRedondeados = Math.round(sanitizarNumero(gramosProducir));

  if (panesProducidos <= 0) {
    mostrarToast("Error: la producción no produce panes. Revisa la receta.", "error");
    return;
  }

  const ahora = new Date().toISOString();

  if (produccionEditandoId) {
    // Actualizar producción existente
    produccionRef.doc(produccionEditandoId).update({
      recetaId: receta.id,
      recetaNombre: receta.nombre,
      fecha: ahora,
      cantidadProducida: cantidad,
      unidadProduccion: unidad,
      multiplicador: multiplicador,
      gramosProducidos: gramosRedondeados,
      ingredientes: ingredientes,
      costoAdicionalReceta: costoAdicionalReceta,
      costoAdicionalExtra: costoAdicionalExtra,
      costoAdicional: costoAdicionalTotal,
      costoIngredientes: totalIngredientes,
      costoTotal: costoTotal,
      panesProducidos: panesProducidos,
      precioVentaPan: receta.precioVenta,
      ingreso: ingreso,
      ganancia: ganancia,
      margen: margen
    }).catch(function(error) { mostrarError("Error al actualizar producción: " + error.message); });

    mostrarToast("Producción actualizada: " + panesProducidos + " panes · Ganancia: $" + ganancia.toFixed(2), "success");
    cancelarEditarProduccion();
  } else {
    // Nueva producción
    produccionRef.add({
      recetaId: receta.id,
      recetaNombre: receta.nombre,
      fecha: ahora,
      cantidadProducida: cantidad,
      unidadProduccion: unidad,
      multiplicador: multiplicador,
      gramosProducidos: gramosRedondeados,
      ingredientes: ingredientes,
      costoAdicionalReceta: costoAdicionalReceta,
      costoAdicionalExtra: costoAdicionalExtra,
      costoAdicional: costoAdicionalTotal,
      costoIngredientes: totalIngredientes,
      costoTotal: costoTotal,
      panesProducidos: panesProducidos,
      precioVentaPan: receta.precioVenta,
      ingreso: ingreso,
      ganancia: ganancia,
      margen: margen
    }).catch(function(error) { mostrarError("Error al guardar producción: " + error.message); });

    // Limpiar formulario
    document.getElementById("produccion-form").reset();
    document.getElementById("produccion-receta-select").value = "";
    document.getElementById("produccion-ingredientes-container").innerHTML = '<p class="empty-prod-msg">Selecciona una receta para ver los ingredientes</p>';
    document.getElementById("produccion-info").classList.add("hidden");
    document.getElementById("produccion-resumen").classList.add("hidden");

    mostrarToast("Producción guardada: " + panesProducidos + " panes · Ganancia: $" + ganancia.toFixed(2), "success");
  }
}

// ============================================================
// HISTORIAL
// ============================================================

function esCorrupto(d) {
  var campos = ["panesProducidos", "costoIngredientes", "costoAdicional", "costoAdicionalReceta", "costoAdicionalExtra", "costoTotal", "ingreso", "ganancia", "margen"];
  return campos.some(function(c) {
    var v = d[c];
    return v != null && sanitizarNumero(v) !== v;
  });
}

function configurarListenerProducciones() {
  produccionRef.orderBy("fecha", "desc").onSnapshot(function(snapshot) {
    if (sessionStorage.getItem("autenticado") !== "true") return;
    produccionesData = [];
    var hayCorruptos = false;
    snapshot.forEach(function(doc) {
      const d = doc.data();
      var corrupto = esCorrupto(d);
      if (corrupto) hayCorruptos = true;
      produccionesData.push({
        id: doc.id,
        fecha: d.fecha,
        recetaNombre: d.recetaNombre,
        recetaId: d.recetaId,
        cantidadProducida: d.cantidadProducida,
        unidadProduccion: d.unidadProduccion,
        panesProducidos: corrupto ? 0 : sanitizarNumero(d.panesProducidos),
        costoIngredientes: corrupto ? 0 : sanitizarNumero(d.costoIngredientes),
        costoAdicional: corrupto ? 0 : sanitizarNumero(d.costoAdicional),
        costoAdicionalReceta: corrupto ? 0 : sanitizarNumero(d.costoAdicionalReceta),
        costoAdicionalExtra: corrupto ? 0 : sanitizarNumero(d.costoAdicionalExtra),
        costoTotal: corrupto ? 0 : sanitizarNumero(d.costoTotal),
        ingreso: corrupto ? 0 : sanitizarNumero(d.ingreso),
        ganancia: corrupto ? 0 : sanitizarNumero(d.ganancia),
        margen: corrupto ? 0 : sanitizarNumero(d.margen)
      });
    });
    if (hayCorruptos) {
      mostrarToast("Se detectaron producciones con datos corruptos (costos enormes). Revisa el historial y elimínalas.", "warning");
    }
    actualizarHistorial();
  }, function(error) {
    mostrarError("Error al cargar historial: " + error.message);
  });
}

function cambiarPeriodoHistorial(periodo) {
  historialPeriodo = periodo;
  historialPagina = 1;
  document.querySelectorAll(".historial-btn").forEach(function(b) {
    b.classList.toggle("active", b.dataset.period === periodo);
  });
  actualizarHistorial();
}

function filtrarProducciones(producciones, periodo) {
  var ahora = new Date();
  var inicio = new Date(ahora);

  switch (periodo) {
    case "today":
      inicio.setHours(0, 0, 0, 0);
      break;
    case "week":
      inicio.setDate(ahora.getDate() - 7);
      inicio.setHours(0, 0, 0, 0);
      break;
    case "month":
      inicio.setDate(1);
      inicio.setHours(0, 0, 0, 0);
      break;
    case "year":
      inicio.setMonth(0, 1);
      inicio.setHours(0, 0, 0, 0);
      break;
    default:
      return producciones;
  }

  return producciones.filter(function(p) {
    if (!p.fecha) return false;
    var f = new Date(p.fecha);
    if (isNaN(f.getTime())) return false;
    return f >= inicio && f <= ahora;
  });
}

function ordenarProducciones(lista, col, dir) {
  var copia = lista.slice();
  copia.sort(function(a, b) {
    var va, vb;
    switch (col) {
      case "fecha": va = a.fecha || ""; vb = b.fecha || ""; break;
      case "receta": va = (a.recetaNombre || "").toLowerCase(); vb = (b.recetaNombre || "").toLowerCase(); break;
      case "cantidad": va = a.cantidadProducida || 0; vb = b.cantidadProducida || 0; break;
      case "panes": va = a.panesProducidos || 0; vb = b.panesProducidos || 0; break;
      case "costo": va = a.costoTotal || 0; vb = b.costoTotal || 0; break;
      case "ingreso": va = a.ingreso || 0; vb = b.ingreso || 0; break;
      case "ganancia": va = a.ganancia || 0; vb = b.ganancia || 0; break;
      case "margen": va = a.margen || 0; vb = b.margen || 0; break;
      default: va = a.fecha || ""; vb = b.fecha || "";
    }
    if (typeof va === "string") {
      return dir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
    }
    return dir === "asc" ? va - vb : vb - va;
  });
  return copia;
}

function dibujarGrafica(porReceta) {
  var canvas = document.getElementById("historial-grafica");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  var rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width - 32;
  canvas.height = 200;

  var nombres = Object.keys(porReceta);
  if (nombres.length === 0) return;

  var w = canvas.width;
  var h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  var ganancias = nombres.map(function(n) { return porReceta[n].ganancia; });
  var maxGan = Math.max.apply(null, ganancias) || 1;
  var minGan = Math.min.apply(null, ganancias);
  var rango = maxGan - minGan || 1;

  var padding = { top: 20, bottom: 30, left: 10, right: 10 };
  var chartW = w - padding.left - padding.right;
  var chartH = h - padding.top - padding.bottom;
  var barW = Math.min(60, (chartW / nombres.length) * 0.7);
  var gap = (chartW - barW * nombres.length) / (nombres.length + 1);

  ctx.font = "12px " + getComputedStyle(document.body).fontFamily;
  ctx.textAlign = "center";

  nombres.forEach(function(nombre, i) {
    var g = porReceta[nombre].ganancia;
    var barH = (g / maxGan) * chartH;
    var x = padding.left + gap + i * (barW + gap);
    var y = padding.top + chartH - barH;

    // Barra
    var grad = ctx.createLinearGradient(x, y, x, padding.top + chartH);
    if (g >= 0) {
      grad.addColorStop(0, "#059669");
      grad.addColorStop(1, "#34d399");
    } else {
      grad.addColorStop(0, "#dc2626");
      grad.addColorStop(1, "#f87171");
    }
    ctx.fillStyle = grad;

    // Redondear esquinas superiores
    var r = 4;
    ctx.beginPath();
    ctx.moveTo(x, padding.top + chartH);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.lineTo(x + barW - r, y);
    ctx.quadraticCurveTo(x + barW, y, x + barW, y + r);
    ctx.lineTo(x + barW, padding.top + chartH);
    ctx.closePath();
    ctx.fill();

    // Etiqueta
    ctx.fillStyle = "#374151";
    ctx.font = "bold 11px " + getComputedStyle(document.body).fontFamily;
    var label = nombres.length <= 6 ? nombre : nombre.substring(0, 8) + "…";
    ctx.fillText(label, x + barW / 2, padding.top + chartH + 18);

    // Valor en la barra si es suficientemente alta
    if (barH > 20) {
      ctx.fillStyle = "white";
      ctx.font = "bold 11px " + getComputedStyle(document.body).fontFamily;
      ctx.fillText("$" + g.toFixed(0), x + barW / 2, y + 14);
    }
  });
}

function actualizarHistorial() {
  var section = document.getElementById("historial-section");
  if (!section || section.offsetParent === null) return;

  document.querySelectorAll(".historial-btn").forEach(function(b) {
    b.classList.toggle("active", b.dataset.period === historialPeriodo);
  });

  var filtradas = filtrarProducciones(produccionesData, historialPeriodo);
  var emptyMsg = document.getElementById("sin-historial");

  if (filtradas.length === 0) {
    document.getElementById("historial-resumen").classList.add("hidden");
    document.getElementById("historial-tabla-container").innerHTML = "";
    document.getElementById("historial-por-receta").innerHTML = "";
    document.getElementById("historial-grafica-container").style.display = "none";
    document.getElementById("historial-paginacion").innerHTML = "";
    emptyMsg.classList.remove("hidden");
    return;
  }
  emptyMsg.classList.add("hidden");
  document.getElementById("historial-resumen").classList.remove("hidden");
  document.getElementById("historial-grafica-container").style.display = "";

  // Resumen
  var totalPanes = 0, totalCosto = 0, totalIngreso = 0, totalGanancia = 0;
  filtradas.forEach(function(p) {
    totalPanes += p.panesProducidos;
    totalCosto += p.costoTotal;
    totalIngreso += p.ingreso;
    totalGanancia += p.ganancia;
  });
  var margenProm = totalIngreso > 0 ? (totalGanancia / totalIngreso) * 100 : 0;

  document.getElementById("hist-count").textContent = filtradas.length;
  document.getElementById("hist-panes").textContent = totalPanes;
  document.getElementById("hist-costo").textContent = "$" + totalCosto.toFixed(0);
  document.getElementById("hist-ingreso").textContent = "$" + totalIngreso.toFixed(0);
  document.getElementById("hist-ganancia").textContent = "$" + totalGanancia.toFixed(0);
  document.getElementById("hist-margen").textContent = margenProm.toFixed(1) + "%";

  // Ordenar
  var ordenadas = ordenarProducciones(filtradas, historialOrden.col, historialOrden.dir);

  // Paginación
  var totalPaginas = Math.ceil(ordenadas.length / historialPorPagina);
  if (historialPagina > totalPaginas) historialPagina = totalPaginas;
  var desde = (historialPagina - 1) * historialPorPagina;
  var hasta = Math.min(desde + historialPorPagina, ordenadas.length);
  var paginaActual = ordenadas.slice(desde, hasta);

  // Controles de paginación
  var pagHtml = "";
  if (totalPaginas > 1) {
    pagHtml += '<button class="pag-prev" ' + (historialPagina <= 1 ? "disabled" : "") + '>← Anterior</button>';
    pagHtml += '<span class="pag-info">Pág. ' + historialPagina + ' de ' + totalPaginas + ' (' + ordenadas.length + ' registros)</span>';
    pagHtml += '<button class="pag-next" ' + (historialPagina >= totalPaginas ? "disabled" : "") + '>Siguiente →</button>';
  }
  document.getElementById("historial-paginacion").innerHTML = pagHtml;

  // Cabeceras ordenables
  var cols = [
    { key: "fecha", label: "Fecha" },
    { key: "receta", label: "Receta" },
    { key: "cantidad", label: "Cantidad" },
    { key: "panes", label: "Panes" },
    { key: "costo", label: "Costo" },
    { key: "ingreso", label: "Ingreso" },
    { key: "ganancia", label: "Ganancia" },
    { key: "margen", label: "Margen" },
    { key: "acciones", label: "Acciones" }
  ];

  // Tabla detallada
  var html = '<div class="table-container"><table><thead><tr>';
  cols.forEach(function(col) {
    var clases = "sortable";
    if (col.key === historialOrden.col) {
      clases += " sort-" + historialOrden.dir;
    }
    var dataAttr = col.key !== "acciones" ? ' data-col="' + col.key + '"' : '';
    html += '<th class="' + clases + '"' + dataAttr + '>' + col.label + '</th>';
  });
  html += '</tr></thead><tbody>';

  paginaActual.forEach(function(p) {
    var fecha = p.fecha
      ? new Date(p.fecha).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })
      : "—";
    var cant = p.cantidadProducida + " " + p.unidadProduccion;
    var margenClase = p.margen > 0 ? "hist-verde" : "hist-rojo";
    html += '<tr>' +
      '<td>' + fecha + '</td>' +
      '<td><span class="hist-receta-nombre">' + p.recetaNombre + '</span></td>' +
      '<td>' + cant + '</td>' +
      '<td><strong>' + p.panesProducidos + '</strong></td>' +
      '<td>$' + p.costoTotal.toFixed(0) + '</td>' +
      '<td class="hist-verde">$' + p.ingreso.toFixed(0) + '</td>' +
      '<td class="' + margenClase + '">$' + p.ganancia.toFixed(0) + '</td>' +
      '<td>' + (p.margen || 0).toFixed(1) + '%</td>' +
      '<td><button class="btn-hist-editar" data-editar-id="' + p.id + '">Editar</button> <button class="btn-hist-eliminar" data-eliminar-id="' + p.id + '">Eliminar</button></td>' +
      '</tr>';
  });

  html += '</tbody></table></div>';
  document.getElementById("historial-tabla-container").innerHTML = html;

  // Por receta
  var porReceta = {};
  filtradas.forEach(function(p) {
    if (!porReceta[p.recetaNombre]) {
      porReceta[p.recetaNombre] = { veces: 0, panes: 0, costo: 0, ingreso: 0, ganancia: 0 };
    }
    porReceta[p.recetaNombre].veces++;
    porReceta[p.recetaNombre].panes += p.panesProducidos;
    porReceta[p.recetaNombre].costo += p.costoTotal;
    porReceta[p.recetaNombre].ingreso += p.ingreso;
    porReceta[p.recetaNombre].ganancia += p.ganancia;
  });

  var recetaHtml = '<div class="table-container"><table><thead><tr>' +
    '<th>Receta</th><th>Veces</th><th>Panes</th><th>Costo</th><th>Ingreso</th><th>Ganancia</th><th>Margen</th>' +
    '</tr></thead><tbody>';

  var recetasOrdenadas = Object.keys(porReceta).sort();
  recetasOrdenadas.forEach(function(nombre) {
    var r = porReceta[nombre];
    var margenR = r.ingreso > 0 ? (r.ganancia / r.ingreso) * 100 : 0;
    recetaHtml += '<tr>' +
      '<td><strong>' + nombre + '</strong></td>' +
      '<td>' + r.veces + '</td>' +
      '<td>' + r.panes + '</td>' +
      '<td>$' + r.costo.toFixed(0) + '</td>' +
      '<td class="hist-verde">$' + r.ingreso.toFixed(0) + '</td>' +
      '<td class="' + (margenR > 0 ? "hist-verde" : "hist-rojo") + '">$' + r.ganancia.toFixed(0) + '</td>' +
      '<td>' + margenR.toFixed(1) + '%</td>' +
      '</tr>';
  });

  recetaHtml += '</tbody></table></div>';
  document.getElementById("historial-por-receta").innerHTML = recetaHtml;

  // Gráfica
  dibujarGrafica(porReceta);
}

// Eventos de historial
document.addEventListener("click", function(e) {
  var btn = e.target.closest(".historial-btn");
  if (btn) cambiarPeriodoHistorial(btn.dataset.period);

  // Ordenar columna
  var th = e.target.closest("th.sortable[data-col]");
  if (th) {
    var col = th.dataset.col;
    if (historialOrden.col === col) {
      historialOrden.dir = historialOrden.dir === "asc" ? "desc" : "asc";
    } else {
      historialOrden.col = col;
      historialOrden.dir = "desc";
    }
    historialPagina = 1;
    actualizarHistorial();
  }

  // Paginación
  var prev = e.target.closest(".pag-prev");
  if (prev && !prev.disabled) {
    historialPagina--;
    actualizarHistorial();
  }
  var next = e.target.closest(".pag-next");
  if (next && !next.disabled) {
    historialPagina++;
    actualizarHistorial();
  }

  // Editar producción
  var editar = e.target.closest("[data-editar-id]");
  if (editar) editarProduccion(editar.dataset.editarId);

  // Eliminar producción
  var eliminar = e.target.closest("[data-eliminar-id]");
  if (eliminar) eliminarProduccion(eliminar.dataset.eliminarId);
});

function eliminarProduccion(id) {
  if (!confirm("¿Estás seguro de eliminar esta producción?")) return;
  if (!produccionRef) { mostrarError("Firebase no está conectado."); return; }
  produccionRef.doc(id).delete().catch(function(error) {
    mostrarError("Error al eliminar producción: " + error.message);
  });
}

// ============================================================
// VENTAS
// ============================================================

function configurarListenerClientes() {
  clientesRef.orderBy("nombre", "asc").onSnapshot(function(snapshot) {
    if (sessionStorage.getItem("autenticado") !== "true") return;
    clientesData = [];
    snapshot.forEach(function(doc) {
      var d = doc.data();
      clientesData.push({
        id: doc.id,
        nombre: d.nombre || "",
        telefono: d.telefono || "",
        direccion: d.direccion || "",
        barrio: d.barrio || ""
      });
    });
    renderClientes();
    llenarSelectClienteVenta();
  }, function(error) {
    mostrarError("Error al cargar clientes: " + error.message);
  });
}

function configurarListenerVentas() {
  ventasRef.orderBy("fechaCreacion", "desc").onSnapshot(function(snapshot) {
    if (sessionStorage.getItem("autenticado") !== "true") return;
    ventasData = [];
    snapshot.forEach(function(doc) {
      var d = doc.data();
      ventasData.push({
        id: doc.id,
        clienteId: d.clienteId || "",
        clienteNombre: d.clienteNombre || "",
        fecha: d.fecha || "",
        items: d.items || [],
        total: d.total || 0
      });
    });
    renderVentas();
  }, function(error) {
    mostrarError("Error al cargar ventas: " + error.message);
  });
}

function llenarSelectClienteVenta() {
  var select = document.getElementById("venta-cliente-select");
  if (!select) return;
  var html = '<option value="">Sin cliente</option>';
  clientesData.forEach(function(c) {
    html += '<option value="' + c.id + '">' + c.nombre + '</option>';
  });
  select.innerHTML = html;
}

// ------------------------------------------------------------------
// CRUD CLIENTES
// ------------------------------------------------------------------

function guardarCliente(evento) {
  evento.preventDefault();
  if (!clientesRef) { mostrarError("Firebase no está conectado."); return; }

  var nombre = document.getElementById("cliente-nombre-input").value.trim();
  if (!nombre) { mostrarToast("Ingresa el nombre del cliente.", "warning"); return; }

  var data = {
    nombre: nombre,
    telefono: document.getElementById("cliente-telefono-input").value.trim(),
    direccion: document.getElementById("cliente-direccion-input").value.trim(),
    barrio: document.getElementById("cliente-barrio-input").value.trim(),
    fecha: new Date().toISOString()
  };

  if (clienteEditandoId) {
    clientesRef.doc(clienteEditandoId).update(data).catch(function(e) {
      mostrarError("Error al actualizar cliente: " + e.message);
    });
    cancelarEditarCliente();
  } else {
    clientesRef.add(data).catch(function(e) {
      mostrarError("Error al guardar cliente: " + e.message);
    });
    document.getElementById("clientes-form").reset();
  }
}

function editarCliente(id) {
  var c = clientesData.find(function(x) { return x.id === id; });
  if (!c) return;
  clienteEditandoId = id;
  document.getElementById("cliente-nombre-input").value = c.nombre;
  document.getElementById("cliente-telefono-input").value = c.telefono;
  document.getElementById("cliente-direccion-input").value = c.direccion;
  document.getElementById("cliente-barrio-input").value = c.barrio;
  document.getElementById("cancelar-editar-cliente-btn").classList.remove("hidden");
}

function cancelarEditarCliente() {
  clienteEditandoId = null;
  document.getElementById("clientes-form").reset();
  document.getElementById("cancelar-editar-cliente-btn").classList.add("hidden");
}

function eliminarCliente(id) {
  if (!confirm("¿Estás seguro de eliminar este cliente?")) return;
  if (!clientesRef) { mostrarError("Firebase no está conectado."); return; }
  clientesRef.doc(id).delete().catch(function(e) {
    mostrarError("Error al eliminar cliente: " + e.message);
  });
}

function renderClientes() {
  var tbody = document.getElementById("clientes-lista");
  var empty = document.getElementById("sin-clientes");
  if (!tbody) return;

  if (clientesData.length === 0) {
    tbody.innerHTML = "";
    if (empty) empty.classList.remove("hidden");
    return;
  }
  if (empty) empty.classList.add("hidden");

  var html = "";
  clientesData.forEach(function(c) {
    html += '<tr>' +
      '<td><span class="nombre-ingrediente">' + escHtml(c.nombre) + '</span></td>' +
      '<td>' + escHtml(c.telefono) + '</td>' +
      '<td>' + escHtml(c.barrio) + '</td>' +
      '<td>' + escHtml(c.direccion) + '</td>' +
      '<td class="acciones">' +
        '<button class="btn-editar" data-cliente-editar="' + c.id + '">Editar</button>' +
        '<button class="btn-eliminar" data-cliente-eliminar="' + c.id + '">Eliminar</button>' +
      '</td></tr>';
  });
  tbody.innerHTML = html;
}

// ------------------------------------------------------------------
// CRUD VENTAS
// ------------------------------------------------------------------

var ventaItemsCount = 0;

function agregarItemVenta(recetaId, cantidad, precioUnitario) {
  var container = document.getElementById("venta-items-container");
  var emptyMsg = container.querySelector(".empty-venta-msg");
  if (emptyMsg) emptyMsg.remove();

  ventaItemsCount++;
  var index = ventaItemsCount;

  var html = '<div class="venta-item-row" data-venta-item="' + index + '">';

  html += '<div class="form-group" style="flex:2">';
  html += '  <label>Producto</label>';
  html += '  <select class="venta-item-receta" data-item-index="' + index + '">';
  html += '    <option value="">Seleccionar...</option>';
  recetasData.forEach(function(r) {
    if (!r.precioVenta) return;
    var sel = r.id === recetaId ? "selected" : "";
    html += '    <option value="' + r.id + '" data-precio="' + (r.precioVenta || 0) + '" ' + sel + '>' + r.nombre + '</option>';
  });
  html += '  </select>';
  html += '</div>';

  html += '<div class="form-group">';
  html += '  <label>Cantidad</label>';
  html += '  <input type="number" class="venta-item-cantidad" data-item-index="' + index + '" value="' + (cantidad || "") + '" min="1" step="1" placeholder="0" />';
  html += '</div>';

  html += '<div class="form-group">';
  html += '  <label>Precio unit.</label>';
  html += '  <input type="number" class="venta-item-precio" data-item-index="' + index + '" value="' + (precioUnitario || "") + '" step="0.01" min="0" placeholder="0" />';
  html += '</div>';

  html += '<div class="venta-item-subtotal" data-item-index="' + index + '">$0.00</div>';

  html += '<button type="button" class="btn-quitar-item-venta" data-venta-quitar="' + index + '">×</button>';

  html += '</div>';

  container.insertAdjacentHTML("beforeend", html);
  calcularTotalVenta();
}

function calcularTotalVenta() {
  var rows = document.querySelectorAll(".venta-item-row");
  var total = 0;
  rows.forEach(function(row) {
    var index = row.dataset.ventaItem;
    var select = row.querySelector(".venta-item-receta");
    var cantidad = parseFloat(row.querySelector(".venta-item-cantidad").value) || 0;
    var precio = parseFloat(row.querySelector(".venta-item-precio").value) || 0;
    var subtotal = cantidad * precio;
    total += subtotal;
    var subEl = row.querySelector(".venta-item-subtotal");
    if (subEl) subEl.textContent = "$" + subtotal.toFixed(2);
  });
  document.getElementById("venta-total-valor").textContent = "$" + total.toFixed(2);
}

function guardarVenta(evento) {
  evento.preventDefault();
  if (!ventasRef) { mostrarError("Firebase no está conectado."); return; }

  var items = [];
  var rows = document.querySelectorAll(".venta-item-row");
  rows.forEach(function(row) {
    var select = row.querySelector(".venta-item-receta");
    var recetaId = select.value;
    if (!recetaId) return;
    var opt = select.options[select.selectedIndex];
    items.push({
      recetaId: recetaId,
      recetaNombre: opt.text,
      cantidad: parseFloat(row.querySelector(".venta-item-cantidad").value) || 0,
      precioUnitario: parseFloat(row.querySelector(".venta-item-precio").value) || 0,
      subtotal: (parseFloat(row.querySelector(".venta-item-cantidad").value) || 0) * (parseFloat(row.querySelector(".venta-item-precio").value) || 0)
    });
  });

  if (items.length === 0) { mostrarToast("Agrega al menos un producto a la venta.", "warning"); return; }

  var total = items.reduce(function(s, i) { return s + i.subtotal; }, 0);
  var clienteSelect = document.getElementById("venta-cliente-select");
  var clienteId = clienteSelect.value;
  var clienteNombre = clienteId ? clienteSelect.options[clienteSelect.selectedIndex].text : "";

  var data = {
    clienteId: clienteId,
    clienteNombre: clienteNombre,
    fecha: document.getElementById("venta-fecha-input").value || fechaHoyLocal(),
    items: items,
    total: total,
    fechaCreacion: new Date().toISOString()
  };

  if (ventaEditandoId) {
    ventasRef.doc(ventaEditandoId).update(data).catch(function(e) {
      mostrarError("Error al actualizar venta: " + e.message);
    });
    mostrarToast("Venta actualizada: $" + total.toFixed(2), "success");
    cancelarEditarVenta();
  } else {
    ventasRef.add(data).catch(function(e) {
      mostrarError("Error al guardar venta: " + e.message);
    });
    limpiarFormVenta();
    mostrarToast("Venta guardada: $" + total.toFixed(2), "success");
  }
}

function editarVenta(id) {
  var v = ventasData.find(function(x) { return x.id === id; });
  if (!v) return;

  ventaEditandoId = id;
  document.getElementById("cancelar-editar-venta-btn").classList.remove("hidden");
  document.querySelector("#ventas-section h2").textContent = "Editar venta";

  // Cliente
  if (v.clienteId) {
    document.getElementById("venta-cliente-select").value = v.clienteId;
  }

  // Fecha
  var fechaInput = document.getElementById("venta-fecha-input");
  if (v.fecha) {
    fechaInput.value = v.fecha;
  }

  // Items
  var container = document.getElementById("venta-items-container");
  container.innerHTML = "";
  ventaItemsCount = 0;
  (v.items || []).forEach(function(item) {
    agregarItemVenta(item.recetaId, item.cantidad, item.precioUnitario);
  });

  calcularTotalVenta();
}

function cancelarEditarVenta() {
  ventaEditandoId = null;
  document.getElementById("cancelar-editar-venta-btn").classList.add("hidden");
  document.querySelector("#ventas-section h2").textContent = "Registrar venta";
  limpiarFormVenta();
}

function limpiarFormVenta() {
  document.getElementById("ventas-form").reset();
  var container = document.getElementById("venta-items-container");
  container.innerHTML = '<p class="empty-venta-msg">Agrega productos a la venta</p>';
  ventaItemsCount = 0;
  document.getElementById("venta-total-valor").textContent = "$0.00";
  // Restaurar fecha a hoy
  document.getElementById("venta-fecha-input").value = fechaHoyLocal();
}

function eliminarVenta(id) {
  if (!confirm("¿Estás seguro de eliminar esta venta?")) return;
  if (!ventasRef) { mostrarError("Firebase no está conectado."); return; }
  ventasRef.doc(id).delete().catch(function(e) {
    mostrarError("Error al eliminar venta: " + e.message);
  });
}

function cambiarPeriodoVentas(periodo) {
  ventasPeriodo = periodo;
  document.querySelectorAll(".ventas-periodo").forEach(function(b) {
    b.classList.toggle("active", b.dataset.periodo === periodo);
  });
  renderVentas();
}

function renderVentas() {
  var tbody = document.getElementById("ventas-lista");
  var resumen = document.getElementById("ventas-resumen");
  var empty = document.getElementById("sin-ventas");
  if (!tbody) return;

  document.querySelectorAll(".ventas-periodo").forEach(function(b) {
    b.classList.toggle("active", b.dataset.periodo === ventasPeriodo);
  });

  var filtradas = filtrarProducciones(ventasData, ventasPeriodo);

  if (filtradas.length === 0) {
    tbody.innerHTML = "";
    if (resumen) resumen.classList.add("hidden");
    if (empty) empty.classList.remove("hidden");
    return;
  }
  if (empty) empty.classList.add("hidden");
  if (resumen) resumen.classList.remove("hidden");

  // Resumen
  var total = 0, maxVenta = 0;
  filtradas.forEach(function(v) {
    total += v.total || 0;
    if ((v.total || 0) > maxVenta) maxVenta = v.total;
  });
  var promedio = total / filtradas.length;

  document.getElementById("ventas-res-count").textContent = filtradas.length;
  document.getElementById("ventas-res-total").textContent = "$" + total.toFixed(0);
  document.getElementById("ventas-res-promedio").textContent = "$" + promedio.toFixed(0);
  document.getElementById("ventas-res-max").textContent = "$" + maxVenta.toFixed(0);

  // Tabla
  var html = "";
  filtradas.forEach(function(v) {
    var fecha = v.fecha || "—";
    var prodLabels = (v.items || []).map(function(i) {
      return i.cantidad + " × " + i.recetaNombre;
    }).join(", ");
    if (prodLabels.length > 60) prodLabels = prodLabels.substring(0, 57) + "…";

    html += '<tr>' +
      '<td>' + fecha + '</td>' +
      '<td>' + escHtml(v.clienteNombre || "—") + '</td>' +
      '<td>' + escHtml(prodLabels) + '</td>' +
      '<td><strong>$' + (v.total || 0).toFixed(0) + '</strong></td>' +
      '<td class="acciones">' +
        '<button class="btn-venta-editar" data-venta-editar="' + v.id + '">Editar</button>' +
        '<button class="btn-venta-eliminar" data-venta-eliminar="' + v.id + '">Eliminar</button>' +
      '</td></tr>';
  });
  tbody.innerHTML = html;
}

function escHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Eventos delegados de Ventas
document.addEventListener("change", function(e) {
  var select = e.target.closest(".venta-item-receta");
  if (select) {
    var row = select.closest(".venta-item-row");
    if (row) {
      var opt = select.options[select.selectedIndex];
      var precio = opt && opt.dataset.precio ? parseFloat(opt.dataset.precio) : 0;
      var precioInput = row.querySelector(".venta-item-precio");
      if (precioInput && precio > 0) precioInput.value = precio.toFixed(2);
      calcularTotalVenta();
    }
  }
});

document.addEventListener("input", function(e) {
  if (e.target.closest(".venta-item-cantidad") || e.target.closest(".venta-item-precio")) {
    calcularTotalVenta();
  }
});

document.addEventListener("click", function(e) {
  var quitar = e.target.closest("[data-venta-quitar]");
  if (quitar) {
    var row = quitar.closest(".venta-item-row");
    if (row) row.remove();
    calcularTotalVenta();
    var container = document.getElementById("venta-items-container");
    if (!container.querySelector(".venta-item-row")) {
      container.innerHTML = '<p class="empty-venta-msg">Agrega productos a la venta</p>';
    }
  }

  var editarClienteBtn = e.target.closest("[data-cliente-editar]");
  if (editarClienteBtn) editarCliente(editarClienteBtn.dataset.clienteEditar);

  var eliminarClienteBtn = e.target.closest("[data-cliente-eliminar]");
  if (eliminarClienteBtn) eliminarCliente(eliminarClienteBtn.dataset.clienteEliminar);

  var editarVentaBtn = e.target.closest("[data-venta-editar]");
  if (editarVentaBtn) editarVenta(editarVentaBtn.dataset.ventaEditar);

  var eliminarVentaBtn = e.target.closest("[data-venta-eliminar]");
  if (eliminarVentaBtn) eliminarVenta(eliminarVentaBtn.dataset.ventaEliminar);

  var ventaPeriodoBtn = e.target.closest(".ventas-periodo");
  if (ventaPeriodoBtn) cambiarPeriodoVentas(ventaPeriodoBtn.dataset.periodo);

  var estPeriodoBtn = e.target.closest(".est-periodo");
  if (estPeriodoBtn) cambiarPeriodoEst(estPeriodoBtn.dataset.periodo);

  var estCard = e.target.closest(".est-card");
  if (estCard) {
    var label = estCard.querySelector(".hist-card-label");
    var tipo = label && label.textContent.trim().toLowerCase();
    if (tipo === "ventas") mostrarDetalleCard("ventas");
    else if (tipo === "total vendido") mostrarDetalleCard("total");
    else if (tipo === "promedio") mostrarDetalleCard("promedio");
    else if (tipo === "venta mayor") mostrarDetalleCard("max");
    else if (tipo === "más vendido") mostrarDetalleCard("top-producto");
    else if (tipo === "top cliente") mostrarDetalleCard("top-cliente");
  }
});

// ============================================================
// ESTADÍSTICAS
// ============================================================

var estPeriodo = "month";
var estFiltradas = [];
var estStats = {};

function cambiarPeriodoEst(periodo) {
  estPeriodo = periodo;
  document.querySelectorAll(".est-periodo").forEach(function(b) {
    b.classList.toggle("active", b.dataset.periodo === periodo);
  });
  renderEstadisticas();
}

function renderEstadisticas() {
  var section = document.getElementById("estadisticas-section");
  if (!section || section.offsetParent === null) return;

  document.querySelectorAll(".est-periodo").forEach(function(b) {
    b.classList.toggle("active", b.dataset.periodo === estPeriodo);
  });

  var ventasFiltradas = filtrarProducciones(ventasData, estPeriodo);
  var prodFiltradas = filtrarProducciones(produccionesData, estPeriodo);
  estFiltradas = ventasFiltradas;
  var emptyMsg = document.getElementById("sin-est");

  var hayVentas = ventasFiltradas.length > 0;
  var hayProduccion = prodFiltradas.length > 0;

  if (!hayVentas && !hayProduccion) {
    document.getElementById("est-resumen").classList.add("hidden");
    document.getElementById("est-prod-resumen").classList.add("hidden");
    document.getElementById("est-financiero-resumen").classList.add("hidden");
    document.getElementById("est-grafica-container").style.display = "none";
    document.getElementById("est-por-producto").innerHTML = "";
    document.getElementById("est-por-dia").innerHTML = "";
    emptyMsg.classList.remove("hidden");
    return;
  }
  emptyMsg.classList.add("hidden");
  document.getElementById("est-grafica-container").style.display = "";

  // ===== VENTAS =====
  document.getElementById("est-resumen").classList.toggle("hidden", !hayVentas);
  if (hayVentas) {
    var total = 0, maxVenta = 0, maxVentaId = null;
    var prodCount = {};
    var clienteTotales = {};
    ventasFiltradas.forEach(function(v) {
      total += v.total || 0;
      if ((v.total || 0) > maxVenta) {
        maxVenta = v.total;
        maxVentaId = v.id;
      }
      (v.items || []).forEach(function(item) {
        prodCount[item.recetaNombre] = (prodCount[item.recetaNombre] || 0) + item.cantidad;
      });
      if (v.clienteNombre) {
        clienteTotales[v.clienteNombre] = (clienteTotales[v.clienteNombre] || 0) + (v.total || 0);
      }
    });
    var promedio = total / ventasFiltradas.length;

    var topProducto = Object.keys(prodCount).length
      ? Object.keys(prodCount).reduce(function(a, b) { return prodCount[a] > prodCount[b] ? a : b; })
      : null;
    var topCliente = Object.keys(clienteTotales).length
      ? Object.keys(clienteTotales).reduce(function(a, b) { return clienteTotales[a] > clienteTotales[b] ? a : b; })
      : null;

    estStats = {
      total: total,
      maxVenta: maxVenta,
      maxVentaId: maxVentaId,
      promedio: promedio,
      prodCount: prodCount,
      topProducto: topProducto,
      clienteTotales: clienteTotales,
      topCliente: topCliente
    };

    document.getElementById("est-count").textContent = ventasFiltradas.length;
    document.getElementById("est-total").textContent = "$" + total.toFixed(0);
    document.getElementById("est-promedio").textContent = "$" + promedio.toFixed(0);
    document.getElementById("est-max").textContent = "$" + maxVenta.toFixed(0);
    document.getElementById("est-top-producto").textContent = topProducto || "—";
    document.getElementById("est-top-cliente").textContent = topCliente || "—";
  }

  // ===== PRODUCCIÓN =====
  document.getElementById("est-prod-resumen").classList.toggle("hidden", !hayProduccion);
  if (hayProduccion) {
    var prodCountTotal = prodFiltradas.length;
    var prodInversion = 0, prodGastos = 0, prodCostoTotal = 0;
    var prodIngreso = 0, prodGanancia = 0;

    prodFiltradas.forEach(function(p) {
      prodInversion += p.costoIngredientes || 0;
      prodGastos += p.costoAdicional || 0;
      prodCostoTotal += p.costoTotal || 0;
      prodIngreso += p.ingreso || 0;
      prodGanancia += p.ganancia || 0;
    });

    document.getElementById("est-prod-count").textContent = prodCountTotal;
    document.getElementById("est-prod-inversion").textContent = "$" + prodInversion.toFixed(0);
    document.getElementById("est-prod-gastos").textContent = "$" + prodGastos.toFixed(0);
    document.getElementById("est-prod-costo").textContent = "$" + prodCostoTotal.toFixed(0);
    document.getElementById("est-prod-ingreso").textContent = "$" + prodIngreso.toFixed(0);
    var prodGananciaEl = document.getElementById("est-prod-ganancia");
    prodGananciaEl.textContent = "$" + prodGanancia.toFixed(0);
    prodGananciaEl.className = "hist-card-valor " + (prodGanancia >= 0 ? "hist-verde" : "hist-rojo");
  }

  // ===== RESUMEN FINANCIERO =====
  document.getElementById("est-financiero-resumen").classList.toggle("hidden", !hayProduccion && !hayVentas);
  if (hayProduccion || hayVentas) {
    var ingresoReal = hayVentas ? ventasFiltradas.reduce(function(s, v) { return s + (v.total || 0); }, 0) : 0;
    var costoProd = hayProduccion ? prodFiltradas.reduce(function(s, p) { return s + (p.costoTotal || 0); }, 0) : 0;
    var gananciaNeta = ingresoReal - costoProd;
    var margenNeto = ingresoReal > 0 ? (gananciaNeta / ingresoReal) * 100 : 0;

    document.getElementById("est-fin-ingreso").textContent = "$" + ingresoReal.toFixed(0);
    document.getElementById("est-fin-costo").textContent = "$" + costoProd.toFixed(0);

    var gananciaNetaEl = document.getElementById("est-fin-ganancia");
    gananciaNetaEl.textContent = "$" + gananciaNeta.toFixed(0);
    gananciaNetaEl.className = "hist-card-valor " + (gananciaNeta >= 0 ? "hist-verde" : "hist-rojo");

    document.getElementById("est-fin-margen").textContent = margenNeto.toFixed(1) + "%";
  }

  // Gráfica de barras (ventas totales por día)
  dibujarGraficaEst(ventasFiltradas);

  // Por producto
  renderEstPorProducto(ventasFiltradas);

  // Por día de la semana
  renderEstPorDia(ventasFiltradas);
}

function renderEstPorProducto(ventas) {
  var porProd = {};
  ventas.forEach(function(v) {
    (v.items || []).forEach(function(item) {
      if (!porProd[item.recetaNombre]) {
        porProd[item.recetaNombre] = { unidades: 0, total: 0 };
      }
      porProd[item.recetaNombre].unidades += item.cantidad;
      porProd[item.recetaNombre].total += item.subtotal;
    });
  });

  var nombres = Object.keys(porProd);
  if (nombres.length === 0) {
    document.getElementById("est-por-producto").innerHTML = "";
    return;
  }

  nombres.sort(function(a, b) { return porProd[b].total - porProd[a].total; });
  var maxTotal = porProd[nombres[0]].total || 1;

  var html = '<div class="est-barras-h">';
  nombres.forEach(function(n, i) {
    var p = porProd[n];
    var prom = p.unidades > 0 ? p.total / p.unidades : 0;
    var pct = (p.total / maxTotal) * 100;
    var opacidad = 0.35 + (1 - i / nombres.length) * 0.65;
    var delay = i * 60;
    html += '<div class="est-bh-fila" style="animation-delay:' + delay + 'ms">' +
      '<div class="est-bh-izq">' +
        '<span class="est-bh-nombre">' + n + '</span>' +
        '<span class="est-bh-detalle">' + p.unidades + ' unid  •  $' + prom.toFixed(0) + '/u</span>' +
      '</div>' +
      '<div class="est-bh-pista">' +
        '<div class="est-bh-barra" style="width:' + pct + '%;opacity:' + opacidad + ';transition-delay:' + delay + 'ms">' +
          '<span class="est-bh-monto">' + formatearDinero(p.total) + '</span>' +
        '</div>' +
      '</div>' +
    '</div>';
  });
  html += '</div>';
  document.getElementById("est-por-producto").innerHTML = html;
}

function renderEstPorDia(ventas) {
  var diasCorto = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
  var porDia = {};
  for (var i = 0; i < 7; i++) porDia[i] = { count: 0, total: 0 };

  ventas.forEach(function(v) {
    if (!v.fecha) return;
    var parts = v.fecha.split("-");
    var d = parts.length === 3 ? new Date(+parts[0], +parts[1] - 1, +parts[2]) : new Date(v.fecha);
    if (isNaN(d.getTime())) return;
    porDia[d.getDay()].count++;
    porDia[d.getDay()].total += v.total || 0;
  });

  var maxTotal = 0;
  for (var i = 0; i < 7; i++) {
    if (porDia[i].total > maxTotal) maxTotal = porDia[i].total;
  }
  if (maxTotal === 0) maxTotal = 1;

  var html = '<div class="est-semana">';
  for (var i = 0; i < 7; i++) {
    var d = porDia[i];
    var pct = (d.total / maxTotal) * 100;
    var barH = Math.max(pct, 3);
    var delay = i * 80;
    html += '<div class="est-semana-col" style="animation-delay:' + delay + 'ms">' +
      '<div class="est-semana-valor">' + formatearDinero(d.total) + '</div>' +
      '<div class="est-semana-barra-wrap">' +
        '<div class="est-semana-barra" style="height:' + barH + '%;transition-delay:' + delay + 'ms"></div>' +
      '</div>' +
      '<div class="est-semana-nombre">' + diasCorto[i] + '</div>' +
      '<div class="est-semana-count">' + d.count + '</div>' +
    '</div>';
  }
  html += '</div>';
  document.getElementById("est-por-dia").innerHTML = html;
}

function dibujarGraficaEst(ventas) {
  var canvas = document.getElementById("est-grafica");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  var container = canvas.parentElement;
  var rect = container.getBoundingClientRect();
  var dpr = window.devicePixelRatio || 1;
  var w = rect.width - 32, h = 260;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + "px";
  canvas.style.height = h + "px";
  ctx.scale(dpr, dpr);

  // Agrupar por día
  var grupos = {};
  var fechasOrden = [];
  ventas.forEach(function(v) {
    if (!v.fecha) return;
    var parts = v.fecha.split("-");
    var d = parts.length === 3 ? new Date(+parts[0], +parts[1] - 1, +parts[2]) : new Date(v.fecha);
    if (isNaN(d.getTime())) return;
    var key = d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
    if (!grupos[key]) fechasOrden.push(key);
    grupos[key] = (grupos[key] || 0) + (v.total || 0);
  });

  var nombres = fechasOrden;
  if (nombres.length === 0) return;

  ctx.clearRect(0, 0, w, h);

  var valores = nombres.map(function(n) { return grupos[n]; });
  var maxVal = Math.max.apply(null, valores) || 1;

  var roundTo = Math.pow(10, Math.floor(Math.log10(maxVal)));
  var yMax = Math.ceil(maxVal / roundTo) * roundTo;
  if (yMax === 0) yMax = 1;

  var padding = { top: 28, bottom: 38, left: 56, right: 20 };
  var chartW = w - padding.left - padding.right;
  var chartH = h - padding.top - padding.bottom;
  var barW = Math.min(44, (chartW / nombres.length) * 0.55);
  var gap = (chartW - barW * nombres.length) / (nombres.length + 1);
  var fontFamily = getComputedStyle(document.body).fontFamily;

  // Fondo blanco redondeado
  ctx.fillStyle = "#fafafa";
  roundRect(ctx, 0, 0, w, h, 12);
  ctx.fill();

  // Grid + Y axis
  var numLines = 4;
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 1;
  for (var i = 0; i <= numLines; i++) {
    var yVal = (yMax / numLines) * i;
    var yPos = padding.top + chartH - (yVal / yMax) * chartH;
    ctx.beginPath();
    ctx.moveTo(padding.left - 4, yPos);
    ctx.lineTo(w - padding.right, yPos);
    ctx.stroke();
    ctx.fillStyle = "#9ca3af";
    ctx.font = "11px " + fontFamily;
    ctx.fillText("$" + yVal.toFixed(0), padding.left - 10, yPos);
  }
  ctx.textBaseline = "alphabetic";

  // Eje X
  ctx.strokeStyle = "#d1d5db";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top + chartH + 0.5);
  ctx.lineTo(w - padding.right, padding.top + chartH + 0.5);
  ctx.stroke();

  ctx.textAlign = "center";

  // Animación: barras crecen
  var animProgress = 0, animStart = null, animDuration = 350;

  function step(timestamp) {
    if (!animStart) animStart = timestamp;
    var elapsed = timestamp - animStart;
    animProgress = Math.min(elapsed / animDuration, 1);

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#fafafa";
    roundRect(ctx, 0, 0, w, h, 12);
    ctx.fill();

    // Grid
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 1;
    for (var i = 0; i <= numLines; i++) {
      var yVal = (yMax / numLines) * i;
      var yPos = padding.top + chartH - (yVal / yMax) * chartH;
      ctx.beginPath();
      ctx.moveTo(padding.left - 4, yPos);
      ctx.lineTo(w - padding.right, yPos);
      ctx.stroke();
      ctx.fillStyle = "#9ca3af";
      ctx.font = "11px " + fontFamily;
      ctx.fillText("$" + yVal.toFixed(0), padding.left - 10, yPos);
    }
    ctx.textBaseline = "alphabetic";

    ctx.strokeStyle = "#d1d5db";
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top + chartH + 0.5);
    ctx.lineTo(w - padding.right, padding.top + chartH + 0.5);
    ctx.stroke();

    ctx.textAlign = "center";

    nombres.forEach(function(nombre, i) {
      var val = grupos[nombre];
      var barH = (val / yMax) * chartH * animProgress;
      var x = padding.left + gap + i * (barW + gap);
      var y = padding.top + chartH - barH;

      var grad = ctx.createLinearGradient(x, y, x, padding.top + chartH);
      grad.addColorStop(0, "#d97706");
      grad.addColorStop(1, "#f59e0b");
      ctx.fillStyle = grad;

      var r = 3;
      ctx.beginPath();
      ctx.moveTo(x, padding.top + chartH);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.lineTo(x + barW - r, y);
      ctx.quadraticCurveTo(x + barW, y, x + barW, y + r);
      ctx.lineTo(x + barW, padding.top + chartH);
      ctx.closePath();
      ctx.fill();

      // Etiqueta día
      ctx.fillStyle = "#6b7280";
      ctx.font = "10px " + fontFamily;
      ctx.fillText(nombre, x + barW / 2, padding.top + chartH + 20);

      // Valor cuando la barra tiene algo de altura
      if (barH > 6) {
        ctx.fillStyle = "#111827";
        ctx.font = "bold 11px " + fontFamily;
        if (nombres.length <= 12) {
          ctx.fillText(formatearDinero(val), x + barW / 2, y - 8);
        }
      }
    });

    if (animProgress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function formatearDinero(num) {
  return "$" + num.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function fechaHoyLocal() {
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function cerrarModalEst() {
  document.getElementById("est-modal-overlay").classList.add("hidden");
}

function mostrarDetalleCard(tipo) {
  var overlay = document.getElementById("est-modal-overlay");
  var titulo = document.getElementById("est-modal-titulo");
  var body = document.getElementById("est-modal-body");
  if (!overlay || !titulo || !body) return;

  if (estFiltradas.length === 0) return;

  var s = estStats;
  var html = "";

  switch (tipo) {
    case "ventas":
      titulo.textContent = "🧾 Lista de ventas del período";
      html = '<div class="est-modal-total">' + estFiltradas.length + '</div>' +
        '<div class="est-modal-sub">ventas en este período</div>' +
        '<table><thead><tr><th>Fecha</th><th>Cliente</th><th>Total</th></tr></thead><tbody>';
      estFiltradas.forEach(function(v) {
        html += '<tr><td>' + (v.fecha || "—") + '</td><td>' + escHtml(v.clienteNombre || "—") + '</td><td>$' + (v.total || 0).toFixed(0) + '</td></tr>';
      });
      html += '</tbody></table>';
      break;

    case "total":
      titulo.textContent = "💰 Total vendido";
      html = '<div class="est-modal-total">' + formatearDinero(s.total) + '</div>' +
        '<div class="est-modal-sub">en ' + estFiltradas.length + ' ventas</div>';
      // Top productos contribución
      var topN = Object.keys(s.prodCount).sort(function(a,b) { return s.prodCount[b] - s.prodCount[a]; }).slice(0, 5);
      if (topN.length) {
        html += '<h4 style="margin:12px 0 8px;font-size:0.95rem">Top productos</h4><table><thead><tr><th>Producto</th><th>Unidades</th></tr></thead><tbody>';
        topN.forEach(function(n) {
          html += '<tr><td>' + n + '</td><td>' + s.prodCount[n] + '</td></tr>';
        });
        html += '</tbody></table>';
      }
      break;

    case "promedio":
      titulo.textContent = "📊 Promedio por venta";
      html = '<div class="est-modal-total">' + formatearDinero(s.promedio) + '</div>' +
        '<div class="est-modal-sub">promedio de ' + estFiltradas.length + ' ventas</div>';
      // Mostrar cuántas están arriba/abajo
      var arriba = estFiltradas.filter(function(v) { return (v.total || 0) > s.promedio; }).length;
      var abajo = estFiltradas.length - arriba;
      html += '<table><thead><tr><th></th><th>Cantidad</th></tr></thead><tbody>' +
        '<tr><td>💰 Sobre el promedio</td><td>' + arriba + '</td></tr>' +
        '<tr><td>📉 Bajo el promedio</td><td>' + abajo + '</td></tr>' +
        '</tbody></table>';
      break;

    case "max":
      titulo.textContent = "🏆 Venta mayor";
      html = '<div class="est-modal-total">' + formatearDinero(s.maxVenta) + '</div>' +
        '<div class="est-modal-sub">venta más alta del período</div>';
      // Mostrar las primeras 3 más altas
      var topVentas = estFiltradas.slice().sort(function(a,b) { return (b.total || 0) - (a.total || 0); }).slice(0, 5);
      html += '<table><thead><tr><th>#</th><th>Fecha</th><th>Cliente</th><th>Total</th></tr></thead><tbody>';
      topVentas.forEach(function(v, i) {
        html += '<tr><td>' + (i+1) + '</td><td>' + (v.fecha || "—") + '</td><td>' + escHtml(v.clienteNombre || "—") + '</td><td>$' + (v.total || 0).toFixed(0) + '</td></tr>';
      });
      html += '</tbody></table>';
      break;

    case "top-producto":
      if (!s.topProducto) { cerrarModalEst(); return; }
      titulo.textContent = "🥇 " + s.topProducto;
      html = '<div class="est-modal-total">' + s.prodCount[s.topProducto] + ' unidades</div>' +
        '<div class="est-modal-sub">producto más vendido del período</div>';
      // Mostrar todas las ventas de este producto
      var ventasProd = estFiltradas.filter(function(v) {
        return (v.items || []).some(function(item) { return item.recetaNombre === s.topProducto; });
      });
      html += '<table><thead><tr><th>Fecha</th><th>Cantidad</th><th>Total</th></tr></thead><tbody>';
      ventasProd.forEach(function(v) {
        var items = (v.items || []).filter(function(i) { return i.recetaNombre === s.topProducto; });
        var cant = items.reduce(function(sum, i) { return sum + i.cantidad; }, 0);
        var subt = items.reduce(function(sum, i) { return sum + i.subtotal; }, 0);
        html += '<tr><td>' + (v.fecha || "—") + '</td><td>' + cant + '</td><td>$' + subt.toFixed(0) + '</td></tr>';
      });
      html += '</tbody></table>';
      break;

    case "top-cliente":
      if (!s.topCliente) { cerrarModalEst(); return; }
      titulo.textContent = "👤 " + s.topCliente;
      html = '<div class="est-modal-total">' + formatearDinero(s.clienteTotales[s.topCliente]) + '</div>' +
        '<div class="est-modal-sub">total comprado en el período</div>';
      // Compras de este cliente
      var ventasCliente = estFiltradas.filter(function(v) { return v.clienteNombre === s.topCliente; });
      html += '<table><thead><tr><th>Fecha</th><th>Productos</th><th>Total</th></tr></thead><tbody>';
      ventasCliente.forEach(function(v) {
        var prods = (v.items || []).map(function(i) { return i.cantidad + " × " + i.recetaNombre; }).join(", ");
        if (prods.length > 40) prods = prods.substring(0, 37) + "…";
        html += '<tr><td>' + (v.fecha || "—") + '</td><td>' + escHtml(prods) + '</td><td>$' + (v.total || 0).toFixed(0) + '</td></tr>';
      });
      html += '</tbody></table>';
      break;
  }

  body.innerHTML = html;
  overlay.classList.remove("hidden");
}

// ============================================================
// LIMPIAR DATOS (ejecutar desde Consola F12)
// ============================================================

function limpiarColeccion(ref, nombre) {
  if (!db) { mostrarToast("Firebase no está conectado.", "error"); return; }
  if (!confirm("¿Eliminar TODOS los " + nombre + "? Esta acción no se puede deshacer.")) return;

  ref.get().then(function(snapshot) {
    if (snapshot.empty) { mostrarToast("No hay " + nombre + " para borrar.", "info"); return; }
    var batch = db.batch();
    snapshot.forEach(function(doc) { batch.delete(doc.ref); });
    return batch.commit().then(function() {
      mostrarToast(nombre + " eliminados.", "success");
      location.reload();
    });
  }).catch(function(e) {
    mostrarToast("Error al borrar " + nombre + ": " + e.message, "error");
  });
}

function limpiarIngredientes() { limpiarColeccion(ingredientesRef, "ingredientes"); }
function limpiarRecetas() { limpiarColeccion(recetasRef, "recetas"); }
function limpiarProduccion() { limpiarColeccion(produccionRef, "producciones"); }
function limpiarClientes() { limpiarColeccion(clientesRef, "clientes"); }
function limpiarVentas() { limpiarColeccion(ventasRef, "ventas"); }
function limpiarTodosLosDatos() {
  limpiarIngredientes();
  limpiarRecetas();
  limpiarProduccion();
  limpiarClientes();
  limpiarVentas();
}

function ayuda() {
  console.log("");
  console.log("  🧹 COMANDOS DISPONIBLES");
  console.log("  ────────────────────────────");
  console.log("  limpiarIngredientes()   → Borra solo ingredientes");
  console.log("  limpiarRecetas()        → Borra solo recetas");
  console.log("  limpiarProduccion()     → Borra solo producción");
  console.log("  limpiarClientes()       → Borra solo clientes");
  console.log("  limpiarVentas()         → Borra solo ventas");
  console.log("  limpiarTodosLosDatos()  → Borra TODO");
  console.log("  ────────────────────────────");
  console.log("  Cada comando pide confirmación antes de borrar.");
  console.log("");
}

// ============================================================
// TOAST
// ============================================================

function mostrarToast(mensaje, tipo) {
  tipo = tipo || "info";
  var container = document.getElementById("toast-container");
  var el = document.createElement("div");
  el.className = "toast toast-" + tipo;
  el.textContent = mensaje;
  container.appendChild(el);
  setTimeout(function() {
    if (el.parentNode) el.parentNode.removeChild(el);
  }, 3000);
}

// ============================================================
// ERRORES
// ============================================================

function mostrarError(mensaje) {
  document.getElementById("error-text").textContent = mensaje;
  document.getElementById("error-bar").classList.remove("hidden");
}

function cerrarError() {
  document.getElementById("error-bar").classList.add("hidden");
}
