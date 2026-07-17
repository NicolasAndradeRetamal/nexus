# nexus

Plugin de [Claude Code](https://code.claude.com) que empaqueta mi forma de
trabajar: un equipo de agentes especializados orquestados, skills con las
convenciones del equipo, y un HUD de sesión inspirado en Starcraft.

```
⚡ Archon [Fable 5] ✦  🪐 gestor-gastos  🌿 main  ⌖ orquestador
▰▰▰▰▰▱▱▱▱▱ 104k/200k (52%)  💎 $1.23  ⛽ 5h:24% 7d:41%  ⏱ 1h13m  ⚔ +156/-23
```

## Instalación

```bash
claude plugin marketplace add <usuario-github>/nexus
claude plugin install nexus@nexus
```

## Contenido

### Equipo de agentes (`agents/`)

| Agente | Rol |
|---|---|
| orquestador | Líder técnico: coordina al resto, no implementa. Usar con `claude --agent nexus:orquestador` |
| arquitecto | Diseña arquitectura, modelo de datos y contratos → ARCHITECTURE.md |
| disenador | Identidad visual y tokens de diseño → DESIGN.md |
| backend | API, lógica de negocio, persistencia, auth |
| frontend | UI, componentes, estados, conexión con la API |
| devops | Docker, CI/CD, variables de entorno, README |
| reviewer | Revisión de código (solo lectura, con memoria por proyecto) |
| qa | Validación end-to-end → QA_REPORT.md (con memoria por proyecto) |

Los agentes son **agnósticos al stack**: el stack, alcance y convenciones de
cada proyecto viven en el `CLAUDE.md` de ese proyecto, que todos los agentes
cargan automáticamente. Flujo estándar: arquitecto → disenador → backend +
frontend en paralelo → devops → reviewer + qa.

### Skills (`skills/`)

- `convenciones` — reglas transversales de idioma, base de datos y calidad.

### HUD Starcraft (`scripts/` + `settings.json`)

Status line con: modelo como unidad Protoss, uso de contexto como *supply*
(con alerta "YOU MUST CONSTRUCT ADDITIONAL PYLONS" al 90%), costo como
minerales, límites de uso como gas vespeno, rama git, reloj de partida y
líneas cambiadas.

- `statusline.mjs` — multiplataforma (requiere Node), usado por defecto.
- `statusline.ps1` — versión PowerShell equivalente para Windows sin Node:

```json
{
  "statusLine": {
    "type": "command",
    "command": "powershell -NoProfile -File <ruta-al-plugin>/scripts/statusline.ps1"
  }
}
```

Si tienes un `statusLine` propio en `~/.claude/settings.json`, ese tiene
prioridad sobre el del plugin.

## Desarrollo

Editar los `.md` de `agents/` o `skills/` y ejecutar `/reload-plugins` (o
reiniciar Claude Code) para probar los cambios. Validar con:

```bash
claude plugin validate .
```
