# Proyecto VetGestión
## Sistema de gestión de turnos y consultas veterinarias
**Informe final · Entrega final 2026 · Equipo 07**

| Datos | Detalle |
| :--- | :--- |
| **Institución:** | CRUC IUA |
| **Materia:** | Taller de Desarrollo de Aplicaciones |
| **Equipo / Alumnos:** | Equipo 07 · Franco Tobar y Gisella Burgos |
| **Docente:** | Ing. Gustavo Marcelo Macarone |
| **Comisión:** | A |
| **Fecha de entrega:** | 04/11/2026 |
| **Año:** | 2026 |

---

## 1. Identificación

| Campo | Información |
| :--- | :--- |
| **Proyecto** | VetGestión – Sistema de gestión de turnos y consultas veterinarias |
| **Equipo** | 07 |
| **Integrantes** | Franco Tobar y Gisella Burgos |
| **Carrera** | Tecnicatura Universitaria en Desarrollo de Aplicaciones Informáticas |
| **Materia / Docente** | Taller de Desarrollo de Aplicaciones – Ing. Gustavo Marcelo Macarone |
| **Comisión / Fecha** | Comisión A · Ciclo lectivo 2026 · Fecha de entrega: 04/11/2026 |
| **Repositorio** | [https://github.com/francotobar/vetGestion](https://github.com/francotobar/vetGestion) |
| **Entrega (commit/tag)** | v1.0-entrega |
| **Aplicación desplegada** | **Frontend:** [https://vetgestionfrontend.onrender.com/](https://vetgestionfrontend.onrender.com/)<br>**Backend:** [https://vetgestion.onrender.com/](https://vetgestion.onrender.com/) |
| **Archivos de entrega** | `Equipo07_Informe.pdf` y `Equipo07_Codigo.txt` (archivo único; el código no se dividió en partes) |

---

## 2. Problema y alcance

### 2.1 Problema
La veterinaria funciona sin sistema digital: los clientes llegan sin turno previo. Esto genera tres problemas:
1. Aglomeración en la sala de espera, con tensión para los animales (cruces entre perros reactivos, gatos y otros).
2. Desorden administrativo al asignar los tiempos de atención.
3. Información clínica dispersa o inexistente de las mascotas.

### 2.2 Usuarios y objetivo
* **Cliente:** se registra, inicia sesión, gestiona sus mascotas, consulta servicios, solicita, cancela y reprograma turnos desde su domicilio y consulta el historial clínico de sus mascotas.
* **Administrador:** gestiona la agenda, registra turnos telefónicos o presenciales, confirma, reprograma y cancela turnos, administra clientes, servicios y feriados, y registra las atenciones realizadas.
* **Objetivo:** desarrollar una aplicación web que centralice la agenda de turnos de una veterinaria, permita a los clientes solicitar turnos sin trasladarse, reduzca la acumulación de personas y animales en el local, facilite resolver imprevistos y mantenga organizado el historial clínico de cada mascota.

### 2.3 Funcionalidades incluidas
* **Acceso y cuentas:** registro con consentimiento de datos, alta asistida por el administrador, login con documento y contraseña, bloqueo tras 5 intentos fallidos, desbloqueo por el administrador y por email (envío simulado por consola) y cierre de sesión.
* **Mascotas:** alta, edición, baja lógica y ficha, por el cliente y (parcialmente) por el administrador.
* **Turnos del cliente:** disponibilidad, reserva, listado, cancelación y reprogramación, con control de concurrencia.
* **Administrador:** agenda diaria y semanal, turno manual, cambio de estado, reprogramación y urgencias; gestión de clientes, servicios y feriados.
* **Historial clínico:** atenciones inmutables, notas aclaratorias y consulta por el cliente.
* **Privacidad:** anonimización de clientes (Ley 25.326). Pantalla de inicio pública.

### 2.4 Fuera de alcance
Rol de veterinario/profesional; recordatorios y notificaciones automáticas por email (trabajo futuro, sin requisito asociado); pagos, facturación o cobros en línea; tienda de productos; telemedicina; integraciones con sistemas externos; backup automático y garantía de disponibilidad.

---

## 3. Requerimientos

### 3.1 Requisitos funcionales
* **Prioridad:** P0 obligatorio; P1 segundo nivel. 
* **Estados:** Completo / Parcial / No implementado.

| ID | Función concreta | Prior. | Estado |
| :--- | :--- | :---: | :--- |
| **RF-01** | Alta de clientes: (a) registro propio con contraseña y consentimiento; (b) alta asistida por el administrador, sin cuenta. | P0 | Completo |
| **RF-02** | Autenticación con documento y contraseña, con permisos según rol (administrador o cliente). | P0 | Completo |
| **RF-03** | Bloqueo tras 5 intentos fallidos. Desbloqueo por el administrador (P0) y por email mediante recuperación de contraseña (P1). | P0/P1 | Parcial: el envío del email es simulado (enlace impreso en consola) |
| **RF-04** | Cierre de sesión. | P0 | Completo |
| **RF-05** | Alta, edición y baja lógica de mascotas propias. | P0 | Completo |
| **RF-06** | Ficha de mascota: nombre, especie, raza, sexo, fecha de nacimiento, peso, esterilización, microchip y alergias. | P0 | Completo |
| **RF-07** | Consulta solo de las mascotas propias; las ajenas responden 404. | P0 | Completo |
| **RF-08** | Solicitud de turno: mascota, servicio, fecha y franja libre; queda pendiente. | P0 | Completo |
| **RF-09** | Un único turno activo por franja, resuelto con restricción única en la base de datos. | P0 | Completo |
| **RF-10** | Listado de los turnos propios con su estado. | P0 | Completo |
| **RF-11** | Cancelación y reprogramación del cliente con antelación mínima configurable (24 h por defecto). | P0 | Completo |
| **RF-12** | Historial clínico de cada mascota propia, con notas aclaratorias (solo lectura). | P1 | Completo |
| **RF-13** | ABM del catálogo de servicios con baja lógica; el cliente ve solo los activos. | P0 | Completo |
| **RF-14** | Gestión de clientes y mascotas por el administrador, con estado de cuenta. | P0 | Parcial: falta la baja lógica de mascota realizada por el administrador |
| **RF-15** | Agenda por día y semana; turno manual (telefónico/presencial, nace confirmado); cambios de estado; reprogramación; registro de canal y creador. | P0 | Completo |
| **RF-16** | Alta y baja de feriados. Horario fijo de lunes a viernes, de 09:00 a 19:00. | P0 | Completo |
| **RF-17** | Rechazo de documento o email duplicado, informando la ficha existente. | P0 | Parcial: informa el nombre del cliente, pero la respuesta no incluye el id de la ficha |
| **RF-18** | Urgencias: cancelar o reprogramar sin antelación, con motivo, mostrando el contacto del cliente. | P0 | Completo |
| **RF-19** | Atención clínica para turnos atendidos, inmutable una vez guardada. | P1 | Completo |
| **RF-20** | Notas aclaratorias sobre una atención, sin modificar el registro original. | P1 | Completo |

### 3.2 Historias de usuario y criterios de aceptación
* **Formato:** «Como [rol], quiero [acción], para [beneficio]». 
* Los códigos HTTP indican la respuesta observable del sistema.

| HU / RF | Historia de usuario | Criterios de aceptación observables |
| :--- | :--- | :--- |
| **HU-01**<br>(RF-01) | Como cliente, quiero registrarme con mis datos y consentimiento, para solicitar turnos para mis mascotas. | • Datos completos + consentimiento → crea la cuenta (201) y lleva al ingreso con aviso de éxito.<br>• Sin consentimiento → rechaza (400), no crea cuenta.<br>• Email ya registrado → rechaza (409) y lo informa.<br>• Contraseña de <6 caracteres o <2 números (abc12, abcdef1) → rechaza (400), error en el campo. |
| **HU-02**<br>(RF-01) | Como cliente con ficha en la veterinaria, quiero registrarme con mi documento y teléfono, para vincular mi cuenta sin duplicar la ficha. | • Ficha sin cuenta con mismo documento y teléfono → vincula, sin registro nuevo.<br>• Mismo documento, otro teléfono → rechaza (409) e indica contactar a la veterinaria.<br>• Documento que ya tiene cuenta → rechaza (409). |
| **HU-03**<br>(RF-02, RF-04) | Como cliente o administrador, quiero iniciar y cerrar sesión, para usar solo las funciones de mi rol. | • Credenciales correctas de administrador → agenda; de cliente → Mis turnos.<br>• Documento inexistente o contraseña incorrecta → rechaza (401) con mensaje genérico.<br>• Cerrar sesión → elimina la sesión; las pantallas privadas redirigen al ingreso. |
| **HU-04**<br>(RF-03) | Como cliente, quiero que mi cuenta se bloquee tras 5 intentos fallidos, para proteger mis datos. | • 5 fallos seguidos y luego contraseña correcta → rechaza (423), mensaje de cuenta bloqueada.<br>• Menos de 5 fallos y contraseña correcta → accede normalmente. |
| **HU-05**<br>(RF-03) | Como cliente con email registrado, quiero recuperar mi contraseña por email, para desbloquear mi cuenta. | • Email registrado → mensaje genérico (200); el enlace se imprime en la consola del servidor (envío simulado).<br>• Email no registrado → mismo mensaje y no se imprime enlace.<br>• Enlace vencido → rechaza (400); primer enlace tras pedir uno segundo → rechaza (400).<br>• Enlace válido + contraseña válida → cuenta desbloqueada e ingreso con la nueva contraseña. |
| **HU-06**<br>(RF-03, RF-14) | Como administrador, quiero desbloquear una cuenta con una contraseña temporal, para asistir a clientes sin email. | • Contraseña temporal válida → el cliente ingresa con ella.<br>• Contraseña temporal inválida → rechaza (400); la cuenta sigue bloqueada.<br>• Un cliente intenta desbloquear → 403. |
| **HU-07**<br>(RF-05, RF-06) | Como cliente, quiero registrar, editar y dar de baja a mis mascotas, para que la veterinaria tenga sus datos. | • Datos obligatorios completos → aparece en la lista con su edad calculada.<br>• Nombre, raza o fecha vacíos → el formulario marca los campos y no envía datos.<br>• Fecha de nacimiento futura → rechaza; peso $\le 0$ → rechaza (debe ser $> 0$).<br>• Editar → la ficha muestra los valores nuevos.<br>• Baja confirmada → deja de aparecer en la lista, pero queda como inactiva en la base. |
| **HU-08**<br>(RF-07, RF-12) | Como cliente, quiero ver solo mis mascotas y su historial, para conocer sus atenciones sin acceder a datos ajenos. | • Mascota de otro cliente → responde 404 sin mostrar datos.<br>• Sin atenciones → muestra «Sin atenciones».<br>• Con atenciones → orden cronológico inverso, con sus notas aclaratorias. |
| **HU-09**<br>(RF-08, RF-09) | Como cliente, quiero reservar un turno en una franja libre, para llevar a mi mascota a consulta. | • Mascota, servicio, fecha y franja libre → turno pendiente (201), visible en Mis turnos.<br>• Franja ya reservada → rechaza (409), informa y recarga las franjas.<br>• Dos reservas simultáneas de la misma franja → una recibe 201, la otra 409; existe un solo turno.<br>• Sábado, domingo o feriado → no se ofrecen franjas y se muestra el motivo.<br>• Fecha pasada o a más de 60 días → rechaza (422). |
| **HU-10**<br>(RF-10, RF-11) | Como cliente, quiero ver, cancelar y reprogramar mis turnos según las reglas, para liberar o cambiar el horario. | • Mis turnos muestra solo los propios, con su estado.<br>• Cancelar con menos de 24 h → rechaza (422); con 24 h o más → queda cancelado y la franja vuelve a ofrecerse.<br>• Turno atendido o ya cancelado → no se puede cancelar (422).<br>• Reprogramar a franja libre → cambia el horario y vuelve a pendiente; a franja ocupada → rechaza (409) y el original queda intacto. |
| **HU-11**<br>(RF-13) | Como administrador, quiero gestionar el catálogo de servicios, para que los clientes elijan solo servicios vigentes. | • Alta o edición → se refleja en el listado.<br>• Servicio desactivado → no aparece entre las opciones del cliente. |
| **HU-12**<br>(RF-16) | Como administrador, quiero cargar y eliminar feriados, para que no se ofrezcan turnos esos días. | • Feriado cargado → la fecha no ofrece franjas.<br>• Fecha ya feriado → rechaza (409).<br>• Eliminar un feriado ya eliminado → 404. |
| **HU-13**<br>(RF-14, RF-17) | Como administrador, quiero buscar, dar de alta y editar clientes, para atenderlos con sus datos completos. | • Búsqueda por nombre, apellido, documento o email → lista coincidencias con estado de cuenta; sin texto, todos.<br>• Alta con datos obligatorios → cliente registrado sin cuenta.<br>• Documento o email existentes → rechaza (409) e informa el nombre del cliente existente.<br>• Editar con el email de otro cliente → rechaza (409). |
| **HU-14**<br>(RF-15) | Como administrador, quiero ver la agenda por día y semana y cargar turnos telefónicos o de mostrador, para ocupar la agenda. | • Agenda del día → 20 franjas, libres y ocupadas, con cliente, mascota, servicio, canal y estado; vista semanal con los turnos de la semana.<br>• Turno manual telefónico → queda confirmado, canal telefónico, a nombre del administrador.<br>• Cliente inexistente → el sistema ofrece crearlo. Un cliente intenta crear un turno manual → 403. |
| **HU-15**<br>(RF-15) | Como administrador, quiero confirmar, marcar atendido/ausente o cancelar turnos, para controlar la jornada. | • Pendiente → confirmado. Confirmado → atendido, ausente o cancelado.<br>• Turno atendido, ausente o cancelado → no admite cambios de estado (422). |
| **HU-16**<br>(RF-18) | Como administrador, quiero cancelar o reprogramar por urgencia y ver a quién avisar, para atender la emergencia sin descuidar a los demás. | • Cancelar con motivo → turno cancelado, marcado como urgencia y con motivo guardado.<br>• Al finalizar se muestra el teléfono (y email, si existe) del cliente afectado.<br>• Reprogramar a franja libre → cambia horario y conserva estado; a franja ocupada → 409.<br>• Turno cancelado o atendido → rechaza (422). Un cliente intenta una urgencia → 403. |
| **HU-17**<br>(RF-19) | Como administrador, quiero cargar la atención de un turno atendido, para que quede en el historial de la mascota. | • Turno atendido sin atención → se guarda asociada al turno y a la mascota.<br>• Turno que ya tiene atención → rechaza (409).<br>• Modificar o borrar una atención directamente en la base → la base lo rechaza (triggers).<br>• Un cliente intenta cargar una atención → 403. |
| **HU-18**<br>(RF-20, RF-12) | Como administrador, quiero agregar notas aclaratorias a una atención, para corregir información sin alterar el registro original. | • Nota agregada → se muestra bajo la atención con fecha y autor; el original no cambia.<br>• Atención inexistente → 404. Un cliente intenta agregar una nota → 403.<br>• El cliente ve las notas bajo la atención al consultar el historial. |
| **HU-19**<br>(RNF-04) | Como cliente, quiero que mis datos personales se anonimicen a mi pedido, para ejercer el derecho de supresión (Ley 25.326). | • Anonimizar → datos personales reemplazados, mascotas inactivas, turnos futuros cancelados.<br>• Las atenciones clínicas permanecen sin cambios; el cliente anonimizado no puede ingresar.<br>• Anonimizar a un cliente ya anonimizado → error controlado. |

### 3.3 Requisitos no funcionales

| ID | Requisito | Cómo se verificó | Estado |
| :--- | :--- | :--- | :--- |
| **RNF-01** | Toda funcionalidad privada exige autenticación; la autorización se valida en el servidor. | Pruebas automatizadas (`autorizacion.test.js`): sin sesión 401; cliente en ruta de administrador 403; recurso ajeno 404. | Verificado |
| **RNF-02** | Contraseñas con hash y salt (bcrypt), consultas parametrizadas, cookie httpOnly SameSite=Lax y bloqueo tras 5 intentos. | Revisión de código (`bcryptjs`, parámetros en consultas, cookie, helmet) y prueba automatizada del bloqueo. En local se usa HTTP; en el sitio desplegado el HTTPS lo provee Render (no configurado por el equipo). | Verificado |
| **RNF-03** | Interfaz adaptable a escritorio, tablet y móvil. | Revisión visual manual en anchos de 375, 768 y 1280 px. | Verificado |
| **RNF-04** | Consentimiento con fecha y hora, rectificación y supresión por anonimización (Ley 25.326). | Se guarda `consentimiento_at`; alta sin consentimiento rechazada; rectificación por el administrador y anonimización con pruebas automatizadas. El cliente no puede editar su propio perfil. | Parcial |
| **RNF-05** | Auditoría: se registra quién creó y modificó turnos, clientes, mascotas y atenciones. | Revisión de código; turno manual con `creado_por` = administrador; comprobación en la base al editar una mascota. | Verificado |
| **RNF-06** | Claves foráneas e índices únicos; respaldo manual. | Revisión de `backend/db/schema.sql`; pruebas de duplicados y concurrencia confirman las restricciones. Respaldo manual con `mysqldump` documentado en el README. | Verificado |
| **RNF-07** | Consultas habituales en menos de 2 segundos. | No se realizaron mediciones. | No verificado |
| **RNF-08** | Solicitar un turno en pocos pasos y sin capacitación previa. | No se hicieron pruebas con usuarios. | No verificado |
| **RNF-09** | Disponibilidad del servicio. | No verificada: el despliegue usa planes gratuitos sin garantía de disponibilidad (fuera de alcance). | No verificado |

---

## 4. Análisis

### 4.1 Backlog final y prioridades
* **Prioridad P0 (imprescindible):** BE-01 a DEP-01. 
* **Prioridad P1 (implementado):** BE-14 a FE-11.

| ID | Tarea concreta | Responsable | Estado |
| :--- | :--- | :---: | :--- |
| **BE-01** | Configurar backend Express, CORS, Helmet, cookies, conexión y endpoint de salud. | Franco | Completa |
| **DB-01** | Crear esquema MySQL, scripts de reinicio y seed de demostración. | Franco | Completa |
| **BE-02** | Implementar y probar reglas de fechas y franjas. | Franco | Completa |
| **BE-03** | Implementar registro, login, logout, sesión y vinculación de ficha. | Franco | Completa |
| **BE-04** | Implementar pruebas de autorización y acceso a recursos ajenos. | Franco | Completa |
| **FE-01** | Configurar React, rutas, Axios, contexto de sesión y componentes base. | Gisella | Completa |
| **FE-02** | Crear pantallas de login y registro. | Gisella | Completa |
| **BE-05** | Implementar CRUD de mascotas del cliente. | Franco | Completa |
| **BE-06** | Implementar servicios y feriados. | Franco | Completa |
| **BE-07** | Implementar disponibilidad de franjas. | Franco | Completa |
| **BE-08** | Implementar reserva de cliente y control de concurrencia. | Franco | Completa |
| **FE-03** | Crear pantallas de mascotas. | Gisella | Completa |
| **FE-04** | Crear asistente de reserva de turno. | Gisella | Completa |
| **BE-09** | Implementar consulta, cancelación y reprogramación de turnos propios. | Franco | Completa |
| **BE-10** | Implementar agenda administrativa y turno manual. | Franco | Completa |
| **BE-11** | Implementar cambios de estado, reprogramación administrativa y urgencias. | Franco | Completa |
| **FE-05** | Crear pantalla «Mis turnos». | Gisella | Completa |
| **FE-06** | Crear agenda del administrador. | Gisella | Completa |
| **FE-07** | Crear pantalla de turno manual. | Gisella | Completa |
| **BE-12** | Implementar administración de clientes y mascotas. | Franco | Parcial (sin baja de mascota) |
| **BE-13** | Implementar desbloqueo por administrador. | Franco | Completa |
| **FE-08** | Crear listado, alta y ficha de clientes. | Gisella | Completa |
| **FE-09** | Crear pantallas administrativas de servicios y feriados. | Gisella | Completa |
| **QA-01** | Verificar recorridos manuales de aceptación. | Ambos | Completa |
| **DEP-01** | Desplegar frontend y backend en Render y la base MySQL en Aiven. | Ambos | Completa |
| **BE-14** | Registrar atención, consultar historial y agregar notas. (P1) | Franco | Completa |
| **BE-15** | Anonimizar cliente y cancelar sus turnos futuros. (P1) | Franco | Completa |
| **BE-16** | Recuperar y restablecer contraseña por enlace local simulado. (P1) | Franco | Completa |
| **FE-10** | Mostrar historial al cliente y gestionar atención/notas como administrador. (P1) | Gisella | Completa |
| **FE-11** | Crear pantallas de recuperación/restablecimiento y acción de anonimización. (P1) | Gisella | Completa |

> **P2 – Fuera de alcance (No aplica):** recordatorios automáticos por email (trabajo futuro del MVP); rol profesional con agenda propia (se eliminó su acceso al sistema); duración variable de servicios, sábados y horarios especiales (la agenda es única, de lunes a viernes, con franjas fijas de 30 minutos); backup automático y disponibilidad del 99 % (hosting gratuito sin garantías).

### 4.2 Reglas de negocio

| Área | Regla |
| :--- | :--- |
| **Roles** | Solo existen los roles administrador y cliente; el veterinario no opera el sistema. |
| **Agenda y horarios** | Agenda única para toda la veterinaria; una franja no admite más de un turno activo. Atención de lunes a viernes, 09:00 a 19:00, franjas de 30 minutos (última reservable: 18:30). |
| **Disponibilidad** | No se ofrecen franjas pasadas, de fin de semana, feriados, fuera de horario ni a más de 60 días. |
| **Reserva y concurrencia** | El cliente elige una mascota propia activa y un servicio activo; el turno web nace pendiente. Dos clientes no pueden reservar la misma franja: lo impone un índice único y quien pierde recibe 409. |
| **Turno manual** | El administrador crea turnos telefónicos o presenciales; nacen confirmados. |
| **Estados** | `pendiente` $\rightarrow$ `confirmado`/`cancelado`; `confirmado` $\rightarrow$ `atendido`/`ausente`/`cancelado`. Atendido, ausente y cancelado son finales. |
| **Cancelación y reprogramación** | El cliente solo opera turnos propios pendientes o confirmados con al menos 24 h de antelación; al reprogramar vuelve a pendiente. El administrador reprograma sin antelación y conserva el estado. |
| **Urgencias** | El administrador cancela o reprograma sin antelación pero con motivo obligatorio; el sistema marca la urgencia y devuelve el contacto del cliente. |
| **Clientes y contraseñas** | Documento único; email opcional pero único si se informa. Una ficha sin cuenta se vincula solo si coinciden documento y teléfono. Contraseña de 6 o más caracteres con al menos 2 dígitos; 5 fallos bloquean la cuenta. |
| **Mascotas y servicios** | Solo perro y gato. Las mascotas dadas de baja quedan inactivas y no reciben turnos. El cliente solo ve servicios activos. |
| **Historial clínico** | Una atención solo se registra para un turno atendido; es inmutable y no se elimina. Las correcciones se hacen con notas aclaratorias. |
| **Privacidad y auditoría** | La anonimización inactiva la cuenta, desactiva mascotas y cancela turnos futuros sin alterar las atenciones. Clientes, mascotas, turnos y atenciones guardan creador/modificador. |

### 4.3 Riesgos y tratamiento

| Riesgo | Impacto | Tratamiento aplicado |
| :--- | :--- | :--- |
| **Doble reserva de una franja** | Dos clientes con el mismo horario. | Índice único `uq_turnos_franja_activa`; el error `ER_DUP_ENTRY` se responde como `409 FRANJA_OCUPADA`. |
| **Acceso indebido entre usuarios** | Un cliente consulta mascotas, turnos o historial ajenos. | JWT en cookie, middleware de autenticación, filtros por `usuario_id`; recurso ajeno responde 404. |
| **Acceso administrativo no autorizado** | Un cliente modifica agenda, servicios o clientes. | Middleware `roles('admin')` en las rutas administrativas. |
| **Contraseñas expuestas o débiles** | Compromiso de cuentas y datos personales. | Hash bcrypt, validación de contraseña y bloqueo tras cinco fallos. |
| **Datos de entrada inválidos** | Turnos fuera de horario o datos inconsistentes. | Esquemas Zod y validaciones de fecha, horario, feriado y antelación. |
| **Modificación de la historia clínica** | Alteración de información ya registrada. | Triggers MySQL que rechazan UPDATE y DELETE en atenciones; correcciones por notas aclaratorias. |
| **Eliminación accidental de información** | Pérdida de mascotas, clientes o turnos. | Bajas lógicas por estado en lugar de borrado físico. |
| **Zona horaria y fechas** | Turnos en fechas u horas erróneas. | Zona `America/Argentina/Buenos_Aires`, fechas locales y formato uniforme `YYYY-MM-DD` / `HH:mm`. |
| **Pérdida de datos** | La base puede perderse ante un error. | Scripts de recreación y seed; respaldo manual con `mysqldump` (sin backup automático). |
| **Alcance excesivo** | Retraso del flujo central de turnos. | Priorización P0 $\rightarrow$ P1; recordatorios y funciones avanzadas fuera del MVP. |
| **Recuperación por email real** | Requiere SMTP y credenciales externas. | El enlace de recuperación se simula por consola; no se usan servicios ni credenciales reales. |
| **Despliegue Render $\leftrightarrow$ Aiven** | El servidor publicado no iniciaba. | Se corrigió el archivo de configuración env y se ajustaron las variables de entorno de frontend y backend (ver 6.5). |

### 4.4 Maquetas y prototipos
No aplica. No se utilizaron maquetas, bocetos ni herramientas como Figma: el equipo priorizó la implementación funcional guiada por la especificación y el plan de desarrollo (`docs/`). La interfaz se implementó directamente en React con CSS propio, por lo que no hay diferencias que comparar entre prototipo y versión final.

---

## 5. Diseño

### 5.1 Arquitectura

```
+------------------+                    +-----------------------+                    +------------------------+                    +------------------+
|     Usuario      |                    | Frontend React + Vite |                    | Backend Node.js+Express|                    |     MySQL 8      |
|                  |     HTTP(S)        |                       |  REST JSON         |                        |     mysql2         |                  |
|     Cliente /    |<------------------>| Páginas públicas,     |<------------------>| Rutas -> middlewares ->|<------------------>| Base vetgestion  |
|  Administrador   |                    | cliente y admin.      | + cookie JWT       | servicios              |  (consultas param.)| 7 tablas         |
|                  |                    | AuthContext · Axios   | /api/*             | JWT · roles · Zod      |                    | Local / Aiven    |
| Navegador web    |                    | Local: localhost:5173 |                    | Local: localhost:3000  |                    |                  |
|                  |                    | Web: Render           |                    | Web: Render            |                    |                  |
+------------------+                    +-----------------------+                    +------------------------+                    +------------------+
```
*Las flechas indican el sentido de la comunicación: solicitud ($\rightarrow$) y respuesta ($\leftarrow$).*

**Figura 1. Arquitectura de VetGestión.** El usuario accede desde el navegador a una interfaz React; el frontend mantiene la sesión con `AuthContext` y consume la API REST con Axios, enviando una cookie JWT `httpOnly`. Express valida autenticación, rol y datos de entrada (Zod) antes de derivar la operación al servicio correspondiente, donde reside la lógica de negocio. Los servicios acceden a MySQL con consultas parametrizadas mediante un pool de conexiones (`mysql2/promise`). La base conserva los datos, asegura relaciones con claves foráneas y previene turnos simultáneos en una franja con una restricción única. En local se ejecuta todo en `localhost`; en el despliegue, frontend y backend corren en Render y la base en Aiven.

### 5.2 Módulos principales

| Módulo | Responsabilidad | Ubicación |
| :--- | :--- | :--- |
| **Aplicación y configuración** | Express, CORS, Helmet, cookies, rutas y endpoint de salud; carga de configuración y pool MySQL. | `backend/src/app.js`, `server.js`, `config/env.js`, `config/db.js` |
| **Autenticación** | Registro, vinculación de ficha, login, JWT, cierre de sesión, bloqueo y restablecimiento de contraseña. | `backend/src/modules/auth/` |
| **Autorización y validación** | Verifica JWT y roles; esquemas Zod; respuestas de error uniformes. | `backend/src/middlewares/` (`auth.js`, `roles.js`, `validar.js`, `errores.js`) |
| **Clientes (admin)** | Búsqueda, alta, edición, baja, desbloqueo y anonimización de clientes; mascotas del cliente. | `backend/src/modules/clientes/` |
| **Mascotas / Servicios / Feriados** | Mascotas propias y ficha; catálogo de servicios; días no laborables. | `backend/src/modules/mascotas/`, `servicios/`, `feriados/` |
| **Turnos** | Disponibilidad, reserva, cancelación, reprogramación, agenda, estados, turnos manuales y urgencias. | `backend/src/modules/turnos/`, `backend/src/utils/fechas.js` |
| **Atenciones clínicas** | Atenciones de turnos atendidos, historial y notas aclaratorias. | `backend/src/modules/atenciones/` |
| **Base de datos** | Esquema, reinicio y datos de demostración. | `backend/db/schema.sql`, `reset.js`, `seed.js` |
| **Pruebas** | Suites automatizadas de backend (Jest + Supertest). | `backend/tests/` |
| **Cliente HTTP y sesión** | Solicitudes a la API con cookies; recupera la sesión al iniciar. | `frontend/src/api/`, `frontend/src/context/AuthContext.jsx` |
| **Interfaces** | Pantallas públicas, de cliente y de administración. | `frontend/src/pages/publicas/`, `cliente/`, `admin/` |
| **Componentes reutilizables** | Rutas protegidas, navegación, formularios, modales, estado de turno y selector de franja. | `frontend/src/components/` |

### 5.3 Base de datos (MySQL 8, base vetgestion)
La información persiste entre ejecuciones. Relaciones: un usuario tiene muchas mascotas y turnos; un turno pertenece a un servicio y puede originar una atención; una atención tiene muchas notas. `feriados` es independiente.

| Tabla | PK | Claves y relaciones |
| :--- | :--- | :--- |
| **usuarios** | `id` | `documento` y `email` únicos; `creado_por` y `modificado_por` $\rightarrow$ `usuarios.id`. |
| **mascotas** | `id` | `usuario_id` $\rightarrow$ `usuarios.id`; auditoría con `creado_por`/`modificado_por`. |
| **servicios** | `id` | `nombre` único; referenciado por `turnos.servicio_id`. |
| **feriados** | `fecha` | Fecha no laborable y motivo; sin relaciones. |
| **turnos** | `id` | `usuario_id` $\rightarrow$ `usuarios.id`; `mascota_id` $\rightarrow$ `mascotas.id`; `servicio_id` $\rightarrow$ `servicios.id`; auditoría hacia `usuarios.id`. |
| **atenciones** | `id` | `turno_id` $\rightarrow$ `turnos.id` (único: una atención por turno); `mascota_id` $\rightarrow$ `mascotas.id`; `creado_por` $\rightarrow$ `usuarios.id`. |
| **notas_atencion** | `id` | `atencion_id` $\rightarrow$ `atenciones.id`; `creado_por` $\rightarrow$ `usuarios.id`. |

* **Integridad:** `turnos.fecha_hora_activa` es una columna generada que vale `NULL` si el turno está cancelado; el índice único `uq_turnos_franja_activa` impide dos turnos activos en la misma franja; los triggers `atenciones_no_update` y `atenciones_no_delete` impiden editar o borrar atenciones; las bajas de clientes y mascotas son lógicas (por estado).

### 5.4 Tecnologías, versiones y justificación

| Capa | Tecnología | Capa | Tecnología |
| :--- | :--- | :--- | :--- |
| **Entorno** | Node.js 20 | **Base de datos** | MySQL 8 (local y Aiven) |
| **Backend** | Express 4.22.3 | **Acceso a datos** | mysql2 3.24.6 |
| **Contraseñas** | bcryptjs 2.4.3 | **Sesiones** | jsonwebtoken 9.0.3, cookie-parser 1.4.7 |
| **Validación** | Zod 3.25.76 | **Seguridad HTTP** | Helmet 8.3.0, cors 2.8.6 |
| **Configuración** | dotenv 16.6.1 | **Frontend** | React / React DOM 18.3.1, Vite 5.4.21 |
| **Enrutado** | react-router-dom 6.30.6 | **HTTP y fechas** | Axios 1.20.0, dayjs 1.11.23 |
| **Pruebas** | Jest 29.7.0, Supertest 7.3.1 | **Desarrollo** | Nodemon 3.1.14 |

* **React y Vite:** interfaz ágil, organizada en pantallas para dos perfiles distintos con recorridos simples.
* **Express modular:** mantiene en el servidor las reglas sensibles (antelación, estados, disponibilidad), sin depender del navegador.
* **MySQL 8:** los datos son relacionales (cliente $\rightarrow$ mascotas $\rightarrow$ turnos $\rightarrow$ atenciones); claves foráneas e índices únicos protegen esas relaciones y resuelven la concurrencia aun con reservas simultáneas.
* **JWT en cookie httpOnly, bcrypt, Zod y consultas parametrizadas:** protegen datos personales y clínicos (sesión inaccesible a JavaScript, sin contraseñas en texto plano, entradas validadas, sin inyección SQL).
* **Triggers en atenciones:** trasladan la inmutabilidad clínica a la base, que se mantiene aunque la modificación se intente fuera de la interfaz.

---

## 6. Implementación

### 6.1 Árbol de carpetas y código entregado

```text
vetGestion/
├── AGENTS.md
├── README.md
├── docs/
│   ├── DECISIONES.md
│   ├── especificacion_proyecto_veterinario.md
│   └── plan_desarrollo_mvp_vetgestion.md
├── backend/
│   ├── db/ (reset.js, schema.sql, seed.js)
│   ├── src/
│   │   ├── config/  middlewares/  utils/
│   │   ├── modules/
│   │   │   ├── atenciones/  auth/  clientes/
│   │   │   └── feriados/  mascotas/  servicios/  turnos/
│   │   ├── app.js
│   │   └── server.js
│   ├── tests/
│   ├── package.json
│   └── package-lock.json
└── frontend/
    ├── src/
    │   ├── api/
    │   ├── components/
    │   ├── context/
    │   ├── pages/
    │   │   ├── admin/
    │   │   ├── cliente/
    │   │   └── publicas/
    │   ├── App.jsx
    │   ├── main.jsx
    │   └── styles.css
    ├── package.json
    ├── package-lock.json
    └── vite.config.js
```
El código fuente completo de los archivos propios (con su ruta relativa) está en `Equipo07_Codigo.txt`, archivo único.

### 6.2 Estado de las funcionalidades

| Estado | Requisitos | Qué falta |
| :--- | :--- | :--- |
| **Completa** | RF-01, 02, 04 a 13, 15, 16, 18, 19, 20 | — |
| **Parcial** | RF-03 | El envío de email de recuperación es simulado (enlace en consola); no hay SMTP real. |
| **Parcial** | RF-14 | Falta la baja lógica de mascota realizada por el administrador. |
| **Parcial** | RF-17 | La respuesta de duplicado no incluye el id de la ficha existente. |
| **No implementada** | Recordatorios por email | Fuera de alcance, sin requisito asociado. |

### 6.3 Requisitos previos
Node.js 20 y npm (incluido con Node.js); MySQL 8 local en ejecución; navegador moderno; dos terminales. No se requiere IDE.

### 6.4 Instalación y ejecución local
1. Abrir una terminal en la carpeta raíz del proyecto (`vetGestion/`).
2. Instalar dependencias del backend: `cd backend && npm install`.
3. Crear `backend/.env` (según el README) con los siguientes valores locales (`JWT_SECRET` y `DB_PASSWORD` deben completarse con valores propios):

```env
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=vetgestion
JWT_SECRET=cambiar_esto
FRONTEND_URL=http://localhost:5173
HORA_INICIO=09:00
HORA_FIN=19:00
SLOT_MINUTOS=30
ANTELACION_HS=24
DIAS_MAX_RESERVA=60
TZ=America/Argentina/Buenos_Aires
```

4. Crear la estructura de la base local: `npm run db:reset`. Cargar los datos ficticios de demostración: `npm run seed`.
5. Instalar dependencias del frontend: `cd ../frontend && npm install`.
6. Iniciar el backend (terminal 1, carpeta backend): `npm run dev`. La API queda en `http://localhost:3000`.
7. Iniciar el frontend (terminal 2, carpeta frontend): `npm run dev`. La interfaz queda en `http://localhost:5173`.
8. Abrir `http://localhost:5173`. Inicio correcto: se muestra la pantalla de inicio pública y es posible ingresar con las cuentas de la sección 6.6.

### 6.5 Despliegue en la web
Además de la ejecución local, la aplicación fue desplegada. La documentación no depende de este servicio: todo puede evaluarse en local.

| Componente | Servicio | URL / detalle |
| :--- | :--- | :--- |
| **Frontend** | Render | [https://vetgestionfrontend.onrender.com/](https://vetgestionfrontend.onrender.com/) — variable de entorno: `VITE_API_URL` (URL del backend). |
| **Backend (API)** | Render | [https://vetgestion.onrender.com/](https://vetgestion.onrender.com/) — variables: `ANTELACION_HS`, `DB_HOST`, `DB_NAME`, `DB_PASSWORD`, `DB_PORT`, `DB_SSL_CA`, `DB_USER`, `DIAS_MAX_RESERVA`, `FRONTEND_URL`, `HORA_FIN`, `HORA_INICIO`, `JWT_SECRET`, `NODE_ENV`, `SLOT_MINUTOS`, `TZ`. |
| **Base de datos** | Aiven (MySQL) | La base MySQL local se importó en la instancia de Aiven; la conexión usa SSL mediante `DB_SSL_CA`. |

1. Importar en Aiven la base MySQL generada localmente y obtener host, puerto, usuario, contraseña y certificado CA.
2. Crear el servicio del backend en Render apuntando al repositorio (carpeta backend). Comandos de build y start: `npm install` / `npm start`. Cargar las variables de entorno listadas, con los valores de Aiven.
3. Crear el servicio del frontend en Render (carpeta frontend) con la variable `VITE_API_URL` apuntando a la URL del backend. Comandos de build y publicación: `npm install && npm run build`.
4. En el backend, `FRONTEND_URL` debe coincidir con la URL pública del frontend (CORS y cookies).

> **Incidente resuelto:** el servidor publicado no iniciaba. Se corrigió el archivo de configuración `env` del código y se ajustaron los valores de las variables de entorno en ambos servicios. Datos: el sitio publicado usa las mismas cuentas de demostración; además contiene cuentas creadas por personas que probaron la aplicación (sus contraseñas son desconocidas para el equipo y no se incluyen en este informe).

### 6.6 Cuentas de demostración (ficticias)

| Rol | Documento | Contraseña |
| :--- | :--- | :--- |
| **Administrador** | `00000000` | `Admin12` |
| **Cliente:** Luciana García | `28765432` | `Demo12` |
| **Cliente:** Martín Ferreyra | `31999888` | `Demo12` |

*Se generan con el seed; no corresponden a servicios reales.*

### 6.7 Capturas de los recorridos principales
Las 9 capturas están en el Anexo 1. Cada una indica la acción realizada, el resultado que muestra y el RF relacionado. Las capturas muestran resultados puntuales; se complementan con los casos de prueba y las suites automatizadas de la sección 7.

---

## 7. Pruebas y trazabilidad

Los casos CP-01 a CP-22 se ejecutaron con datos ficticios. La columna de evidencia indica si la verificación se respalda con una captura del Anexo 1 (recorrido manual) y/o con la suite automatizada de backend indicada (Jest + Supertest). Para cada RF existe al menos un caso; los casos de rechazo (negativos) están marcados con (−).

### 7.1 Casos de prueba

| ID · RF | Precondiciones y datos | Pasos | Resultado esperado | Resultado obtenido | Estado y evidencia |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **CP-01**<br>(RF-01) | Ficha sin cuenta: Sofía Peralta, doc. 35123456, tel. 1166778899. | 1. Registrarse con ese documento y teléfono.<br>2. Definir contraseña válida. | Se vincula la ficha existente; no se duplica el cliente. | Coincide: cuenta vinculada, sin cliente nuevo. | Aprobada · `auth.test.js` |
| **CP-02 (−)**<br>(RF-01) | Email ya existente: `luciana.garcia@example.com`. | 1. Registrar otro documento con ese email. | Error 409 de email duplicado. | Coincide: 409, sin alta. | Aprobada · `auth.test.js` |
| **CP-22 (−)**<br>(RF-01) | Datos válidos, consentimiento sin aceptar. | 1. Enviar el registro sin consentimiento. | Rechazo 400; no se crea la cuenta. | Coincide: 400, sin cuenta. | Aprobada · `auth.test.js` |
| **CP-03 (−)**<br>(RF-02) | Usuario anónimo; credenciales inválidas ficticias. | 1. Acceder a una ruta privada.<br>2. Login con contraseña incorrecta. | Ruta rechazada (401); autenticación denegada. | Coincide: 401 en ambos pasos. | Aprobada · `auth.test.js`, `autorizacion.test.js`; Captura 1 (login correcto) |
| **CP-04 (−)**<br>(RF-03) | Cliente de prueba creado para este caso. | 1. Cinco inicios de sesión fallidos.<br>2. Sexto con contraseña correcta. | Cuenta bloqueada; respuesta 423. | Coincide: 423 en el sexto intento. | Aprobada · `auth.test.js` |
| **CP-05**<br>(RF-04) | Cliente autenticado. | 1. Pulsar «Cerrar sesión».<br>2. Abrir `/turnos`. | Se cierra la sesión y la ruta vuelve a exigir autenticación. | Coincide: redirige al ingreso. | Aprobada · `auth.test.js` |
| **CP-06 (−)**<br>(RF-05, RF-07) | Luciana (cliente A) y mascota de Martín (cliente B). | 1. Como Luciana, abrir o editar la mascota de Martín por URL o API. | Respuesta 404; no se revelan datos ajenos. | Coincide: 404 sin datos. | Aprobada · `mascotas.test.js`, `autorizacion.test.js`; Captura 2 (alta propia) |
| **CP-07**<br>(RF-06) | Luciana autenticada; mascota Mora existente. | 1. Abrir la ficha de Mora.<br>2. Revisar especie, raza, sexo, fecha, edad, peso, esterilización, microchip, alergias. | Datos correctos; sin registros clínicos aparece «Sin atenciones». | Coincide: ficha completa. | Aprobada · Captura 2; `mascotas.test.js` |
| **CP-08 (−)**<br>(RF-08) | Cliente autenticado. | 1. Intentar reservar sin mascota, servicio, fecha o franja.<br>2. Usar un servicio inactivo. | Se bloquea el envío o hay error controlado; no se crea turno. | Coincide: sin turno creado. | Aprobada · `turnos-cliente.test.js`; Captura 3 (reserva correcta) |
| **CP-09 (−)**<br>(RF-08) | Fecha pasada, fin de semana, feriado y hora 09:15 o 19:00. | 1. Consultar disponibilidad o intentar reservar cada valor. | No se ofrecen franjas inválidas; rechazo controlado. | Coincide: no se ofrecen / se rechazan. | Aprobada · `turnos.test.js` |
| **CP-21 (−)**<br>(RF-09) | Una franja libre; dos clientes. | 1. Ambos confirman la misma franja a la vez. | Uno recibe 201, el otro 409; queda un único turno. | Coincide: 201 y 409; un turno. | Aprobada · `turnos.test.js` |
| **CP-10**<br>(RF-10) | Luciana con turnos del seed o creados. | 1. Abrir `/turnos`. | Solo turnos propios, con mascota, servicio, fecha, hora y estado. | Coincide: solo los propios. | Aprobada · Captura 1; `turnos-cliente.test.js` |
| **CP-11 (−)**<br>(RF-11) | Turno propio a menos de 24 h. | 1. Intentar cancelar.<br>2. Intentar reprogramar. | Rechazo `ANTELACION_INSUFICIENTE`; el turno no cambia. | Coincide: rechazo, turno intacto. | Aprobada · `turnos-cliente.test.js`; Captura 4 (con antelación) |
| **CP-12**<br>(RF-12) | Cliente con mascota con atención registrada. | 1. Abrir `/mascotas/:id`.<br>2. Revisar atención y notas. | Historial completo, más reciente primero, sin edición. | Coincide: orden y solo lectura. | Aprobada · `atenciones.test.js` |
| **CP-13 (−)**<br>(RF-13) | Administrador; servicio ficticio de prueba. | 1. Dar de alta/editar un servicio.<br>2. Desactivarlo.<br>3. Como cliente, buscarlo al reservar. | El cambio se refleja; el servicio inactivo no se ofrece. | Coincide: no aparece al cliente. | Aprobada · `servicios.test.js` |
| **CP-14**<br>(RF-14) | Administrador autenticado. | 1. En la ficha de un cliente, crear una mascota. | Mascota creada y asociada al cliente correcto. | Coincide: asociada al cliente. | Aprobada · `clientes-admin.test.js` |
| **CP-15**<br>(RF-15) | Administrador; datos seed. | 1. Abrir `/admin/agenda`.<br>2. Alternar vista diaria y semanal.<br>3. Verificar datos del turno. | Franjas, cliente, mascota, servicio, canal y estado. | Coincide: datos completos. | Aprobada · Capturas 5 y 6; `agenda-admin.test.js` |
| **CP-16 (−)**<br>(RF-16) | Feriado existente, p. ej. 2026-12-08. | 1. Cargar la misma fecha. | Rechazo 409: ya existe un feriado en esa fecha. | Coincide: 409. | Aprobada · `feriados.test.js`; Captura 9 (alta/baja) |
| **CP-17 (−)**<br>(RF-17) | Administrador; documento/email ya registrados. | 1. Alta con documento de Luciana.<br>2. Repetir con su email. | Rechazo 409 e identificación de la ficha existente. | Coincide: 409 con nombre; no devuelve el id. | Aprobada (RF parcial) · `clientes-admin.test.js` |
| **CP-18 (−)**<br>(RF-18) | Administrador; turno activo. | 1. Intentar una urgencia sin motivo. | Rechazo de validación; el turno no cambia. | Coincide: rechazo, turno intacto. | Aprobada · `turnos-admin-estados-urgencia.test.js`; Captura 7 (urgencia correcta) |
| **CP-19**<br>(RF-19) | Administrador; turno atendido. | 1. «Registrar atención».<br>2. Completar campos clínicos.<br>3. Guardar. | Una única atención asociada al turno y a la mascota. | Coincide: atención única. | Aprobada · Captura 8; `atenciones.test.js` |
| **CP-20 (−)**<br>(RF-20) | Atención existente. | 1. Intentar agregar una nota vacía. | Rechazo de validación; no se agrega. | Coincide: sin nota agregada. | Aprobada · `atenciones.test.js` |

### 7.2 Matriz de trazabilidad

| ID | Criterio de aceptación | Implementación (archivo: función/clase) | Prueba | Estado |
| :--- | :--- | :--- | :--- | :--- |
| **RF-01** | Vincular ficha sin cuenta; rechazar email duplicado y alta sin consentimiento. | `backend/src/modules/auth/service.js`: registro<br>`frontend/src/pages/publicas/Registro.jsx`: Registro | CP-01, 02, 22 | Completo |
| **RF-02** | Rechazar acceso privado sin sesión y credenciales inválidas. | `backend/src/modules/auth/service.js`: login<br>`backend/src/middlewares/auth.js`: auth<br>`frontend/src/components/RutaProtegida.jsx` | CP-03 | Completo |
| **RF-03** | Bloquear la cuenta tras cinco intentos fallidos. | `backend/src/modules/auth/service.js`: login | CP-04 | Parcial (envío de email simulado) |
| **RF-04** | Cerrar sesión e impedir el acceso posterior a rutas privadas. | `backend/src/modules/auth/service.js`: cerrarSesion<br>`backend/src/modules/auth/routes.js` | CP-05 | Completo |
| **RF-05** | Impedir consultar o editar mascotas ajenas (404). | `backend/src/modules/mascotas/service.js`: obtener, actualizar<br>`backend/src/modules/mascotas/routes.js` | CP-06 | Completo |
| **RF-06** | Mostrar los datos completos de la ficha. | `backend/src/modules/mascotas/service.js`: obtener<br>`frontend/src/pages/cliente/MascotaFicha.jsx`: MascotaFicha, calcularEdad | CP-07 | Completo |
| **RF-07** | El cliente consulta solo sus mascotas; las ajenas dan 404. | `backend/src/modules/mascotas/service.js`: obtener<br>`frontend/src/pages/cliente/MascotaFicha.jsx`: MascotaFicha | CP-06 | Completo |
| **RF-08** | Rechazar reserva incompleta, con servicio inactivo o en franja inválida. | `backend/src/modules/turnos/service.js`: crearComoCliente, disponibilidad<br>`backend/src/modules/turnos/schema.js`: crearTurnoSchema<br>`backend/src/utils/fechas.js`: validarFranja<br>`frontend/src/pages/cliente/ReservarTurno.jsx`: ReservarTurno | CP-08, 09 | Completo |
| **RF-09** | Una sola reserva por franja; la segunda recibe 409. | `backend/db/schema.sql`: índice `uq_turnos_franja_activa`<br>`backend/src/modules/turnos/service.js`: crearComoCliente | CP-21 | Completo |
| **RF-10** | Listar exclusivamente los turnos propios con datos y estado. | `backend/src/modules/turnos/service.js`: misTurnos<br>`frontend/src/pages/cliente/MisTurnos.jsx`: MisTurnos | CP-10 | Completo |
| **RF-11** | Rechazar cancelación/reprogramación sin antelación suficiente. | `backend/src/modules/turnos/service.js`: cancelarComoCliente, reprogramarComoCliente<br>`frontend/src/pages/cliente/MisTurnos.jsx`: MisTurnos | CP-11 | Completo |
| **RF-12** | Mostrar historial clínico y notas en modo lectura. | `backend/src/modules/atenciones/service.js`: obtenerHistorial<br>`frontend/src/pages/cliente/MascotaFicha.jsx`: MascotaFicha | CP-12 | Completo |
| **RF-13** | El servicio desactivado no se ofrece al cliente. | `backend/src/modules/servicios/service.js`: crear, actualizar<br>`frontend/src/pages/admin/` (pantalla de servicios) | CP-13 | Completo |
| **RF-14** | Crear una mascota desde la ficha administrativa de un cliente. | `backend/src/modules/clientes/service.js`: crearMascotaCliente<br>`backend/src/modules/clientes/routes.js`<br>`frontend/src/pages/admin/ClienteFicha.jsx`: ClienteFicha | CP-14 | Parcial (sin baja de mascota) |
| **RF-15** | Mostrar la agenda diaria y semanal con los datos de cada turno. | `backend/src/modules/turnos/service.js`: listarAgendaAdmin<br>`frontend/src/pages/admin/Agenda.jsx`: Agenda | CP-15 | Completo |
| **RF-16** | Rechazar el alta de un feriado existente. | `backend/src/modules/feriados/service.js`: crear<br>`backend/src/modules/feriados/routes.js`<br>`frontend/src/pages/admin/Feriados.jsx`: Feriados | CP-16 | Completo |
| **RF-17** | Rechazar cliente duplicado por documento o email e identificar la ficha. | `backend/src/modules/clientes/service.js`: crearCliente, actualizarCliente<br>`frontend/src/pages/admin/ClienteAlta.jsx`: ClienteAlta | CP-17 | Parcial (falta id en la respuesta) |
| **RF-18** | Rechazar urgencia sin motivo y conservar el turno. | `backend/src/modules/turnos/service.js`: urgencia<br>`backend/src/modules/turnos/schema.js`: urgenciaSchema<br>`frontend/src/pages/admin/Agenda.jsx`: Agenda | CP-18 | Completo |
| **RF-19** | Registrar una atención única para un turno atendido. | `backend/src/modules/atenciones/service.js`: cargarAtencion<br>`backend/src/modules/turnos/routes.js`<br>`frontend/src/pages/admin/Agenda.jsx`: Agenda | CP-19 | Completo |
| **RF-20** | Rechazar una nota aclaratoria vacía. | `backend/src/modules/atenciones/service.js`: agregarNota<br>`backend/src/modules/atenciones/schema.js`: notaSchema<br>`frontend/src/pages/admin/Agenda.jsx`: Agenda | CP-20 | Completo |

### 7.3 Evidencia automatizada
Se ejecutó `npm test` en `backend/` con el siguiente resultado:

```text
Test Suites: 14 passed, 15 total
Tests:       158 passed, 158 total
Snapshots:   0 total
Time:        13.723 s
```
* **Suites:** auth, autorizacion, mascotas, turnos, turnos-cliente, agenda-admin, turnos-admin-estados-urgencia, atenciones, clientes-admin, feriados, servicios y desbloqueo-admin (archivos `*.test.js` en `backend/tests/`). 
* Las suites cubren autenticación, autorización, concurrencia, disponibilidad, agenda, urgencias, atenciones, anonimización y desbloqueo.

---

## 8. Cierre, aportes y fuentes

### 8.1 Errores conocidos, limitaciones y pendientes

| Tipo | Descripción | Requisito afectado | Estado |
| :--- | :--- | :--- | :--- |
| **Limitación funcional** | No existen recordatorios automáticos por email 24 h antes del turno. | Ninguno (fuera de alcance) | Trabajo futuro |
| **Limitación funcional** | El administrador no puede dar de baja (baja lógica) una mascota; solo crearla desde la ficha del cliente. | RF-14 | Pendiente |
| **Limitación técnica** | La recuperación de contraseña se simula: el enlace se imprime en la consola del backend, sin SMTP real. | RF-03 | Aceptado para el alcance del proyecto |
| **Error conocido** | El rechazo por documento/email duplicado informa el nombre del cliente pero no incluye el id de la ficha. | RF-17 | Pendiente |
| **Limitación funcional** | El cliente no puede editar su propio perfil; la rectificación la hace el administrador. | RNF-04 | Pendiente |
| **Limitación de verificación** | No se midieron tiempos de respuesta ni se probó con usuarios; la disponibilidad no está garantizada (planes gratuitos) y no hay backup automático. | RNF-07, 08, 09 y 06 | No verificado / fuera de alcance |
| **Incidente resuelto** | Al desplegar, el servidor publicado no iniciaba por la configuración de variables de entorno (Render $\leftrightarrow$ Aiven). | Ninguno (infraestructura) | Resuelto |

*No se reportaron errores funcionales activos en los casos documentados: CP-01 a CP-22 aprobados.*

### 8.2 Aportes de cada integrante

| Integrante | Aportes principales | Tareas y archivos concretos |
| :--- | :--- | :--- |
| **Franco** | Backend, base de datos, lógica de negocio, seguridad y pruebas automatizadas. | **Servidor y configuración:** `backend/src/app.js`, `server.js`, `config/`.<br>**Base de datos y demo:** `backend/db/schema.sql`, `reset.js`, `seed.js`.<br>**Módulos:** `backend/src/modules/` (auth, clientes, mascotas, servicios, feriados, turnos, atenciones).<br>**Pruebas:** `backend/tests/`. |
| **Gisella** | Frontend, recorridos por rol, componentes reutilizables, lógica de negocio y pruebas funcionales manuales. | **Rutas y entrada:** `frontend/src/App.jsx`, `main.jsx`.<br>**Sesión y API:** `frontend/src/context/AuthContext.jsx`, `frontend/src/api/`.<br>**Componentes:** `frontend/src/components/`.<br>**Pantallas:** `frontend/src/pages/`.<br>**Pruebas funcionales manuales:** CP-01 a CP-22. |
| **Ambos** | Integración por ramas, despliegue, revisión de requerimientos y criterios de aceptación. | Git/GitHub con ramas; configuración de frontend, backend y base remota en Render/Aiven; QA-01 y DEP-01. |

### 8.3 Conclusiones del equipo
El proyecto permitió construir un sistema de turnos con agenda única, control de disponibilidad, autenticación por roles, gestión de clientes y mascotas y registro clínico inmutable. El flujo principal (registrarse, cargar una mascota, reservar un turno, administrarlo y consultar el historial) quedó cubierto por la implementación y los casos de prueba. Durante la cursada, el cambio de docente y las nuevas condiciones de despliegue exigieron adaptar el trabajo en poco tiempo, lo que impulsó el aprendizaje de Render, Aiven, GitHub y el trabajo colaborativo con ramas. La experiencia representó una situación frecuente en equipos reales: adaptar una solución y su forma de trabajo ante requisitos que cambian durante el desarrollo.

### 8.4 Fuentes y recursos ajenos
No se incorporaron imágenes externas, fragmentos de código de terceros ni tutoriales copiados. Se realizaron consultas exploratorias en plataformas oficiales; no se conservaron los enlaces puntuales, por lo que se consignan como referencias generales, sin atribuirles código específico.

| Organización | Recurso | Enlace | Consulta | Uso |
| :--- | :--- | :--- | :---: | :--- |
| **Render** | Sitio oficial | `render.com` | 03/11/2026 | Orientación general para publicar frontend y backend. |
| **Aiven** | Sitio oficial | `aiven.io` | 03/11/2026 | Orientación sobre conexión y administración de base remota. |
| **GitHub** | Sitio oficial | `github.com` | 03/11/2026 | Repositorio, ramas e integración del trabajo en equipo. |

### 8.5 Uso de IA generativa

| Aspecto | Detalle |
| :--- | :--- |
| **Herramientas y modelos** | OpenCode (modelo MiMo V2 Flash Free), Kilo Code (modelo Nemotron 3.5 Lightning) y Antigravity (modelo por defecto de la herramienta). |
| **Para qué se usó** | Interpretar y llevar a código los requerimientos funcionales y no funcionales; descomponer historias de usuario en tareas; implementar criterios de aceptación, validaciones y estructura de módulos. |
| **Cómo se verificó** | (1) Revisión manual del código generado.<br>(2) Pruebas automatizadas de backend (158 pruebas aprobadas) y recorridos manuales de los casos CP-01 a CP-22.<br>El desarrollo se guió con la arquitectura definida por el equipo y con los documentos `AGENTS.md`, la especificación y el plan de desarrollo (carpeta `docs/`). |
| **Privacidad** | No se adjuntan conversaciones completas ni datos sensibles. |