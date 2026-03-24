# UPTCHEVRE

UPTCHEVRE is an interactive web-based application for creating, editing, and validating finite automata derived from user-defined formalisms.

The system allows users to visually model states and transitions, support multiple transition notations, and validate input strings against the constructed automaton.

## How can i run

You can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install frontend dependencies.
npm --prefix frontend i

# Step 4: (Optional) install backend dependencies.
npm --prefix backend i

# Step 5: Start frontend dev server.
npm run dev:frontend
```

## Backend (basic API)

This project includes a basic backend in `backend/` with:

- `GET /api/health`
- `POST /api/automata/equivalent`

### Run backend

```sh
# Install backend deps
npm --prefix backend i

# Run backend in dev mode (http://localhost:4000)
npm run dev:backend
```

### Example request

```sh
curl -X POST http://localhost:4000/api/automata/equivalent \
  -H "Content-Type: application/json" \
  -d '{"automatonA":{"states":[],"transitions":[],"alphabet":[]},"automatonB":{"states":[],"transitions":[],"alphabet":[]}}'
```

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
