# Discord Bot

Advanced Discord Bot with Music, Economy, and AI Moderation.

## Setup

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Environment Variables**:
    Copy `.env` and fill in the values:
    ```env
    DISCORD_TOKEN=your_token
    DATABASE_URL="postgresql://..."
    GEMINI_API_KEY=your_key
    ```

3.  **Database**:
    Ensure PostgreSQL is running.
    ```bash
    npx prisma generate
    npx prisma db push
    ```

4.  **Run**:
    ```bash
    npm run dev
    ```

## Features
-   **Music**: High-quality playback via `discord-player`.
-   **Economy**: Shop, currency, gambling.
-   **Moderation**: AI-powered auto-mod (Gemini).
