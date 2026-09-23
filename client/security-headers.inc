# En-têtes de sécurité, inclus par nginx.conf au niveau server et dans chaque
# location (nginx n'hérite pas des add_header dès qu'une location en déclare).
#
# CSP : l'application ne charge rien d'extérieur et Vite ne produit aucun
# script inline. 'unsafe-inline' pour les styles seulement : Recharts pose des
# attributs style sur ses graphiques.
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header Referrer-Policy "no-referrer" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
