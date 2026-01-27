FROM python:3.9-slim

WORKDIR /usr/src/app

COPY dashboardv2/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY dashboardv2 ./

# Default to template if .env doesn't exist
COPY dashboardv2/.env* ./

CMD ["python", "main.py"]
