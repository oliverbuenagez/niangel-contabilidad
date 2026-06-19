// ============================================================
// app.js - LÓGICA PRINCIPAL DE LA APLICACIÓN
//
// ¿Qué hace este archivo?
// - Conecta con Firebase
// - Maneja el login con PIN
// - CRUD (Crear, Leer, Actualizar, Eliminar) de ingredientes
// - Escucha cambios en Firebase en tiempo real
//
// Explicación para cada función:
// ============================================================

// ============================================================
// PASO 1: INICIALIZAR FIREBASE
//
// ¿Qué es Firebase? Es una plataforma de Google que nos da
// una base de datos en la nube. Nosotros guardamos los
// ingredientes allí, y la página los muestra.
//
// firebase.initializeApp(firebaseConfig):
//   Le dice a Firebase: "Conéctate a mi proyecto usando
//   estas credenciales". Sin esto, no puede hablar con la BD.
//
// firebase.firestore():
//   Devuelve un "objeto" que usamos para leer/escribir en
//   Firestore (la base de datos). Lo llamamos "db".
//
// db.collection("ingredientes"):
//   Apunta a la colección "ingredientes" en Firestore.
//   Una colección es como una carpeta que contiene documentos.
//   Cada documento es un ingrediente.
// ============================================================

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const ingredientesRef = db.collection("ingredientes");

// ============================================================
// PASO 2: VARIABLE DE ESTADO
//
// editandoId guarda el ID del ingrediente que estamos editando.
// - null = estamos AGREGANDO un ingrediente nuevo
// - "abc123" = estamos EDITANDO el ingrediente con ese ID
//
// ¿Por qué necesitamos esto?
// Porque cuando hacemos clic en "Guardar", necesitamos saber
// si debemos CREAR un documento nuevo (.add()) o
// ACTUALIZAR uno existente (.update()).
// ============================================================

let editandoId = null;

// ============================================================
// PASO 3: VERIFICAR SESIÓN AL CARGAR LA PÁGINA
//
// sessionStorage es un almacén temporal en el navegador.
// Cuando el usuario ingresa el PIN correcto, guardamos
// "autenticado = true". Al recargar la página, revisamos
// si ya está autenticado y mostramos la app directamente.
//
// Diferencia entre sessionStorage y localStorage:
// - sessionStorage: se BORRA al cerrar la pestaña
// - localStorage: PERMANECE aunque cierres el navegador
//
// Usamos sessionStorage por seguridad: al cerrar la pestaña,
// se pide el PIN otra vez.
// ============================================================

if (sessionStorage.getItem("autenticado") === "true") {
  document.getElementById("login-screen").classList.add("hidden");
  document.getElementById("app-screen").classList.remove("hidden");
}

// ============================================================
// PASO 4: ESCUCHAR CAMBIOS EN FIREBASE (onSnapshot)
//
// ¿Qué hace onSnapshot?
// Es un "vigilante" en tiempo real. Se conecta a Firebase y
// se queda escuchando. Cuando alguien (desde cualquier
// dispositivo) agrega, edita o borra un ingrediente, esta
// función se ejecuta automáticamente y actualiza la tabla.
//
// snapshot: contiene TODOS los documentos de la colección
// en el momento actual. snapshot.forEach() recorre cada uno.
//
// doc.id: el ID único que Firebase le asigna al documento
// doc.data(): los campos del documento {nombre, precio, ...}
// ============================================================

ingredientesRef.onSnapshot(function(snapshot) {
  // Solo actualizar la tabla si el usuario está autenticado
  if (sessionStorage.getItem("autenticado") !== "true") return;

  const lista = document.getElementById("ingredientes-lista");
  const emptyMsg = document.getElementById("sin-ingredientes");

  // Vaciar la tabla antes de llenarla de nuevo
  // Esto evita que se dupliquen las filas
  lista.innerHTML = "";

  // snapshot.empty nos dice si la colección está vacía
  if (snapshot.empty) {
    emptyMsg.classList.remove("hidden");
    return;
  }
  emptyMsg.classList.add("hidden");

  // Recorrer cada documento (ingrediente) que viene de Firebase
  snapshot.forEach(function(doc) {
    const datos = doc.data();

    // Crear un elemento <tr> (fila de tabla)
    const fila = document.createElement("tr");

    // Rellenar la fila con los datos del ingrediente
    // template literal (``) permite insertar variables con ${}
    fila.innerHTML = `
      <td>${datos.nombre}</td>
      <td>$${Number(datos.precio).toFixed(2)}</td>
      <td>${datos.unidad}</td>
      <td>${datos.cantidad}</td>
      <td class="acciones">
        <button class="btn-editar" data-id="${doc.id}">Editar</button>
        <button class="btn-eliminar" data-id="${doc.id}">Eliminar</button>
      </td>
    `;

    // Agregar la fila a la tabla
    lista.appendChild(fila);
  });
});

// ============================================================
// PASO 5: ESCUCHAR CLICS EN LOS BOTONES DE LA TABLA
// (DELEGACIÓN DE EVENTOS)
//
// En lugar de poner onclick en cada botón (que sería repetitivo),
// escuchamos los clics en la TABLA COMPLETA y detectamos
// qué botón se presionó.
//
// ¿Cómo funciona?
// 1. Ponemos un "oyente" en la tabla
// 2. Cuando el usuario hace clic, vemos si el clic fue en
//    un botón (e.target.closest("button"))
// 3. Si fue en "Editar", obtenemos los datos de la fila
// 4. Si fue en "Eliminar", borramos el ingrediente
//
// data-id: atributo que pusimos en cada botón con el ID
// del documento en Firebase
// ============================================================

document.getElementById("ingredientes-tabla").addEventListener("click", function(e) {
  // e.target = el elemento exacto donde se hizo clic
  // closest("button") busca el botón más cercano (por si
  // el clic fue en un hijo del botón)
  const btn = e.target.closest("button");
  if (!btn) return;

  const id = btn.dataset.id;
  if (!id) return;

  if (btn.classList.contains("btn-editar")) {
    // Obtener los datos de la fila donde está el botón
    const fila = btn.closest("tr");
    const celdas = fila.cells;

    // celdas[0] = nombre (texto)
    // celdas[1] = precio (ej: "$2.50" → quitamos "$")
    // celdas[2] = unidad (texto)
    // celdas[3] = cantidad (texto)
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
// PASO 6: ESCUCHAR "ENTER" EN EL INPUT DEL PIN
//
// addEventListener("keypress") ejecuta una función cuando
// el usuario presiona una tecla. Si la tecla es "Enter",
// llamamos a verificarPin() automáticamente.
// ============================================================

document.getElementById("pin-input").addEventListener("keypress", function(e) {
  if (e.key === "Enter") {
    verificarPin();
  }
});

// ============================================================
// PASO 7: ESCUCHAR EL ENVÍO DEL FORMULARIO
//
// Cuando el usuario hace clic en "Guardar" o presiona Enter
// dentro del formulario, se dispara el evento "submit".
// Capturamos ese evento y llamamos a guardarIngrediente().
// ============================================================

document.getElementById("ingredientes-form").addEventListener("submit", function(e) {
  guardarIngrediente(e);
});

// ============================================================
// PASO 8: ESCUCHAR EL BOTÓN "CANCELAR"
// ============================================================

document.getElementById("cancelar-btn").addEventListener("click", function() {
  cancelarEdicion();
});

// ============================================================
// FUNCIÓN: verificarPin()
//
// ¿Qué hace?
//   Toma el PIN que el usuario escribió y lo compara con "1285".
//
// ¿Cómo funciona?
//   1. Obtiene el valor del input (#pin-input.value)
//   2. Si es "1285", guarda "autenticado" en sessionStorage
//      y muestra la pantalla principal
//   3. Si no, muestra un mensaje de error
//
// ¿Por qué sessionStorage?
//   Para que al recargar la página no tengamos que escribir
//   el PIN otra vez (mientras no cerremos la pestaña)
// ============================================================

function verificarPin() {
  const pinIngresado = document.getElementById("pin-input").value;

  if (pinIngresado === "1285") {
    sessionStorage.setItem("autenticado", "true");

    document.getElementById("login-screen").classList.add("hidden");
    document.getElementById("app-screen").classList.remove("hidden");

    document.getElementById("pin-input").value = "";
  } else {
    alert("PIN incorrecto. Intenta de nuevo.");
    document.getElementById("pin-input").value = "";
    document.getElementById("pin-input").focus();
  }
}

// ============================================================
// FUNCIÓN: guardarIngrediente(evento)
//
// ¿Qué hace?
//   Toma los datos del formulario y los guarda en Firebase.
//   Si editandoId es null, CREA un nuevo documento (.add()).
//   Si editandoId tiene un ID, ACTUALIZA ese documento (.update()).
//
// ¿Qué es un objeto en JavaScript?
//   Es una forma de agrupar datos relacionados.
//   Ejemplo: { nombre: "Harina", precio: 2.50 }
//   La { } crea un objeto, y dentro ponemos pares clave:valor.
//
// ¿Qué hace preventDefault()?
//   Los formularios HTML, al enviarse, recargan la página.
//   preventDefault() detiene ese comportamiento para que
//   nosotros manejemos el envío con JavaScript.
//
// ¿Qué es parseFloat()?
//   Convierte un texto como "2.50" en un número 2.50.
//   Los inputs tipo "number" devuelven texto, no números.
// ============================================================

function guardarIngrediente(evento) {
  evento.preventDefault();

  const nombre = document.getElementById("nombre-input").value.trim();
  const precio = parseFloat(document.getElementById("precio-input").value);
  const unidad = document.getElementById("unidad-select").value;
  const cantidad = parseFloat(document.getElementById("cantidad-input").value);

  // Validación: si algún campo obligatorio está vacío o inválido,
  // mostramos una alerta y DETENEMOS la función con return
  if (!nombre || isNaN(precio) || !unidad || isNaN(cantidad) || precio < 0 || cantidad < 0) {
    alert("Todos los campos son obligatorios y deben ser válidos.");
    return;
  }

  // Creamos un objeto con los datos del ingrediente
  const ingrediente = {
    nombre: nombre,
    precio: precio,
    unidad: unidad,
    cantidad: cantidad
  };

  if (editandoId) {
    // MODO EDICIÓN: actualizar un documento existente
    // .doc(editandoId) selecciona el documento por su ID
    // .update(ingrediente) MODIFICA solo los campos que pasamos
    ingredientesRef.doc(editandoId).update(ingrediente);
    editandoId = null;
    document.getElementById("form-titulo").textContent = "Agregar ingrediente";
  } else {
    // MODO AGREGAR: crear un documento nuevo
    // .add(ingrediente) CREA un nuevo documento en Firebase
    // Firebase le asigna automáticamente un ID único
    ingredientesRef.add(ingrediente);
  }

  // Limpiar el formulario y ocultar botón de cancelar
  document.getElementById("ingredientes-form").reset();
  document.getElementById("cancelar-btn").classList.add("hidden");
}

// ============================================================
// FUNCIÓN: editarIngrediente(id, datos)
//
// ¿Qué hace?
//   Prepara el formulario para EDITAR un ingrediente existente.
//   Rellena los inputs con los datos actuales del ingrediente
//   y guarda el ID del documento para usarlo al guardar.
//
// ¿Qué recibe?
//   id: el ID del documento en Firebase (ej: "abc123")
//   datos: objeto con {nombre, precio, unidad, cantidad}
// ============================================================

function editarIngrediente(id, datos) {
  editandoId = id;

  document.getElementById("nombre-input").value = datos.nombre;
  document.getElementById("precio-input").value = datos.precio;
  document.getElementById("unidad-select").value = datos.unidad;
  document.getElementById("cantidad-input").value = datos.cantidad;

  document.getElementById("form-titulo").textContent = "Editar ingrediente";
  document.getElementById("cancelar-btn").classList.remove("hidden");

  // Desplazar la página hacia arriba para ver el formulario
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ============================================================
// FUNCIÓN: eliminarIngrediente(id)
//
// ¿Qué hace?
//   Elimina un ingrediente de Firebase.
//   Primero pregunta "¿Estás seguro?" con confirm().
//   Si el usuario acepta, borra el documento.
//
// ¿Qué es confirm()?
//   Muestra una ventana emergente con "Aceptar" y "Cancelar".
//   Devuelve true si el usuario hace clic en "Aceptar".
// ============================================================

function eliminarIngrediente(id) {
  if (confirm("¿Estás seguro de eliminar este ingrediente?")) {
    ingredientesRef.doc(id).delete();
  }
}

// ============================================================
// FUNCIÓN: cancelarEdicion()
//
// ¿Qué hace?
//   Cancela la edición actual y vuelve al modo "agregar nuevo".
//   Limpia el formulario y oculta el botón "Cancelar".
// ============================================================

function cancelarEdicion() {
  editandoId = null;
  document.getElementById("ingredientes-form").reset();
  document.getElementById("cancelar-btn").classList.add("hidden");
  document.getElementById("form-titulo").textContent = "Agregar ingrediente";
}

// ============================================================
// FUNCIÓN: cerrarSesion()
//
// ¿Qué hace?
//   Cierra la sesión:
//   1. Borra "autenticado" de sessionStorage
//   2. Muestra la pantalla de login
//   3. Oculta la pantalla principal
//   4. Limpia el input del PIN
// ============================================================

function cerrarSesion() {
  sessionStorage.removeItem("autenticado");

  document.getElementById("login-screen").classList.remove("hidden");
  document.getElementById("app-screen").classList.add("hidden");

  document.getElementById("pin-input").value = "";
}
