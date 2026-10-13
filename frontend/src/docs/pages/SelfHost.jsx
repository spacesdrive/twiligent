// each page lives in selfHost/; this barrel keeps them in one lazy chunk for routes.js
export { SCHEMA_SQL } from './selfHost/selfHostSql';
export { default as Overview } from './selfHost/Overview';
export { default as Supabase } from './selfHost/Supabase';
export { default as GoogleSignIn } from './selfHost/GoogleSignIn';
export { default as YouTube } from './selfHost/YouTube';
export { default as Instagram } from './selfHost/Instagram';
export { default as Cloudinary } from './selfHost/Cloudinary';
export { default as Redis } from './selfHost/Redis';
export { default as DeployBackend } from './selfHost/DeployBackend';
export { default as DeployFrontend } from './selfHost/DeployFrontend';
export { default as GitHub } from './selfHost/GitHub';
export { default as Checklist } from './selfHost/Checklist';
