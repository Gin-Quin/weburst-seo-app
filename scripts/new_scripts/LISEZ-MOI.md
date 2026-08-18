# Pipeline SEO — analyse SERP en 4 phases

Scripts Python (testés sur Python 3.13 / pandas 3.0.2, Windows).
Toutes les corrections apportées le 25/06/2026 sont repérables dans le code par le marqueur `# [FIX]`.

## Contenu du dossier

| Fichier | Rôle | Entrée | Sortie |
|---|---|---|---|
| `1_collecte_dataforseo.py` | Collecte SERP via l'API DataForSEO | `keywords.csv` | `serps_resultats_with_volume.csv` |
| `2_clustering_similarite.py` | Clustering single-linkage (méthode d'origine) | le pivot | `clusters_serp.csv` |
| `2bis_clustering_pivot.py` | **Clustering par pivot — méthode retenue** | le pivot | `clusters_serp_pivot.csv` + `clusters_serp.csv` |
| `3_cannibalisation.py` | Positions et duplications du domaine cible | pivot + clusters | `clusters_serp_enrichi.csv` |
| `4_part_de_voix.py` | Part de voix et trafic estimé par domaine | le pivot | `domain_metrics.csv` |
| `client.py` | Wrapper API DataForSEO (requis par la phase 1) | — | — |
| `script similarité v2.py` | Copie du script 2 sous son nom d'origine — **ne pas supprimer**, la phase 2bis l'importe | — | — |

Ordre d'exécution : **1 → 2bis → 3**, et **1 → 4** (indépendant, peut tourner en parallèle).
La phase 2 d'origine n'est plus nécessaire : la phase 2bis la remplace et alimente directement la phase 3.

## À vérifier AVANT chaque run

Rien ne valide ces réglages automatiquement : un mauvais paramètre produit un résultat
plausible mais faux, sans aucune erreur.

1. **Le marché**, dans `1_collecte_dataforseo.py` :

   | Marché | `LANGUAGE_CODE` | `LOCATION_CODE` |
   |---|---|---|
   | France | `"fr"` | `2250` |
   | Royaume-Uni | `"en"` | `2826` |
   | Espagne | `"es"` | `2724` |

2. **Le domaine cible**, dans `3_cannibalisation.py` : variable `TARGET_DOMAIN`
   (les sous-domaines sont inclus automatiquement, le `www.` est ignoré).

3. **Le dossier de travail**, dans `1_collecte_dataforseo.py` : variable `BASE_DIR`.
   Il doit être **vide de tout run précédent** — sinon la phase 1 refuse désormais de
   fusionner deux marchés différents et s'arrête avec un message explicite.

4. **`keywords.csv`** doit avoir exactement les colonnes `keyword` et `volume`
   (un export Google Sheets donne `Keyword` / `Search Volume` : à renommer).

## Lancement

La phase 1 travaille avec des chemins absolus (`BASE_DIR`). Les phases 3 et 4 utilisent des
chemins **relatifs** : il faut donc les lancer **depuis le dossier de travail**.

```bash
cd "C:\Users\dany\Documents\Test analyse SERP"
python "C:\Users\Dany\Documents\Pipeline SEO SERP\1_collecte_dataforseo.py"
python "C:\Users\Dany\Documents\Pipeline SEO SERP\2bis_clustering_pivot.py" -i "serps_resultats_with_volume.csv" -o "clusters_serp_pivot.csv"
python "C:\Users\Dany\Documents\Pipeline SEO SERP\3_cannibalisation.py"
python "C:\Users\Dany\Documents\Pipeline SEO SERP\4_part_de_voix.py"
```

Options utiles de la phase 2bis : `-t` (seuil de similarité, défaut 0.50), `-n` (nombre d'URLs
comparées, défaut 12), `--no-promote` (n'écrit pas `clusters_serp.csv`).

## Contrôles à lire après chaque run

- **Phase 1** — la ligne `[CONTRÔLE] mots-clés récupérés : N/N | manquants : 0 | intrus : 0`.
  Tout écart signale une collecte incomplète ou une contamination par un run précédent.
  Les tâches manquantes sont déjà facturées et restent récupérables gratuitement via
  `task_get` sur les identifiants du fichier `task_ids_*.csv`.
- **Phase 3** — la ligne `<domaine> positionné sur N / M mots-clés principaux`.
  Un `0 / M` signifie presque toujours un `TARGET_DOMAIN` oublié.
- **Phase 4** — la ligne `[FILTRE] ... lignes non organic écartées`.
  Les annonces Ads et les featured snippets doivent être exclus : sans ce filtre, une
  publicité est comptée comme une position 3 organique.

## Lire `domain_metrics.csv`

Deux colonnes de nature différente, à ne pas confondre :

- **`part_de_voix_trafic`** — part du trafic estimé total. **Somme à 100 %**, c'est la seule
  interprétable comme une part de marché.
- **`indice_visibilite`** — volume cumulé des mots-clés où le domaine est en top 10, rapporté au
  volume total. **Ne somme pas à 100 %** (environ 1000 %, puisque chaque mot-clé a 10 domaines
  dans son top 10). C'est un indice de couverture, à ne jamais présenter comme un pourcentage
  de marché.

## Points connus, non corrigés

- Les identifiants de l'API DataForSEO sont en clair dans `1_collecte_dataforseo.py`.
  À ne pas publier ni versionner en dépôt public.
- Le marché et le domaine cible restent des variables à éditer à la main : aucun garde-fou
  ne bloque un run lancé avec le paramétrage du client précédent.
- La phase 1 facture l'API à chaque exécution (une tâche SERP par mot-clé).
