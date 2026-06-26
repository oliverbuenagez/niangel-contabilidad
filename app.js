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
    alert("PIN incorrecto. Intenta de nuevo.");
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
    configurarListener();
    configurarListenerRecetas();
    configurarListenerProducciones();
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
  return (base.precio / gramosBase) * gramosUsados;
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
      if (tab.dataset.tab === "produccion") llenarSelectReceta();
      if (tab.dataset.tab === "historial") actualizarHistorial();
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
    alert("Todos los campos son obligatorios y deben ser válidos.");
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
  if (!nombre) { alert("El nombre de la receta es obligatorio."); return; }

  const rows = document.querySelectorAll("#receta-ingredientes-container .receta-ingr-row");
  if (rows.length === 0) { alert("Agrega al menos un ingrediente a la receta."); return; }

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

  if (!algunValido) { alert("Completa todos los ingredientes con valores válidos."); return; }

  const costoAdicional = parseFloat(document.getElementById("receta-costo-adicional").value) || 0;
  const rinde = parseInt(document.getElementById("receta-rinde").value) || 0;
  const precioVenta = parseFloat(document.getElementById("receta-precio-venta").value) || 0;
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
      extraInfo = `
        <div class="receta-extra-info">
          <span>${receta.harinaTanda ? receta.harinaTanda + 'g' : '—'} · ${receta.rinde} panes · $${receta.precioVenta}/pan</span>
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
    }
    if (cantEscalada >= 500 && ing.unidad === "g") {
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
  const costoAdicionalReceta = (receta.costoAdicional || 0) * multiplicador;
  const costoAdicionalExtra = parseFloat(document.getElementById("produccion-costo-adicional").value) || 0;
  const costoAdicionalTotal = costoAdicionalReceta + costoAdicionalExtra;
  const panesProducidos = Math.round(multiplicador * receta.rinde);
  const ingreso = panesProducidos * receta.precioVenta;
  const costoTotal = totalCosto + costoAdicionalTotal;
  const ganancia = ingreso - costoTotal;
  const margen = ingreso > 0 ? (ganancia / ingreso) * 100 : 0;

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
  if (!recetaId) { alert("Selecciona una receta."); return; }

  const receta = recetasData.find(function(r) { return r.id === recetaId; });
  if (!receta) return;

  const cantidad = parseFloat(document.getElementById("produccion-cantidad").value);
  const unidad = document.getElementById("produccion-unidad").value;
  if (isNaN(cantidad) || cantidad <= 0) { alert("Ingresa una cantidad válida."); return; }

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

  const costoAdicionalReceta = (receta.costoAdicional || 0) * multiplicador;
  const costoAdicionalExtra = parseFloat(document.getElementById("produccion-costo-adicional").value) || 0;
  const costoAdicionalTotal = costoAdicionalReceta + costoAdicionalExtra;
  const totalIngredientes = ingredientes.reduce(function(s, i) { return s + i.costo; }, 0);
  const costoTotal = totalIngredientes + costoAdicionalTotal;
  const panesProducidos = Math.round(multiplicador * receta.rinde);
  const ingreso = panesProducidos * receta.precioVenta;
  const ganancia = ingreso - costoTotal;
  const margen = ingreso > 0 ? (ganancia / ingreso) * 100 : 0;

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
      gramosProducidos: Math.round(gramosProducir),
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

    alert("✅ Producción actualizada: " + panesProducidos + " panes · Ganancia: $" + ganancia.toFixed(2));
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
      gramosProducidos: Math.round(gramosProducir),
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

    alert("✅ Producción guardada: " + panesProducidos + " panes · Ganancia: $" + ganancia.toFixed(2));
  }
}

// ============================================================
// HISTORIAL
// ============================================================

function configurarListenerProducciones() {
  produccionRef.orderBy("fecha", "desc").onSnapshot(function(snapshot) {
    if (sessionStorage.getItem("autenticado") !== "true") return;
    produccionesData = [];
    snapshot.forEach(function(doc) {
      const d = doc.data();
      produccionesData.push({
        id: doc.id,
        fecha: d.fecha,
        recetaNombre: d.recetaNombre,
        cantidadProducida: d.cantidadProducida,
        unidadProduccion: d.unidadProduccion,
        panesProducidos: d.panesProducidos || 0,
        costoIngredientes: d.costoIngredientes || 0,
        costoAdicional: d.costoAdicional || 0,
        costoTotal: d.costoTotal || 0,
        ingreso: d.ingreso || 0,
        ganancia: d.ganancia || 0,
        margen: d.margen || 0
      });
    });
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
// ERRORES
// ============================================================

function mostrarError(mensaje) {
  document.getElementById("error-text").textContent = mensaje;
  document.getElementById("error-bar").classList.remove("hidden");
}

function cerrarError() {
  document.getElementById("error-bar").classList.add("hidden");
}
