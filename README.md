# KON BOARD

KON BOARD is a community bulletin board project.

## Initial concept

- Supabase Auth for sign-in
- Supabase PostgreSQL for posts, comments, likes and reports
- Static frontend deployable from GitHub Pages
- Thread creation, comments, categories and user profiles
- Row Level Security as the foundation for access control

## Planned structure

```text
kon-board/
├── index.html
├── css/style.css
├── js/config.example.js
├── js/app.js
├── supabase/schema.sql
└── docs/ARCHITECTURE.md
```

The first implementation is intentionally dependency-free so it can be opened locally during early UI development. Supabase configuration is added through a separate local `config.js` file that is not committed.
