import 'server-only'
import {
  parseBillingEnv,
  parseCronSecret,
  parseEmailEnv,
  parseMediaStorageEnv,
  parseOrderRateLimit,
  parseRateLimitSalt,
  parseSupabaseSecretKey,
  parseVideoServiceEnv,
  parseWebhookSecret,
} from './server-env-schema'

// Avaliadas sob demanda: uma variável que falta só quebra a rota que precisa dela.
export const getSupabaseSecretKey = () => parseSupabaseSecretKey(process.env)
export const getMediaStorageEnv = () => parseMediaStorageEnv(process.env)
export const getRateLimitSalt = () => parseRateLimitSalt(process.env)
export const getOrderRateLimit = () => parseOrderRateLimit(process.env)
export const getVideoServiceEnv = () => parseVideoServiceEnv(process.env)
export const getWebhookSecret = () => parseWebhookSecret(process.env)
export const getCronSecret = () => parseCronSecret(process.env)
export const getEmailEnv = () => parseEmailEnv(process.env)
export const getBillingEnv = () => parseBillingEnv(process.env)
