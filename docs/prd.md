# PRD — Sistema de Gestión para Taller Mecánico

## 1. Nombre provisional del producto

**RacerLab**
Sistema web para la gestión operativa de un taller mecánico: clientes, vehículos, órdenes de servicio, técnicos, cotizaciones, inventario de repuestos/consumibles y seguimiento de reparaciones.

---

## 2. Contexto del proyecto

El taller actualmente utiliza una solución externa para manejar órdenes de servicio y operación diaria, pero el costo mensual es elevado. La oportunidad es construir una solución propia, más económica y adaptada al flujo real del taller.

El sistema no debe intentar copiar todas las funcionalidades de una plataforma grande desde el inicio. Debe enfocarse en resolver el flujo principal del negocio:

**Cliente → Vehículo → Orden de servicio → Diagnóstico → Cotización → Aprobación → Inventario/Repuestos → Reparación → Entrega**

---

## 3. Problema principal

El taller necesita controlar de forma clara:

- Qué vehículos están dentro del taller.
- Qué se le está haciendo a cada vehículo.
- En qué etapa está cada orden.
- Qué técnico está asignado.
- Qué repuestos, aceites, lubricantes o consumibles se necesitan.
- Qué productos fueron cotizados, aprobados y usados.
- Cuánto stock queda disponible.
- Qué órdenes están esperando aprobación del cliente.
- Qué vehículos están listos para entregar.

Actualmente pagan mucho por una herramienta externa y necesitan una alternativa más económica, propia y personalizable.

---

## 4. Objetivo del producto

Crear un sistema web privado para el taller que permita gestionar la operación diaria, centralizando órdenes de servicio, clientes, vehículos, técnicos, cotizaciones e inventario.

El objetivo del MVP es reemplazar el uso más frecuente de la herramienta actual, especialmente en:

- Registro de clientes y vehículos.
- Creación y seguimiento de órdenes de servicio.
- Control de etapas del taller.
- Gestión de técnicos.
- Cotizaciones.
- Inventario básico de repuestos y productos.
- Evidencias fotográficas.
- Reportes operativos básicos.

---

## 5. Usuarios del sistema

### 5.1 Administrador / Dueño

Puede ver todo el sistema, configurar usuarios, revisar reportes, controlar inventario, precios, órdenes y rendimiento del taller.

### 5.2 Recepción / Asesor de servicio

Puede registrar clientes, vehículos, crear órdenes, cargar fallas reportadas, tomar fotos de ingreso, generar cotizaciones y comunicarse con el cliente.

### 5.3 Técnico

Puede ver las órdenes asignadas, agregar diagnóstico, actualizar tareas, cargar evidencias y reportar repuestos necesarios.

### 5.4 Encargado de inventario

Puede registrar productos, ajustar stock, ver movimientos, alertas de stock bajo y asociar repuestos a órdenes de servicio.

---

## 6. Alcance del MVP

El MVP debe incluir los siguientes módulos:

1. Autenticación y roles.
2. Dashboard operativo.
3. Clientes.
4. Vehículos.
5. Órdenes de servicio.
6. Diagnóstico.
7. Cotizaciones.
8. Inventario de repuestos, aceites, lubricantes y consumibles.
9. Tareas de reparación.
10. Evidencias/fotos.
11. Historial de estados.
12. Reportes básicos.

---

## 7. Flujo principal del sistema

### 7.1 Recepción del vehículo

1. Se registra o busca el cliente.
2. Se registra o busca el vehículo.
3. Se crea una orden de servicio.
4. Se agregan fallas reportadas por el cliente.
5. Se toma información inicial:
   - Kilometraje.
   - Nivel de combustible.
   - Estado visual.
   - Fotos de ingreso.
   - Observaciones.

6. La orden queda en estado **Recepción**.

---

### 7.2 Diagnóstico

1. El encargado asigna un técnico.
2. El técnico revisa el vehículo.
3. El técnico registra:
   - Diagnóstico.
   - Repuestos requeridos.
   - Productos necesarios.
   - Mano de obra sugerida.
   - Fotos o evidencias.

4. La orden pasa a estado **Diagnóstico completado** o **Cotización pendiente**.

---

### 7.3 Cotización

1. El asesor genera una cotización desde la orden.
2. La cotización puede incluir:
   - Mano de obra.
   - Repuestos.
   - Aceites.
   - Lubricantes.
   - Filtros.
   - Consumibles.
   - Servicios adicionales.
   - Descuentos.

3. El sistema calcula subtotal, impuestos opcionales y total.
4. La cotización queda en estado **Pendiente de aprobación**.

---

### 7.4 Aprobación

Primera versión:

- El asesor marca manualmente la cotización como aprobada, rechazada o parcialmente aprobada.
- Puede registrar el medio de aprobación:
  - WhatsApp.
  - Llamada.
  - Presencial.
  - Email.

Versión futura:

- El cliente recibe un enlace público para aprobar o rechazar la cotización desde su celular.

---

### 7.5 Inventario y reserva de productos

Cuando una cotización es aprobada:

1. El sistema verifica disponibilidad de productos.
2. Los productos pueden quedar en estado:
   - Disponible.
   - Reservado para una orden.
   - Consumido/usado.
   - Sin stock.

3. Si hay stock suficiente, se reserva el producto para la orden.
4. Si no hay stock, se marca como pendiente de compra.
5. Al iniciar o finalizar la reparación, el sistema descuenta el stock según la configuración definida.

---

### 7.6 Reparación

1. La orden pasa a estado **En reparación**.
2. El técnico ve las tareas asignadas.
3. El técnico actualiza cada tarea:
   - Pendiente.
   - En progreso.
   - Completada.
   - Bloqueada.

4. Puede agregar comentarios internos.
5. Puede cargar fotos del proceso.
6. El sistema registra el técnico responsable y fecha de actualización.

---

### 7.7 Control de calidad y entrega

1. Al terminar la reparación, la orden pasa a **Control de calidad**.
2. Se valida que:
   - Las tareas estén completadas.
   - Los productos usados estén registrados.
   - Las evidencias estén cargadas.
   - La cotización esté aprobada.

3. Luego pasa a **Listo para entregar**.
4. Finalmente se marca como **Entregado**.

---

## 8. Estados de la orden de servicio

Estados iniciales recomendados:

1. Recepción.
2. Diagnóstico.
3. Cotización pendiente.
4. Esperando aprobación.
5. Aprobada.
6. Rechazada.
7. Parcialmente aprobada.
8. Esperando repuestos.
9. En reparación.
10. Control de calidad.
11. Listo para entregar.
12. Entregado.
13. Cancelado.

Cada cambio de estado debe guardar:

- Estado anterior.
- Estado nuevo.
- Usuario que hizo el cambio.
- Fecha y hora.
- Comentario opcional.

---

## 9. Módulo de clientes

### Funcionalidades

- Crear cliente.
- Editar cliente.
- Buscar cliente por nombre, teléfono, documento o email.
- Ver vehículos asociados.
- Ver historial de órdenes.
- Ver cotizaciones anteriores.

### Datos del cliente

- Nombre completo.
- Teléfono.
- WhatsApp.
- Email.
- Documento de identidad opcional.
- Dirección opcional.
- Notas internas.

---

## 10. Módulo de vehículos

### Funcionalidades

- Crear vehículo.
- Asociar vehículo a un cliente.
- Editar información.
- Ver historial de órdenes.
- Ver historial de reparaciones.

### Datos del vehículo

- Placa.
- Marca.
- Modelo.
- Año.
- Color.
- Kilometraje.
- VIN opcional.
- Tipo de vehículo.
- Observaciones.

---

## 11. Módulo de órdenes de servicio

La orden de servicio es la entidad principal del sistema.

### Funcionalidades

- Crear orden.
- Ver detalle completo.
- Cambiar estado.
- Asignar técnico.
- Registrar diagnóstico.
- Crear cotización.
- Asociar productos/repuestos.
- Registrar tareas.
- Subir evidencias.
- Cerrar orden.
- Consultar historial.

### Información principal

- Código de orden.
- Cliente.
- Vehículo.
- Técnico asignado.
- Fecha de ingreso.
- Fecha estimada de entrega.
- Estado actual.
- Fallas reportadas.
- Observaciones internas.
- Kilometraje de ingreso.
- Nivel de combustible.
- Prioridad.
- Total cotizado.
- Total aprobado.
- Total final.

---

## 12. Módulo de cotizaciones

### Funcionalidades

- Crear cotización desde una orden.
- Agregar ítems manuales.
- Agregar productos desde inventario.
- Agregar mano de obra.
- Aplicar descuentos.
- Calcular totales.
- Marcar como aprobada, rechazada o parcialmente aprobada.
- Duplicar o versionar cotización.
- Generar PDF en fase posterior.

### Estados de cotización

- Borrador.
- Pendiente de aprobación.
- Aprobada.
- Rechazada.
- Parcialmente aprobada.
- Vencida.

### Tipos de ítems

- Mano de obra.
- Repuesto.
- Aceite.
- Lubricante.
- Filtro.
- Consumible.
- Servicio externo.
- Otro.

---

## 13. Módulo de inventario

El inventario es obligatorio desde el MVP porque el taller necesita controlar repuestos, productos y consumibles.

### Objetivo

Permitir que el taller sepa qué productos tiene disponibles, cuáles se usaron en cada orden, cuáles están reservados y cuáles deben comprarse.

### Productos soportados

- Repuestos.
- Aceites.
- Lubricantes.
- Filtros.
- Baterías.
- Consumibles.
- Productos de limpieza.
- Otros productos internos del taller.

### Datos del producto

- Nombre.
- Código interno / SKU.
- Categoría.
- Marca.
- Descripción.
- Unidad de medida:
  - Unidad.
  - Litro.
  - Galón.
  - Mililitro.
  - Kit.
  - Caja.

- Costo de compra.
- Precio de venta.
- Stock actual.
- Stock mínimo.
- Ubicación en almacén.
- Proveedor opcional.
- Activo/inactivo.

### Movimientos de inventario

El sistema debe registrar cada movimiento:

- Entrada de stock.
- Salida de stock.
- Reserva para orden.
- Consumo en orden.
- Devolución.
- Ajuste manual.
- Pérdida/merma.

Cada movimiento debe guardar:

- Producto.
- Cantidad.
- Tipo de movimiento.
- Orden asociada, si aplica.
- Usuario responsable.
- Fecha.
- Comentario opcional.

### Alertas de inventario

El sistema debe mostrar alertas cuando:

- Un producto está por debajo del stock mínimo.
- Un producto está agotado.
- Una orden aprobada requiere productos sin stock.
- Hay productos reservados pero no consumidos.
- Hay productos pendientes de compra.

---

## 14. Módulo de técnicos y tareas

### Funcionalidades

- Crear técnicos como usuarios.
- Asignar técnico a una orden.
- Crear tareas de reparación.
- Actualizar estado de cada tarea.
- Registrar comentarios del técnico.
- Ver carga de trabajo por técnico.

### Estados de tarea

- Pendiente.
- En progreso.
- Completada.
- Bloqueada.
- Cancelada.

---

## 15. Módulo de evidencias

### Tipos de evidencia

- Fotos de ingreso.
- Fotos de diagnóstico.
- Fotos de reparación.
- Fotos de entrega.
- Documentos.
- Notas internas.

### Reglas

- Cada evidencia debe estar asociada a una orden.
- Puede estar asociada a una etapa específica.
- Debe guardar usuario, fecha y descripción opcional.

---

## 16. Dashboard

El dashboard debe mostrar:

- Órdenes abiertas.
- Vehículos actualmente en taller.
- Órdenes esperando aprobación.
- Órdenes en reparación.
- Órdenes esperando repuestos.
- Órdenes listas para entregar.
- Productos con bajo stock.
- Productos agotados.
- Cotizaciones pendientes.
- Cotizaciones aprobadas.
- Técnicos activos.

---

## 17. Reportes del MVP

Reportes básicos:

- Órdenes por estado.
- Órdenes por técnico.
- Órdenes por fecha.
- Cotizaciones aprobadas.
- Productos más usados.
- Productos con bajo stock.
- Valor estimado del inventario.
- Tiempo promedio de una orden.

---

## 18. Fuera de alcance para el MVP

No incluir en la primera versión:

- Facturación fiscal avanzada.
- Contabilidad completa.
- Nómina.
- App móvil nativa.
- Integración real con WhatsApp Business API.
- Pasarela de pago.
- Múltiples sucursales.
- IA.
- Firma digital avanzada.
- Encuestas automáticas.
- CRM avanzado.

---

## 19. Roadmap sugerido

### MVP 1.0

- Login.
- Roles.
- Clientes.
- Vehículos.
- Órdenes.
- Diagnóstico.
- Cotización.
- Inventario básico.
- Evidencias.
- Dashboard.
- Reportes básicos.

### Versión 1.1

- PDF de cotización.
- Enlace público para aprobación del cliente.
- Historial visual tipo timeline.
- Notificaciones internas.
- Mejoras en reportes.

### Versión 1.2

- Compras a proveedores.
- Control avanzado de inventario.
- Costos vs ganancias.
- Plantillas de servicios frecuentes.
- Recordatorios de mantenimiento.

### Versión 2.0

- App móvil o PWA avanzada.
- WhatsApp Business API.
- Multi-sucursal.
- Facturación.
- Analítica avanzada.
- Portal del cliente.

---

## 20. Criterios de éxito del MVP

El MVP será exitoso si el taller puede:

- Registrar clientes y vehículos.
- Crear órdenes de servicio.
- Saber qué carro está en qué etapa.
- Asignar técnicos.
- Generar cotizaciones.
- Controlar productos usados por orden.
- Ver stock disponible.
- Detectar productos agotados o con bajo stock.
- Adjuntar evidencias.
- Cerrar órdenes.
- Consultar reportes básicos del taller.
