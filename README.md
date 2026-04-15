# 🚀 Kaizora Management System

## 📖 Introduction
Kaizora is a specialized Kaizen tracking and management platform designed to streamline operations, facilitate user permissions, and track active submission flows.

It employs a cleanly decoupled architecture featuring a modern React frontend and an Express-based Node.js backend proxy. Both halves of the application synchronize natively with **Supabase** acting as the fundamental source of truth for both Authentication (JWTs) and Database storage (PostgreSQL).

## 🛠️ Complete Tech Stack

### Frontend (`/Kaizora-FrontEnd`)
*   **Framework**: React 19 + Vite (Runs as an SPA)
*   **Styling**: Tailwind CSS V4 alongside Radix UI (accessible components integrated via Shadcn)
*   **Routing**: React Router v7
*   **Data Fetching**: `@tanstack/react-query` & `axios` (Centrally managed in `src/api/client.js`)
*   **Auth SDK**: `@supabase/supabase-js` (Handled via Context APIs for public-facing queries)

### Backend (`/Kaizora-BackEnd`)
*   **Environment**: Node.js + Express
*   **Architecture**: Traditional persistent Daemon executing REST endpoints (`app.listen()`).
*   **Security & Logging**: `cors`, `helmet`, `morgan`
*   **Auth Integration**: Receives tokens from the frontend, dynamically validating them on standard HTTP request bounds securely using `@supabase/supabase-js`.

### Database & Cloud
*   **Database Engine**: Postgres (hosted natively on Supabase)
*   **Data Sync**: SQL Triggers are heavily utilized within Supabase to synchronize their internal Auth System dynamically over to a bespoke `profiles` table locally in the database.

---

## 🏃‍♂️ Getting Started Locally

Getting the system fully booted offline involves three essential parts: establishing the database, starting the API, and running the Vite server.

### 1. Database Setup
1. Clone the repository natively.
2. Initialize a fresh project natively inside your Supabase dashboard workspace.
3. Execute the SQL schema scripts situated directly in the root of this repository. **Crucial**: Ensure you evaluate and load `schema.sql` first to assemble the primary tables, followed by the migration scripts.

### 2. Backend Initialization (`/Kaizora-BackEnd`)
Open a terminal and navigate to the backend directory:
```bash
cd Kaizora-BackEnd
npm install
```

Create a `.env` file modeled after the example:
```env
PORT=5000
NODE_ENV=development
SUPABASE_URL=your_project_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```
*(⚠️ **NOTE:** The backend uses the `SERVICE_ROLE_KEY` exclusively. This permits the Express endpoints to bypass normal user-auth protections securely when Admins invoke deep system changes).*

Start the server:
```bash
npm run dev
```

### 3. Frontend Initialization (`/Kaizora-FrontEnd`)
Open a second parallel terminal pointing to the frontend directory:
```bash
cd Kaizora-FrontEnd
npm install
```

Create a `.env` locally here as well:
```env
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_public_anon_key
VITE_API_URL=http://localhost:5000/api
```
*(⚠️ **NOTE:** The frontend strictly uses the `ANON_KEY`. Never expose the Service Role key up here).*

Start the Vite compiler:
```bash
npm run dev
```

---

## 🧠 System Architecture & "Gotchas"

For any new developer diving in, ensure you read these critical structural pillars:

1. **State Independence:** The Node server holds absolutely **zero** state. There are no CRON jobs, server-side caching, socket loops, or file system uploads. Every operation is completely stateless HTTP cleanly passing logic to Supabase postgres. 
2. **The `api/client.js` Controller:** Do not write random `fetch()` commands in the frontend. All API interactions (unless explicitly logging into Supabase) route exclusively through the unified `api` Axios interceptor module. The interceptor is uniquely designed to automatically fetch the Supabase JWT and mount it safely into the HTTP headers, while also ensuring graceful fallback "Toast" errors if Vercel deployment configurations break down.
3. **Super Admin Isolation Architecture:** There is a "phantom" security role built tightly into the backend Node middleware (`checkNotSuperAdmin`). If an account possesses the role `superadmin` within your database, standard Admin operations will bounce back instantly protecting it. "Super Admins" are architected to be globally immune to being banned, altered, or restricted whatsoever!
4. **Vercel vs. Render Host Planning:**
    *   **Frontend Deployment**: Perfectly optimized for **Vercel**. All routes dynamically fallback via the staged `vercel.json` meaning React Router SPAs continue working smoothly online.
    *   **Backend Deployment**: Since the backend invokes a strict `express().listen()` cycle, it is intentionally built for Daemon hosting. If migrating servers, strongly gravitate toward utilizing **Render** natively rather than jumping through the complex Serverless HTTP hoops trying to wedge it onto Vercel.
