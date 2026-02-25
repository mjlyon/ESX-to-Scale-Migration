import { useQuery } from '@tanstack/react-query'
import { getMigrations, getMigration, getMigrationStats } from '../api/migrations'

export function useMigrations(status?: string) {
  return useQuery({
    queryKey: ['migrations', status],
    queryFn: () => getMigrations(status),
    refetchInterval: 5000,
  })
}

export function useMigration(id: number) {
  return useQuery({
    queryKey: ['migrations', id],
    queryFn: () => getMigration(id),
    refetchInterval: 3000,
  })
}

export function useMigrationStats() {
  return useQuery({
    queryKey: ['migration-stats'],
    queryFn: getMigrationStats,
    refetchInterval: 5000,
  })
}
