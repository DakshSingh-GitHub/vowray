# Vowray

Vowray is a calm, thoughtful AI assistant built with Next.js, React, and Tailwind CSS. It features real-time streaming responses, rich Markdown and syntax-highlighted code rendering, automatic conversation titling, and local-first session persistence in the browser.

## Features

- **Streaming Chat**: Real-time token streaming via `/api/chat` with support for stopping generation mid-response.
- **Rich Markdown & Code Blocks**: GitHub Flavored Markdown (`remark-gfm`) with `highlight.js` syntax highlighting and one-click copy for both code blocks and messages.
- **Automatic Conversation Titles**: Generates concise 3–6 word titles for new chats via `/api/title`.
- **Local-First Persistence**: Stores chat sessions, active session state, and theme preference in browser **IndexedDB** (`vowray_db`).
- **Session Management**: Collapsible sidebar with chronological grouping (`Today`, `Previous 7 Days`, `Older`), inline renaming, and delete confirmation.
- **Starter Prompts**: Built-in prompt cards on new conversations to help you get started quickly.
- **Light & Dark Mode**: Theme toggle in the header that respects your system preference on first visit.

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org) 16 (App Router) & React 19
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS v4, `Plus Jakarta Sans` & `JetBrains Mono` (`next/font/google`)
- **Markdown & Icons**: `react-markdown`, `remark-gfm`, `highlight.js`, `lucide-react`

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create a `.env` file in the project root (or update your existing one) with your API key:

```env
NVIDIA_API_KEY=your_api_key_here

# Optional overrides (shown with defaults):
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_MODEL=nvidia/nemotron-3.5-super-vl-120b-a12b
```

> **Note:** The API routes target an OpenAI-compatible `/chat/completions` endpoint and default to NVIDIA NIM. If `NVIDIA_API_KEY` is not set, the server also checks `GEMINI_API_KEY` as a fallback.

### 3. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Next.js development server |
| `npm run build` | Build the application for production |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint across the project |

## Project Structure

```text
├── app/
│   ├── api/
│   │   ├── chat/route.ts      # Streaming chat completions endpoint
│   │   └── title/route.ts     # Automatic chat title generation endpoint
│   ├── globals.css            # Theme tokens and global styles
│   ├── layout.tsx             # Root layout, metadata, and fonts
│   └── page.tsx               # Main application entry point
├── components/
│   ├── ChatArea.tsx           # Message list, starter prompts, and composer
│   ├── DeleteConfirmModal.tsx # Confirmation dialog for deleting a chat
│   ├── Header.tsx             # Top bar with sidebar and theme toggles
│   ├── MarkdownRenderer.tsx   # Markdown and syntax-highlighted code blocks
│   ├── Sidebar.tsx            # Chronological chat history and rename/delete controls
│   ├── VowrayApp.tsx          # Top-level client state and orchestration
│   └── VowrayLogo.tsx         # Brand logo component
└── lib/
    ├── gemini.ts              # Client helpers for streaming chat and title fetching
    ├── storage.ts             # IndexedDB persistence and chronological grouping
    └── types.ts               # Shared TypeScript interfaces and starter prompts
```
