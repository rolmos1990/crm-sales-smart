-- Otorgar todos los privilegios al usuario sobre la base de datos
GRANT ALL PRIVILEGES ON DATABASE crm_sales_smart_dev TO crm_sales_smart_user;

-- Asegurar que el usuario puede crear esquemas y tablas
\c crm_sales_smart_dev
GRANT ALL ON SCHEMA public TO crm_sales_smart_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO crm_sales_smart_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO crm_sales_smart_user;

-- Permisos por defecto para objetos futuros
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO crm_sales_smart_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO crm_sales_smart_user;
