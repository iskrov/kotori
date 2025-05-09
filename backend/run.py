import uvicorn
import argparse # Import argparse

if __name__ == "__main__":
    # Set up argument parser
    parser = argparse.ArgumentParser(description="Run the Vibes FastAPI backend.")
    parser.add_argument("--port", type=int, default=8001, help="Port number to run the server on.")
    parser.add_argument("--host", type=str, default="0.0.0.0", help="Host address to bind the server to.")
    parser.add_argument("--reload", action="store_true", help="Enable auto-reloading.")
    
    # Parse arguments
    args = parser.parse_args()
    
    # Start Uvicorn with parsed arguments
    # Note: Ensure your app path "app.main:app" is correct
    uvicorn.run(
        "app.main:app", 
        host=args.host, 
        port=args.port, 
        reload=args.reload
    )
