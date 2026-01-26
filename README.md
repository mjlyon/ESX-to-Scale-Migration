# ESX to Scale Computing HC3 Migration Tool

Automated migration tool to convert and upload VMware ESXi/vCenter VMs to Scale Computing HC3 clusters using virt-v2v and VDDK.
THIS IS PROVIDED AS-IS WITH NO WARRANTY
USE AT YOUR OWN RISK!

## Overview

This script automates the process of:
1. Connecting to VMware ESXi/vCenter
2. Converting VMs using virt-v2v with VDDK for optimal performance
3. Injecting VirtIO drivers for Windows VMs
4. Converting disk images to qcow2 format
5. Uploading converted disks to Scale Computing HC3 via REST API

## Prerequisites

### System Requirements

- **Linux host** with sufficient storage space for VM conversions
  - Recommended: Dedicated Linux VM or physical machine with fast storage
  - Storage requirements: ~2x the size of VMs being converted (for temporary conversion workspace)
  - Tested on: AlmaLinux, Rocky Linux
  
### Required Software

The script will automatically detect and offer to install missing prerequisites:

- `virt-v2v` - VM conversion tool
- `libguestfs-tools` - Guest filesystem tools
- `libvirt-clients` - VMware connectivity
- `qemu-img` - Disk image conversion
- `curl` - API uploads
- `jq` - JSON parsing
- `python3` - URL encoding utilities
- `pv` - Upload progress (optional but recommended)

### VMware Requirements

- **SSH enabled on ESXi host**
  - Required for retrieving VM moref (Managed Object Reference)
  - Enable in ESXi: Host → Actions → Services → Enable Secure Shell (SSH)
  
- **VMware VDDK (Virtual Disk Development Kit)**
  - Download from: [VMware Developer Downloads]([https://developer.vmware.com/](https://developer.broadcom.com/sdks/vmware-virtual-disk-development-kit-vddk/latest))
  - Free registration required
  - Extract to `/usr/local/vmware-vix-disklib-distrib` (or custom path)

- **Network access** from Linux host to:
  - ESXi/vCenter on port 443 (HTTPS)
  - ESXi host on port 22 (SSH)
  - Scale HC3 cluster on port 443 (HTTPS)

### VirtIO Drivers (Windows VMs)

For Windows VMs to boot properly on Scale Computing, VirtIO drivers must be injected during conversion:

- The script will automatically download the latest virtio-win ISO if not found
- Manual download: [virtio-win stable releases](https://fedorapeople.org/groups/virt/virtio-win/direct-downloads/stable-virtio/virtio-win.iso)
- Saves to `/tmp/virtio-win.iso` by default

## Installation

1. **Clone or download the script**
   ```bash
   wget https://raw.githubusercontent.com/yourusername/esx2hc/main/esx2hc.sh
   chmod +x esx2hc.sh
   ```

2. **Install VMware VDDK**
   ```bash
   # Download from VMware, then:
   tar -xzf VMware-vix-disklib-*.tar.gz
   sudo mv vmware-vix-disklib-distrib /usr/local/
   ```

3. **Prepare storage**
   ```bash
   # Create a directory with plenty of space
   mkdir -p /storage/vm_conversions
   ```

## Usage

### Basic Usage

```bash
./esx2hc.sh --vddk-libdir /usr/local/vmware-vix-disklib-distrib
```

The script will interactively prompt for:
- VMware connection details (ESXi/vCenter host, username, password)
- VM selection from available VMs
- Storage location for conversion workspace
- Scale HC3 cluster details (IP, username, password)

### Command-Line Options

```bash
./esx2hc.sh [options]

Options:
  --dry-run                      Plan only; do not convert or upload
  --out-dir /path                Base dir for conversion outputs (overrides interactive selection)
  --virtio-win-iso /path.iso     Path to virtio-win ISO (auto-downloads if not specified)
  --vddk-libdir /path            Path to VDDK library directory
  --vmware-insecure              Skip VMware TLS verify (default: enabled)
  --vmware-insecure=false        Enforce VMware TLS verification
  --scale-verify-tls             Verify Scale TLS certificates (default: disabled)
  --auto-install yes|no|ask      Auto-install missing prereqs (default: ask)
  --esx-timeout-seconds N        Timeout for VMware calls (default: 30)
  -h, --help                     Show help
```

### Example: Full Automation

```bash
./esx2hc.sh \
  --vddk-libdir /usr/local/vmware-vix-disklib-distrib \
  --virtio-win-iso /storage/virtio-win.iso \
  --out-dir /storage/vm_conversions \
  --auto-install yes
```

## How It Works

### Conversion Process

1. **Prerequisite Check**
   - Validates required tools
   - Downloads virtio-win ISO if needed
   - Checks storage availability

2. **VMware Connection**
   - Connects to ESXi/vCenter via libvirt
   - Retrieves VM list and metadata
   - Gets VM moref via SSH for VDDK

3. **VM Conversion**
   - Uses virt-v2v with VDDK transport for fast disk access
   - Injects VirtIO drivers for Windows VMs
   - Converts to raw format initially
   - Outputs to local storage

4. **Post-Processing**
   - Converts raw disk to qcow2 format (required by Scale)
   - Uses qcow2 v2 format (`compat=0.10`) for compatibility

5. **Upload to Scale**
   - Uploads qcow2 disk(s) via REST API
   - Shows progress with `pv` if available
   - Handles large files (tested with 100GB+ disks)

### File Storage

```
/storage/vmware_to_scale_conversions/
├── vm_name_1/
│   ├── vm_name_1-sda.qcow2    # Converted disk
│   └── vm_name_1.xml           # VM metadata
├── vm_name_2/
│   └── vm_name_2-sda.qcow2
└── ...
```

## Troubleshooting

### Common Issues

**"Failed to retrieve VM moref"**
- Ensure SSH is enabled on ESXi host
- Verify SSH password authentication is working
- Try: `ssh root@your-esxi-host vim-cmd vmsvc/getallvms`

**"VixDiskLib_Open: Unknown error"**
- VDDK path incorrect - verify `--vddk-libdir` points to lib64 directory
- ESXi SSL thumbprint mismatch - script auto-retrieves this
- VM is running - power off the VM before conversion

**"File type is invalid" (HTTP 400)**
- Ensure qemu-img is installed for format conversion
- Script automatically converts to qcow2, but verify conversion succeeded

**"libguestfs error: guestfs_launch failed"**
- Try: `export LIBGUESTFS_BACKEND=direct`
- Check available memory (libguestfs needs RAM for appliance)

**Terminal echo disabled after password prompts**
- Script includes `stty echo` fixes
- If persists, run: `stty echo` or log out and back in

### Debug Mode

For detailed debugging:
```bash
export LIBGUESTFS_DEBUG=1
export LIBGUESTFS_TRACE=1
./esx2hc.sh --vddk-libdir /usr/local/vmware-vix-disklib-distrib
```

Check logs:
- `/tmp/curl_upload_debug.log` - Upload debugging
- virt-v2v output shows in real-time during conversion

## Performance Tips

1. **Use local SSD/NVMe storage** for conversion workspace
   - Significantly faster than network storage
   - Reduces conversion time by 50%+ for large VMs

2. **VDDK is much faster than HTTPS transport**
   - Always use `--vddk-libdir` when possible
   - VDDK provides direct disk access vs. HTTP streaming

3. **Network bandwidth**
   - Upload speed to Scale cluster is the final bottleneck
   - Use 10GbE network if available
   - Consider running migration host close to Scale cluster

4. **Parallel conversions**
   - Run multiple script instances for different VMs
   - Monitor disk I/O and network to avoid saturation

## Security Notes

- **VMware TLS verification disabled by default** (`--vmware-insecure`)
  - Appropriate for lab/internal environments with self-signed certs
  - Override with `--vmware-insecure=false` for production

- **Scale TLS verification disabled by default**
  - Most HC3 clusters use self-signed certificates
  - Override with `--scale-verify-tls` if using CA-signed certs

- **Credentials**
  - Passwords are not logged or stored
  - Temporary password files are chmod 600 and cleaned up on exit
  - Consider using SSH keys for ESXi access

## Limitations

- **VMs must be powered off** before conversion
  - Script enforces this check
  - Ensures consistent disk state

- **Linux host required**
  - virt-v2v and libguestfs are Linux-only tools
  - Windows/macOS not supported

- **Disk space requirements**
  - Needs ~2x VM size during conversion
  - Raw format (temporary) + qcow2 format (final)
  - Original raw files deleted after conversion

- **Network stability**
  - Large uploads can take hours
  - No resume capability if connection drops
  - Consider `screen` or `tmux` for long-running conversions

## Post-Migration Steps

After successful upload to Scale HC3:

1. **Imported disk visible in Scale UI**
   - Disks appear in Virtual Disk inventory
   - Create new VM and attach uploaded disk(s)

2. **Configure VM settings**
   - Set appropriate CPU/RAM
   - Use VIRTIO for disk and network (virt-v2v should update drivers automatically)

3. **Boot and verify**
   - Windows VMs should boot with injected VIRTIO drivers
   - Verify network connectivity
   - Install Scale guest tools if available

4. **Clean up**
   - Remove uploaded disks as necessary

## To-Do

Follow-up tasks for scalability

1. **Allow for multiple migrations**
   - Select multiple VMs to at least serially migrate
   - create parallel virt-v2v instances ideally
2. **Better auth**
   - Auth is primitive and requires more prompts than I'd like
   - add flags like --scale-host ==scale-user etc. 

## Contributing

Please help, I don't know what I'm doing.

## License

MIT License - See LICENSE file for details

## Support

Contribute or file an issue!

## Main components

- Built on top of virt-v2v from the libguestfs project
- Uses VMware VDDK for optimal disk access performance
- VirtIO drivers from the Fedora Project
