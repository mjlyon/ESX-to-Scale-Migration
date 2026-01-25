#!/usr/bin/env bash
set -euo pipefail

echo "[INFO] Starting: $(basename "$0") at $(date)"

# VMware -> Scale: Convert with virt-v2v, then upload disk(s) to HC3 via /rest/v1/VirtualDisk/upload
#
# NOTE: libvirt ESX driver usually prompts for a password interactively (expected).
# HARDENING NOTE (IMPORTANT):
#   libvirt ESX driver does NOT reliably cache or reuse authentication between separate virsh invocations.
#   If virsh runs where it cannot prompt (non-TTY stdin), it can fail with:
#     HTTP 500 for call to 'Login' ... incorrect user name or password
#   Therefore: run virsh in the foreground when it may need to prompt.
#   To capture output, use tee to a file and parse that file.
#
# virt-v2v note:
#   When using `-i libvirt -ic esx://...`, virt-v2v expects a password file via `-ip <file>`
#   (it will NOT interactively prompt the way virsh does).

DRY_RUN=0
OUT_DIR=""
VIRTIO_ISO=""
VDDK_LIBDIR=""
INSECURE_VMWARE="true"
VERIFY_SCALE_TLS="false"
AUTO_INSTALL="ask"
ESX_CONNECT_TIMEOUT_SEC=30

VIRSH_KA_ARGS=(-k 0 -K 0)

usage() {
  cat <<'EOF'
Usage: esx2hc.sh [options]

Options:
  --dry-run                      Plan only; do not convert or upload
  --out-dir /path                Base dir for conversion outputs (optional; overrides mount selection)
  --virtio-win-iso /path.iso     REQUIRED for Windows VMs: virtio-win ISO for driver injection
                                 Download from: https://fedorapeople.org/groups/virt/virtio-win/direct-downloads/stable-virtio/
  --vddk-libdir /path            Path to VDDK library directory (e.g., /opt/vmware-vix-disklib/lib64)
  --vmware-insecure              Skip VMware TLS verify (sets no_verify=1)
  --vmware-insecure=true|false
  --scale-verify-tls             Verify Scale TLS (disables curl -k)
  --scale-verify-tls=true|false
  --auto-install yes|no|ask      Auto-install missing prereqs (default: ask)
  --esx-timeout-seconds N        Timeout for VMware calls (default: 30)
  -h, --help                     Show help

IMPORTANT: For Windows VMs, you MUST provide --virtio-win-iso or the VM will not boot on Scale.
The virtio-win ISO contains Windows drivers needed for VirtIO disk and network controllers.
EOF
}

log()  { printf "\033[1;34m[INFO]\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m[WARN]\033[0m %s\n" "$*"; }
err()  { printf "\033[1;31m[ERR ]\033[0m %s\n" "$*"; }

need() { command -v "$1" >/dev/null 2>&1; }

prompt() {
  local var="$1" text="$2" default="${3:-}"
  local val=""
  # Ensure terminal is in normal mode
  stty echo 2>/dev/null || true
  if [[ -n "$default" ]]; then
    read -r -p "$text [$default]: " val
    val="${val:-$default}"
  else
    read -r -p "$text: " val
  fi
  printf -v "$var" '%s' "$val"
}

prompt_secret() {
  local var="$1" text="$2"
  local val=""
  read -r -s -p "$text: " val
  echo
  # Restore terminal echo in case it gets disabled
  stty echo 2>/dev/null || true
  printf -v "$var" '%s' "$val"
}

detect_pkg_mgr() {
  if command -v apt-get >/dev/null 2>&1; then echo "apt"
  elif command -v dnf >/dev/null 2>&1; then echo "dnf"
  elif command -v yum >/dev/null 2>&1; then echo "yum"
  else echo "unknown"
  fi
}

ask_install() {
  local what="$1"
  if [[ "$AUTO_INSTALL" == "yes" ]]; then
    return 0
  elif [[ "$AUTO_INSTALL" == "no" ]]; then
    return 1
  else
    local ans
    read -r -p "Install missing prerequisites ($what)? [y/N]: " ans
    [[ "$ans" =~ ^[Yy]$ ]]
  fi
}

install_packages() {
  local mgr="$1"; shift
  local pkgs=("$@")
  case "$mgr" in
    apt)
      sudo apt-get update
      sudo apt-get install -y "${pkgs[@]}"
      ;;
    dnf)
      sudo dnf install -y "${pkgs[@]}"
      ;;
    yum)
      sudo yum install -y "${pkgs[@]}"
      ;;
    *)
      err "Unsupported package manager. Install manually: ${pkgs[*]}"
      exit 1
      ;;
  esac
}

check_prerequisites() {
  log "Checking prerequisites"
  local mgr
  mgr="$(detect_pkg_mgr)"
  log "Package manager: $mgr"

  local required=(bash curl jq python3 virt-v2v virsh df sort awk stat find timeout tee mktemp qemu-img)
  local missing=()

  for c in "${required[@]}"; do
    if need "$c"; then
      printf "  %-18s %s\n" "$c" "OK"
    else
      printf "  %-18s %s\n" "$c" "MISSING"
      missing+=("$c")
    fi
  done

  if need pv; then
    printf "  %-18s %s\n" "pv" "OK (optional)"
  else
    printf "  %-18s %s\n" "pv" "not installed (optional)"
  fi

  if [[ "${#missing[@]}" -gt 0 ]]; then
    warn "Missing tools: ${missing[*]}"
    if ! ask_install "${missing[*]}"; then
      err "Missing required tools. Aborting."
      exit 1
    fi

    case "$mgr" in
      apt)
        install_packages apt curl jq python3 virt-v2v libguestfs-tools libvirt-clients coreutils findutils gawk qemu-utils
        ;;
      dnf|yum)
        install_packages "$mgr" curl jq python3 virt-v2v libguestfs-tools libvirt-client coreutils findutils gawk qemu-img || \
        install_packages "$mgr" curl jq python3 virt-v2v libguestfs-tools libvirt coreutils findutils gawk qemu-img
        ;;
      *)
        err "Install manually: ${missing[*]}"
        exit 1
        ;;
    esac
  fi

  if [[ "$DRY_RUN" -eq 0 ]]; then
    export LIBGUESTFS_BACKEND="${LIBGUESTFS_BACKEND:-direct}"
    virt-v2v --version >/dev/null 2>&1 || {
      err "virt-v2v not functional. Try: export LIBGUESTFS_BACKEND=direct"
      exit 1
    }
  fi
  
  # Check for virtio-win ISO
  if [[ -z "$VIRTIO_ISO" ]]; then
    log "Checking for virtio-win drivers..."
    
    # Check common locations
    local common_paths=(
      "/usr/share/virtio-win/virtio-win.iso"
      "/storage/virtio-win.iso"
      "$HOME/virtio-win.iso"
      "/tmp/virtio-win.iso"
    )
    
    for path in "${common_paths[@]}"; do
      if [[ -f "$path" ]]; then
        VIRTIO_ISO="$path"
        log "Found virtio-win ISO at: $VIRTIO_ISO"
        break
      fi
    done
    
    if [[ -z "$VIRTIO_ISO" ]]; then
      warn "virtio-win ISO not found in common locations"
      if ask_install "virtio-win drivers (required for Windows VMs)"; then
        log "Downloading latest virtio-win ISO..."
        VIRTIO_ISO="/tmp/virtio-win.iso"
        if curl -L -o "$VIRTIO_ISO" "https://fedorapeople.org/groups/virt/virtio-win/direct-downloads/stable-virtio/virtio-win.iso"; then
          log "Downloaded virtio-win ISO to: $VIRTIO_ISO"
        else
          err "Failed to download virtio-win ISO"
          VIRTIO_ISO=""
        fi
      else
        warn "Proceeding without virtio-win drivers (Windows VMs may not boot properly)"
      fi
    fi
  fi
}

build_esx_uri() {
  local host="$1" user="$2" insecure="$3"
  local nv="0"
  [[ "$insecure" == "true" ]] && nv="1"
  echo "esx://${user}@${host}/?no_verify=${nv}"
}

select_conversion_storage() {
  log "Selecting local conversion storage (before VMware connection)"

  mapfile -t MENU < <(
    df -PT -x tmpfs -x devtmpfs 2>/dev/null \
      | awk 'NR>1 {print $7 "|" $2 "|" $5}' \
      | awk -F'|' '$1 != "" && $2 !~ /^(squashfs|overlay)$/ {print $0}' \
      | sort -t'|' -k3,3nr
  )

  if [[ "${#MENU[@]}" -eq 0 ]]; then
    err "No usable mount points detected."
    df -hT
    exit 1
  fi

  local MOUNT_POINTS=()
  local MOUNT_LABELS=()
  for row in "${MENU[@]}"; do
    local mp="${row%%|*}"
    local rest="${row#*|}"
    local fstype="${rest%%|*}"
    local human
    human="$(df -hP "$mp" | awk 'NR==2{print "free="$4" total="$2" used="$3" ("$5")"}')"
    MOUNT_POINTS+=("$mp")
    MOUNT_LABELS+=("$mp  ($fstype)  $human")
  done

  echo
  log "Mount points (sorted by free space):"
  PS3="Mount choice (1-${#MOUNT_LABELS[@]}): "
  select label in "${MOUNT_LABELS[@]}"; do
    if [[ -n "${label:-}" ]]; then
      local idx=$((REPLY-1))
      CHOSEN_MOUNT="${MOUNT_POINTS[$idx]}"
      break
    fi
    echo "Invalid selection."
  done

  local line
  line="$(df -hP "$CHOSEN_MOUNT" | awk 'NR==2')"
  CHOSEN_TOTAL="$(awk '{print $2}' <<<"$line")"
  CHOSEN_USED="$(awk '{print $3}' <<<"$line")"
  CHOSEN_FREE="$(awk '{print $4}' <<<"$line")"
  CHOSEN_PCT="$(awk '{print $5}' <<<"$line")"
  log "Chosen mount: $CHOSEN_MOUNT  free=$CHOSEN_FREE total=$CHOSEN_TOTAL used=$CHOSEN_USED ($CHOSEN_PCT)"

  local default_base="${CHOSEN_MOUNT%/}/vmware_to_scale_conversions"
  if [[ -z "${OUT_DIR:-}" ]]; then
    prompt OUT_DIR "Conversion output base directory" "$default_base"
  else
    warn "--out-dir provided; using: $OUT_DIR"
  fi

  log "Conversion outputs will be stored under: $OUT_DIR"
}

ask_vmware_target_type() {
  echo
  log "VMware connection target"
  echo "1) vCenter (recommended)"
  echo "2) ESXi host directly"
  while true; do
    read -r -p "Select (1-2): " sel
    case "$sel" in
      1) VC_KIND="vcenter"; break;;
      2) VC_KIND="esxi"; break;;
      *) echo "Invalid selection.";;
    esac
  done

  if [[ "$VC_KIND" == "vcenter" ]]; then
    log "Selected: vCenter"
  else
    log "Selected: ESXi host"
    warn "Direct-to-ESXi can work, but vCenter is usually more reliable."
  fi
}

urlencode() {
  python3 -c "import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=''))" "$1"
}

filesize_bytes() { stat -c '%s' "$1"; }

upload_disk_file() {
  local sc_node="$1" sc_user="$2" sc_pass="$3" verify_tls="$4" filepath="$5"
  local fname fenc size url curl_tls=("-k")
  [[ "$verify_tls" == "true" ]] && curl_tls=()

  fname="$(basename "$filepath")"
  
  # Clean up multiple .qcow2 extensions (e.g., file.qcow2.qcow2.qcow2 -> file.qcow2)
  while [[ "$fname" =~ \.qcow2\.qcow2 ]]; do
    fname="${fname%.qcow2}"
  done
  
  fenc="$(urlencode "$fname")"
  size="$(filesize_bytes "$filepath")"
  url="https://${sc_node}/rest/v1/VirtualDisk/upload?filename=${fenc}&filesize=${size}"

  log "Uploading: $fname (size=${size} bytes)"
  log "URL: $url"
  
  if [[ "$DRY_RUN" -eq 1 ]]; then
    warn "Dry-run: would PUT to: $url"
    return 0
  fi

  # Create temp files for response and HTTP code
  local response_file http_code_file
  response_file="$(mktemp /tmp/scale_upload_response.XXXXXX)"
  http_code_file="$(mktemp /tmp/scale_upload_code.XXXXXX)"
  
  if command -v pv >/dev/null 2>&1; then
    pv -pterb "$filepath" | \
      curl -w "%{http_code}" -o "$response_file" "${curl_tls[@]}" -u "${sc_user}:${sc_pass}" \
        -H "Content-Type: application/octet-stream" \
        -H "Content-Length: ${size}" \
        -T - "$url" > "$http_code_file" 2>/dev/null
    local rc=${PIPESTATUS[1]}
  else
    curl -w "%{http_code}" --progress-bar -o "$response_file" "${curl_tls[@]}" -u "${sc_user}:${sc_pass}" \
      -H "Content-Type: application/octet-stream" \
      -H "Content-Length: ${size}" \
      -T "$filepath" "$url" > "$http_code_file" 2>/dev/null
    rc=$?
  fi
  
  local http_code
  http_code="$(cat "$http_code_file" 2>/dev/null || echo "000")"
  
  if [[ "$http_code" != "200" && "$http_code" != "201" ]]; then
    err "Upload failed with HTTP $http_code"
    if [[ -s "$response_file" ]]; then
      err "API Error Response:"
      cat "$response_file" >&2
      echo >&2
    fi
    rm -f "$response_file" "$http_code_file"
    return 1
  fi
  
  rm -f "$response_file" "$http_code_file"
  echo
  log "Upload complete: $fname"
}

get_esx_thumbprint() {
  local host="$1"
  local thumbprint
  thumbprint=$(openssl s_client -connect "${host}:443" < /dev/null 2>/dev/null | \
    openssl x509 -fingerprint -sha1 -noout -in /dev/stdin 2>/dev/null | \
    cut -d= -f2)
  
  if [[ -z "$thumbprint" ]]; then
    return 1
  fi
  
  echo "$thumbprint"
}

# ------------------ args ------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --out-dir) OUT_DIR="${2:?--out-dir requires a path}"; shift 2 ;;
    --virtio-win-iso) VIRTIO_ISO="${2:?--virtio-win-iso requires a path}"; shift 2 ;;
    --vddk-libdir) VDDK_LIBDIR="${2:?--vddk-libdir requires a path}"; shift 2 ;;

    --vmware-insecure) INSECURE_VMWARE="true"; shift ;;
    --vmware-insecure=*) INSECURE_VMWARE="${1#*=}"; shift ;;

    --scale-verify-tls) VERIFY_SCALE_TLS="true"; shift ;;
    --scale-verify-tls=*) VERIFY_SCALE_TLS="${1#*=}"; shift ;;

    --auto-install) AUTO_INSTALL="${2:?--auto-install requires yes|no|ask}"; shift 2 ;;
    --auto-install=*) AUTO_INSTALL="${1#*=}"; shift ;;

    --esx-timeout-seconds) ESX_CONNECT_TIMEOUT_SEC="${2:?--esx-timeout-seconds requires a number}"; shift 2 ;;
    --esx-timeout-seconds=*) ESX_CONNECT_TIMEOUT_SEC="${1#*=}"; shift ;;

    -h|--help) usage; exit 0 ;;
    *) err "Unknown arg: $1"; usage; exit 1 ;;
  esac
done

# 1) prereqs
check_prerequisites

# 2) storage selection (before VMware connection)
select_conversion_storage

# 3) ask vCenter vs ESXi
ask_vmware_target_type

# 4) VMware creds
log "VMware credentials (libvirt ESX transport uses HTTPS/443, not SSH)"
if [[ "$VC_KIND" == "vcenter" ]]; then
  prompt VC_HOST "vCenter host/IP (ex: vcenter.company.com)"
else
  prompt VC_HOST "ESXi host/IP (ex: 10.0.0.25)"
fi
prompt VC_USER "VMware username"
prompt_secret VC_PASS "VMware password"

ESX_URI="$(build_esx_uri "$VC_HOST" "$VC_USER" "$INSECURE_VMWARE")"
export LIBVIRT_DEFAULT_URI="$ESX_URI"

# Temp files (vm list + v2v password file)
VM_LIST_FILE="$(mktemp /tmp/esx2hc.vmlist.XXXXXX)"
V2V_PASS_FILE="$(mktemp /tmp/esx2hc.v2vpass.XXXXXX)"
cleanup() {
  rm -f "$VM_LIST_FILE" "$V2V_PASS_FILE"
}
trap cleanup EXIT

chmod 600 "$V2V_PASS_FILE"
printf '%s' "$VC_PASS" >"$V2V_PASS_FILE"

# 5) Validate virsh (foreground so it can prompt)
log "Validating VMware access via virsh with timeout=${ESX_CONNECT_TIMEOUT_SEC}s..."
if [[ "$DRY_RUN" -eq 0 ]]; then
  if timeout --foreground "${ESX_CONNECT_TIMEOUT_SEC}" \
      virsh "${VIRSH_KA_ARGS[@]}" -c "$ESX_URI" uri; then
    log "virsh URI check succeeded."
  else
    rc=$?
    if [[ "$rc" -eq 124 ]]; then
      err "Timed out after ${ESX_CONNECT_TIMEOUT_SEC}s (likely waiting on password prompt or stalled TLS)."
    else
      err "virsh failed to connect/authenticate (rc=$rc)."
    fi
    exit 1
  fi
else
  warn "Dry-run: skipping virsh validation."
fi

# 6) Fetch VM list via virsh (foreground) and tee to a temp file; filter prompt noise out of the file
log "Fetching VM list via virsh (foreground + tee to capture output)"
if [[ "$DRY_RUN" -eq 1 ]]; then
  cat >"$VM_LIST_FILE" <<'EOF'
 Id   Name                        State
--------------------------------------------
 -    example-vm                   shut off
 -    windows11                     shut off
EOF
  cat "$VM_LIST_FILE"
else
  # tee captures everything; we filter out the password prompt line before saving
  timeout --foreground "${ESX_CONNECT_TIMEOUT_SEC}" \
    virsh "${VIRSH_KA_ARGS[@]}" -c "$ESX_URI" list --all \
    | tee >(grep -v -E "^Enter .+'s password for " >"$VM_LIST_FILE")
fi

# Build VM menu directly from the captured list output (avoid extra virsh calls)
VM_DISPLAY=()
VM_STATES=()

while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  [[ "$line" =~ ^[[:space:]]*Id[[:space:]] ]] && continue
  [[ "$line" =~ ^-+$ ]] && continue

  id="$(awk '{print $1}' <<<"$line")"
  [[ -z "$id" || "$id" == "Id" ]] && continue

  last2="$(awk '{print $(NF-1)" "$NF}' <<<"$line" 2>/dev/null || true)"
  last1="$(awk '{print $NF}' <<<"$line")"

  if [[ "$last2" == "shut off" ]]; then
    state="shut off"
    name="$(awk '{for(i=2;i<=NF-2;i++){printf "%s%s",$i,(i<NF-2?OFS:"")} print ""}' OFS=" " <<<"$line")"
  else
    state="$last1"
    name="$(awk '{for(i=2;i<=NF-1;i++){printf "%s%s",$i,(i<NF-1?OFS:"")} print ""}' OFS=" " <<<"$line")"
  fi

  name="${name#"${name%%[![:space:]]*}"}"
  name="${name%"${name##*[![:space:]]}"}"
  state="$(tr '[:upper:]' '[:lower:]' <<<"$state")"

  [[ -z "$name" ]] && continue

  VM_STATES+=("$state")
  VM_DISPLAY+=("$name  [state: $state]")
done <"$VM_LIST_FILE"

if [[ "${#VM_DISPLAY[@]}" -eq 0 ]]; then
  err "Failed to parse VM list output."
  err "Captured file was: $VM_LIST_FILE"
  exit 1
fi

echo
log "Select a VM to convert (state shown):"
PS3="VM choice (1-${#VM_DISPLAY[@]}): "
select vline in "${VM_DISPLAY[@]}"; do
  if [[ -n "${vline:-}" ]]; then
    idx=$((REPLY-1))
    SELECTED_VM="$(sed -n 's/[[:space:]]*\[state:.*$//p' <<<"$vline")"
    SELECTED_STATE="${VM_STATES[$idx]}"
    break
  fi
  echo "Invalid selection."
done

log "Selected VM: $SELECTED_VM (state: ${SELECTED_STATE:-unknown})"

if [[ "${SELECTED_STATE:-}" == *running* || "${SELECTED_STATE:-}" == *paused* ]]; then
  warn "VM appears to be RUNNING."
  err "Shut down '$SELECTED_VM' in VMware, then re-run for a consistent conversion."
  exit 1
elif [[ "${SELECTED_STATE:-}" == "shut off" || "${SELECTED_STATE:-}" == "shutoff" ]]; then
  log "VM is powered off — good to proceed."
else
  warn "VM state is '${SELECTED_STATE:-unknown}'."
  err "Aborting for safety."
  exit 1
fi

# Get VM moref (required for VDDK)
if [[ -n "$VDDK_LIBDIR" && "$DRY_RUN" -eq 0 ]]; then
  log "Retrieving VM moref (Managed Object Reference)..."
  VM_MOREF=""
  
  # Method 1: Try virsh dumpxml (requires libvirt >= 3.7)
  VM_XML_FILE="$(mktemp /tmp/esx2hc.vmxml.XXXXXX)"
  if timeout --foreground "${ESX_CONNECT_TIMEOUT_SEC}" \
      virsh "${VIRSH_KA_ARGS[@]}" -c "$ESX_URI" dumpxml "$SELECTED_VM" >"$VM_XML_FILE" 2>/dev/null; then
    VM_MOREF="$(grep -oP '<vmware:moref>\K[^<]+' "$VM_XML_FILE" 2>/dev/null || true)"
    if [[ -z "$VM_MOREF" ]]; then
      VM_MOREF="$(grep -oP '<moref>\K[^<]+' "$VM_XML_FILE" 2>/dev/null || true)"
    fi
  fi
  rm -f "$VM_XML_FILE"
  
  # Method 2: Try vim-cmd via SSH (more reliable for older libvirt)
  if [[ -z "$VM_MOREF" ]]; then
    log "Trying to retrieve moref via SSH (vim-cmd)..."
    # First get all VMs, then filter by name
    VM_MOREF=$(ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
      "${VC_USER}@${VC_HOST}" \
      "vim-cmd vmsvc/getallvms | grep -F '${SELECTED_VM}' | awk '{print \$1}'" 2>/dev/null || true)
  fi
  
  if [[ -z "$VM_MOREF" ]]; then
    err "Failed to retrieve VM moref. This is required for VDDK with direct ESXi access."
    err ""
    err "Tried methods:"
    err "  1) virsh dumpxml (requires libvirt >= 3.7)"
    err "  2) SSH to ESXi and vim-cmd (requires SSH access)"
    err ""
    err "Alternatives:"
    err "  A) Enable SSH on ESXi: ESXi > Host > Actions > Services > Enable Secure Shell (SSH)"
    err "  B) Run without VDDK (slower, may have issues): remove --vddk-libdir flag"
    err "  C) Manually provide moref by modifying the script"
    exit 1
  fi
  
  log "VM moref: $VM_MOREF"
fi

VM_OUT_DIR="${OUT_DIR%/}/${SELECTED_VM// /_}"
log "Final conversion output dir: $VM_OUT_DIR"
log "Storage: mount $CHOSEN_MOUNT free=$CHOSEN_FREE (total=$CHOSEN_TOTAL, used=$CHOSEN_USED $CHOSEN_PCT)"

# 7) Convert
log "Converting with virt-v2v"
if [[ "$DRY_RUN" -eq 1 ]]; then
  warn "Dry-run: skipping virt-v2v run."
else
  mkdir -p "$VM_OUT_DIR"
  export LIBGUESTFS_BACKEND="${LIBGUESTFS_BACKEND:-direct}"

  # NOTE: virt-v2v requires -ip <passwordfile> for libvirt VMware sources (no interactive prompt).
  CMD=(virt-v2v -i libvirt -ic "$ESX_URI" -ip "$V2V_PASS_FILE" "$SELECTED_VM" -o local -os "$VM_OUT_DIR" -of raw --machine-readable)
  
  # Add VDDK if available
  if [[ -n "$VDDK_LIBDIR" ]]; then
    # Detect lib64 or lib directory
    vddk_lib_path=""
    if [[ -d "${VDDK_LIBDIR}/lib64" ]]; then
      vddk_lib_path="${VDDK_LIBDIR}/lib64"
    elif [[ -d "${VDDK_LIBDIR}/lib" ]]; then
      vddk_lib_path="${VDDK_LIBDIR}/lib"
    elif [[ -f "${VDDK_LIBDIR}/libvixDiskLib.so" ]]; then
      vddk_lib_path="${VDDK_LIBDIR}"
    else
      err "VDDK library directory not found at: $VDDK_LIBDIR"
      err "Expected lib64/ or lib/ subdirectory, or libvixDiskLib.so in the specified path"
      exit 1
    fi
    
    log "Using VDDK transport from: $vddk_lib_path"
    
    # Get thumbprint automatically
    log "Retrieving ESXi SSL thumbprint from $VC_HOST..."
    VDDK_THUMBPRINT=$(get_esx_thumbprint "$VC_HOST")
    if [[ -z "$VDDK_THUMBPRINT" ]]; then
      err "Could not retrieve ESXi SSL thumbprint automatically."
      prompt VDDK_THUMBPRINT "Enter ESXi SSL thumbprint manually (SHA-1, format: XX:XX:XX:...)"
    else
      log "ESXi SSL thumbprint: $VDDK_THUMBPRINT"
    fi
    
    CMD+=(-it vddk -io "vddk-libdir=$vddk_lib_path" -io "vddk-thumbprint=$VDDK_THUMBPRINT")
  else
    warn "VDDK not specified. Using libvirt transport (may fail with range request errors)."
    warn "For better reliability, use: --vddk-libdir /usr/local/vmware-vix-disklib-distrib"
  fi
  
  if [[ -n "$VIRTIO_ISO" ]]; then
    if [[ ! -f "$VIRTIO_ISO" ]]; then
      err "VirtIO ISO not found: $VIRTIO_ISO"
      exit 1
    fi
    log "Using VirtIO drivers from: $VIRTIO_ISO"
    
    # virt-v2v looks for drivers in /usr/share/virtio-win
    # Mount the ISO and ensure drivers are accessible
    if [[ ! -d "/usr/share/virtio-win" ]]; then
      log "Creating /usr/share/virtio-win directory..."
      sudo mkdir -p /usr/share/virtio-win
    fi
    
    # Check if ISO is already mounted or if files exist
    if [[ -z "$(ls -A /usr/share/virtio-win 2>/dev/null)" ]]; then
      log "Mounting virtio-win ISO to /usr/share/virtio-win..."
      sudo mount -o loop,ro "$VIRTIO_ISO" /usr/share/virtio-win || {
        err "Failed to mount virtio-win ISO"
        err "Trying to extract ISO contents instead..."
        VIRTIO_TEMP="$(mktemp -d /tmp/virtio-win.XXXXXX)"
        if command -v 7z >/dev/null 2>&1; then
          7z x "$VIRTIO_ISO" -o"$VIRTIO_TEMP"
          sudo cp -r "$VIRTIO_TEMP"/* /usr/share/virtio-win/
          rm -rf "$VIRTIO_TEMP"
        else
          err "Cannot mount or extract ISO. Install p7zip-full or mount manually"
          exit 1
        fi
      }
    else
      log "VirtIO drivers already available in /usr/share/virtio-win"
    fi
  else
    warn "No VirtIO ISO specified (--virtio-win-iso)"
    warn "Windows VMs will NOT have VirtIO drivers and may not boot properly on Scale."
    warn "Linux VMs will use IDE/SATA controllers instead of VirtIO (slower performance)."
    warn ""
    warn "Download virtio-win.iso from: https://fedorapeople.org/groups/virt/virtio-win/direct-downloads/stable-virtio/"
    read -r -p "Continue without VirtIO drivers? [y/N]: " continue_ans
    if [[ ! "$continue_ans" =~ ^[Yy]$ ]]; then
      err "Conversion cancelled. Re-run with --virtio-win-iso /path/to/virtio-win.iso"
      exit 1
    fi
  fi

  log "Running: ${CMD[*]}"
  "${CMD[@]}"
fi

# 8) Find disk image(s) and convert to qcow2 if needed
DISK_FILES=()
if [[ "$DRY_RUN" -eq 1 ]]; then
  DISK_FILES=("$VM_OUT_DIR/disk0.qcow2")
else
  # Look for qcow2 files (already in correct format)
  while IFS= read -r f; do DISK_FILES+=("$f"); done < <(
    find "$VM_OUT_DIR" -type f -iname '*.qcow2' 2>/dev/null | sort
  )
  
  # If no qcow2 files found, look for raw/img/vmdk files and files without extensions
  if [[ "${#DISK_FILES[@]}" -eq 0 ]]; then
    log "No .qcow2 files found, searching for disk images to convert..."
    needs_conversion=()
    
    # Find .raw, .img, .vmdk files
    while IFS= read -r f; do needs_conversion+=("$f"); done < <(
      find "$VM_OUT_DIR" -type f \( -iname '*.raw' -o -iname '*.img' -o -iname '*.vmdk' \) 2>/dev/null | sort
    )
    
    # Also find files without extensions (virt-v2v output format)
    while IFS= read -r f; do 
      if [[ ! "$f" =~ \.xml$ ]] && [[ $(stat -c '%s' "$f" 2>/dev/null || echo 0) -gt 1048576 ]]; then
        needs_conversion+=("$f")
      fi
    done < <(find "$VM_OUT_DIR" -type f ! -name "*.*" 2>/dev/null | sort)
    
    # Convert all found files to qcow2
    if [[ "${#needs_conversion[@]}" -gt 0 ]]; then
      log "Converting disk files to qcow2 format (required by Scale API)..."
      for f in "${needs_conversion[@]}"; do
        # Strip existing extensions properly
        base="${f}"
        base="${base%.raw}"
        base="${base%.img}"
        base="${base%.vmdk}"
        newname="${base}.qcow2"
        
        log "  Converting: $(basename "$f") -> $(basename "$newname")"
        if qemu-img convert -f raw -O qcow2 -o compat=0.10 "$f" "$newname"; then
          log "  Conversion successful, removing original file"
          rm -f "$f"
          DISK_FILES+=("$newname")
        else
          err "Failed to convert $f to qcow2"
          exit 1
        fi
      done
    fi
  fi
fi

if [[ "${#DISK_FILES[@]}" -eq 0 ]]; then
  err "No disk images found in $VM_OUT_DIR"
  err "Contents of directory:"
  ls -lh "$VM_OUT_DIR"
  exit 1
fi

log "Found disk image(s):"
for f in "${DISK_FILES[@]}"; do echo "  - $f"; done

# 9) Scale upload
log "Scale (HC3) upload target"
prompt SC_NODE "Scale node IP/hostname"
prompt SC_USER "Scale username" "admin"
prompt_secret SC_PASS "Scale password"

log "Uploading disk image(s) via /rest/v1/VirtualDisk/upload"
for f in "${DISK_FILES[@]}"; do
  upload_disk_file "$SC_NODE" "$SC_USER" "$SC_PASS" "$VERIFY_SCALE_TLS" "$f"
done

log "All uploads complete."
log "Artifacts remain at: $VM_OUT_DIR"

echo
log "==================================================================="
log "IMPORTANT: Post-Migration Configuration for Windows 11 VMs"
log "==================================================================="
log ""
log "When creating the VM in Scale Computing:"
log "  1. Set firmware to UEFI (not BIOS/Legacy)"
log "  2. Add virtual TPM 2.0 device"
log "  3. Attach the uploaded disk as first boot device"
log ""
log "If Windows 11 doesn't boot (stuck at UEFI shell or 'No bootable device'):"
log "  - This is normal - virt-v2v doesn't preserve UEFI boot configuration"
log "  - You need to manually register Windows Boot Manager in UEFI:"
log ""
log "    Option A - UEFI Firmware Setup:"
log "      1. Enter UEFI firmware (press ESC/F2/DEL during boot)"
log "      2. Boot Manager → Add Boot Option"
log "      3. Browse to: EFI\\Microsoft\\Boot\\bootmgfw.efi"
log "      4. Save and reboot"
log ""
log "    Option B - UEFI Shell:"
log "      fs0:"
log "      cd EFI\\Microsoft\\Boot"
log "      bootmgfw.efi"
log ""
log "Windows 10 VMs typically boot without these extra steps."
log "==================================================================="
echo
