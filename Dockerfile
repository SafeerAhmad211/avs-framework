# syntax=docker/dockerfile:1

# --- Build stage: produce a wheel from source ---
FROM python:3.13-slim AS builder
WORKDIR /build

COPY pyproject.toml README.md LICENSE ./
COPY src ./src

RUN pip install --no-cache-dir build && python -m build --wheel

# --- Runtime stage: minimal image with the package installed ---
FROM python:3.13-slim

LABEL org.opencontainers.image.title="avs-framework"
LABEL org.opencontainers.image.description="Audit, Validation, Security: statistical engine for auditing AI-driven employment decision systems"
LABEL org.opencontainers.image.source="https://github.com/SafeerAhmad211/avs-framework"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.authors="Safeer Ahmad <safeer@nautaresearchlabs.com>"

WORKDIR /app

COPY --from=builder /build/dist/*.whl /tmp/
RUN pip install --no-cache-dir /tmp/*.whl && rm -rf /tmp/*.whl

COPY examples ./examples

RUN useradd --create-home --uid 1000 avs && chown -R avs:avs /app
USER avs

# Default: run the bundled quickstart demo so `docker run` works with zero setup.
# Override the command to run your own script or drop into a REPL, e.g.:
#   docker run -it --rm -v "$PWD/data:/data" ghcr.io/safeerahmad211/avs-framework python
ENTRYPOINT ["python"]
CMD ["examples/quickstart.py"]
