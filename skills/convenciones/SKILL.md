---
name: convenciones
description: Convenciones de código, base de datos y documentación del equipo. Usar al escribir código, diseñar esquemas de base de datos o generar documentación en cualquier proyecto.
---

# Convenciones del equipo

Reglas transversales que todo agente del equipo debe cumplir, independiente
del stack del proyecto.

## Idiomas

- Código, identificadores y comentarios: **inglés**
- Textos de UI: **español neutro** — tuteo estándar ("tú tienes",
  "regístrate"), nunca voseo ni regionalismos, ortografía y tildes impecables
  (incluidos imperativos: "Regístrate", "Inicia sesión")
- Documentación generada (README, ARCHITECTURE.md, DESIGN.md, QA_REPORT.md, etc.): **español**

## Bases de datos relacionales

- Toda tabla lleva, **conceptualmente**: timestamp de creación, timestamp de
  última actualización, y un flag de borrado lógico (soft delete por defecto; no
  borrar filas salvo que la arquitectura del proyecto indique lo contrario).
- Nombres en **inglés**.
- **Casing según el gestor**: en PostgreSQL (el de los proyectos con BD hoy),
  snake_case → tablas/columnas y los campos genéricos `created_at`, `updated_at`,
  `active`. Con otro gestor u ORM, usa la convención idiomática de esa tecnología;
  el CLAUDE.md del proyecto la fija y manda.
- Ojo con las capas: el **esquema físico** sigue la convención de la BD; el
  **código y las entidades del ORM** siguen el idioma del lenguaje (C# PascalCase,
  TS camelCase); los **DTOs/JSON** de la API siguen el suyo (normalmente
  camelCase). No fuerces snake_case fuera de la BD.

## Comentarios en el código

- Pocos y breves: comenta solo cuando el *por qué* no sea obvio leyendo el
  código. **Una línea; dos como máximo absoluto**, y nunca en bloque `/** */`
  para código interno — los bloques son para API pública, no para explicarte a
  ti mismo. Si necesitas un párrafo, el código necesita mejores nombres.
  Ejemplo real de lo que **no** se hace:

  ```ts
  /**
   * Excludes destinations already covered by another menu action: "Completada"
   * duplicates "Completar", and "Por hacer" duplicates "Reabrir" (toggleDone
   * always reopens to 'todo').
   */
  ```

  La versión correcta: `// "Completar" y "Reabrir" ya cubren esos destinos.`
- Nunca narres *qué* hace la línea siguiente ni *para qué* se usa un elemento
  en otro lugar — eso lo dice el propio código o su uso.
- Nunca cites documentos ni secciones en comentarios (`DESIGN.md §9.3`,
  `ARCHITECTURE.md`, tickets): los documentos cambian y el comentario queda
  obsoleto. Las referencias a documentos van en commits o PRs, no en el código.

## Git y commits

- Un commit = un cambio lógico. Commits pequeños y atómicos.
- Mensajes en **inglés**, formato Conventional Commits:
  `tipo: asunto en imperativo` (minúscula, ≤50 caracteres, sin punto final).
- Tipos permitidos: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`
  (opcionales: `perf`, `build`, `ci`, `style`).
- Cuerpo opcional: agrégalo (línea en blanco + texto) solo cuando el *por qué*
  no sea obvio desde el asunto.
- No dejes commits `temp`/`WIP` en el historial compartido; haz squash antes de
  integrar.
- Cada agente commitea su propio trabajo. El orquestador no commitea código.

Ejemplo: `feat: add login rate limiting`

## Ramas y Pull Requests (GitHub Flow)

- `main` siempre estable y desplegable. El commit inicial (scaffolding,
  .gitignore) va directo a `main`; todo lo demás llega por merge.
- Todo lo demás en ramas cortas creadas desde `main` actualizado, una por fase
  o feature: `feat/<slug>`, `fix/<slug>`, `docs/<slug>`, `chore/<slug>` (slug
  corto en inglés, kebab-case).
- **Todo PR apunta a `main`**: usa `--base main` explícito al crearlo y
  verifica la base en el resultado. Nunca abras un PR contra otra rama de
  trabajo: si la fase anterior aún no fue mergeada, espera ese merge antes de
  crear la rama nueva. Un PR mergeado contra una rama lateral deja los cambios
  varados fuera de `main` y del deploy.
- Se integra vía Pull Request con merge normal (`gh pr merge --merge
  --delete-branch`), nunca squash: los commits atómicos son parte del historial
  que se quiere mostrar. Sin remoto en GitHub: `git merge --no-ff` local. Tras
  integrar, borra también la rama local (`git branch -d`): las ramas viven lo
  que vive su PR.
- El orquestador crea las ramas y mergea los PRs; los especialistas solo
  commitean en la rama activa.
- **El título del PR va en inglés**, mismo formato que un commit
  (`tipo: asunto en imperativo`, minúscula, sin punto). Es parte del historial
  del repo, no comunicación con el usuario.
- **El cuerpo del PR va en español y tiene un formato duro: máximo tres frases
  corridas y 60 palabras**, en lenguaje llano — qué cambia y por qué; el
  detalle vive en los commits y el diff. Sin listas, sin encabezados, sin
  secciones. Prohibido: citar secciones de documentos (`§`, "DESIGN.md §3.1"),
  jerga académica, desglose por capas (Backend/Frontend/Tests) y resultados de
  builds, tests o verificaciones (eso vive en la CI y en el reporte del agente).
  Ejemplo: "Agrega presupuestos mensuales por categoría con barras de progreso
  y alertas al 80% y al superar el límite. Migración aditiva, no toca datos
  existentes."
- Un validador automático rechaza el PR que viole este formato, con el motivo.
  Si rechaza, reescribe el cuerpo desde cero según el ejemplo; no negocies con
  el validador.

## Gestor de paquetes JS/TS

- **pnpm, no npm** (`pnpm install`, `pnpm run <script>`, `pnpm dlx` en vez de
  `npx`). Motivos: bloquea por defecto los scripts de instalación de las
  dependencias (mitiga ataques de supply chain vía postinstall), node_modules
  estricto sin dependencias fantasma, y es más rápido.
- Si una dependencia legítima necesita ejecutar su script de build (raro),
  autorízala explícitamente con `pnpm approve-builds` — nunca desactives la
  protección global.
- En CI usa `pnpm/action-setup` + `pnpm install --frozen-lockfile`.
- Proyectos existentes con `package-lock.json` siguen en npm hasta que se
  migren a propósito; no mezcles lockfiles.

## Documentos públicos vs internos

Los repos de proyecto son públicos y funcionan como portafolio. Hay dos clases
de documentos:

- **Internos** (no se suben; van en el .gitignore inicial): el CLAUDE.md del proyecto,
  `QA_REPORT.md` y `.claude/`. Siguen existiendo en el disco y el equipo los
  usa con normalidad; simplemente no viajan en el repo.
- **Públicos** (sí se suben): `README.md`, `ARCHITECTURE.md`, `DESIGN.md`.
  Escríbelos para un lector externo: hablan de la implementación y sus
  decisiones, nunca del proceso — sin mencionar agentes, IA, el CLAUDE.md del proyecto ni
  QA_REPORT.md, y sin frases como "el agente frontend implementará".

## Interoperabilidad

- Exportes CSV siempre en **UTF-8 con BOM** (el carácter `\uFEFF` al inicio
  del archivo): sin él, Excel en Windows muestra las tildes y eñes rotas. El
  público objetivo de un CSV abre Excel, no un editor de texto.

## Calidad

- Documentar decisiones importantes; preguntar antes de decisiones grandes
- Calidad de portafolio: README claro y app desplegada valen más que features extra
- **La demo nunca se ve vacía**: quien abre la app desplegada debe encontrar
  contenido de ejemplo realista en segundos. Sin cuentas, sembrar datos de
  muestra en la primera visita (vaciables desde la UI). Con cuentas, cuenta de
  demostración accesible con **un clic desde el login** (botón visible, sin
  escribir credenciales) y datos de bienvenida para cada usuario nuevo. Un
  reclutador no se registra ni configura nada: si la primera pantalla está
  vacía, cierra la pestaña
- Sobre estas reglas, si hay conflicto, siempre manda el CLAUDE.md del proyecto activo
