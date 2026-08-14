# Mensaje simple — busca la CuentaCanal automáticamente
npm run script:simular-wa

# Con teléfono y texto personalizados
npm run script:simular-wa -- --telefono 51987654321 --texto "Hola, precio del producto?"

# Con nombre del contacto (se guarda como pushName)
npm run script:simular-wa -- --telefono 51987654321 --texto "Quiero info" --nombre "Carlos Ramírez"

# Especificando la CuentaCanal manualmente
npm run script:simular-wa -- --cuentaId cm9we123456 --telefono 51987654321 --texto "Hola"