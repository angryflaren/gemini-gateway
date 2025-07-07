bind = "unix:/tmp/gunicorn_gemini_gateway.sock"
workers = 4 # (2 * CPU Cores) + 1
worker_class = "uvicorn.workers.UvicornWorker"
daemon = False