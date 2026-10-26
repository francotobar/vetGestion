# Idea Proyecto

## Sistema Web de Gestión de Turnos para una Veterinaria (vetGestión)

Plataforma web que ordena la atención de una veterinaria mediante turnos: permite administrar clientes, mascotas y turnos, y da a los clientes un medio para reservar turnos y consultar la información e historial clínico de sus mascotas. Existen dos roles: **Cliente** y **Administrador**.

## Problemática

En el modelo actual, la veterinaria funciona sin sistema digital: los clientes llegan de forma presencial y sin turno previo. Esto genera:

* Aglomeración de mascotas en la sala de espera, con situaciones de tensión y estrés en los animales (cruces entre perros reactivos, gatos y otros animales).
* Desorden administrativo en la asignación de tiempos de atención.
* Información clínica de las mascotas dispersa o inexistente.

**Objetivo principal:** reducir la aglomeración en la sala de espera mediante un sistema de turnos con una única agenda, de franjas de 30 minutos, que pueda ser operado tanto por los clientes (web) como por el administrador (teléfono y mostrador).

---

## Reglas de negocio vigentes (decisiones cerradas)

| Tema | Regla |
| --- | --- |
| Roles | Solo **Administrador** y **Cliente**. El profesional veterinario atiende de forma presencial y **no tiene acceso al sistema**. El administrador **no** es profesional. |
| Agenda | **Agenda única**. Un solo turno por franja para toda la clínica. No se asigna ni se elige profesional. |
| Franjas | Cada 30 minutos, de 09:00 a 19:00 (última franja 18:30). Cada turno ocupa una franja. |
| Días | Lunes a viernes. Los feriados no se trabaja (los carga el administrador). |
| Zona horaria | America/Argentina/Buenos_Aires. |
| Especies | Solo **perro** y **gato**. Raza como texto libre. |
| Registro | Para reservar online, el cliente debe registrarse con datos personales. No existen clientes "invitados". |
| Identificador de login | **Documento** (DNI) + contraseña. El email es opcional. |
| Contraseña | Mínimo 6 caracteres y al menos 2 números. |
| Bloqueo | Tras 5 intentos fallidos la cuenta se bloquea. Con email: se desbloquea ingresando el email. Sin email: solo lo desbloquea el administrador. |
| Estados del turno | pendiente, confirmado, cancelado, atendido, ausente. Lo confirma el **administrador**. |
| Franja ocupada | Ocupan franja los turnos pendiente, confirmado, atendido y ausente. Cancelar libera la franja. |
| Historial clínico | Lo carga el **administrador**. El cliente ve el historial completo de sus mascotas (solo lectura). Si no hay registros se muestra "Sin atenciones". Los registros son inmutables; se corrigen con una **nota aclaratoria**. |
| Despliegue | No se despliega. Se desarrolla y se presenta localmente. |
| Marco legal | Ley 25.326 de Protección de los Datos Personales. |

---

## Requerimientos Funcionales

### Gestión de Identidad y Acceso
* **RF01 – Registro de clientes:** Dos formas de alta:
  * **(a)** Registro propio del cliente con credenciales. Datos obligatorios: nombre, apellido, documento, teléfono y contraseña; email opcional. Debe aceptar el consentimiento de tratamiento de datos.
  * **(b)** Alta asistida por el administrador (cliente sin cuenta). Obligatorios: nombre, apellido, documento y teléfono; email opcional.
  * Si un cliente con alta asistida se registra después con el mismo documento, el sistema **vincula la cuenta a la ficha existente** (no crea otra).
* **RF02 – Autenticación:** El sistema debe autenticar con documento y contraseña, y otorgar permisos según el rol (Administrador / Cliente).
* **RF03 – Bloqueo y recuperación de credenciales:**
  * La cuenta se bloquea tras 5 intentos fallidos consecutivos.
  * Si el usuario tiene email, puede desbloquearla y restablecer su contraseña ingresando ese email.
  * Si no tiene email, solo el administrador puede desbloquearla (asignando una contraseña temporal).
* **RF04 – Cierre de sesión:** El sistema debe permitir cerrar sesión.

### Cliente
* **RF05 – Gestión de mascotas:** El cliente puede registrar, editar y dar de baja una o más mascotas propias (relación 1:N).
* **RF06 – Ficha de mascota:** nombre, especie (perro/gato), raza, sexo, fecha de nacimiento (la edad se calcula), peso, esterilización, microchip (opcional) y alergias o condiciones preexistentes. El teléfono pertenece al perfil del cliente. La ficha figura con "Sin atenciones" mientras no tenga registros clínicos.
* **RF07 – Consulta de ficha:** El cliente consulta la ficha de sus mascotas. No puede ver mascotas de otros clientes.
* **RF08 – Solicitud de turnos:** El cliente elige mascota, servicio del catálogo, fecha y franja libre. No elige profesional. El turno queda en estado *pendiente*.
* **RF09 – Validación de disponibilidad y concurrencia:** No pueden existir dos turnos activos en la misma franja, sin importar el canal (web, teléfono, mostrador). Debe resolverse en la base de datos con una restricción única, y el backend debe responder un error controlado (409) a quien pierde la carrera.
* **RF10 – Consulta de turnos:** El cliente lista sus turnos con su estado.
* **RF11 – Cancelación y reprogramación:** El cliente puede cancelar o reprogramar un turno con una antelación mínima configurable (por defecto 24 h). Un turno reprogramado por el cliente vuelve a *pendiente*.
* **RF12 – Historial clínico:** El cliente consulta el historial **completo** de cada mascota (fecha, servicio, anamnesis, diagnóstico, tratamiento, medicación, vacunas, observaciones y notas aclaratorias).
* **RF13 – Notificaciones de recordatorio:** *Fuera del MVP (trabajo futuro).* Recordatorio por email 24 h antes, con consentimiento del cliente.

### Profesional (Médico Veterinario)
* **RF14 a RF17 – Eliminados.** El profesional no accede al sistema.
* **RF18 – Estado del turno:** *Pasa al Administrador* (ver RF21).

### Administrador
* **RF19 – Gestión de servicios:** Alta, modificación y baja lógica del catálogo de servicios (nombre, descripción, activo). Los clientes ven y eligen solo servicios activos.
* **RF20 – Gestión de clientes y mascotas:** CRUD de clientes y sus mascotas, con estado de cuenta (con cuenta / sin cuenta / inactiva).
* **RF21 – Gestión de turnos:**
  * Ver la agenda por día y por semana.
  * Crear turnos manuales (canal telefónico o presencial) para un cliente existente; si el cliente no existe, se lo da de alta asistida (RF01b). El turno manual nace *confirmado*.
  * Confirmar turnos pendientes, cancelarlos, reprogramarlos y marcarlos como *atendido* o *ausente*.
  * Cada turno registra su canal de origen (web / telefónico / presencial) y quién lo cargó.
  * Transiciones válidas: pendiente → confirmado | cancelado; confirmado → atendido | ausente | cancelado. Los estados atendido, ausente y cancelado son finales.
* **RF22 – Gestión de personal:** *Eliminado.* Existe una cuenta de administrador inicial creada por seed.
* **RF23 – Gestión de horarios y feriados:** El administrador carga y elimina feriados. El horario (09:00–19:00, 30 min, lunes a viernes) es configuración del sistema. Las franjas en feriados o fuera de horario no se ofrecen.
* **RF24 – Prevención de duplicados:** Al dar de alta un cliente, el sistema rechaza documento o email ya existentes e informa a qué ficha corresponden (para reutilizarla).
* **RF25 – Urgencias:** El administrador puede cancelar o reprogramar cualquier turno por urgencia médica, sin respetar la antelación mínima, indicando un motivo. El sistema marca el turno como urgencia y muestra el contacto (teléfono y email si existe) de los clientes afectados para que el administrador los avise manualmente.
* **RF26 – Registro de atención clínica:** Para un turno *atendido*, el administrador carga la atención: nombre del profesional que atendió (texto), anamnesis, diagnóstico, tratamiento, medicación, vacunas aplicadas y observaciones. Queda asociada al turno y a la mascota, y es **inmutable** una vez guardada.
* **RF27 – Nota aclaratoria:** El administrador puede agregar notas aclaratorias a una atención ya cargada. La nota no modifica el registro original; se muestra debajo con fecha y autor.

---

## Requerimientos No Funcionales

* **RNF01 – Autenticación obligatoria:** Toda funcionalidad privada exige autenticación y la autorización se valida del lado del servidor.
* **RNF02 – Seguridad de datos:**
  * Contraseñas con hash y salt (bcrypt); nunca en texto plano.
  * Medidas contra inyección SQL (consultas parametrizadas), XSS y CSRF (cookie httpOnly + SameSite).
  * Bloqueo tras 5 intentos fallidos (RF03).
  * HTTPS/TLS: requisito para un despliegue real; fuera de alcance mientras no se despliegue.
* **RNF03 – Diseño adaptable:** Interfaz responsive para escritorio, tablet y móvil en navegadores modernos.
* **RNF04 – Tratamiento de datos y privacidad (Ley 25.326):**
  * Se registra el consentimiento del cliente (fecha y hora) al crear la cuenta.
  * Rectificación: el cliente edita sus datos de perfil; el administrador puede editar los de cualquier cliente.
  * Supresión a pedido: se **anonimiza** el cliente (datos personales reemplazados, cuenta inactiva). Los registros clínicos se conservan desvinculados de la identidad por su inmutabilidad y obligación de conservación. *Verificar el criterio con el docente.*
* **RNF05 – Auditoría:** Los turnos, clientes, mascotas y atenciones guardan quién los creó y modificó (usuario y fecha).
* **RNF06 – Integridad y respaldo:** Claves foráneas e índices únicos en la base. Respaldo mediante script `mysqldump` documentado (no automático).
* **RNF07 – Rendimiento:** Consultas habituales en menos de 2 segundos en condiciones normales.
* **RNF08 – Usabilidad:** Solicitar un turno en pocos pasos y sin capacitación previa.
* **RNF09 – Disponibilidad:** *No aplica* mientras el sistema no se despliegue.

---

## Historias de Usuario

### Login
* **Como** CLIENTE **quiero** registrarme con mis datos personales **para** solicitar turnos para mis mascotas.
* **Como** CLIENTE REGISTRADO **quiero** iniciar sesión **para** ver y gestionar mis turnos.
* **Como** CLIENTE **quiero** desbloquear mi cuenta con mi email **para** volver a ingresar si me bloqueé.
* **Como** CLIENTE **quiero** cerrar sesión **para** proteger mi cuenta.
* **Como** ADMINISTRADOR **quiero** desbloquear cuentas y gestionar clientes **para** asistir a quienes no tienen email.

### Mascotas y Clientes
* **Como** CLIENTE **quiero** registrar los datos de mis mascotas **para** que la veterinaria los tenga disponibles.
* **Como** ADMINISTRADOR **quiero** ver y editar los datos de un cliente y sus mascotas **para** tener la información necesaria durante la atención.
* **Como** ADMINISTRADOR **quiero** dar de alta clientes que no tienen cuenta **para** poder cargarles turnos.

### Gestión de Turnos
* **Como** CLIENTE **quiero** consultar los horarios disponibles **para** elegir un turno.
* **Como** CLIENTE **quiero** reservar un turno disponible **para** llevar a mi mascota a consulta.
* **Como** CLIENTE **quiero** cancelar o reprogramar un turno según las reglas de la veterinaria **para** liberar o cambiar el horario.
* **Como** ADMINISTRADOR **quiero** consultar la agenda **para** organizar las atenciones.
* **Como** ADMINISTRADOR **quiero** confirmar, modificar o cancelar turnos **para** reorganizar la agenda.
* **Como** ADMINISTRADOR **quiero** reservar turnos tomados por teléfono o en mostrador **para** ocupar el espacio en la agenda.
* **Como** ADMINISTRADOR **quiero** cancelar o reprogramar turnos por urgencia y ver a quién avisar **para** atender la emergencia sin descuidar a los demás clientes.
* **Como** ADMINISTRADOR **quiero** marcar un turno como atendido o ausente **para** llevar el control de la jornada.

### Historial Clínico
* **Como** ADMINISTRADOR **quiero** cargar la atención realizada a una mascota **para** que quede en su historial.
* **Como** ADMINISTRADOR **quiero** agregar notas aclaratorias **para** corregir información sin alterar el registro original.
* **Como** CLIENTE **quiero** ver el historial completo de mis mascotas **para** conocer sus atenciones y vacunas.

### Configuración
* **Como** ADMINISTRADOR **quiero** gestionar el catálogo de servicios **para** que los clientes elijan qué turno solicitar.
* **Como** ADMINISTRADOR **quiero** cargar los feriados **para** que no se ofrezcan turnos esos días.

---

## Pendiente
* Confirmar con el docente el criterio de conservación de registros clínicos al anonimizar (RNF04).

---

## Restricciones
* Un cliente no puede ver datos de mascotas que no sean suyas.
* No se permiten dos turnos activos en la misma franja (agenda única).
* Se debe controlar la concurrencia cuando varios usuarios reservan la misma franja simultáneamente.
* El documento es único. El email es opcional, pero único cuando se informa.
* Todo cliente debe tener al menos nombre, apellido, documento y teléfono.
* La contraseña debe tener al menos 6 caracteres y 2 números.
* No se ofrecen franjas en feriados, fines de semana, fuera de 09:00–19:00 ni en el pasado.
* Los registros clínicos no se modifican ni se eliminan; solo se agregan notas aclaratorias.

---

## Alcance del MVP (prioridades)

* **P0 (imprescindible):** RF01, RF02, RF04, RF05–RF11, RF19, RF20, RF21, RF23, RF24, RF25, consentimiento (RNF04), auditoría simple (RNF05), concurrencia (RF09), desbloqueo por administrador (RF03).
* **P1 (si alcanza el tiempo):** RF12, RF26, RF27 (historial clínico) y desbloqueo/recuperación por email (RF03). Supresión/anonimización (RNF04).
* **P2 (trabajo futuro, fuera de la entrega):** RF13 (recordatorios), HTTPS, backups automáticos, disponibilidad 99%.
