# ESX to Scale Computing Hypercore Migration Tool
## Ubuntu/Debian Installation Guide

Automated migration tool to convert and upload VMware ESXi/vCenter VMs to Scale Computing Hypercore clusters using virt-v2v and VDDK.

**THIS IS PROVIDED AS-IS WITH NO WARRANTY. USE AT YOUR OWN RISK!**

## Overview

This script automates the process of:

1. Connecting to VMware ESXi/vCenter
2. Converting VMs using virt-v2v with VDDK for optimal performance
3. Injecting VirtIO drivers for Windows VMs
4. Converting disk images to qcow2 format
5. Uploading converted disks to Scale Computing Hypercore via REST API

## System Requirements

### Ubuntu/Debian Host Requirements

* **Supported Distributions**:
  - Ubuntu 20.04 LTS, 22.04 LTS, 24.04 LTS (recommended)
  - Debian 11 (Bullseye), 12 (Bookworm)
* **Architecture**: x86_64 (64-bit)
* **Storage**: Minimum 2x the size of VMs being converted
  - Recommended: Dedicated Ubuntu VM or physical machine with fast SSD/NVMe storage
  - Example: To convert a 100GB VM, allocate at least 200GB free space
* **Memory**: Minimum 4GB RAM (8GB+ recommended for large VMs)
* **Network**: 1Gbps+ connection (10GbE recommended for production migrations)

### Network Access Requirements

Your Ubuntu migration host must have network access to:
- **ESXi/vCenter**: Port 443 (HTTPS) for VM metadata and disk access
- **ESXi host**: Port 22 (SSH) for moref retrieval
- **Scale Hypercore cluster**: Port 443 (HTTPS) for API uploads

## Ubuntu/Debian Prerequisites Installation

### Step 1: Update System Packages
```bash
# Update package lists
sudo apt update

# Upgrade existing packages
sudo apt upgrade -y

# Install basic build tools (if needed)
sudo apt install -y build-essential
```

### Step 2: Install Required Packages
```bash
# Install virtualization and conversion tools
sudo apt install -y \
    virtinst \
    libguestfs-tools \
    libvirt-clients \
    libvirt-daemon-system \
    qemu-kvm \
    qemu-utils \
    virt-v2v

# Install supporting utilities
sudo apt install -y \
    curl \
    jq \
    python3 \
    python3-urllib3 \
    pv \
    sshpass \
    openssh-client \
    wget

# Install additional guestfs tools
sudo apt install -y \
    guestfs-tools \
    libguestfs-tools
```

**Package Descriptions:**
- `virtinst` - Virtual machine installation tools
- `libguestfs-tools` - Guest filesystem access and modification tools
- `libvirt-clients` - Client tools for libvirt virtualization
- `libvirt-daemon-system` - Libvirt daemon configuration files
- `qemu-kvm` - KVM virtualization support
- `qemu-utils` - QEMU disk image utilities (including qemu-img)
- `virt-v2v` - Convert VMs from VMware to KVM
- `curl` - HTTP/HTTPS transfer tool
- `jq` - JSON parsing utility
- `python3` - Python 3 interpreter
- `pv` - Pipe viewer for progress monitoring
- `sshpass` - Non-interactive SSH password authentication

### Step 3: Enable and Start libvirt Service
```bash
# Enable libvirt daemon to start on boot
sudo systemctl enable libvirtd

# Start libvirt daemon immediately
sudo systemctl start libvirtd

# Verify libvirtd is running
sudo systemctl status libvirtd
```

### Step 4: Configure User Permissions
```bash
# Add your user to libvirt group
sudo usermod -a -G libvirt $(whoami)

# Add your user to kvm group for hardware acceleration
sudo usermod -a -G kvm $(whoami)

# Apply group changes (alternative to logging out)
newgrp libvirt

# Verify group membership
groups $(whoami)
# Should show: ... libvirt kvm ...
```

**Note:** If `newgrp` doesn't work, log out and log back in for group changes to take effect.

### Step 5: Verify Virtualization Support
```bash
# Check if CPU supports virtualization
egrep -o '(vmx|svm)' /proc/cpuinfo
# vmx = Intel VT-x
# svm = AMD-V
# If no output, enable virtualization in BIOS

# Verify KVM module is loaded
lsmod | grep kvm
# Should show: kvm_intel (Intel) or kvm_amd (AMD)

# If KVM module not loaded, load it manually
sudo modprobe kvm_intel  # For Intel
# OR
sudo modprobe kvm_amd    # For AMD

# Test libguestfs functionality
sudo libguestfs-test-tool
# Should complete successfully and show "libguestfs: run ok"
```

### Step 6: Install VMware VDDK (Virtual Disk Development Kit)

The VDDK provides high-performance direct disk access to VMware VMs.

#### Download VDDK

1. Visit: https://developer.broadcom.com/sdks/vmware-virtual-disk-development-kit-vddk/latest
2. Register for a free VMware Developer account (if needed)
3. Download: **VMware Virtual Disk Development Kit** (latest version)
4. Recommended: VDDK 8.0.3 or newer

#### Extract and Install VDDK
```bash
# Navigate to your downloads directory
cd ~/Downloads

# Extract the VDDK archive (replace with your downloaded version)
tar -xzf VMware-vix-disklib-8.0.3-*.x86_64.tar.gz

# Move to system directory
sudo mv vmware-vix-disklib-distrib /usr/local/

# Set appropriate permissions
sudo chmod -R 755 /usr/local/vmware-vix-disklib-distrib

# Verify installation
ls -la /usr/local/vmware-vix-disklib-distrib/lib64/
# Should show libvixDiskLib.so* and related library files
```

#### Build nbdkit VDDK Plugin (Ubuntu 24.04)

Ubuntu 24.04 doesn't include the nbdkit VDDK plugin due to VMware's proprietary licensing, so we need to build it from source.

**Note:** This step is only required for Ubuntu 24.04. Earlier versions may have the plugin available in repositories.
```bash
# Enable source repositories
sudo sed -i 's/^Types: deb$/Types: deb deb-src/' /etc/apt/sources.list.d/ubuntu.sources
sudo apt update

# Install build dependencies
sudo apt install -y nbdkit nbdkit-plugin-dev build-essential autoconf automake libtool pkg-config

# Download and build nbdkit from source
cd /tmp
apt source nbdkit
cd nbdkit-*  # Use tab completion for exact version

# Configure with VDDK support
./configure --with-vddk=/usr/local/vmware-vix-disklib-distrib

# Build the VDDK plugin
make

# Install the plugin
sudo cp plugins/vddk/.libs/nbdkit-vddk-plugin.so /usr/lib/x86_64-linux-gnu/nbdkit/plugins/

# Create compatibility symlink for VDDK 9.x
sudo ln -s /usr/local/vmware-vix-disklib-distrib/lib64/libvixDiskLib.so.9 \
           /usr/local/vmware-vix-disklib-distrib/lib64/libvixDiskLib.so.8

# Verify plugin installation
LD_LIBRARY_PATH=/usr/local/vmware-vix-disklib-distrib/lib64 nbdkit vddk --dump-plugin
# Should display VDDK plugin configuration options

# Clean up build directory
cd ~
rm -rf /tmp/nbdkit-*
```

#### Configure VDDK Library Path

**Important:** Do NOT set `LD_LIBRARY_PATH` globally in your shell profile, as VDDK libraries can conflict with system libraries and break tools like `apt`.

The migration script will automatically set `LD_LIBRARY_PATH` when needed. If you need to run virt-v2v manually, always prefix the command:
```bash
# Correct - temporary for one command
sudo LD_LIBRARY_PATH=/usr/local/vmware-vix-disklib-distrib/lib64 virt-v2v [options]

# Wrong - breaks system tools
export LD_LIBRARY_PATH=/usr/local/vmware-vix-disklib-distrib/lib64  # Don't do this!
```

#### Make Kernel Readable (Required for libguestfs)

The libguestfs/supermin tool needs to read the kernel to build its appliance:
```bash
# Make kernel files readable
sudo chmod +r /boot/vmlinuz-*

# Verify permissions
ls -la /boot/vmlinuz-*
```

### Step 7: Download VirtIO Drivers for Windows VMs

Windows VMs require VirtIO drivers to boot on KVM-based hypervisors like Scale Computing.
```bash
# Create directory for ISOs
sudo mkdir -p /opt/virtio-win

# Download latest stable virtio-win ISO
sudo wget -O /opt/virtio-win/virtio-win.iso \
    https://fedorapeople.org/groups/virt/virtio-win/direct-downloads/stable-virtio/virtio-win.iso

# Verify download (should be ~500MB)
ls -lh /opt/virtio-win/virtio-win.iso

# Set permissions
sudo chmod 644 /opt/virtio-win/virtio-win.iso
```

The script will automatically use this ISO location, or you can specify a custom path with `--virtio-win-iso`.

### Step 8: Prepare Migration Storage Directory
```bash
# Create directory with sufficient space for conversions
sudo mkdir -p /storage/vm_conversions

# Set ownership to your user
sudo chown -R $(whoami):$(whoami) /storage/vm_conversions

# Set permissions
chmod 755 /storage/vm_conversions

# Verify available space (should be 2x your largest VM)
df -h /storage/vm_conversions
```

**Alternative storage locations:**
- `/mnt/migrations` - If using a dedicated mount point
- `/var/lib/virt-v2v` - Traditional libvirt location
- `/data/vm_conversions` - Custom data partition

### Step 9: Configure VMware ESXi Host

On your ESXi host, enable SSH access:

1. Log into ESXi web interface (https://your-esxi-host)
2. Navigate to: **Host** → **Actions** → **Services** → **Enable Secure Shell (SSH)**
3. Verify SSH is running: Status should show "Running"

#### Test SSH Connectivity
```bash
# Test SSH connection (replace with your ESXi host)
ssh root@your-esxi-host

# If successful, you should see ESXi shell prompt
# Test moref retrieval
vim-cmd vmsvc/getallvms

# Type 'exit' to close connection
exit
```

#### Optional: Configure SSH Key Authentication
```bash
# Generate SSH key (if you don't have one)
ssh-keygen -t rsa -b 4096 -C "vmware-migration"

# Copy public key to ESXi host
cat ~/.ssh/id_rsa.pub | ssh root@your-esxi-host 'cat >> /etc/ssh/keys-root/authorized_keys'

# Test key-based authentication
ssh root@your-esxi-host
# Should not prompt for password
```

### Step 10: Configure Firewall (if using UFW)
```bash
# Check if UFW is active
sudo ufw status

# If active, allow necessary ports for remote management
sudo ufw allow 22/tcp comment 'SSH'

# Allow libvirt connections (if managing remotely)
sudo ufw allow 16509/tcp comment 'Libvirt'

# Reload firewall
sudo ufw reload

# Verify rules
sudo ufw status numbered
```

## Installation of Migration Script

### Method 1: Download Directly
```bash
# Download the script
wget https://raw.githubusercontent.com/mjlyon/ESX-to-Scale-Migration/main/esx2hc.sh

# Make executable
chmod +x esx2hc.sh

# Optionally move to a standard location
sudo mv esx2hc.sh /usr/local/bin/
```

### Method 2: Clone Repository
```bash
# Install git if not already installed
sudo apt install -y git

# Clone the repository
git clone https://github.com/mjlyon/ESX-to-Scale-Migration.git

# Navigate to directory
cd ESX-to-Scale-Migration

# Make script executable
chmod +x esx2hc.sh
```

## Verification Checklist

Before running your first migration, verify all prerequisites:
```bash
# 1. Check virt-v2v is installed
virt-v2v --version

# 2. Check libguestfs is working
sudo libguestfs-test-tool

# 3. Check qemu-img is installed
qemu-img --version

# 4. Check VDDK is installed
ls -la /usr/local/vmware-vix-disklib-distrib/lib64/libvixDiskLib.so

# 5. Check nbdkit VDDK plugin is installed (Ubuntu 24.04)
ls -la /usr/lib/x86_64-linux-gnu/nbdkit/plugins/nbdkit-vddk-plugin.so

# 6. Verify nbdkit VDDK plugin works
LD_LIBRARY_PATH=/usr/local/vmware-vix-disklib-distrib/lib64 nbdkit vddk --dump-plugin

# 7. Check VirtIO ISO exists
ls -lh /opt/virtio-win/virtio-win.iso

# 8. Check storage directory
df -h /storage/vm_conversions

# 9. Check libvirtd is running
sudo systemctl status libvirtd

# 10. Check kernel is readable
ls -la /boot/vmlinuz-* | grep -v "^-r--------"

# 11. Test SSH to ESXi
ssh root@your-esxi-host 'vim-cmd vmsvc/getallvms'

# 12. Verify group membership
groups | grep -E '(libvirt|kvm)'
```

All checks should pass before proceeding with migration.

## Quick Start

### One-Command Installation (All Prerequisites)
```bash
# Complete installation command for Ubuntu/Debian
sudo apt update && sudo apt install -y \
    virtinst libguestfs-tools libvirt-clients libvirt-daemon-system \
    qemu-kvm qemu-utils virt-v2v curl jq python3 python3-urllib3 \
    pv sshpass openssh-client wget guestfs-tools && \
sudo systemctl enable --now libvirtd && \
sudo usermod -a -G libvirt,kvm $(whoami) && \
echo "Installation complete! Log out and back in for group changes to take effect."
```

**Note:** This does not include VDDK installation or nbdkit plugin build (Ubuntu 24.04). Follow Step 6 for those.

### First Migration
```bash
# Run the script with VDDK path
./esx2hc-ubuntu.sh --vddk-libdir /usr/local/vmware-vix-disklib-distrib

# Follow interactive prompts for:
# - VMware connection details
# - VM selection
# - Storage location
# - Scale Hypercore credentials
```

## Usage Examples

### Interactive Mode (Recommended for First Use)
```bash
./esx2hc-ubuntu.sh --vddk-libdir /usr/local/vmware-vix-disklib-distrib
```

### Automated Mode with All Options
```bash
./esx2hc-ubuntu.sh \
  --vddk-libdir /usr/local/vmware-vix-disklib-distrib \
  --virtio-win-iso /opt/virtio-win/virtio-win.iso \
  --out-dir /storage/vm_conversions \
  --auto-install yes \
  --vmware-insecure
```

### Dry Run (Test Without Converting)
```bash
./esx2hc-ubuntu.sh \
  --vddk-libdir /usr/local/vmware-vix-disklib-distrib \
  --dry-run
```

### With TLS Verification Enabled
```bash
./esx2hc-ubuntu.sh \
  --vddk-libdir /usr/local/vmware-vix-disklib-distrib \
  --vmware-insecure=false \
  --scale-verify-tls
```

## Troubleshooting Ubuntu-Specific Issues

### Issue: "Failed to connect to libvirt"
```bash
# Check libvirtd service
sudo systemctl status libvirtd

# Restart libvirtd
sudo systemctl restart libvirtd

# Check socket permissions
ls -la /var/run/libvirt/libvirt-sock

# Verify group membership
groups $(whoami) | grep libvirt
```

### Issue: "KVM kernel module not loaded"
```bash
# Check if KVM is loaded
lsmod | grep kvm

# Load KVM module for Intel
sudo modprobe kvm_intel

# Or for AMD
sudo modprobe kvm_amd

# Make it permanent
echo "kvm_intel" | sudo tee -a /etc/modules  # Intel
# OR
echo "kvm_amd" | sudo tee -a /etc/modules    # AMD

# Verify CPU supports virtualization
egrep -o '(vmx|svm)' /proc/cpuinfo
```

### Issue: "Permission denied" Running virt-v2v
```bash
# Check file permissions
ls -la /storage/vm_conversions

# Fix ownership
sudo chown -R $(whoami):$(whoami) /storage/vm_conversions

# Or run with sudo
sudo -E ./esx2hc-ubuntu.sh --vddk-libdir /usr/local/vmware-vix-disklib-distrib
```

### Issue: "libguestfs error: guestfs_launch failed"
```bash
# Set libguestfs backend
export LIBGUESTFS_BACKEND=direct

# Check available memory
free -h

# Increase swap if needed (for systems with <4GB RAM)
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Make swap permanent
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### Issue: "virt-v2v: error: libguestfs error: could not locate virtio-win"
```bash
# Verify ISO exists
ls -lh /opt/virtio-win/virtio-win.iso

# Re-download if missing or corrupted
sudo wget -O /opt/virtio-win/virtio-win.iso \
    https://fedorapeople.org/groups/virt/virtio-win/direct-downloads/stable-virtio/virtio-win.iso

# Specify ISO path explicitly
./esx2hc-ubuntu.sh \
  --vddk-libdir /usr/local/vmware-vix-disklib-distrib \
  --virtio-win-iso /opt/virtio-win/virtio-win.iso
```

### Issue: "nbdkit-vddk-plugin is not installed"

This occurs on Ubuntu 24.04 where the VDDK plugin is not included in the distribution.
```bash
# Verify if plugin exists
ls -la /usr/lib/x86_64-linux-gnu/nbdkit/plugins/nbdkit-vddk-plugin.so

# If missing, follow the build instructions in Step 6
# Enable source repositories
sudo sed -i 's/^Types: deb$/Types: deb deb-src/' /etc/apt/sources.list.d/ubuntu.sources
sudo apt update

# Install build dependencies and build plugin (see Step 6 for full instructions)
```

### Issue: "cannot open '/boot/vmlinuz' for reading: Permission denied"
```bash
# Make kernel files readable
sudo chmod +r /boot/vmlinuz-*

# Always run virt-v2v with sudo
sudo LD_LIBRARY_PATH=/usr/local/vmware-vix-disklib-distrib/lib64 ./esx2hc-ubuntu.sh [options]
```

### Issue: LD_LIBRARY_PATH Breaks System Tools

If you've accidentally set `LD_LIBRARY_PATH` globally and system tools like `apt` are broken:
```bash
# Unset the variable
unset LD_LIBRARY_PATH

# Verify it's unset
echo $LD_LIBRARY_PATH
# Should be empty

# Check if apt works again
apt --version

# Remove from profile files if set there
grep -r "LD_LIBRARY_PATH" ~/.bashrc ~/.bash_profile ~/.profile
# Remove any VDDK-related LD_LIBRARY_PATH lines found
```

### Issue: "libvixDiskLib.so.8: cannot open shared object file"
```bash
# Create compatibility symlink for VDDK 9.x
sudo ln -s /usr/local/vmware-vix-disklib-distrib/lib64/libvixDiskLib.so.9 \
           /usr/local/vmware-vix-disklib-distrib/lib64/libvixDiskLib.so.8

# Verify symlink
ls -la /usr/local/vmware-vix-disklib-distrib/lib64/libvixDiskLib.so*
```

### Issue: "VixDiskLib: Failed to load library"
```bash
# Check VDDK installation
ls -la /usr/local/vmware-vix-disklib-distrib/lib64/

# Verify library path
cat /etc/ld.so.conf.d/vmware-vddk.conf

# Rebuild library cache
sudo ldconfig

# Test library loading
ldd /usr/local/vmware-vix-disklib-distrib/bin64/vmware-vdiskmanager
```

### Issue: Upload to Scale Failed
```bash
# Test Scale Hypercore API connectivity
curl -k https://your-scale-cluster/rest/v1/

# Check network connectivity
ping -c 4 your-scale-cluster
nc -zv your-scale-cluster 443

# Test with verbose curl
curl -k -v https://your-scale-cluster/rest/v1/

# Check upload debug log
cat /tmp/curl_upload_debug.log
```

## Performance Optimization for Ubuntu

### Storage Performance
```bash
# Check I/O scheduler (for SSD/NVMe)
cat /sys/block/sda/queue/scheduler
# Should show: [none] or [noop] for SSDs

# Set I/O scheduler for SSD
echo none | sudo tee /sys/block/sda/queue/scheduler

# Use XFS filesystem for conversion directory (optimal for large files)
# Format partition as XFS:
sudo mkfs.xfs /dev/sdX
sudo mount /dev/sdX /storage/vm_conversions

# Or check current filesystem
df -T /storage/vm_conversions
```

### Network Performance
```bash
# Check network interface speed
ethtool eth0 | grep Speed

# Enable jumbo frames (if supported, typically for 10GbE)
sudo ip link set eth0 mtu 9000

# Make permanent - edit /etc/netplan/*.yaml (Ubuntu 18.04+)
sudo nano /etc/netplan/00-installer-config.yaml
# Add under interface:
#   mtu: 9000

# Apply netplan changes
sudo netplan apply

# Verify MTU
ip link show eth0
```

### Memory and CPU
```bash
# Monitor resource usage during conversion
htop

# Install if not present
sudo apt install -y htop

# Check CPU frequency scaling
cat /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor

# Set to performance mode
echo performance | sudo tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor
```

### Using Screen for Long Migrations
```bash
# Install screen
sudo apt install -y screen

# Start a named screen session
screen -S migration

# Run migration
./esx2hc-ubuntu.sh --vddk-libdir /usr/local/vmware-vix-disklib-distrib

# Detach from screen: Press Ctrl+A, then D

# List screen sessions
screen -ls

# Reattach to session
screen -r migration

# Kill a screen session
screen -X -S migration quit
```

## Common Package Versions on Ubuntu

| Ubuntu Version | virt-v2v | libguestfs | qemu-img | nbdkit |
|----------------|----------|------------|----------|--------|
| 20.04 LTS      | 1.40.2   | 1.40.2     | 4.2      | 1.16.2 |
| 22.04 LTS      | 1.45.3   | 1.46.2     | 6.2      | 1.30.5 |
| 24.04 LTS      | 1.52.0   | 1.52.0     | 8.2      | 1.36.3 |

**Note:** Ubuntu 22.04 LTS or newer is recommended for the latest features and bug fixes.

## Additional Resources

### Documentation
- **virt-v2v Manual**: https://libguestfs.org/virt-v2v.1.html
- **libguestfs Tools**: https://libguestfs.org/
- **nbdkit Documentation**: https://libguestfs.org/nbdkit.1.html
- **Ubuntu Server Guide**: https://ubuntu.com/server/docs
- **Scale Computing Docs**: https://www.scalecomputing.com/resources

### Community Support
- **GitHub Issues**: https://github.com/mjlyon/ESX-to-Scale-Migration/issues
- **Ubuntu Forums**: https://ubuntuforums.org/
- **libguestfs Mailing List**: https://www.redhat.com/mailman/listinfo/libguestfs

---

**Distribution**: Ubuntu/Debian Guide  
**Last Updated**: February 2026  
**Tested On**: Ubuntu 22.04 LTS, Ubuntu 24.04 LTS, Debian 12  
**Script Version**: Compatible with esx2hc.sh v1.0+
