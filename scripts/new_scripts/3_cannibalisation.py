# -*- coding: utf-8 -*-
"""
Enrichit 'clusters_serp.csv' avec les positions/URLs de loyoly.io (et sous-domaines) sur type 'organic*'
pour le Mot-clé principal uniquement.

Ajoute :
- Position
- URL positionnée
- Nombre d'URL positionnée
- URL en duplication

Si le domaine n'est pas positionné : 4 colonnes = "Non positionné".
"""

import sys
import pandas as pd
from pathlib import Path
from urllib.parse import urlparse

for _s in (sys.stdout, sys.stderr):          # [FIX] sortie console en UTF-8
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# =========================
# ⚙️ Paramètres modifiables
# =========================
INPUT_SERPS = "serps_resultats_with_volume.csv"
INPUT_CLUSTERS = "clusters_serp.csv"
OUTPUT_FILE = "clusters_serp_enrichi.csv"

TARGET_DOMAIN = "loyoly.io"    # matchera loyoly.io ET *.loyoly.io
ENCODING_SERPS = "utf-8"
ENCODING_CLUSTERS = "utf-8-sig"

# Active un petit récap debug en console (False pour silencieux)
DEBUG = False
# =========================

def load_csv_safely(path: str, encoding: str = "utf-8") -> pd.DataFrame:
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError(f"Fichier introuvable : {p.resolve()}")
    return pd.read_csv(p, encoding=encoding, low_memory=False)

def normalize_str(x):
    if pd.isna(x):
        return ""
    return str(x).strip()

def extract_host(s: str) -> str:
    """
    Retourne l'hôte (sans schéma, sans 'www.'). Si s est déjà un host, ok.
    """
    if pd.isna(s) or s is None:
        return ""
    s = str(s).strip()
    if not s:
        return ""
    to_parse = s if "://" in s else "http://" + s
    parsed = urlparse(to_parse)
    host = parsed.netloc or parsed.path.split("/")[0]
    host = host.lower()
    if host.startswith("www."):
        host = host[4:]
    return host.rstrip("/.")

def _host_from_url(u):                       # [FIX] garde NA avant urlparse
    # En pandas 3.0, .astype(str) ne transforme plus les NA en "nan" : une cellule 'url'
    # vide reste un float nan et faisait planter urlparse (AttributeError ... 'decode').
    if pd.isna(u):
        return ""
    s = str(u).strip()
    if not s:
        return ""
    return extract_host(urlparse(s).netloc or s)

def _strip_or_na(x):                         # [FIX] strip sans écraser les NA
    # Remplace .astype(str).str.strip() : les valeurs renseignées sont strippées,
    # les NA restent des NA (le dropna / le na=False plus bas les écartent comme avant).
    if pd.isna(x):
        return x
    return str(x).strip()

def host_matches_target(host: str, target: str) -> bool:
    """
    True si host == target ou se termine par '.' + target (sous-domaines).
    """
    if not host or not target:
        return False
    return host == target or host.endswith("." + target)

def main():
    # 1) Chargement
    df_serps = load_csv_safely(INPUT_SERPS, ENCODING_SERPS)
    df_clusters = load_csv_safely(INPUT_CLUSTERS, ENCODING_CLUSTERS)

    # 2) Vérifs colonnes côté SERP
    expected_serp_cols = {"keyword", "position", "type", "url", "domain"}
    lower_map = {c.lower(): c for c in df_serps.columns}
    missing = expected_serp_cols.difference(set(lower_map))
    if missing:
        raise ValueError(
            f"Colonnes manquantes dans {INPUT_SERPS} (attendues : {expected_serp_cols}). "
            f"Colonnes absentes (case-insensitive) : {missing}"
        )
    df_serps.columns = [c.lower() for c in df_serps.columns]

    # 3) Normalisation des champs de base
    df_serps["keyword"] = df_serps["keyword"].map(_strip_or_na)   # [FIX] NA-safe
    df_serps["type"] = df_serps["type"].map(_strip_or_na)         # [FIX] NA-safe
    df_serps["url"] = df_serps["url"].map(_strip_or_na)           # [FIX] NA-safe
    df_serps["position"] = pd.to_numeric(df_serps["position"], errors="coerce")

    # 4) Normalisation du domaine côté SERP + fallback depuis l'URL si besoin
    #    (beaucoup d'exports SERP mettent une URL complète dans 'domain' ou la laissent vide)
    dom_from_domain = df_serps["domain"].apply(extract_host)
    dom_from_url = df_serps["url"].apply(_host_from_url)   # [FIX] garde NA avant urlparse
    df_serps["domain_host"] = dom_from_domain.where(dom_from_domain.ne(""), dom_from_url)

    target_host = extract_host(TARGET_DOMAIN)

    # 5) Filtre "organic" souple (contains, insensible à la casse)
    is_organic = df_serps["type"].str.lower().str.contains("organic", na=False)

    # 6) Filtre domaine : host == target ou se termine par '.' + target
    matches_target = df_serps["domain_host"].apply(lambda h: host_matches_target(h, target_host))

    serps_filtered = (
        df_serps[is_organic & matches_target]
        .dropna(subset=["keyword", "url", "position"])
        .copy()
    )

    if DEBUG:
        total = len(df_serps)
        organic_cnt = int(is_organic.sum())
        target_cnt = int(matches_target.sum())
        kept = len(serps_filtered)
        print(f"[DEBUG] Total SERP: {total}")
        print(f"[DEBUG] Type contient 'organic': {organic_cnt}")
        print(f"[DEBUG] Domaine match target '{target_host}': {target_cnt}")
        print(f"[DEBUG] Après filtres + dropna(keyword,url,position): {kept}")

    # 7) Agrégations (sans .apply)
    if serps_filtered.empty:
        by_kw_best = pd.DataFrame(columns=["keyword", "best_position", "best_url"])
        by_kw_count = pd.DataFrame(columns=["keyword", "nb_urls"])
        by_kw_dupes = pd.DataFrame(columns=["keyword", "dupes_str"])
    else:
        # Meilleure position par URL pour chaque keyword
        per_url = (
            serps_filtered
            .groupby(["keyword", "url"], as_index=False)
            .agg(best_pos=("position", "min"))
        )

        # meilleure URL (position min) par keyword
        idx_best = per_url.groupby("keyword")["best_pos"].idxmin()
        by_kw_best = per_url.loc[idx_best, ["keyword", "best_pos", "url"]].copy()
        by_kw_best = by_kw_best.rename(columns={"best_pos": "best_position", "url": "best_url"})

        # nombre d'URLs distinctes par keyword
        by_kw_count = per_url.groupby("keyword", as_index=False).agg(nb_urls=("url", "nunique"))

        # "url (pos)" trié par position
        per_url_sorted = per_url.sort_values(["keyword", "best_pos"], ascending=[True, True]).copy()
        per_url_sorted["_dupe_item"] = (
            per_url_sorted["url"] + " (" + per_url_sorted["best_pos"].astype(int).astype(str) + ")"
        )
        by_kw_dupes = (
            per_url_sorted
            .groupby("keyword", as_index=False)["_dupe_item"]
            .agg(lambda s: ", ".join(s))
        )
        by_kw_dupes.columns = ["keyword", "dupes_str"]

    by_kw = (
        by_kw_best
        .merge(by_kw_count, on="keyword", how="outer")
        .merge(by_kw_dupes, on="keyword", how="outer")
    )

    # 8) Clé clusters = Mot-clé principal UNIQUEMENT
    cl_cols_lower = {c.lower(): c for c in df_clusters.columns}
    col_main = cl_cols_lower.get("mot-clé principal", cl_cols_lower.get("mot clé principal"))
    if not col_main:
        raise ValueError("La colonne 'Mot-clé principal' est absente de clusters_serp.")
    df_clusters["_kw_principal_"] = df_clusters[col_main].apply(normalize_str)

    # 9) Jointure
    enriched = df_clusters.merge(by_kw, how="left", left_on="_kw_principal_", right_on="keyword")

    # 10) Renommage + remplissage
    enriched = enriched.rename(columns={
        "best_position": "Position",
        "best_url": "URL positionnée",
        "nb_urls": "Nombre d'URL positionnée",
        "dupes_str": "URL en duplication"
    })

    # La jointure how="left" introduit des NaN et remonte ces 2 colonnes en float64 :
    # sans ce passage en entier nullable, le CSV livré affiche "47.0" au lieu de "47".
    for col in ["Position", "Nombre d'URL positionnée"]:      # [FIX] 47 au lieu de 47.0
        # list(...).count() : si le fichier de clusters portait déjà une colonne de ce nom, le
        # rename ci-dessus crée un libellé en double et enriched[col] renverrait un DataFrame.
        if list(enriched.columns).count(col) != 1:
            continue
        _vals = pd.to_numeric(enriched[col], errors="coerce")
        _connus = _vals.dropna()
        # cast entier uniquement si toutes les valeurs le permettent (une position 47.5
        # resterait affichée telle quelle plutôt que de faire planter le script)
        if _connus.empty or (_connus == _connus.round()).all():
            enriched[col] = _vals.astype("Int64")

    # Crée les colonnes si absentes (cast en object : autorise le mélange nombres / "Non positionné")
    for col in ["Position", "URL positionnée", "Nombre d'URL positionnée", "URL en duplication"]:
        if col not in enriched.columns:
            enriched[col] = pd.NA
        enriched[col] = enriched[col].astype(object)

    # Lignes sans correspondance → "Non positionné"
    no_hit = enriched["keyword"].isna()
    enriched.loc[no_hit, ["Position", "URL positionnée", "Nombre d'URL positionnée", "URL en duplication"]] = "Non positionné"

    # Remplace NaN résiduels par "Non positionné"
    for col in ["Position", "URL positionnée", "Nombre d'URL positionnée", "URL en duplication"]:
        enriched[col] = enriched[col].where(enriched[col].notna(), "Non positionné")

    # 11) Nettoyage colonnes techniques
    enriched = enriched.drop(columns=[c for c in ["_kw_principal_", "keyword"] if c in enriched.columns])

    # 11 bis) [FIX] Garde-fou : TARGET_DOMAIN visiblement faux (reste d'un client précédent ?)
    # Sans ce contrôle, un mauvais TARGET_DOMAIN ne provoque aucune erreur : le fichier sort
    # avec 100 % de "Non positionné", structurellement parfait mais sémantiquement faux.
    nb_total = len(enriched)
    nb_positionne = int((enriched["Position"].astype(str) != "Non positionné").sum())
    taux = (nb_positionne / nb_total * 100) if nb_total else 0.0
    print(f"{TARGET_DOMAIN} positionné sur {nb_positionne} / {nb_total} mots-clés principaux ({taux:.1f} %)")
    if nb_total > 0 and nb_positionne == 0:
        print("")
        print("*" * 78)
        print("!!!  AVERTISSEMENT : AUCUN MOT-CLÉ POSITIONNÉ  !!!")
        print(f'Le domaine configuré TARGET_DOMAIN = "{TARGET_DOMAIN}" n\'a été trouvé sur')
        print("AUCUN des mots-clés principaux de ce fichier.")
        print("C'est très probablement une ERREUR DE CONFIGURATION : vérifiez la valeur de")
        print("TARGET_DOMAIN en haut du script (reste du client précédent ?).")
        print("Le fichier est tout de même écrit, mais NE LE LIVREZ PAS en l'état.")
        print("*" * 78)
        print("")

    # 12) Sauvegarde
    enriched.to_csv(OUTPUT_FILE, index=False, encoding=ENCODING_CLUSTERS)
    print(f"✅ Fichier écrit : {Path(OUTPUT_FILE).resolve()}")

if __name__ == "__main__":
    main()