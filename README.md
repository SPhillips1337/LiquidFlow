# LiquidFlow

LiquidFlow is a premium, high-fidelity, canvas-first reading platform. It evolves the standard digital reading experience into a tactile, animated environment with cinematic visual effects and integrated AI intelligence.

## ✨ Features

- **Canvas Rendering Engine**: High-performance typography rendering using `@chenglou/pretext`.
- **Animated ASCII Illustrations**: Procedural and image-based ASCII art that reacts to user interaction.
- **AI Intelligence**: Integrated scholarly lookups via local Ollama models.
- **Dynamic Themes**: Dark, Light, and Sepia modes with curated color palettes.
- **Interactive Scrubber**: Draggable progress bar for seamless chapter navigation.
- **Library Management**: In-browser ability to delete and regenerate book manifests.
- **Aesthetic UI**: Premium "Glassmorphic" interface with smooth micro-animations.

---

## 🛠 Prerequisites

Before running the application, ensure you have the following installed:

1. **Node.js** (v18 or higher recommended)
2. **Ollama**: Required for AI lookups and scene annotation.
   - Install from [ollama.com](https://ollama.com/)
   - Ensure the service is running (default port `11434`).
   - Pull the required models:
     ```bash
     ollama pull llama3:latest
     ollama pull granite4:3b
     ```

---

## 🚀 Getting Started

### 1. Installation

Install all dependencies from the root directory using npm workspaces:

```bash
npm install
```

Alternatively, use the hardened installer. It checks for `git`, `node`, and `npm`, safely clones (or validates an existing checkout), installs workspace dependencies, and runs the production build:

```bash
curl -fsSL https://raw.githubusercontent.com/SPhillips1337/LiquidFlow/main/install.sh -o install.sh
chmod +x install.sh
./install.sh
```

To install into a custom directory or from a non-default branch:

```bash
LIQUIDFLOW_BRANCH=dev ./install.sh ~/src/LiquidFlow
```

> Review scripts before running them. If you are testing the development branch, replace `main` in the raw URL with `dev`.

### 2. Environment Setup

Copy the example environment file and fill in your details:

```bash
cp .env.example .env
```

*Note: The reader defaults to `127.0.0.1:11434` via Vite proxy for stability.*

### 3. Running the App

Start the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:5173`.

---

## 📖 Book Management

### Ingesting New Books

LiquidFlow uses a custom pipeline to convert source texts (like Project Gutenberg) into rich JSON manifests.

To ingest a book, place the source file in `pipeline/temp/` (optional for images) and run:

```bash
npm run ingest -- <book-id>
```

Replace `<book-id>` with the name of the book you wish to process (e.g., `alice`, `moby-dick`).

### Regenerating from Dashboard

You can regenerate any existing book's manifest directly from the Library Dashboard:
1. Hover over a book card.
2. Click the three-dot menu (⋮) in the top-right corner.
3. Select **Regenerate**.

---

## 📂 Project Structure

- `reader/`: The Vite-powered frontend.
  - `src/renderer.ts`: The core Canvas rendering loop.
  - `src/AsciiVisualizer.ts`: Particle-based ASCII engine.
- `pipeline/`: The Node.js ingestion engine.
  - `src/ingest.ts`: CLI for processing books.
  - `src/ascii.ts`: Image-to-ASCII conversion logic.
- `public/books/`: Location of generated `.manifest.json` files.

---

## 📋 License

This project is licensed under the MIT License.
