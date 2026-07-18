---
name: convenciones
description: Convenciones de código, base de datos y documentación del equipo. Usar al escribir código, diseñar esquemas de base de datos o generar documentación en cualquier proyecto.
---

# Convenciones del equipo

Reglas transversales que todo agente del equipo debe cumplir, independiente
del stack del proyecto.

## Idiomas

- Código, identificadores y comentarios: **inglés**
- Textos de UI: **español**
- Documentación generada (README, ARCHITECTURE.md, DESIGN.md, QA_REPORT.md, etc.): **español**

## Bases de datos relacionales

- Toda tabla lleva, **conceptualmente**: timestamp de creación, timestamp de
  última actualización, y un flag de borrado lógico (soft delete por defecto; no
  borrar filas salvo que la arquitectura del proyecto indique lo contrario).
- Nombres en **inglés**.
- **Casing según el gestor**: en PostgreSQL (el de los proyectos con BD hoy),
  snake_case → tablas/columnas y los campos genéricos `created_at`, `updated_at`,
  `active`. Con otro gestor u ORM, usa la convención idiomática de esa tecnología;
  el `CLAUDE.md` del proyecto la fija y manda.
- Ojo con las capas: el **esquema físico** sigue la convención de la BD; el
  **código y las entidades del ORM** siguen el idioma del lenguaje (C# PascalCase,
  TS camelCase); los **DTOs/JSON** de la API siguen el suyo (normalmente
  camelCase). No fuerces snake_case fuera de la BD.

## Comentarios en el código

- Pocos y breves: comenta solo cuando el *por qué* no sea obvio leyendo el
  código. Una línea basta; nada de bloques JSDoc para describir lo evidente.
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

- `main` siempre estable y desplegable; solo recibe el commit inicial y merges.
- Todo lo demás en ramas cortas desde `main`: `feat/<slug>`, `fix/<slug>`,
  `docs/<slug>`, `chore/<slug>` (slug corto en inglés, kebab-case).
- Una rama = una fase o feature; se integra vía Pull Request (título estilo
  Conventional Commit, cuerpo breve) mergeado con merge normal — nunca squash,
  los commits atómicos son parte del historial que se quiere mostrar.
- El orquestador crea las ramas y mergea los PRs; los especialistas solo
  commitean en la rama activa. Sin remoto en GitHub: `git merge --no-ff` local.

## Documentos públicos vs internos

Los repos de proyecto son públicos y funcionan como portafolio. Hay dos clases
de documentos:

- **Internos** (no se suben; van en el .gitignore inicial): `CLAUDE.md`,
  `QA_REPORT.md` y `.claude/`. Siguen existiendo en el disco y el equipo los
  usa con normalidad; simplemente no viajan en el repo.
- **Públicos** (sí se suben): `README.md`, `ARCHITECTURE.md`, `DESIGN.md`.
  Escríbelos para un lector externo: hablan de la implementación y sus
  decisiones, nunca del proceso — sin mencionar agentes, IA, CLAUDE.md ni
  QA_REPORT.md, y sin frases como "el agente frontend implementará".

## Calidad

- Documentar decisiones importantes; preguntar antes de decisiones grandes
- Calidad de portafolio: README claro y app desplegada valen más que features extra
- El CLAUDE.md del proyecto activo siempre manda sobre estas reglas si hay conflicto
