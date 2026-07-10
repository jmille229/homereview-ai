// Shared Sanity project config, read by both the app (read client) and the
// Studio CLI. projectId + dataset are public values (safe to commit); env vars
// override them so a different project/dataset can be used per environment.
export const apiVersion = process.env.NEXT_PUBLIC_SANITY_API_VERSION || '2024-10-01'
export const dataset    = process.env.NEXT_PUBLIC_SANITY_DATASET    || 'production'
export const projectId  = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID || '4j57wsdj'
