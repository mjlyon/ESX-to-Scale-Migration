from __future__ import annotations

import re


def parse_v2v_progress(line: str) -> float | None:
    """Parse virt-v2v --machine-readable output for progress percentage.

    virt-v2v with --machine-readable outputs structured lines like:
      (0/100)
      (25/100)
      Copying disk 1/2 to ...
    """
    m = re.match(r"\((\d+)/100\)", line)
    if m:
        return float(m.group(1))

    m = re.search(r"Copying disk (\d+)/(\d+)", line)
    if m:
        current_disk = int(m.group(1))
        total_disks = int(m.group(2))
        base = ((current_disk - 1) / total_disks) * 100
        return base

    return None


def parse_qemu_img_progress(line: str) -> float | None:
    """Parse qemu-img -p output for percentage."""
    m = re.search(r"(\d+\.?\d*)%", line)
    if m:
        return float(m.group(1))
    return None
