#!/usr/bin/env bash
set -e

echo "[entrypoint] ESX to Scale Migration Tool starting..."

# Ensure libvirt runtime directories exist (required on Ubuntu)
mkdir -p /var/run/libvirt /var/lib/libvirt /var/log/libvirt

# Start libvirtd (needed for virsh commands)
if command -v libvirtd &>/dev/null; then
  echo "[entrypoint] Starting libvirtd..."
  libvirtd -d 2>/dev/null || true
  sleep 1
fi

# Configure VDDK if uploaded
VDDK_LIB=""
if [ -d /data/vddk/vmware-vix-disklib-distrib/lib64 ]; then
  VDDK_LIB="/data/vddk/vmware-vix-disklib-distrib/lib64"
elif [ -d /data/vddk/vmware-vix-disklib-distrib/lib ]; then
  VDDK_LIB="/data/vddk/vmware-vix-disklib-distrib/lib"
fi

if [ -n "$VDDK_LIB" ]; then
  export LD_LIBRARY_PATH="${VDDK_LIB}:${LD_LIBRARY_PATH:-}"
  echo "$VDDK_LIB" > /etc/ld.so.conf.d/vmware-vddk.conf
  ldconfig 2>/dev/null || true
  echo "[entrypoint] VDDK configured: $VDDK_LIB"
fi

# Ensure data directories exist
mkdir -p /data/db /data/conversions /data/vddk /data/uploads /data/logs /data/mounts

# Set libguestfs backend
export LIBGUESTFS_BACKEND="${LIBGUESTFS_BACKEND:-direct}"

# Ensure libguestfs can find the kernel (Ubuntu ships it in /boot)
if [ -z "$SUPERMIN_KERNEL" ]; then
  KERNEL=$(ls /boot/vmlinuz-* 2>/dev/null | sort -V | tail -1)
  if [ -n "$KERNEL" ]; then
    export SUPERMIN_KERNEL="$KERNEL"
    export SUPERMIN_MODULES="/lib/modules/$(basename "$KERNEL" | sed 's/vmlinuz-//')"
    echo "[entrypoint] libguestfs kernel: $SUPERMIN_KERNEL"
  fi
fi

# Initialize database
cd /app
python3 -c "import asyncio; from backend.database import init_db; asyncio.run(init_db())"

# Start FastAPI
echo "[entrypoint] Starting API server on :8080"
exec uvicorn backend.main:app \
  --host 0.0.0.0 \
  --port 8080 \
  --workers 1 \
  --log-level info
