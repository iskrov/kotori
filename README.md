# Vibes - Voice Journaling App

Vibes is a voice-controlled journaling application that allows users to record voice entries, which are automatically transcribed to text, and manage their personal journals.

## Features

- **Voice-to-Text Journaling**: Record voice entries that are automatically transcribed
- **Journal Management**: Create, view, edit, and delete journal entries
- **Tag System**: Organize entries with customizable tags
- **Calendar View**: Browse entries by date
- **Authentication**: Secure login with email/password or Google Sign-In
- **Reminder System**: Set reminders to maintain journaling habits

## Tech Stack

### Frontend (React Native + Expo)
- React Native with TypeScript
- Expo for cross-platform compatibility
- React Navigation for routing
- Axios for API requests
- AsyncStorage for local storage
- Expo AV for audio recording/playback

### Backend (FastAPI)
- FastAPI framework
- PostgreSQL database
- SQLAlchemy ORM
- Alembic for migrations
- JWT for authentication
- Google Cloud Speech-to-Text API

## Setup Instructions

This project utilizes scripts to simplify the setup and running process.

### Prerequisites
- Git
- Node.js (v16+)
- npm (usually comes with Node.js)
- Python 3.10+ (Ensure `python3` points to a compatible version)
- PostgreSQL Client (`psql` command available)
- PostgreSQL Server (Installation instructions vary by OS)
- `sudo` privileges (for installing system dependencies and managing the PostgreSQL service via scripts)
- Google Cloud account (for Speech-to-Text API, configure backend `.env`)

### Installation & Setup

1.  **Clone the Repository:**
    ```bash
    git clone <your-repository-url>
    cd vibes # Navigate into the repository root
    ```
    *Note: The repository root contains the `.venv/` virtual environment and `logs/` directory (ignored by git) alongside the main `vibes/` source directory.*

2.  **Run the Setup Script:**
    This script installs system dependencies (like `python3-dev`, `libpq-dev`, `postgresql`), Python dependencies for the backend (`pip install`), Node.js dependencies for the frontend (`npm install`), sets up the PostgreSQL database and user (you might be prompted for your `sudo` password), and runs database migrations.
    ```bash
    # From the project root (e.g., /home/ai/src/vibes)
    chmod +x scripts/*.sh # Ensure scripts are executable
    scripts/setup.sh
    ```
    *If the script fails, check the output for errors, ensure all prerequisites are met, and that the PostgreSQL service can be managed via `systemctl` or `service`.*

3.  **Configure Environment Variables:**
    *   **Backend:** Copy the example and edit it:
        ```bash
        cp backend/.env.example backend/.env
        nano backend/.env # Add DB details, JWT secret, Google Cloud credentials/API key
        ```
    *   **Frontend:** Copy the example and edit it:
        ```bash
        cp frontend/.env.example frontend/.env
        nano frontend/.env # Add API URL (e.g., http://localhost:8001)
        ```

### Running the Application

1.  **Start the Application (Backend + Frontend):**
    This script activates the virtual environment, starts the backend FastAPI server, and starts the frontend Expo development server. Logs are stored in the `logs/` directory at the workspace root.
    ```bash
    # From the project root (e.g., /home/ai/src/vibes)
    scripts/start.sh
    ```
    The script will output the URLs for the backend and frontend.

2.  **Accessing the Frontend:**
    Open the frontend URL (likely `http://localhost:19006` or similar) in your browser, or use the Expo Go app on your mobile device to scan the QR code printed by the `start.sh` script.

### Stopping the Application

1.  **Stop All Services (Backend + Frontend):**
    This script stops the backend and frontend processes gracefully.
    ```bash
    # From the project root (e.g., /home/ai/src/vibes)
    scripts/stop.sh
    ```

### Database Management (Optional)

The `setup.sh` script handles the initial database service startup. If you need to manually control the PostgreSQL service *without* running the full setup:

*   **Start Database Service:**
    ```bash
    # From the project root (e.g., /home/ai/src/vibes)
    sudo scripts/start_db.sh
    ```
*   **Stop Database Service:**
    ```bash
    # From the project root (e.g., /home/ai/src/vibes)
    sudo scripts/stop_db.sh
    ```

### Development Notes

*   **Virtual Environment:** The Python virtual environment (`.venv/`) is located at the workspace root (`/home/ai/src/vibes/.venv/`), one level above the main project directory. The scripts handle activation automatically. If you need to activate it manually (e.g., to use `pip` or `alembic` directly):
    ```bash
    # From the workspace root (/home/ai/src/vibes)
    source .venv/bin/activate
    ```
*   **Database Migrations:** To create a new migration after changing SQLAlchemy models in `backend/app/models/`:
    ```bash
    # Make sure venv is active
    # From the workspace root (/home/ai/src/vibes)
    cd backend # Navigate to backend directory
    alembic revision --autogenerate -m "Your migration message"
    # Review the generated migration script in backend/migrations/versions/
    # Apply the migration (also done by setup.sh)
    alembic upgrade head
    ```

### Setting Up Google Cloud Speech-to-Text API

**Note:** While the frontend previously interacted directly with the Google API using an API key stored in its `.env`, this has been **refactored for security and best practices**. The backend now handles all communication with the Google Cloud Speech-to-Text API.

1. Ensure the backend `.env` file (`backend/.env`) contains the necessary `GOOGLE_SPEECH_API_KEY` or is configured to use `GOOGLE_APPLICATION_CREDENTIALS` (Service Account Key recommended for production).
2. The backend service (`backend/app/services/speech_service.py`) uses these credentials to interact with the API.
3. The frontend (`frontend/src/services/speechToText.ts`) calls the backend endpoint (`/api/speech/transcribe`) to request transcription.
4. You **no longer need** to configure `GOOGLE_SPEECH_API_KEY` or `GOOGLE_CLOUD_PROJECT_ID` directly in the frontend's `.env` file for transcription purposes.

## Project Structure

```
/home/ai/src/vibes/      # Workspace Root (Git Repository Root)
├── .venv/               # Python Virtual Environment (Ignored by Git)
├── logs/                # Runtime Logs (Ignored by Git)
├── .server.pid          # Backend PID File (Ignored by Git)
├── .frontend.pid        # Frontend PID File (Ignored by Git)
├── .gitignore
├── backend/             # FastAPI backend
│   ├── app/
│   │   ├── core/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── api/
│   │   ├── services/
│   │   └── main.py
│   ├── migrations/
│   ├── requirements.txt
│   ├── .env.example     # (Should exist here)
│   └── .gitignore
├── docs/                # Project Documentation
│   ├── todo.md
│   ├── done.md
│   ├── plan.md
│   └── idea.md
├── frontend/            # React Native frontend
│   ├── src/
│   │   ├── components/
│   │   ├── contexts/
│   │   ├── navigation/
│   │   ├── screens/
│   │   ├── services/
│   │   └── types/
│   ├── scripts/         # Frontend-specific utility scripts (JS)
│   ├── package.json
│   ├── .env.example     # (Should exist here)
│   └── .gitignore
├── scripts/             # Setup, Start, Stop scripts (Bash)
│   ├── setup.sh
│   ├── start.sh
│   ├── stop.sh
│   ├── start_db.sh
│   └── stop_db.sh
└── README.md            # This file (Main Project README)
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'Add some feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

## License

This project is a private project. All rights reserved.
