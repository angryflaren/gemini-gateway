#!/bin/bash
set -e # Exit immediately if a command exits with a non-zero status.

echo "--- Starting Gemini Gateway Backend Setup (v3 - Final) ---"

# --- 1. Clean up previous attempts to ensure a fresh start ---
echo "--- Cleaning up previous installation attempts... ---"
sudo systemctl stop gemini-gateway.service || true
sudo systemctl disable gemini-gateway.service || true
sudo rm -f /etc/systemd/system/gemini-gateway.service
sudo rm -f /etc/nginx/sites-enabled/gemini_gateway
sudo rm -f /etc/nginx/sites-available/gemini_gateway
sudo rm -rf /var/www/gemini_gateway
echo "Cleanup complete."

# --- 2. Install system dependencies ---
echo "--- Installing system dependencies... ---"
sudo apt-get update && sudo apt-get install -y python3-pip python3-venv nginx

# --- 3. Set up project directory and copy files correctly ---
echo "--- Setting up project directory and permissions... ---"
PROJECT_DIR="/var/www/gemini_gateway"
# Create the main project directory AND the 'backend' subdirectory inside it
sudo mkdir -p $PROJECT_DIR/backend
# Copy all files from the current location (.) into the new 'backend' subdirectory
sudo cp -r ./* $PROJECT_DIR/backend/
# Set ownership for the entire project
sudo chown -R $USER:$USER $PROJECT_DIR

# --- 4. Set up Python virtual environment ---
echo "--- Setting up Python virtual environment... ---"
cd $PROJECT_DIR/backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
deactivate

# --- 5. Verify Gunicorn installation ---
echo "--- Verifying Gunicorn installation... ---"
if [ ! -f "$PROJECT_DIR/backend/venv/bin/gunicorn" ]; then
    echo "CRITICAL ERROR: Gunicorn was not found after installation. Exiting."
    exit 1
fi
echo "SUCCESS: Gunicorn executable found."

# --- 6. Configure Nginx ---
echo "--- Configuring Nginx... ---"
sudo bash -c 'cat > /etc/nginx/sites-available/gemini_gateway' << EOF
server {
    listen 80;
    server_name _;
    client_max_body_size 100M;

    location / {
        proxy_pass http://unix:/tmp/gunicorn_gemini_gateway.sock;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}
EOF

# Avoid 'File exists' error by removing the link before creating it
sudo rm -f /etc/nginx/sites-enabled/gemini_gateway
sudo ln -s /etc/nginx/sites-available/gemini_gateway /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# --- 7. Configure and start the systemd service ---
echo "--- Configuring and starting the systemd service... ---"
# This expects gemini-gateway.service to be in the current directory
sudo cp $PROJECT_DIR/backend/gemini-gateway.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl start gemini-gateway
sudo systemctl enable gemini-gateway

echo "--- Setup finished. Checking service status... ---"
sleep 1
sudo systemctl status gemini-gateway.service --no-pager -l
