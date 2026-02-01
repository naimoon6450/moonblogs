# Moony Blogs

> Musings from someone that is trying to get incrementally better every day.

## Telegram Habit Tracker

Overengineered habit tracking. Message a Telegram bot → updates YAML in GitHub → site rebuilds with updated chart.

### Data Flow

```mermaid
sequenceDiagram
    participant U as User
    participant T as Telegram
    participant W as Cloudflare Worker
    participant G as GitHub API
    participant P as GitHub Pages

    U->>T: Send "m" or "meditation"
    T->>W: POST webhook
    W->>W: Validate + map shortcut
    W->>G: GET habits YAML
    G-->>W: file content + SHA
    W->>W: Parse YAML, add date
    W->>G: PUT updated YAML
    G-->>W: Commit success
    W->>T: sendMessage
    T-->>U: Confirmation
    G->>P: Trigger rebuild
```

### Commands

| Command | Action |
|---------|--------|
| `<habit>` | Track habit (e.g., `meditation`, `reading`) |
| `<shortcut>` | Single letter shortcut (e.g., `m`, `r`) |
| `list` / `l` | Show today's progress |
| `help` / `h` | Show commands |
| `/add <name>` | Add new habit |
| `/delete <name>` | Hide habit |
| `/restore <name>` | Restore hidden habit |

Shortcuts are generated dynamically based on habit names (first available letter).
