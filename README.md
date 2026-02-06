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

## Quick Start - Choose Your Distribution

This tool requires a Linux host with virtualization tools. Choose your distribution for detailed installation instructions:

### 📘 [Ubuntu/Debian Installation Guide](README-Ubuntu.md)

**Recommended for:** Ubuntu 20.04+, Ubuntu 22.04 LTS, Ubuntu 24.04 LTS, Debian 11+

Complete step-by-step instructions for:
- APT package installation
- libvirt configuration
- VDDK setup
- VirtIO driver installation
- Ubuntu-specific troubleshooting

[**→ Go to Ubuntu/Debian Guide**](README-Ubuntu.md)

### 📕 [RedHat/AlmaLinux/Rocky/Fedora Installation Guide](README-RedHat.md)

**Recommended for:** RHEL 8/9, AlmaLinux 8/9, Rocky Linux 8/9, Fedora 38+

Complete step-by-step instructions for:
- DNF/YUM package installation
- SELinux configuration
- Firewalld setup
- Repository enablement (PowerTools/CRB/EPEL)
- RedHat-specific troubleshooting

[**→ Go to RedHat/Alma/Rocky/Fedora Guide**](README-RedHat.md)

## What You Need

### Hardware Requirements

- **CPU**: x86_64 with Intel VT-x or AMD-V support
- **RAM**: Minimum 4GB (8GB+ recommended)
- **Storage**: 2x the size of VMs being migrated
- **Network**: 1Gbps+ (10GbE recommended)

### Software Requirements

All distributions require:
- virt-v2v (VM conversion tool)
- libguestfs (guest filesystem tools)
- qemu-img (disk image conversion)
- VMware VDDK (Virtual Disk Development Kit)
- VirtIO drivers ISO (for Windows VMs)

### Network Access

Your migration host needs access to:
- **ESXi/vCenter**: Port 443 (HTTPS) + Port 22 (SSH)
- **Scale Hypercore**: Port 443 (HTTPS)

## Migration Workflow

```
┌─────────────────────┐
│   VMware ESXi/      │
│   vCenter Server    │
│                     │
│  ┌──────────────┐   │
│  │   Source VM  │   │
│  │  (Powered    │   │
│  │   Off)       │   │
│  └──────────────┘   │
└──────────┬──────────┘
           │
           │ SSH + VDDK
           │ (moref + disk access)
           ▼
┌─────────────────────┐
│  Linux Migration    │
│  Host               │
│  ┌───────────────┐  │
│  │  virt-v2v     │  │
│  │  + VDDK       │  │
│  │  + VirtIO     │  │
│  └───────────────┘  │
│                     │
│  ┌───────────────┐  │
│  │  Converted    │  │
│  │  .qcow2 disk  │  │
│  └───────────────┘  │
└──────────┬──────────┘
           │
           │ HTTPS REST API
           │ (upload converted disk)
           ▼
┌─────────────────────┐
│  Scale Computing    │
│  Hypercore Cluster  │
│                     │
│  ┌──────────────┐   │
│  │  Virtual     │   │
│  │  Disk        │   │
│  │  Inventory   │   │
│  └──────────────┘   │
└─────────────────────┘
```

## Features

✅ **VDDK Support** - High-performance direct disk access to VMware  
✅ **VirtIO Driver Injection** - Windows VMs boot properly on Scale  
✅ **Automatic Detection** - Detects OS type and applies appropriate drivers  
✅ **Progress Monitoring** - Real-time conversion and upload progress  
✅ **Error Handling** - Comprehensive error checking and recovery  
✅ **Dry Run Mode** - Test migrations without actual conversion  
✅ **Multiple Disk Support** - Handles VMs with multiple disks  
✅ **Flexible Storage** - Choose custom output directories  

## Usage

### Command-Line Options

```bash
./esx2hc.sh [options]

Options:
  --dry-run                      Plan only; do not convert or upload
  --out-dir /path                Base directory for conversion outputs
  --virtio-win-iso /path.iso     Path to virtio-win ISO
  --vddk-libdir /path            Path to VDDK library directory (required)
  --vmware-insecure              Skip VMware TLS verify (default: enabled)
  --vmware-insecure=false        Enforce VMware TLS verification
  --scale-verify-tls             Verify Scale TLS certificates
  --auto-install yes|no|ask      Auto-install missing prereqs (default: ask)
  --esx-timeout-seconds N        Timeout for VMware calls (default: 30)
  -h, --help                     Show help message
```

### Basic Interactive Usage

```bash
./esx2hc.sh --vddk-libdir /usr/local/vmware-vix-disklib-distrib
```

### Automated Usage

```bash
./esx2hc.sh \
  --vddk-libdir /usr/local/vmware-vix-disklib-distrib \
  --virtio-win-iso /opt/virtio-win/virtio-win.iso \
  --out-dir /storage/vm_conversions \
  --auto-install yes
```

### Dry Run (Planning Mode)

```bash
./esx2hc.sh \
  --vddk-libdir /usr/local/vmware-vix-disklib-distrib \
  --dry-run
```

## How It Works

### 1. Connection Phase
- Connects to ESXi/vCenter via libvirt
- Retrieves VM inventory and metadata
- Uses SSH to get VM moref (Managed Object Reference)

### 2. Conversion Phase
- Uses virt-v2v with VDDK for fast disk access
- Injects VirtIO drivers (Windows VMs)
- Converts disks to raw format initially
- Outputs to local storage directory

### 3. Post-Processing Phase
- Converts raw disks to qcow2 format
- Uses qcow2 v2 (`compat=0.10`) for compatibility
- Cleans up temporary raw files

### 4. Upload Phase
- Uploads qcow2 disk(s) to Scale via REST API
- Shows progress with `pv` utility
- Verifies upload completion

### 5. Finalization
- Disk appears in Scale Hypercore virtual disk inventory
- Ready to attach to new VM

## Supported VM Types

### Operating Systems
- ✅ **Windows**: 7, 8, 10, 11, Server 2008 R2-2022
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
- ❌ Powered-on VMs (must be shut down)

## Limitations

- **VMs must be powered off** during conversion
- **Linux host required** - virt-v2v is Linux-only
- **Disk space requirements** - Need ~2x VM size temporarily
- **No resume capability** - If upload fails, restart from beginning
- **Single-threaded conversion** - One VM at a time per script instance

## Performance Tips

### Storage Optimization
- ✅ Use local SSD/NVMe storage (50%+ faster)
- ✅ Use XFS filesystem for large files
- ✅ Avoid network storage (NFS/CIFS) for conversions

### Network Optimization
- ✅ Use 10GbE network for production
- ✅ Enable jumbo frames (MTU 9000)
- ✅ Run migration host close to Scale cluster

### Parallel Migrations
- ✅ Run multiple script instances for different VMs
- ✅ Monitor disk I/O and network to avoid saturation
- ✅ Use `screen` or `tmux` for long-running migrations

## Security Notes

### TLS Verification
- VMware TLS verification disabled by default (self-signed certs common)
- Scale TLS verification disabled by default (self-signed certs common)
- Enable with `--vmware-insecure=false` and `--scale-verify-tls` if using CA-signed certs

### Credential Security
- Passwords never logged or stored persistently
- Temporary files are `chmod 600` and cleaned on exit
- Consider using SSH keys for ESXi access

### SELinux (RedHat/AlmaLinux/Rocky)
- Keep SELinux enabled in production
- Configure proper file contexts for storage directories
- See RedHat guide for SELinux configuration

## Troubleshooting

For distribution-specific troubleshooting, see:
- [Ubuntu/Debian Troubleshooting](README-Ubuntu.md#troubleshooting-ubuntu-specific-issues)
- [RedHat/Alma/Rocky Troubleshooting](README-RedHat.md#troubleshooting-redhat-specific-issues)

### Common Issues (All Distributions)

**Failed to retrieve VM moref**
- Ensure SSH is enabled on ESXi host
- Test: `ssh root@esxi-host vim-cmd vmsvc/getallvms`

**VixDiskLib_Open: Unknown error**
- Verify VDDK installation path
- Ensure VM is powered off
- Check ESXi accessibility on port 443

**Upload failed: Connection refused**
- Verify Scale Hypercore API accessibility
- Test: `curl -k https://scale-cluster/rest/v1/`

**Permission denied**
- Check user group membership (libvirt, kvm/qemu)
- Verify storage directory permissions
- Check SELinux context (RedHat/Alma/Rocky)

## Post-Migration Steps

1. **Verify disk in Scale Hypercore**
   - Log into Scale web interface
   - Navigate to Storage → Virtual Disks
   - Confirm uploaded disk appears

2. **Create new VM in Scale**
   - Create VM with appropriate CPU/RAM
   - Attach uploaded virtual disk
   - Use VIRTIO for disk and network

3. **Boot and test**
   - Power on VM
   - Verify successful boot
   - Test network connectivity
   - Validate applications

4. **Clean up**
   - Remove local converted files (if no longer needed)
   - Update Scale VM settings as needed

## Roadmap / To-Do

- [ ] Batch migration support (multiple VMs)
- [ ] Parallel conversion support
- [ ] Command-line flags for all credentials
- [ ] Resume capability for interrupted uploads
- [ ] Pre-flight validation checks
- [ ] HTML/JSON migration reports
- [ ] Automated boot testing

## Contributing

Contributions welcome! Please:
- Report bugs via GitHub Issues
- Submit pull requests with improvements
- Share migration experiences
- Suggest new features

## License

GPL-3.0 License - See [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built on **virt-v2v** from the [libguestfs project](https://libguestfs.org/)
- Uses **VMware VDDK** for optimal performance
- **VirtIO drivers** from [Fedora Project](https://fedorapeople.org/groups/virt/virtio-win/)

## Support

- **GitHub**: https://github.com/mjlyon/ESX-to-Scale-Migration
- **Scale Computing**: https://www.scalecomputing.com/resources
- **virt-v2v Docs**: https://libguestfs.org/virt-v2v.1.html

---

**Project Version**: 1.0  
**Last Updated**: February 2026  
**Maintainer**: mjlyon
