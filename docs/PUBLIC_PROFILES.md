# Profils publics et privés

État : adaptation préparée et testée localement ; migrations et publication restent
en attente d’accord explicite sur les champs publics. Ne pas publier ces clients
avant la création des contrats dans la base partagée.

Le projet Supabase partagé `gwen-ha-star` utilisera deux contrats en lecture seule :

- `public_profile_directory` : pseudo, avatar/cadre, bio, spécialité, titres et dates
  publiques de la carte. Aucun email, rôle d’autorisation, langue, solde, identifiant
  LoL/RL ou cache privé.
- `public_chronicles_leaderboard` : identité publique, avatar, titre et score Chronicles.
  Le classement existant est volontairement conservé, séparé de la carte privée.

Ces tables ont RLS et des grants SELECT seulement pour `anon`/`authenticated`.
Un trigger privé interne synchronise les champs explicitement listés lors d’une
écriture de profil ; il n’est pas exécutable directement par le client. La suppression
d’un profil supprime aussi ses projections. Les migrations et tests PostgreSQL sont
versionnés dans [Korigan](https://github.com/MutenRock/Korigan/tree/main/supabase).

Les pages annuaire, compteurs, `profil.html` et CIG d’autrui utilisent ces contrats.
La CIG propre, les personnalisations et les jeux utilisent encore `profiles`, avec
lecture/écriture propriétaire et rôle administrateur géré uniquement côté serveur.
Les badges de l’annuaire ne révèlent plus un rôle d’autorisation.

`profile-card` est public (`verify_jwt=false`), mais utilise uniquement la clé
**publique** intégrée `SUPABASE_ANON_KEY`, jamais service-role. GET/OPTIONS seulement,
réponse allowlistée, `no-store`, absence 404, incident backend 503. Les statistiques
et identifiants de jeux ne sont plus renvoyés implicitement par une clé privilégiée.

Ordre de publication : créer les contrats, publier et vérifier Nitro/Korigan et
l’Edge Function, puis seulement restreindre SELECT de `profiles` au propriétaire.
Un retour aux anciennes politiques réexpose les champs privés ; ne pas l’automatiser.

Tests locaux : `npm test` (contrats CIG, méthodes HTTP, erreurs, champs privés injectés
dans une fixture). Aucun secret ni profil réel dans les tests. Les tests PostgreSQL
isolés couvrent aussi synchronisation, récompenses serveur et suppression en cascade.
Les parcours navigateur des jeux et Auth avec deux vrais comptes guest restent une
validation distincte, non remplacée par ces tests.
