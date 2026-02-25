import { useQuery } from '@tanstack/react-query'
import { getStorageConfigs, getDiskUsage } from '../api/storage'

export function useStorageConfigs() {
  return useQuery({
    queryKey: ['storage-configs'],
    queryFn: getStorageConfigs,
  })
}

export function useDiskUsage() {
  return useQuery({
    queryKey: ['disk-usage'],
    queryFn: getDiskUsage,
    refetchInterval: 10000,
  })
}
