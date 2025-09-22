import pandas as pd

# --- PARAMÈTRES À ADAPTER ---
input_csv = "serps_resultats.csv"
output_csv = "serps_similaires_top10.csv"
seuil_similarite = 0.6   # 60% de similarité (modifiable)
top_n = 10               # nombre de premiers résultats organiques à prendre en compte

# 1. Charger les données
df = pd.read_csv(input_csv, dtype=str)
df['volume'] = pd.to_numeric(df['volume'], errors='coerce').fillna(0)

# 2. Garder uniquement les résultats "organic"
df_organic = df[df['type'].str.lower() == 'organic'].copy()

# 3. Regrouper les URLs par mot-clé, en conservant l'ordre de la SERP (position)
df_organic['position'] = pd.to_numeric(df_organic['position'], errors='coerce')
df_organic = df_organic.sort_values(['keyword', 'position'])

# On prend seulement les top N pour chaque mot-clé
top_urls = (
    df_organic.groupby('keyword')
    .head(top_n)
    .groupby('keyword')['url']
    .apply(list)
    .to_dict()
)
volumes = df_organic.groupby('keyword')['volume'].first().to_dict()

# 4. Calculer la similarité Jaccard sur les top N
def jaccard(list1, list2):
    set1, set2 = set(list1), set(list2)
    if not set1 or not set2:
        return 0.0
    return len(set1 & set2) / len(set1 | set2)

# Construction des clusters
keywords = list(top_urls.keys())
visited = set()
clusters = []

for kw in keywords:
    if kw in visited:
        continue
    cluster = {kw}
    for other_kw in keywords:
        if other_kw == kw or other_kw in visited:
            continue
        sim = jaccard(top_urls[kw], top_urls[other_kw])
        if sim >= seuil_similarite:
            cluster.add(other_kw)
    if len(cluster) > 1:
        clusters.append(cluster)
        visited.update(cluster)

# Fusionner les clusters emboîtés
def fusionne_clusters(clusters):
    fusion = []
    for c in clusters:
        found = False
        for f in fusion:
            if not c.isdisjoint(f):
                f.update(c)
                found = True
                break
        if not found:
            fusion.append(set(c))
    if len(fusion) < len(clusters):
        return fusionne_clusters(fusion)
    return fusion

clusters = fusionne_clusters(clusters)

# 5. Préparer la sortie
output = []
for cluster in clusters:
    principal = max(cluster, key=lambda k: volumes.get(k, 0))
    volume_principal = volumes.get(principal, 0)
    secondaires = [k for k in cluster if k != principal]
    volume_total = volume_principal + sum([volumes.get(k, 0) for k in secondaires])
    output.append({
        "mot-clé principal": principal,
        "volume principal": int(volume_principal),
        "mots-clés secondaires": ",".join(secondaires),
        "volume total": int(volume_total)
    })

# 6. Exporter en CSV
out_df = pd.DataFrame(output, columns=[
    "mot-clé principal",
    "volume principal",
    "mots-clés secondaires",
    "volume total"
])
out_df.to_csv(output_csv, index=False, encoding="utf-8-sig")

print(f"Export terminé ! {len(out_df)} groupes similaires détectés. Fichier : {output_csv}")
