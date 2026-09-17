import 'server-only'
import { parseMediaStorageEnv, parseRateLimitSalt, parseSupabaseSecretKey } from './server-env-schema'

// Avaliadas sob demanda: uma variável que falta só quebra a rota que precisa dela.
export const getSupabaseSecretKey = () => parseSupabaseSecretKey(process.env)
export const getMediaStorageEnv = () => parseMediaStorageEnv(process.env)
export const getRateLimitSalt = () => parseRateLimitSalt(process.env)
