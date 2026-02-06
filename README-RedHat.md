# ESX to Scale Computing Hypercore Migration Tool
## RedHat/AlmaLinux/Rocky/Fedora Installation Guide

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

### RedHat/AlmaLinux/Rocky/Fedora Host Requirements

* **Supported Distributions**:
  - Red Hat Enterprise Linux (RHEL) 8.x, 9.x
  - AlmaLinux 8.x, 9.x (recommended for open-source alternative)
  - Rocky Linux 8.x, 9.x
  - Fedora 38, 39, 40+
  - CentOS Stream 8, 9
* **Architecture**: x86_64 (64-bit)
* **Storage**: Minimum 2x the size of VMs being converted
  - Recommended: Dedicated server or VM with fast SSD/NVMe storage
  - Example: To convert a 100GB VM, allocate at least 200GB free space
* **Memory**: Minimum 4GB RAM (8GB+ recommended for large VMs)
* **Network**: 1Gbps+ connection (10GbE recommended for production migrations)

### Network Access Requirements

Your migration host must have network access to:
- **ESXi/vCenter**: Port 443 (HTTPS) for VM metadata and disk access
- **ESXi host**: Port 22 (SSH) for moref retrieval
- **Scale Hypercore cluster**: Port 443 (HTTPS) for API uploads

## RedHat/AlmaLinux/Rocky Prerequisites Installation

### Step 1: Enable Required Repositories

#### For RHEL 8/9

```bash
# Enable CodeReady Builder repository (RHEL 8)
sudo subscription-manager repos --enable codeready-builder-for-rhel-8-x86_64-rpms

# Or for RHEL 9
sudo subscription-manager repos --enable codeready-builder-for-rhel-9-x86_64-rpms

# Enable EPEL repository
sudo dnf install -y epel-release
```

#### For AlmaLinux/Rocky 8/9

```bash
# Enable PowerTools/CRB repository (AlmaLinux/Rocky 8)
sudo dnf config-manager --set-enabled powertools

# Or for AlmaLinux/Rocky 9
sudo dnf config-manager --set-enabled crb

# Enable EPEL repository
sudo dnf install -y epel-release
```

#### For Fedora

```bash
# Fedora includes most packages by default
# Enable RPM Fusion if needed for additional packages
sudo dnf install -y \
    https://download1.rpmfusion.org/free/fedora/rpmfusion-free-release-$(rpm -E %fedora).noarch.rpm
```

### Step 2: Update System Packages

```bash
# Update all packages
sudo dnf update -y

# Install development tools (if needed)
sudo dnf groupinstall -y "Development Tools"
```

### Step 3: Install Required Packages

```bash
# Install virtualization group
sudo dnf groupinstall -y "Virtualization Host"

# Install virt-v2v and related tools
sudo dnf install -y \
    virt-v2v \
    libguestfs \
    libguestfs-tools \
    libguestfs-tools-c \
    virt-install \
    libvirt \
    libvirt-client \
    qemu-kvm \
    qemu-img

# Install supporting utilities
sudo dnf install -y \
    curl \
    jq \
    python3 \
    python3-urllib3 \
    pv \
    sshpass \
    openssh-clients \
    wget \
    tar \
    gzip

# Install additional guestfs dependencies
sudo dnf install -y \
    guestfs-tools \
    libguestfs-xfs
```

**Package Descriptions:**
- `virt-v2v` - Convert VMs from VMware to KVM
- `libguestfs` - Library for accessing and modifying VM disk images
- `libguestfs-tools` - Guest filesystem tools and utilities
- `virt-install` - Command line tool for creating VMs
- `libvirt` - Virtualization API and management daemon
- `qemu-kvm` - KVM virtualization support
- `qemu-img` - QEMU disk image utility
- `curl` - HTTP/HTTPS transfer tool
- `jq` - JSON parsing utility
- `pv` - Pipe viewer for progress monitoring
- `sshpass` - Non-interactive SSH password authentication

### Step 4: Enable and Start libvirt Service

```bash
# Enable libvirtd to start on boot
sudo systemctl enable libvirtd

# Start libvirtd immediately
sudo systemctl start libvirtd

# Verify libvirtd is running
sudo systemctl status libvirtd

# If using nested virtualization, also enable virtqemud
sudo systemctl enable virtqemud
sudo systemctl start virtqemud
```

### Step 5: Configure User Permissions

```bash
# Add your user to libvirt group
sudo usermod -a -G libvirt $(whoami)

# Add your user to qemu group
sudo usermod -a -G qemu $(whoami)

# For RHEL/AlmaLinux/Rocky, also add to kvm group
sudo usermod -a -G kvm $(whoami)

# Apply group changes
newgrp libvirt

# Verify group membership
groups $(whoami)
# Should show: ... libvirt qemu kvm ...
```

**Note:** If `newgrp` doesn't work, log out and log back in for group changes to take effect.

### Step 6: Configure SELinux (if enabled)

```bash
# Check SELinux status
sestatus

# If SELinux is enforcing, configure policies
# Allow virt-v2v to access necessary files
sudo setsebool -P virt_use_nfs on
sudo setsebool -P virt_use_samba on

# If using custom storage locations, set SELinux context
sudo semanage fcontext -a -t virt_image_t "/storage/vm_conversions(/.*)?"
sudo restorecon -Rv /storage/vm_conversions

# Alternatively, set SELinux to permissive mode temporarily (not recommended for production)
# sudo setenforce 0
```

**Note:** SELinux provides additional security. Keep it enabled and configure policies rather than disabling it.

### Step 7: Configure Firewall

```bash
# Check firewall status
sudo firewall-cmd --state

# If firewalld is running, configure rules
# Allow SSH (if needed for remote management)
sudo firewall-cmd --permanent --add-service=ssh

# Allow libvirt connections (if managing remotely)
sudo firewall-cmd --permanent --add-service=libvirt

# Reload firewall
sudo firewall-cmd --reload

# Verify rules
sudo firewall-cmd --list-all
```

### Step 8: Verify Virtualization Support

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

# Make KVM module load on boot
echo "kvm_intel" | sudo tee /etc/modules-load.d/kvm.conf  # Intel
# OR
echo "kvm_amd" | sudo tee /etc/modules-load.d/kvm.conf    # AMD

# Test libguestfs functionality
sudo libguestfs-test-tool
# Should complete successfully and show "libguestfs: run ok"
```

### Step 9: Install VMware VDDK (Virtual Disk Development Kit)

The VDDK provides high-performance direct disk access to VMware VMs.

#### Download VDDK

1. Visit: https://developer.broadcom.com/tools/open-virtualization-format-ovf-tool/latest
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

#### Configure VDDK Library Path

```bash
# Create a conf file for dynamic linker
echo "/usr/local/vmware-vix-disklib-distrib/lib64" | sudo tee /etc/ld.so.conf.d/vmware-vddk.conf

# Update library cache
sudo ldconfig

# Verify library is recognized
ldconfig -p | grep vix
# Should show libvixDiskLib.so entries
```

### Step 10: Download VirtIO Drivers for Windows VMs

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

# Set SELinux context (if SELinux is enabled)
sudo chcon -t virt_content_t /opt/virtio-win/virtio-win.iso
```

The script will automatically use this ISO location, or you can specify a custom path with `--virtio-win-iso`.

### Step 11: Prepare Migration Storage Directory

```bash
# Create directory with sufficient space for conversions
sudo mkdir -p /storage/vm_conversions

# Set ownership to your user
sudo chown -R $(whoami):$(whoami) /storage/vm_conversions

# Set permissions
chmod 755 /storage/vm_conversions

# Set SELinux context (if SELinux is enabled)
sudo semanage fcontext -a -t virt_image_t "/storage/vm_conversions(/.*)?"
sudo restorecon -Rv /storage/vm_conversions

# Verify available space (should be 2x your largest VM)
df -h /storage/vm_conversions
```

**Alternative storage locations:**
- `/mnt/migrations` - If using a dedicated mount point
- `/var/lib/libvirt/images` - Default libvirt location
- `/data/vm_conversions` - Custom data partition

### Step 12: Configure VMware ESXi Host

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
sudo dnf install -y git

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

# 5. Check VirtIO ISO exists
ls -lh /opt/virtio-win/virtio-win.iso

# 6. Check storage directory
df -h /storage/vm_conversions

# 7. Check libvirtd is running
sudo systemctl status libvirtd

# 8. Test SSH to ESXi
ssh root@your-esxi-host 'vim-cmd vmsvc/getallvms'

# 9. Verify group membership
groups | grep -E '(libvirt|qemu|kvm)'

# 10. Check SELinux status (if enabled)
sestatus
```

All checks should pass before proceeding with migration.

## Quick Start

### One-Command Installation (AlmaLinux/Rocky 9)

```bash
# Complete installation command for AlmaLinux/Rocky 9
sudo dnf config-manager --set-enabled crb && \
sudo dnf install -y epel-release && \
sudo dnf groupinstall -y "Virtualization Host" && \
sudo dnf install -y virt-v2v libguestfs libguestfs-tools virt-install \
    libvirt libvirt-client qemu-kvm qemu-img curl jq python3 \
    python3-urllib3 pv sshpass openssh-clients wget guestfs-tools && \
sudo systemctl enable --now libvirtd && \
sudo usermod -a -G libvirt,qemu,kvm $(whoami) && \
echo "Installation complete! Log out and back in for group changes to take effect."
```

### One-Command Installation (RHEL 9)

```bash
# Complete installation command for RHEL 9
sudo subscription-manager repos --enable codeready-builder-for-rhel-9-x86_64-rpms && \
sudo dnf install -y epel-release && \
sudo dnf groupinstall -y "Virtualization Host" && \
sudo dnf install -y virt-v2v libguestfs libguestfs-tools virt-install \
    libvirt libvirt-client qemu-kvm qemu-img curl jq python3 \
    python3-urllib3 pv sshpass openssh-clients wget guestfs-tools && \
sudo systemctl enable --now libvirtd && \
sudo usermod -a -G libvirt,qemu,kvm $(whoami) && \
echo "Installation complete! Log out and back in for group changes to take effect."
```

### One-Command Installation (Fedora)

```bash
# Complete installation command for Fedora
sudo dnf groupinstall -y "Virtualization" && \
sudo dnf install -y virt-v2v libguestfs libguestfs-tools virt-install \
    libvirt qemu-kvm qemu-img curl jq python3 pv sshpass wget && \
sudo systemctl enable --now libvirtd && \
sudo usermod -a -G libvirt,qemu $(whoami) && \
echo "Installation complete! Log out and back in for group changes to take effect."
```

### First Migration

```bash
# Run the script with VDDK path
./esx2hc.sh --vddk-libdir /usr/local/vmware-vix-disklib-distrib

# Follow interactive prompts for:
# - VMware connection details
# - VM selection
# - Storage location
# - Scale Hypercore credentials
```

## Usage Examples

### Interactive Mode (Recommended for First Use)

```bash
./esx2hc.sh --vddk-libdir /usr/local/vmware-vix-disklib-distrib
```

### Automated Mode with All Options

```bash
./esx2hc.sh \
  --vddk-libdir /usr/local/vmware-vix-disklib-distrib \
  --virtio-win-iso /opt/virtio-win/virtio-win.iso \
  --out-dir /storage/vm_conversions \
  --auto-install yes \
  --vmware-insecure
```

### Dry Run (Test Without Converting)

```bash
./esx2hc.sh \
  --vddk-libdir /usr/local/vmware-vix-disklib-distrib \
  --dry-run
```

### With TLS Verification Enabled

```bash
./esx2hc.sh \
  --vddk-libdir /usr/local/vmware-vix-disklib-distrib \
  --vmware-insecure=false \
  --scale-verify-tls
```

## Troubleshooting RedHat-Specific Issues

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

# Check for SELinux denials
sudo ausearch -m avc -ts recent
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
echo "kvm_intel" | sudo tee /etc/modules-load.d/kvm.conf  # Intel
# OR
echo "kvm_amd" | sudo tee /etc/modules-load.d/kvm.conf    # AMD

# Verify CPU supports virtualization
egrep -o '(vmx|svm)' /proc/cpuinfo
```

### Issue: SELinux Denying Access

```bash
# Check SELinux status
getenforce

# View recent SELinux denials
sudo ausearch -m avc -ts recent

# Check for virt-related denials
sudo ausearch -m avc -c virt-v2v

# Temporarily set to permissive (for troubleshooting only)
sudo setenforce 0

# After identifying issue, create proper policy or set context
# Example: Allow access to custom storage
sudo semanage fcontext -a -t virt_image_t "/storage/vm_conversions(/.*)?"
sudo restorecon -Rv /storage/vm_conversions

# Re-enable enforcing
sudo setenforce 1
```

### Issue: "Permission denied" Running virt-v2v

```bash
# Check file permissions
ls -la /storage/vm_conversions

# Fix ownership
sudo chown -R $(whoami):$(whoami) /storage/vm_conversions

# Check SELinux context
ls -Z /storage/vm_conversions

# Fix SELinux context
sudo restorecon -Rv /storage/vm_conversions

# Or run with sudo
sudo -E ./esx2hc.sh --vddk-libdir /usr/local/vmware-vix-disklib-distrib
```

### Issue: "libguestfs error: guestfs_launch failed"

```bash
# Set libguestfs backend
export LIBGUESTFS_BACKEND=direct

# Check available memory
free -h

# For RHEL/AlmaLinux, ensure kernel modules are loaded
sudo modprobe nbd
sudo modprobe fuse

# Check libguestfs appliance
sudo virt-builder --list

# Rebuild libguestfs appliance if needed
sudo libguestfs-make-fixed-appliance /usr/local/lib/guestfs
```

### Issue: Repository Errors During Installation

```bash
# For RHEL - ensure subscription is active
sudo subscription-manager status

# Register system if not registered
sudo subscription-manager register

# Enable necessary repositories
sudo subscription-manager repos --enable codeready-builder-for-rhel-9-x86_64-rpms

# For AlmaLinux/Rocky - ensure PowerTools/CRB is enabled
sudo dnf config-manager --set-enabled crb  # RHEL 9-based
sudo dnf config-manager --set-enabled powertools  # RHEL 8-based

# Update repository metadata
sudo dnf clean all
sudo dnf makecache
```

### Issue: "virt-v2v: error: libguestfs error: could not locate virtio-win"

```bash
# Verify ISO exists
ls -lh /opt/virtio-win/virtio-win.iso

# Check SELinux context
ls -Z /opt/virtio-win/virtio-win.iso

# Fix SELinux context
sudo chcon -t virt_content_t /opt/virtio-win/virtio-win.iso

# Re-download if missing or corrupted
sudo wget -O /opt/virtio-win/virtio-win.iso \
    https://fedorapeople.org/groups/virt/virtio-win/direct-downloads/stable-virtio/virtio-win.iso

# Specify ISO path explicitly
./esx2hc.sh \
  --vddk-libdir /usr/local/vmware-vix-disklib-distrib \
  --virtio-win-iso /opt/virtio-win/virtio-win.iso
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

# Check for missing dependencies
ldd /usr/local/vmware-vix-disklib-distrib/lib64/libvixDiskLib.so | grep "not found"
```

### Issue: Upload to Scale Failed

```bash
# Test Scale Hypercore API connectivity
curl -k https://your-scale-cluster/rest/v1/

# Check network connectivity
ping -c 4 your-scale-cluster
nc -zv your-scale-cluster 443

# Check firewall rules
sudo firewall-cmd --list-all

# Temporarily disable firewall for testing (not recommended for production)
sudo systemctl stop firewalld

# Check upload debug log
cat /tmp/curl_upload_debug.log
```

## Performance Optimization for RedHat/AlmaLinux

### Storage Performance

```bash
# Check I/O scheduler (for SSD/NVMe)
cat /sys/block/sda/queue/scheduler
# Should show: [none] or [noop] for SSDs

# Set I/O scheduler for SSD
echo none | sudo tee /sys/block/sda/queue/scheduler

# Make permanent - add to /etc/udev/rules.d/60-ioschedulers.rules
echo 'ACTION=="add|change", KERNEL=="sd[a-z]", ATTR{queue/scheduler}="none"' | \
    sudo tee /etc/udev/rules.d/60-ioschedulers.rules

# Use XFS filesystem for conversion directory (optimal for large files)
# Format partition as XFS:
sudo mkfs.xfs /dev/sdX
sudo mount /dev/sdX /storage/vm_conversions

# Add to /etc/fstab for persistence
echo "/dev/sdX /storage/vm_conversions xfs defaults 0 0" | sudo tee -a /etc/fstab

# Or check current filesystem
df -T /storage/vm_conversions
```

### Network Performance

```bash
# Check network interface speed
ethtool eth0 | grep Speed

# Enable jumbo frames (if supported, typically for 10GbE)
sudo ip link set eth0 mtu 9000

# Make permanent - create/edit network config
# For RHEL/AlmaLinux 8/9 using NetworkManager
sudo nmcli connection modify eth0 802-3-ethernet.mtu 9000
sudo nmcli connection up eth0

# Or edit ifcfg file (older method)
echo "MTU=9000" | sudo tee -a /etc/sysconfig/network-scripts/ifcfg-eth0
sudo systemctl restart NetworkManager

# Verify MTU
ip link show eth0
```

### Tuned Profiles

```bash
# Install tuned (if not already installed)
sudo dnf install -y tuned

# Enable tuned service
sudo systemctl enable --now tuned

# List available profiles
tuned-adm list

# Set virtual-host profile for optimal VM performance
sudo tuned-adm profile virtual-host

# Verify active profile
tuned-adm active
```

### Memory and CPU

```bash
# Install htop for monitoring
sudo dnf install -y htop

# Monitor resource usage during conversion
htop

# Check CPU frequency scaling
cat /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor

# Set to performance mode
echo performance | sudo tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor

# Make permanent using tuned (recommended)
sudo tuned-adm profile latency-performance
```

### Using Screen or Tmux for Long Migrations

```bash
# Install screen
sudo dnf install -y screen

# Or install tmux (alternative)
sudo dnf install -y tmux

# Start a named screen session
screen -S migration

# Run migration
./esx2hc.sh --vddk-libdir /usr/local/vmware-vix-disklib-distrib

# Detach from screen: Press Ctrl+A, then D

# List screen sessions
screen -ls

# Reattach to session
screen -r migration

# Kill a screen session
screen -X -S migration quit
```

## Common Package Versions

| Distribution      | virt-v2v | libguestfs | qemu-img |
|-------------------|----------|------------|----------|
| RHEL 8            | 1.42.0   | 1.40.2     | 4.2      |
| RHEL 9            | 2.0.7    | 1.48.4     | 6.2      |
| AlmaLinux 8       | 1.42.0   | 1.40.2     | 4.2      |
| AlmaLinux 9       | 2.0.7    | 1.48.4     | 6.2      |
| Rocky Linux 8     | 1.42.0   | 1.40.2     | 4.2      |
| Rocky Linux 9     | 2.0.7    | 1.48.4     | 6.2      |
| Fedora 39         | 2.2.0    | 1.50.0     | 8.0      |
| Fedora 40         | 2.4.0    | 1.52.0     | 8.2      |

**Note:** RHEL 9 / AlmaLinux 9 / Rocky Linux 9 is recommended for the latest features and bug fixes.

## SELinux Policy Management

### View SELinux Booleans for Virtualization

```bash
# List all virt-related booleans
getsebool -a | grep virt

# Enable booleans commonly needed for migration
sudo setsebool -P virt_use_nfs on
sudo setsebool -P virt_use_samba on
sudo setsebool -P virt_use_fusefs on
```

### Create Custom SELinux Policy (if needed)

```bash
# Install policy tools
sudo dnf install -y policycoreutils-python-utils

# Generate custom policy from AVC denials
sudo ausearch -m avc -ts recent | audit2allow -M my-virt-migration

# Review the policy
cat my-virt-migration.te

# Install the policy
sudo semodule -i my-virt-migration.pp
```

## Additional Resources

### Documentation
- **virt-v2v Manual**: https://libguestfs.org/virt-v2v.1.html
- **RHEL Virtualization Guide**: https://access.redhat.com/documentation/en-us/red_hat_enterprise_linux/9/html/configuring_and_managing_virtualization/
- **libguestfs Tools**: https://libguestfs.org/
- **Scale Computing Docs**: https://www.scalecomputing.com/resources

### Community Support
- **GitHub Issues**: https://github.com/mjlyon/ESX-to-Scale-Migration/issues
- **RHEL Forums**: https://access.redhat.com/discussions
- **AlmaLinux Forums**: https://forums.almalinux.org/
- **Rocky Linux Forums**: https://forums.rockylinux.org/
- **libguestfs Mailing List**: https://www.redhat.com/mailman/listinfo/libguestfs

### Red Hat Knowledge Base
- **SELinux Troubleshooting**: https://access.redhat.com/documentation/en-us/red_hat_enterprise_linux/9/html/using_selinux/
- **KVM Virtualization**: https://access.redhat.com/documentation/en-us/red_hat_enterprise_linux/9/html/configuring_and_managing_virtualization/

---

**Distribution**: RedHat/AlmaLinux/Rocky/Fedora Guide  
**Last Updated**: February 2026  
**Tested On**: AlmaLinux 9, Rocky Linux 9, RHEL 9, Fedora 39/40  
**Script Version**: Compatible with esx2hc.sh v1.0+
