/** A legacy Supabase API key: a JWT whose payload carries the role. */
export const cleLegacy = (role: 'anon' | 'service_role') =>
  ['{"alg":"HS256","typ":"JWT"}', JSON.stringify({ iss: 'supabase', ref: 'abcdefgh', role, iat: 1, exp: 9999999999 })]
    .map((p) => Buffer.from(p).toString('base64url'))
    .join('.') + '.signature';
