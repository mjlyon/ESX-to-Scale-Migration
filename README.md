# ESX to Scale Computing Hypercore Migration Tool

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

### Ubuntu Host Requirements

* **Ubuntu 20.04 LTS or newer** (22.04 LTS or 24.04 LTS recommended)
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

## Ubuntu Prerequisites Installation

### Step 1: Update System Packages

```bash
sudo apt update
sudo apt upgrade -y
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
    openssh-client

# Optional but recommended for troubleshooting
sudo apt install -y \
    libguestfs-tools \
    guestfs-tools
```

### Step 3: Enable and Start libvirt Service

```bash
# Enable libvirt daemon
sudo systemctl enable libvirtd
sudo systemctl start libvirtd

# Add your user to libvirt group (replace 'username' with your actual username)
sudo usermod -a -G libvirt $(whoami)

# Add your user to kvm group for hardware acceleration
sudo usermod -a -G kvm $(whoami)

# Apply group changes (or log out and back in)
newgrp libvirt
```

### Step 4: Verify libguestfs Installation

```bash
# Test libguestfs
sudo libguestfs-test-tool

# This should complete successfully and show "libguestfs: run ok"
# If you see errors, ensure KVM is enabled in BIOS
```

### Step 5: Install VMware VDDK (Virtual Disk Development Kit)

The VDDK provides high-performance direct disk access to VMware VMs.

1. **Download VDDK** from VMware:
   - Visit: https://developer.broadcom.com/sdks/vmware-virtual-disk-development-kit-vddk/latest
   - Register for a free VMware Developer account (if needed)
   - Download: **VMware Virtual Disk Development Kit** (latest version)
   - Recommended: VDDK 8.0.3 or newer

2. **Extract and Install VDDK**:

```bash
# Navigate to your downloads directory
cd ~/Downloads

# Extract the VDDK archive (replace with your downloaded version)
tar -xzf VMware-vix-disklib-8.0.3-*.x86_64.tar.gz

# Move to system directory
sudo mv vmware-vix-disklib-distrib /usr/local/

# Set permissions
sudo chmod -R 755 /usr/local/vmware-vix-disklib-distrib

# Verify installation
ls -la /usr/local/vmware-vix-disklib-distrib/lib64/
# Should show libvixDiskLib.so and related files
```

3. **Add VDDK to Library Path** (optional, helps with linking):

```bash
# Create a conf file for dynamic linker
echo "/usr/local/vmware-vix-disklib-distrib/lib64" | sudo tee /etc/ld.so.conf.d/vmware-vddk.conf

# Update library cache
sudo ldconfig
```

### Step 6: Download VirtIO Drivers for Windows VMs

Windows VMs require VirtIO drivers to boot on KVM-based hypervisors like Scale Computing.

```bash
# Create directory for ISOs
sudo mkdir -p /opt/virtio-win

# Download latest stable virtio-win ISO
sudo wget -O /opt/virtio-win/virtio-win.iso \
    https://fedorapeople.org/groups/virt/virtio-win/direct-downloads/stable-virtio/virtio-win.iso

# Verify download
ls -lh /opt/virtio-win/virtio-win.iso
```

The script will automatically use this ISO location, or you can specify a custom path with `--virtio-win-iso`.

### Step 7: Prepare Migration Storage Directory

```bash
# Create directory with sufficient space for conversions
sudo mkdir -p /storage/vm_conversions

# Set ownership to your user
sudo chown -R $(whoami):$(whoami) /storage/vm_conversions

# Verify available space (should be 2x your largest VM)
df -h /storage/vm_conversions
```

### Step 8: Configure VMware ESXi Host

On your ESXi host, enable SSH access:

1. Log into ESXi web interface (https://your-esxi-host)
2. Navigate to: **Host** → **Actions** → **Services** → **Enable Secure Shell (SSH)**
3. Verify SSH is running: Status should show "Running"

**Test SSH connectivity from Ubuntu:**

```bash
# Test SSH connection (replace with your ESXi host and credentials)
ssh root@your-esxi-host

# If successful, you should see ESXi shell prompt
# Type 'exit' to close connection
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

## Usage

### Basic Interactive Usage

Run the script and follow the interactive prompts:

```bash
./esx2hc.sh --vddk-libdir /usr/local/vmware-vix-disklib-distrib
```

You will be prompted for:
- VMware connection details (host, username, password)
- VM selection from available VMs
- Storage location for converted files
- Scale Hypercore cluster details (IP, username, password)

### Command-Line Options

```bash
./esx2hc.sh [options]

Options:
  --dry-run                      Plan only; do not convert or upload
  --out-dir /path                Base directory for conversion outputs
  --virtio-win-iso /path.iso     Path to virtio-win ISO (default: auto-download)
  --vddk-libdir /path            Path to VDDK library directory (required)
  --vmware-insecure              Skip VMware TLS verify (default: enabled)
  --vmware-insecure=false        Enforce VMware TLS verification
  --scale-verify-tls             Verify Scale TLS certificates (default: disabled)
  --auto-install yes|no|ask      Auto-install missing prereqs (default: ask)
  --esx-timeout-seconds N        Timeout for VMware calls (default: 30)
  -h, --help                     Show help message
```

### Example: Full Automation

```bash
./esx2hc.sh \
  --vddk-libdir /usr/local/vmware-vix-disklib-distrib \
  --virtio-win-iso /opt/virtio-win/virtio-win.iso \
  --out-dir /storage/vm_conversions \
  --auto-install yes
```

### Example: Dry Run (Plan Only)

```bash
# Test without actually converting or uploading
./esx2hc.sh \
  --vddk-libdir /usr/local/vmware-vix-disklib-distrib \
  --dry-run
```

## Migration Workflow

### Pre-Migration Checklist

- [ ] Ubuntu host meets system requirements
- [ ] All prerequisite packages installed
- [ ] VDDK installed and accessible
- [ ] VirtIO drivers ISO downloaded
- [ ] Sufficient storage space available (2x VM size)
- [ ] SSH enabled on ESXi host
- [ ] Network connectivity verified to ESXi and Scale cluster
- [ ] Target VM powered off in VMware

### Migration Steps

1. **Power Off Source VM**
   ```bash
   # VMs must be powered off before conversion
   # Use VMware vSphere to gracefully shut down the VM
   ```

2. **Run Migration Script**
   ```bash
   ./esx2hc.sh --vddk-libdir /usr/local/vmware-vix-disklib-distrib
   ```

3. **Monitor Conversion Progress**
   - Script shows real-time virt-v2v output
   - Conversion time varies based on VM size and disk speed
   - Typical: 5-15 minutes per 100GB on SSD storage

4. **Monitor Upload Progress**
   - Upload shows progress with `pv` (if installed)
   - Upload time depends on network speed
   - Typical: 10-30 minutes per 100GB on 1Gbps network

5. **Verify in Scale Hypercore**
   - Log into Scale Hypercore web interface
   - Navigate to: **Storage** → **Virtual Disks**
   - Confirm uploaded disk appears in inventory

6. **Create VM in Scale**
   - Create new VM in Scale Hypercore
   - Attach the uploaded virtual disk
   - Configure CPU, memory, and network settings
   - Use VIRTIO for disk and network adapters

7. **Boot and Test**
   - Power on the VM
   - Verify successful boot (Windows should use injected VIRTIO drivers)
   - Test network connectivity
   - Validate application functionality

### Post-Migration Steps

```bash
# Clean up local converted files (if no longer needed)
rm -rf /storage/vm_conversions/vm_name

# Update Scale VM settings as needed
# - Install Scale guest tools (if available)
# - Adjust CPU/RAM allocations
# - Configure backup schedules
```

## Troubleshooting

### Common Ubuntu-Specific Issues

#### Issue: "libvirt: error: Failed to connect socket"

**Solution:**
```bash
# Ensure libvirtd is running
sudo systemctl status libvirtd
sudo systemctl restart libvirtd

# Check socket permissions
ls -la /var/run/libvirt/libvirt-sock

# Add user to libvirt group
sudo usermod -a -G libvirt $(whoami)
newgrp libvirt
```

#### Issue: "KVM kernel module not loaded"

**Solution:**
```bash
# Check if KVM is available
lsmod | grep kvm

# Load KVM module (Intel)
sudo modprobe kvm_intel

# Or for AMD
sudo modprobe kvm_amd

# Verify hardware virtualization is enabled in BIOS
egrep -o '(vmx|svm)' /proc/cpuinfo
```

#### Issue: "Permission denied" when running virt-v2v

**Solution:**
```bash
# Run script with sudo, or fix permissions
sudo chown -R libvirt-qemu:kvm /storage/vm_conversions

# Or run virt-v2v as root
sudo ./esx2hc.sh --vddk-libdir /usr/local/vmware-vix-disklib-distrib
```

#### Issue: "Failed to retrieve VM moref"

**Solution:**
```bash
# Test SSH connectivity manually
ssh root@your-esxi-host

# Ensure SSH password authentication is enabled on ESXi
# Try manual moref retrieval
ssh root@your-esxi-host "vim-cmd vmsvc/getallvms"

# If SSH keys are preferred, add to ESXi:
ssh-copy-id root@your-esxi-host
```

#### Issue: "VixDiskLib_Open: Unknown error"

**Solution:**
```bash
# Verify VDDK installation
ls -la /usr/local/vmware-vix-disklib-distrib/lib64/

# Check library linking
ldd /usr/local/vmware-vix-disklib-distrib/bin64/vmware-vdiskmanager

# Ensure VM is powered off in VMware
# Verify ESXi host is accessible on port 443
nc -zv your-esxi-host 443
```

#### Issue: "qemu-img: Could not open file"

**Solution:**
```bash
# Ensure qemu-utils is installed
sudo apt install -y qemu-utils

# Check disk space
df -h /storage/vm_conversions

# Verify file permissions
ls -la /storage/vm_conversions/
```

#### Issue: "Upload failed: Connection refused"

**Solution:**
```bash
# Verify Scale Hypercore API is accessible
curl -k https://your-scale-cluster/rest/v1/

# Check network connectivity
ping your-scale-cluster
nc -zv your-scale-cluster 443

# Verify credentials are correct
# Try accessing Scale web UI manually
```

### General Troubleshooting

#### Enable Debug Mode

```bash
# Set libguestfs debug variables
export LIBGUESTFS_DEBUG=1
export LIBGUESTFS_TRACE=1

# Run script with verbose output
./esx2hc.sh --vddk-libdir /usr/local/vmware-vix-disklib-distrib
```

#### Check Log Files

```bash
# Upload debug log
cat /tmp/curl_upload_debug.log

# System logs
sudo journalctl -u libvirtd -f

# Kernel messages
dmesg | grep -i kvm
```

#### Verify Package Versions

```bash
# Check virt-v2v version
virt-v2v --version

# Check libguestfs version
libguestfs-test-tool

# Check qemu version
qemu-img --version
```

### Performance Issues

#### Slow Conversion

**Optimization tips:**
```bash
# Use local SSD/NVMe storage
# Avoid network-mounted storage for conversions

# Check disk I/O performance
sudo apt install -y iotop
sudo iotop

# Increase virt-v2v cache (if you have RAM)
# Edit /etc/libguestfs-tools.conf (if it exists)
```

#### Slow Upload

**Optimization tips:**
```bash
# Test network bandwidth
sudo apt install -y iperf3
iperf3 -c your-scale-cluster

# Use 10GbE network if available
# Check MTU settings
ip link show

# Monitor network usage
sudo apt install -y iftop
sudo iftop -i eth0
```

## Ubuntu Package Dependencies Summary

For quick reference, here's the complete installation command:

```bash
# Single command to install all required Ubuntu packages
sudo apt update && sudo apt install -y \
    virtinst \
    libguestfs-tools \
    libvirt-clients \
    libvirt-daemon-system \
    qemu-kvm \
    qemu-utils \
    virt-v2v \
    curl \
    jq \
    python3 \
    python3-urllib3 \
    pv \
    sshpass \
    openssh-client \
    guestfs-tools
```

## Security Considerations

### TLS Certificate Verification

**VMware (disabled by default):**
```bash
# Default behavior (for lab/self-signed certs)
./esx2hc.sh --vmware-insecure

# Enable TLS verification (for production with CA-signed certs)
./esx2hc.sh --vmware-insecure=false
```

**Scale Computing (disabled by default):**
```bash
# Default behavior (most Hypercore clusters use self-signed certs)
./esx2hc.sh --vddk-libdir /usr/local/vmware-vix-disklib-distrib

# Enable TLS verification (if using CA-signed certs)
./esx2hc.sh --scale-verify-tls
```

### Credential Security

- Passwords are never logged or stored persistently
- Temporary password files are created with `chmod 600` permissions
- All temporary files are cleaned up on script exit
- Consider using SSH keys for ESXi access instead of passwords

### Firewall Configuration

If using UFW (Ubuntu's default firewall):

```bash
# Allow SSH (if needed for remote management)
sudo ufw allow 22/tcp

# Allow libvirt connections (if managing remotely)
sudo ufw allow 16509/tcp

# Check firewall status
sudo ufw status
```

## Performance Tips

### Storage Optimization

1. **Use local SSD/NVMe storage** for `/storage/vm_conversions`
   - 50%+ faster than spinning disks
   - Significantly faster than NFS/CIFS mounts

2. **Use XFS or ext4 filesystem**
   ```bash
   # Check filesystem type
   df -T /storage/vm_conversions
   
   # XFS is recommended for large files
   ```

3. **Allocate sufficient space**
   ```bash
   # Monitor space during conversion
   watch -n 5 df -h /storage/vm_conversions
   ```

### Network Optimization

1. **Use 10GbE network** for production migrations
2. **Enable jumbo frames** (MTU 9000) if supported
   ```bash
   # Check current MTU
   ip link show eth0
   
   # Set jumbo frames (if supported)
   sudo ip link set eth0 mtu 9000
   ```

3. **Run migration host close to Scale cluster** (same VLAN/subnet)

### Parallel Migrations

Run multiple script instances for different VMs:

```bash
# Terminal 1
./esx2hc.sh --vddk-libdir /usr/local/vmware-vix-disklib-distrib

# Terminal 2 (different VM)
./esx2hc.sh --vddk-libdir /usr/local/vmware-vix-disklib-distrib

# Monitor resource usage
htop
```

**Note:** Monitor disk I/O and network to avoid saturation

### Use Screen or Tmux for Long Migrations

```bash
# Install screen
sudo apt install -y screen

# Start a screen session
screen -S migration

# Run migration
./esx2hc.sh --vddk-libdir /usr/local/vmware-vix-disklib-distrib

# Detach: Press Ctrl+A, then D
# Reattach later: screen -r migration
```

## Limitations

- **VMs must be powered off** during conversion to ensure consistent disk state
- **Linux host required** - virt-v2v and libguestfs are Linux-only tools
- **Disk space requirements** - Need ~2x VM size (raw + qcow2 formats temporarily)
- **No resume capability** - If upload fails, must restart from beginning
- **Single-threaded conversion** - Each script instance converts one VM at a time
- **Ubuntu 20.04+** - Older Ubuntu versions may have incompatible package versions

## Supported VM Types

### Operating Systems
- ✅ **Windows**: 7, 8, 10, 11, Server 2008 R2, 2012, 2016, 2019, 2022
- ✅ **Linux**: Ubuntu, Debian, CentOS, RHEL, Fedora, SUSE
- ✅ **Other**: Most modern x86_64 operating systems

### Disk Types
- ✅ VMDK (all variants)
- ✅ Thin provisioned
- ✅ Thick provisioned
- ✅ Multiple disks per VM

### Not Supported
- ❌ VMs with snapshots (delete snapshots first)
- ❌ VMs with RDM (raw device mapping) disks
- ❌ VMs using physical devices (CD-ROM, USB passthrough)

## To-Do / Future Enhancements

- [ ] **Batch migration support**: Select and migrate multiple VMs serially or in parallel
- [ ] **Improved authentication**: Add command-line flags for all credentials (--vmware-host, --vmware-user, --scale-host, etc.)
- [ ] **Resume capability**: Handle interrupted uploads
- [ ] **Pre-flight validation**: Check all requirements before starting conversion
- [ ] **Progress dashboard**: Real-time status of multiple concurrent migrations
- [ ] **Post-migration testing**: Automated boot testing and validation
- [ ] **Migration reports**: Generate summary reports in HTML/JSON format

## Contributing

Contributions are welcome! Please feel free to:
- Report bugs via GitHub Issues
- Submit pull requests with improvements
- Share your migration experiences
- Suggest new features

**Note from author:** "Please help, I don't know what I'm doing." 😄

## License

This project is licensed under the GPL-3.0 License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built on top of **virt-v2v** from the [libguestfs project](https://libguestfs.org/)
- Uses **VMware VDDK** for optimal disk access performance
- VirtIO drivers from the [Fedora Project](https://fedorapeople.org/groups/virt/virtio-win/)
- Special thanks to the Scale Computing community

## Support and Resources

- **GitHub Repository**: https://github.com/mjlyon/ESX-to-Scale-Migration
- **Scale Computing Documentation**: https://www.scalecomputing.com/resources
- **virt-v2v Documentation**: https://libguestfs.org/virt-v2v.1.html
- **VMware VDDK Documentation**: https://developer.broadcom.com/tools/

---

**Last Updated**: February 2026  
**Tested On**: Ubuntu 22.04 LTS, Ubuntu 24.04 LTS  
**Script Version**: Compatible with esx2hc.sh v1.0+
