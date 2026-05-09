#!/bin/bash

echo "🚀 Starting Portrait Sharpener Studio..."

# Kill any existing instances to prevent port conflicts
echo "Cleaning up old sessions..."
lsof -i :8000 | grep LISTEN | awk '{print $2}' | xargs kill -9 2>/dev/null
lsof -i :5173 | grep LISTEN | awk '{print $2}' | xargs kill -9 2>/dev/null

echo "🧠 Waking up AI Engine..."
# Prepare and start the backend in the background
source venv/bin/activate
export PYTHONPATH=$PYTHONPATH:$(pwd)/backend
python backend/server.py > backend.log 2>&1 &
BACKEND_PID=$!

echo "🎨 Launching Studio Interface..."
# Prepare and start the frontend in the background
cd frontend
export PATH=$PATH:/usr/local/bin
npm run dev -- --port 5173 > frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

# Wait a second for the servers to come online
sleep 3

echo ""
echo "✅ Studio is Live!"
echo "The app should now be opening in your browser at http://localhost:5173"
echo "--------------------------------------------------------"
echo "✨ Ready to process portraits. "
echo "🛑 Press Ctrl+C inside this terminal window to shut down the servers."

# Open the browser automatically (cross-platform)
if command -v xdg-open &>/dev/null; then
  xdg-open http://localhost:5173
elif command -v open &>/dev/null; then
  open http://localhost:5173
elif command -v start &>/dev/null; then
  start http://localhost:5173
fi

# Trap Ctrl+C (SIGINT) to clean up background processes when the user exits
trap "echo -e '\nShutting down Studio...'; kill -9 $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
