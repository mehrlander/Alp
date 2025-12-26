# Alp

Create utilities to store and work with data in the browser.

## Core Concepts

**Data** — Data arrives from clipboard, file, API, user input. Storage is handled through IndexedDB.

**Paths** — A path is an address in your data layer to an IndexedDB record. Components bind to a path and can watch activity on it.

**Components** — A template for UI and data. Name, HTML string, initial state, methods.

**Ping** — How you nudge components by path. `alp.ping(path, data, occasion)` notifies whatever's bound there. Receiver handles it via `onPing(occasion, data)`.

**Queues** — Proxy-based queues smooth over async timing. Call things before they're ready; calls queue and replay.

**Kits** — Adapter layer for external libraries or common functionality. Shared setup available everywhere.
