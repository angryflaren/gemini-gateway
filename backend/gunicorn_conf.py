bind = "unix:/tmp/gunicorn_gemini_gateway.sock"
workers = 3
worker_class = "uvicorn.workers.UvicornWorker"
daemon = False
