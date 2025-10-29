import os
import pyodbc
import json
from flask import Flask, jsonify, request, render_template # Usamos render_template para servir el frontend
from flask_cors import CORS 

# ***************************************************************
# CONFIGURACIÓN DE LA APLICACIÓN FLASK PARA AZURE APP SERVICE
# ***************************************************************

# La instancia se llama 'application' (necesario para Gunicorn en Azure)
application = Flask(__name__, 
            static_folder='static', 
            template_folder='templates') 

CORS(application) 

# ***************************************************************
# CONFIGURACIÓN Y FUNCIÓN DE CONEXIÓN A AZURE SQL
# ***************************************************************

def get_db_connection():
    """
    Establece y retorna la conexión a Azure SQL Server usando pyodbc.
    Las credenciales se obtienen de las variables de entorno.
    """
    try:
        # Las claves deben coincidir con las configuradas en Azure App Service
        DB_DRIVER = os.getenv('DB_DRIVER', '{ODBC Driver 17 for SQL Server}')
        DB_SERVER = os.getenv('DB_SERVER')
        DB_DATABASE = os.getenv('DB_DATABASE')
        DB_USERNAME = os.getenv('DB_USERNAME')
        DB_PASSWORD = os.getenv('DB_PASSWORD')

        if not all([DB_SERVER, DB_DATABASE, DB_USERNAME, DB_PASSWORD]):
            raise ValueError("Faltan variables de entorno de conexión a la base de datos.")

        # Construcción de la cadena de conexión para Azure SQL
        # Se añade el puerto 1433 y opciones de seguridad para robustez en Azure App Service.
        conn_str = (
            f"DRIVER={{{DB_DRIVER}}};"
            f"SERVER={DB_SERVER},1433;"
            f"DATABASE={DB_DATABASE};"
            f"UID={DB_USERNAME};"
            f"PWD={DB_PASSWORD};"
            f"Encrypt=yes;TrustServerCertificate=no;Connection Timeout=30;"
        )
        
        conn = pyodbc.connect(conn_str)
        return conn

    except ValueError as ve:
        application.logger.error(f"ERROR DE CONFIGURACIÓN DE ENTORNO: {ve}")
        raise Exception("Error de configuración: Faltan variables de entorno para Azure SQL.")
    except pyodbc.Error as ex:
        error_detail = ex.args[1] if len(ex.args) > 1 else str(ex)
        application.logger.error(f"ERROR DE CONEXIÓN A DB: {ex}")
        raise Exception(f"Error al conectar con la base de datos. Revise firewall o credenciales: {error_detail}")

def ejecutar_select_query(query, params=None):
    """
    Función genérica para ejecutar una query SELECT, manejo de conexión y errores incluido.
    """
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Ejecutar la query con parámetros para seguridad
        cursor.execute(query, params or [])
        
        column_names = [column[0] for column in cursor.description] if cursor.description else []
        
        reporte_data = []
        for row in cursor.fetchall():
            # Convertir a diccionario y asegurar la serialización JSON (manejo de tipos de datos de SQL)
            processed_row = [str(item) if item is not None else item for item in row]
            reporte_data.append(dict(zip(column_names, processed_row)))

        return {"status": "success", "data": reporte_data}

    except Exception as ex:
        error_msg = str(ex)
        application.logger.error(f"ERROR en consulta SQL: {error_msg}")
        
        # Manejo de errores para retroalimentación en el frontend
        if 'Error al conectar con la base de datos' in error_msg or 'Login failed' in error_msg:
            status_message = "Fallo de Conexión/Credenciales. Por favor, revise la configuración de las variables de entorno."
        elif 'Invalid object name' in error_msg:
             status_message = f"Error: La tabla o vista no existe. Detalle: {error_msg}"
        else:
            status_message = f"Error inesperado al ejecutar la consulta: {error_msg}"
            
        return {"status": "error", "message": status_message}
        
    finally:
        if conn:
            conn.close()


# ***************************************************************
# RUTAS DEL API (Ahora completas)
# ***************************************************************

# RUTA: Sirve el frontend (index.html) en la URL raíz
@application.route('/')
def home():
    """Ruta principal que sirve la interfaz web."""
    # Usamos render_template, estándar en Flask.
    return render_template('index.html') 

# RUTA: Obtiene la lista de empresas (Recuperada de py1 y crucial para el frontend)
@application.route('/api/empresas', methods=['GET'])
def obtener_empresas_api():
    """Endpoint: Obtiene la lista de empresas (REG_Empresa y Nombre_empresa) de la tabla Principal."""
    query = "SELECT REG_Empresa, Nombre_empresa FROM dbo.Principal ORDER BY REG_Empresa"
    resultado = ejecutar_select_query(query)
    
    if resultado['status'] == 'error':
        return jsonify(resultado), 500
        
    return jsonify(resultado)

# RUTA: Obtiene datos de cualquier vista con filtro (Similar a py1, más robusto)
@application.route('/api/reporte-vista/<view_name>', methods=['GET'])
def reporte_vista_api(view_name):
    """
    Endpoint: Obtiene datos de cualquier vista (ej: Activo/Pasivo/Patrimonio) 
    filtrando por el ID de empresa, que viene como parámetro de consulta 'empresa_id'.
    """
    if not view_name:
        return jsonify({"status": "error", "message": "Nombre de vista no especificado"}), 400
        
    # El ID de la empresa es OBLIGATORIO
    empresa_id = request.args.get('empresa_id', type=int)
    
    if not empresa_id:
        return jsonify({"status": "error", "message": "Filtro: empresa_id es requerido."}), 400

    # 1. Construir la consulta SELECT usando el nombre de la vista
    # Asumimos que todas las vistas relevantes tienen una columna llamada 'Empresa'
    query = f"SELECT * FROM dbo.{view_name} WHERE Empresa = ?"
    
    # 2. Ejecutar la consulta con el parámetro de seguridad
    resultado = ejecutar_select_query(query, params=[empresa_id])
    
    # Manejo de errores 
    if resultado['status'] == 'error':
        # Devolvemos un 404 si la vista no existe, y 500 para errores de conexión/SQL
        if 'no existe' in resultado.get('message', ''):
             return jsonify(resultado), 404
        return jsonify(resultado), 500 
    
    return jsonify(resultado)

# ***************************************************************
# INICIO DE LA APLICACIÓN FLASK
# ***************************************************************

# Bloque de inicio para pruebas locales, ignorado en Azure por Gunicorn
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8000))
    application.run(host='0.0.0.0', port=port, debug=True)
