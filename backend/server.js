const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");

const app = express();
const PORT = process.env.PORT || 3001;

const {
  DB_HOST = "10.0.100.80", // IP Privada EC2 DB
  DB_USER = "root",
  DB_PASSWORD = "admin123",
  DB_NAME = "tienda_perritos",
  DB_PORT = 3306,
  USE_MOCK_DB = "false"
} = process.env;

app.use(cors());
app.use(express.json());

let pool;
let isMock = USE_MOCK_DB === "true";

// DB temporal en memoria
let mockProductos = [
  { id: 5, nombre: "Bravery pollo Adulto raza pequeña", descripcion: "Sabor a pollo, premium sin grano", precio: 25990, stock: 20 },
  { id: 4, nombre: "Alimento Adulto Pedigree", descripcion: "Sabor carne y vegetales", precio: 15990, stock: 40 },
  { id: 3, nombre: "Snacks Dentales", descripcion: "Ayuda a la limpieza dental diaria", precio: 5990, stock: 30 },
  { id: 2, nombre: "Alimento Adulto Light", descripcion: "Control de peso, razas medianas", precio: 17990, stock: 8 },
  { id: 1, nombre: "Alimento Cachorro Premium", descripcion: "Sabor a pollo, razas pequeñas", precio: 19990, stock: 15 }
];
let nextId = 6;

// Inicializar pool de conexiones
async function initDb() {
  if (isMock) {
    console.log("⚠️ Corriendo en modo MOCK (Base de datos en memoria local activa).");
    return;
  }
  try {
    pool = mysql.createPool({
      host: DB_HOST,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
      port: DB_PORT,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
    console.log("Pool de conexiones MySQL inicializado.");
  } catch (err) {
    console.error("Error al inicializar pool de MySQL. Activando fallback en memoria...", err);
    isMock = true;
  }
}

// Helper para manejar errores
function handleError(res, error, message = "Error interno del servidor") {
  console.error(error);
  res.status(500).json({ message });
}

// Obtener todos los productos
app.get("/api/productos", async (req, res) => {
  if (isMock) {
    return res.json(mockProductos);
  }
  try {
    const [rows] = await pool.query("SELECT id, nombre, descripcion, precio, stock FROM productos ORDER BY id DESC");
    res.json(rows);
  } catch (err) {
    handleError(res, err, "No se pudieron obtener los productos.");
  }
});

// Obtener un producto por ID
app.get("/api/productos/:id", async (req, res) => {
  const { id } = req.params;
  if (isMock) {
    const prod = mockProductos.find(p => p.id === parseInt(id, 10));
    if (!prod) return res.status(404).json({ message: "Producto no encontrado." });
    return res.json(prod);
  }
  try {
    const [rows] = await pool.query("SELECT id, nombre, descripcion, precio, stock FROM productos WHERE id = ?", [id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: "Producto no encontrado." });
    }
    res.json(rows[0]);
  } catch (err) {
    handleError(res, err, "No se pudo obtener el producto.");
  }
});

// Crear un nuevo producto
app.post("/api/productos", async (req, res) => {
  const { nombre, descripcion, precio, stock } = req.body;

  if (!nombre || precio == null || stock == null) {
    return res.status(400).json({ message: "Nombre, precio y stock son obligatorios." });
  }

  if (isMock) {
    const nuevo = {
      id: nextId++,
      nombre,
      descripcion: descripcion || null,
      precio: Number(precio),
      stock: Number(stock)
    };
    mockProductos.unshift(nuevo); // Añadir al inicio
    return res.status(201).json(nuevo);
  }

  try {
    const [result] = await pool.query(
      "INSERT INTO productos (nombre, descripcion, precio, stock) VALUES (?, ?, ?, ?)",
      [nombre, descripcion || null, precio, stock]
    );
    const nuevoId = result.insertId;
    const [rows] = await pool.query("SELECT id, nombre, descripcion, precio, stock FROM productos WHERE id = ?", [nuevoId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    handleError(res, err, "No se pudo crear el Producto.");
  }
});

// Actualizar un producto
app.put("/api/productos/:id", async (req, res) => {
  const { id } = req.params;
  const { nombre, descripcion, precio, stock } = req.body;

  if (!nombre || precio == null || stock == null) {
    return res.status(400).json({ message: "Nombre, Precio y Stock son obligatorios." });
  }

  if (isMock) {
    const index = mockProductos.findIndex(p => p.id === parseInt(id, 10));
    if (index === -1) {
      return res.status(404).json({ message: "Producto no encontrado." });
    }
    mockProductos[index] = {
      id: parseInt(id, 10),
      nombre,
      descripcion: descripcion || null,
      precio: Number(precio),
      stock: Number(stock)
    };
    return res.json(mockProductos[index]);
  }

  try {
    const [result] = await pool.query(
      "UPDATE productos SET nombre = ?, descripcion = ?, precio = ?, stock = ? WHERE id = ?",
      [nombre, descripcion || null, precio, stock, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Producto no encontrado." });
    }

    const [rows] = await pool.query("SELECT id, nombre, descripcion, precio, stock FROM productos WHERE id = ?", [id]);
    res.json(rows[0]);
  } catch (err) {
    handleError(res, err, "No se pudo actualizar el Producto.");
  }
});

// Eliminar un producto
app.delete("/api/productos/:id", async (req, res) => {
  const { id } = req.params;
  if (isMock) {
    const index = mockProductos.findIndex(p => p.id === parseInt(id, 10));
    if (index === -1) {
      return res.status(404).json({ message: "Producto no encontrado." });
    }
    mockProductos.splice(index, 1);
    return res.json({ message: "Producto eliminado correctamente." });
  }
  try {
    const [result] = await pool.query("DELETE FROM productos WHERE id = ?", [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Producto no encontrado." });
    }
    res.json({ message: "Producto eliminado correctamente." });
  } catch (err) {
    handleError(res, err, "No se pudo eliminar el Producto.");
  }
});

// Endpoint de salud
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", isMock, message: "Backend de tienda de perritos en ejecución." });
});


// Iniciar servidor
app.listen(PORT, async () => {
  console.log(`Servidor backend escuchando en puerto ${PORT}`);
  await initDb();
});
// Despliegue con SSM Agent Online
