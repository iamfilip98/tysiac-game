# Claude Code Notes

## Debugging Issues

When the user reports a game issue:
1. **Use the debug API** to find the relevant session/game logs
2. Query the debug endpoints to investigate:
   ```bash
   # List recent games
   curl -H "x-debug-key: $DEBUG_API_KEY" https://[server]/debug/games

   # Get logs for a specific game
   curl -H "x-debug-key: $DEBUG_API_KEY" https://[server]/debug/logs/game/[gameId]

   # Get error logs
   curl -H "x-debug-key: $DEBUG_API_KEY" https://[server]/debug/logs/errors

   # Get logs by event type (e.g., game:bid, game:playCard)
   curl -H "x-debug-key: $DEBUG_API_KEY" https://[server]/debug/logs/event/[eventType]
   ```
3. Analyze the logs to find the root cause before making code changes

