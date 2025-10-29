<?php
// config.php

// ----------------------------------------------------------------------
// Configuración de la Conexión a la Base de Datos (SQL Server/MySQL)
//
// ADVERTENCIA: Reemplaza estos valores con tus credenciales reales.
// ----------------------------------------------------------------------

// Tipo de base de datos que estás utilizando.
// Si usas SQL Server (MSSQL), asegúrate de tener el driver PDO_SQLSRV instalado.
define('DB_TYPE', 'sqlsrv'); 

// Parámetros de conexión (ACTUALIZADOS PARA AZURE SQL DATABASE)
define('DB_HOST', 'eegobd.database.windows.net'); // Servidor de Azure
define('DB_NAME', 'ProyectoContable_G2BD2v2');  // Nueva Base de Datos
define('DB_USER', 'eego');                       // Usuario
define('DB_PASS', 'Roki2610@');                  // Contraseña
// Puerto (Predeterminado para Azure SQL Database)
define('DB_PORT', '1433'); 

// ----------------------------------------------------------------------
// Configuración de Seguridad y CORS
// ----------------------------------------------------------------------

// Orígenes permitidos para peticiones CORS. Usa '*' para desarrollo.
// ¡IMPORTANTE!: En producción, cámbialo a tu dominio específico.
define('ALLOWED_ORIGINS', '*');

// Establece la zona horaria (útil para logs o manejo de fechas)
date_default_timezone_set('America/Tegucigalpa'); 

?>
<?php
// index.php