# ============================================================
# Stage 1: Build React Frontend
# ============================================================
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --ignore-scripts 2>/dev/null || npm install
COPY frontend/ ./
RUN npm run build

# ============================================================
# Stage 2: Final Runtime Image (Ubuntu 24.04)
# ============================================================
FROM ubuntu:24.04

LABEL maintainer="mjlyon"
LABEL description="ESX to Scale Computing SC// Platform Migration Tool"

ENV LANG=C.UTF-8
ENV LIBGUESTFS_BACKEND=direct
ENV PYTHONUNBUFFERED=1
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
      virt-v2v \
      libguestfs0 \
      libguestfs-tools \
      guestfs-tools \
      libvirt0 \
      libvirt-clients \
      libvirt-daemon-system \
      qemu-kvm \
      qemu-utils \
      nbdkit \
      curl \
      jq \
      python3 \
      python3-pip \
      pv \
      openssh-client \
      openssl \
      wget \
      tar \
      gzip \
      nfs-common \
      cifs-utils \
      procps \
      findutils \
      ca-certificates \
      linux-image-virtual \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Download VirtIO drivers ISO
RUN mkdir -p /usr/share/virtio-win && \
    wget -q -O /usr/share/virtio-win/virtio-win.iso \
      "https://fedorapeople.org/groups/virt/virtio-win/direct-downloads/stable-virtio/virtio-win.iso" || \
    echo "WARNING: Could not download virtio-win.iso - Windows VM migrations will require manual driver setup"

# Install Python dependencies
WORKDIR /app
COPY backend/requirements.txt ./requirements.txt
RUN pip3 install --no-cache-dir --break-system-packages -r requirements.txt

# Copy backend source
COPY backend/ ./backend/

# Copy built frontend
COPY --from=frontend-builder /app/frontend/dist/ ./frontend/dist/

# Copy entrypoint and healthcheck scripts
COPY backend/scripts/entrypoint.sh /entrypoint.sh
COPY backend/scripts/healthcheck.sh /healthcheck.sh
RUN chmod +x /entrypoint.sh /healthcheck.sh

# Create data directories
RUN mkdir -p /data/db /data/conversions /data/vddk /data/uploads /data/logs /data/mounts

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD /healthcheck.sh

VOLUME ["/data"]

ENTRYPOINT ["/entrypoint.sh"]
