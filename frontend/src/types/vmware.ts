export interface VmwareConnection {
  id: number
  name: string
  host: string
  username: string
  connection_type: string
  insecure: string
  vcenter_hint: string
  created_at: string | null
}

export interface VmInfo {
  name: string
  state: string
  can_migrate: boolean
}
