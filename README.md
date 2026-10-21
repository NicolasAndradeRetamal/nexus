# nexus

Metodología de trabajo con un equipo de agentes especializados: roles con
responsabilidades acotadas, un flujo de orquestación y convenciones
transversales. La fuente de verdad es neutral (`core/`); cada herramienta tiene
un adaptador generado a partir de ella.

| Herramienta | Estado |
|---|---|
| [Claude Code](#adaptador-claude-code) | Disponible |
| Codex | Próximamente |
| Gemini CLI | Próximamente |

## Metodología

### Equipo (`core/roles/`)

| Rol | Responsabilidad |
|---|---|
| orquestador | Líder técnico: coordina al resto, no implementa |
| arquitecto | Diseña arquitectura, modelo de datos y contratos → ARCHITECTURE.md |
| disenador | Identidad visual y tokens de diseño → DESIGN.md |
| backend | API, lógica de negocio, persistencia, auth |
| frontend | UI, componentes, estados, conexión con la API |
| devops | Docker, CI/CD, variables de entorno, README |
| reviewer | Revisión de código (solo lectura, con memoria por proyecto) |
| qa | Validación end-to-end → QA_REPORT.md (con memoria por proyecto) |

Los roles son **agnósticos al stack**: el stack, el alcance y las convenciones
de cada proyecto viven en su archivo de contexto. Flujo estándar: arquitecto →
disenador → backend + frontend en paralelo → devops → reviewer + qa.

### Estructura del repo

```
core/
  roles/<rol>.md      instrucciones + metadatos (nivel de modelo, capacidades,
                      solo lectura, memoria por proyecto)
  workflow.md         flujo y reglas del orquestador
  conventions.md      convenciones de código, base de datos, ramas y PRs
  templates/          plantillas que los roles copian a los proyectos
scripts/
  build.mjs           genera el adaptador de Claude Code desde core/
  validate-pr.mjs     validador de título y cuerpo de PR (sin dependencia de IA)
  validate-commit.mjs validador de mensajes de commit
agents/ skills/ hooks/ templates/ .claude-plugin/    salida generada
```

`core/` no menciona herramientas concretas: los metadatos se traducen en cada
adaptador y "el archivo de contexto del proyecto" se convierte en el nombre que
corresponda (`CLAUDE.md` en Claude Code).

### Validadores

```bash
node scripts/validate-pr.mjs --title "feat: add budgets" --body "Agrega presupuestos mensuales."
node scripts/validate-pr.mjs --title "feat: add budgets" --body-file body.md
node scripts/validate-commit.mjs "feat: add login rate limiting"
```

Un PR lleva título en inglés con formato de commit y un cuerpo en español de
máximo tres frases y 60 palabras, sin listas, encabezados ni resultados de
builds. Un commit sigue Conventional Commits: `tipo: asunto` en imperativo,
minúscula, sin punto y de hasta 50 caracteres.

## Adaptador: Claude Code

Plugin de [Claude Code](https://code.claude.com) con el equipo de agentes, la
skill `convenciones` y un hook que valida los PR.

### Instalación

```bash
claude plugin marketplace add NicolasAndradeRetamal/nexus
claude plugin install nexus@nexus
```

El orquestador se usa con `claude --agent nexus:orquestador`; el resto de los
agentes se invocan como `nexus:<nombre>`.

### Contenido generado

- `agents/` — un agente por rol; el nivel de modelo `high` pasa a `opus` y
  `standard` a `sonnet`.
- `skills/convenciones/` — `core/conventions.md` como skill.
- `hooks/hooks.json` — hook `PreToolUse` que extrae título y cuerpo del
  `gh pr create` (incluidos heredocs y `--body-file`) y los pasa a
  `validate-pr.mjs`.
- `templates/` — plantillas copiadas desde `core/templates/`.

Los archivos generados se commitean: `claude plugin install` instala lo que hay
en el repo y no ejecuta el build.

## Próximamente

- **Codex**: adaptador generado desde `core/`.
- **Gemini CLI**: adaptador generado desde `core/`.

## Desarrollo

Edita `core/` (nunca los archivos generados), regenera y prueba:

```bash
node scripts/build.mjs
npm test
claude plugin validate .
```

La CI ejecuta los tests y falla si, tras correr el build, el árbol cambia: lo
generado debe coincidir siempre con `core/`. Para probar cambios en Claude Code,
usa `/reload-plugins` o reinicia la sesión.
