<?php
// Archivo: backend/api-empresas/index.php
// Esta función manejará la ruta para obtener la lista de empresas.

// Incluye la lógica de conexión a la base de datos
require_once __DIR__ . '/db_connector.php'; 

// Establecer encabezados CORS (CRÍTICO para GitHub Pages)
header("Access-Control-Allow-Origin: *"); 
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

// Manejo de la solicitud OPTIONS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

function getEmpresas(PDO $conn): array {
    $query = "SELECT REG_Empresa, Nombre_empresa FROM Principal ORDER BY Nombre_empresa";
    $stmt = $conn->prepare($query);
    $stmt->execute();
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

try {
    $conn = getDbConnection();

    if ($conn === null) {
        http_response_code(500);
        echo json_encode(['status' => 'error', 'message' => 'Falló la conexión a la base de datos.']);
        exit();
    }

    $empresas = getEmpresas($conn);

    echo json_encode(['status' => 'success', 'data' => $empresas]);

} catch (PDOException $e) {
    http_response_code(500);
    error_log("Error SQL: " . $e->getMessage());
    echo json_encode(['status' => 'error', 'message' => 'Error al obtener empresas: ' . $e->getMessage()]);
}
?>
File: db_connector.php
<?php