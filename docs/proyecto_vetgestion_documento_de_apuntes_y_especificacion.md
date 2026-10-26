# Documento de Especificación del Proyecto: vetGestión

## 1. Contexto General y Datos del Proyecto

* **Materia:** Taller de Aplicaciones Informáticas
* **Carrera:** Técnico Universitario en Desarrollo de Aplicaciones Informáticas (Último Año)
* **Proyecto:** `vetGestión` — Sistema de Gestión de Turnos para Veterinaria
* **Integrantes:** Franco Tobar y Gisella Burgos
* **Patrocinador / Cliente:** Docente de la Cátedra
* **Fecha de Inicio:** 4 de Septiembre de 2026
* **Fecha de Entrega Final:** 30 de Octubre de 2026 (**inamovible**)
* **Tiempo restante al 26/10:** 5 días laborables (26, 27, 28, 29 y 30), contando el 26 como día de trabajo.
* **Repositorio de Código:** GitHub
* **Gestor de Tareas:** Trello
* **Stack Tecnológico:** JavaScript, React, Node.js (Express), MySQL
* **Despliegue:** ninguno. Se desarrolla y se presenta de forma local.

## 2. Project Charter (Acta de Constitución del Proyecto)

### 2.1. Propósito del Proyecto

En el modelo operativo actual de la veterinaria (sin sistema digitalizado), los clientes acuden de forma presencial y sin turno previo. Esto genera:

* Aglomeración de mascotas en la sala de espera, con tensión y estrés en los animales (cruce entre perros reactivos, gatos y otros animales).
* Desorden administrativo en la atención y en la asignación de tiempos.

**Solución propuesta (`vetGestión`):** un sistema web de gestión de turnos que ordena la atención con una **agenda única de franjas de 30 minutos**. Los clientes registrados reservan turnos de forma remota; el administrador carga manualmente los turnos pedidos por teléfono o en mostrador, y puede reordenar o cancelar turnos ante urgencias médicas. Además, el administrador registra las atenciones realizadas y el cliente consulta el historial clínico de sus mascotas.

### 2.2. Objetivos del Proyecto

1. Digitalizar y centralizar el 100% de la agenda de turnos de la veterinaria.
2. Reducir la aglomeración de mascotas en la sala de espera para minimizar conflictos entre animales reactivos (**objetivo principal**).
3. Otorgar autonomía al administrador para reprogramar o cancelar turnos por emergencias médicas.
4. Mantener disponible el historial clínico de cada mascota para su dueño.

### 2.3. Alcance y Restricciones

* **Dentro del Alcance:**
  * Registro y autenticación con dos roles: **Administrador** y **Cliente**.
  * Gestión de mascotas (solo perros y gatos) por parte del cliente y del administrador.
  * Autogestión de turnos para clientes registrados (reservar, consultar, cancelar, reprogramar).
  * Módulo de administración: agenda, carga manual de turnos (teléfono/presencial), confirmación, estados, urgencias.
  * Gestión de servicios, feriados y horarios (franjas de 30 min, 09:00 a 19:00, lunes a viernes).
  * Historial clínico cargado por el administrador y consultado por el cliente (P1).
* **Fuera del alcance:** rol Profesional con acceso al sistema, recordatorios por email, despliegue/hosting, facturación, pagos, Pet Shop, telemedicina e integraciones externas.
* **Restricciones:**
  * Límite de entrega estricto: 30 de Octubre.
  * Equipo de 2 integrantes.
  * Sin corrección intermedia del docente: el trabajo se entrega finalizado y validado según definición interna.
  * Alcance limitado a un MVP priorizado (P0 / P1 / P2).

### 2.4. Stakeholders

* **Cliente / Usuario Final:** dueños de mascotas y personal administrativo de la clínica. Los veterinarios son partes interesadas, pero atienden de forma presencial y no usan el sistema.
* **Evaluador / Sponsor:** docente de la materia Taller de Aplicaciones Informáticas.

## 3. Metodología de Trabajo y Gestión en Trello

### 3.1. Marco Metodológico: Ágil adaptado (mini-sprints diarios)

Con 5 días disponibles, se trabaja en un único sprint con cierre diario: cada día se define un objetivo, se integra a la rama principal y se verifica antes de pasar al siguiente. El día 5 es solo de verificación, datos de demostración y documentación; no se agregan funcionalidades nuevas.

### 3.2. Estructura y Flujo del Tablero en Trello

1. **Product Backlog:** épicas (*Autenticación y Usuarios*, *Mascotas*, *Gestión de Turnos*, *Panel Administrativo*, *Historial Clínico*) e historias de usuario con prioridad P0/P1/P2.
2. **To Do:** tareas desglosadas, de **medio día como máximo** (por el plazo).
3. **In Progress:** máximo 1 o 2 tareas por persona.
4. **Testing / QA:** funcionalidades listas a verificar contra sus criterios de aceptación.
5. **Done:** tareas que cumplen la *Definition of Done*.

### 3.3. Contenido de las Tarjetas de Trello

* Título claro, descripción técnica (ej. "Crear endpoint POST /api/turnos"), criterios de aceptación, responsable (Franco o Gisella), prioridad y rama de GitHub asociada.

## 4. Fase de Análisis, Prototipado y Riesgos

### 4.1. Prototipado

* No existe prototipo previo y el plazo no permite un prototipo de alta fidelidad en Figma. Se reemplaza por **bocetos rápidos de baja fidelidad** (papel o Figma básico) de las pantallas clave: login/registro, reserva de turno, mis turnos, agenda del administrador. El diseño visual se resuelve directamente en React con CSS simple.

### 4.2. Desglose de Historias de Usuario

* Las historias (ver especificación) se descomponen en tareas técnicas de medio día como máximo. El detalle está en el *Plan de Desarrollo MVP*.

### 4.3. Criterios de Aceptación y Definition of Done (DoD)

* **Formato:** `Given-When-Then` (Dado - Cuando - Entonces).
  * *Ejemplo:* **Dado** que un cliente inició sesión y la franja de las 15:00 está libre, **cuando** selecciona "Confirmar turno", **entonces** el sistema crea el turno en estado *pendiente* y esa franja deja de estar disponible para otros.
* **Definition of Done del Equipo:**
  * El código funciona localmente sin errores de consola ni de servidor.
  * Cumple los Criterios de Aceptación verificados en la columna *Testing*.
  * Fue integrado a la rama principal en GitHub mediante Pull Request (revisión cruzada breve entre ambos integrantes).
  * Los endpoints nuevos están listados en el README de la API.

### 4.4. Gestión de Riesgos Técnicos y Mitigación

| Riesgo Técnico Identificado | Impacto | Plan de Mitigación Preventiva |
| ----- | ----- | ----- |
| Tiempo muy acotado (5 días, entrega inamovible) | Alto | Mantener el MVP estricto (P0 primero), congelar funcionalidades el día 4 y reservar el día 5 para verificación y presentación. |
| Solapamiento de turnos por reservas simultáneas | Alto | Restricción única en MySQL sobre la franja activa y prueba automatizada de concurrencia antes de construir la UI de turnos. |
| Falta de experiencia avanzada en alguna librería del stack | Medio | Pruebas de concepto aisladas y uso de librerías simples y conocidas. |
| Dependencia de SMTP para desbloqueo/recordatorios | Bajo | Desbloqueo por administrador en P0; el email queda en P1 con envío simulado por consola. |
| Conflictos de integración entre dos desarrolladores | Medio | Reparto por capas (backend/frontend), contrato de API definido el día 1 y ramas cortas. |

## 5. Principios de Diseño, Arquitectura y Tecnologías

### 5.1. Principios de Diseño de Software

* **Modularidad:** componentes React en el frontend; rutas, controladores y servicios en el backend.
* **Alta cohesión y bajo acoplamiento.**
* **Separación de responsabilidades:** la interfaz no contiene lógica de negocio; el backend no renderiza HTML.

### 5.2. Arquitectura de Software (3 Capas)

1. **Presentación:** React (SPA) que consume la API.
2. **Lógica de negocio:** Node.js con Express. Valida turnos, estados, urgencias, autenticación y roles.
3. **Acceso a datos:** base de datos **relacional MySQL** (usuarios, mascotas, servicios, feriados, turnos, atenciones y notas).

### 5.3. Justificación del Stack

* JS/React/Node permite construir una SPA dinámica de forma ágil.
* Amplio ecosistema de librerías (fechas, routing, validación).
* El equipo ya conoce el stack, lo que reduce la curva de aprendizaje.
* MySQL: las restricciones únicas y la integridad referencial resuelven de forma directa la concurrencia de turnos.

### 5.4. Especificación Detallada de Módulos (Plantilla de Análisis)

Cada módulo debe indicar: **responsabilidad principal**, **entradas** (props, parámetros de API, formularios), **salidas** (JSON, cambios de estado de la UI) y **relaciones** (componentes o servicios con los que se conecta).

## 6. Utilidad de este Documento para la IA / Agentes de Código

Este documento, junto con la *Especificación del proyecto* y el *Plan de Desarrollo MVP*, se entrega a una IA o a agentes de programación como **contexto primario de referencia**. Sirve para:

1. Generar la hoja de ruta de los 5 días con las tareas exactas.
2. Cargar en Trello las épicas, historias y tarjetas con sus criterios de aceptación.
3. Generar el *boilerplate* de la arquitectura en 3 capas con Node.js y React.
4. Escribir endpoints y componentes respetando el bajo acoplamiento y las restricciones del proyecto.

**Orden de precedencia ante contradicciones:** (1) Especificación del proyecto, (2) Plan de Desarrollo MVP, (3) este documento.
