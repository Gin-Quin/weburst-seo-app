#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Clustering de mots-clés par similarité de SERP (Top N "organic") via coefficient de Sørensen–Dice.

Entrée:
  - CSV "serps_resultats" (avec ou sans .csv)
  - Colonnes attendues :
      keyword | volume | type | url

Sortie:
  - CSV "clusters_serp.csv" avec:
      A  Mot-clé principal
      B  Mot-clé secondaire
      C  Volume de recherche du mot-clé principal
      D  Volume de recherche total
"""

# =========================
# ⚙️ Paramètres modifiables
# =========================
TAUX_SIMILARITE    = 0.50          # Seuil de similarité (0.60 = 60%)
NB_URLS_ANALYSE    = 12            # Top N URLs par mot-clé (type "organic")
TYPE_RESULTAT      = "organic"     # Type de résultat à considérer
INPUT_FILE         = "serps_resultats_with_volume.csv"   # accepte "serps_resultats" ou "serps_resultats.csv"
OUTPUT_FILE        = "clusters_serp.csv"

# Normalisation d'URL
EXCLURE_PARAMS_FIXES = {
    "gclid", "fbclid", "srsltid", "mc_eid", "igshid"
}
EXCLURE_PREFIX_PARAMS = ("utm_",)  # tout param commençant par "utm_"
RETIRER_SCHEMA     = True          # retire "http(s)://"
RETIRER_FRAGMENT   = True          # retire "#..."
HARMONISER_SLASH   = True          # supprime le trailing "/" sauf racine
RETIRER_WWW        = True          # retire le préfixe "www."
# =========================

import argparse
import os
import sys
import pandas as pd
from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode

# -------------------------------
# Utils fichiers & arguments
# -------------------------------

def resolve_input_path(path_base: str) -> str:
    """Accepte 'serps_resultats' ou 'serps_resultats.csv'."""
    if os.path.isfile(path_base):
        return path_base
    if not path_base.lower().endswith(".csv"):
        candidate = path_base + ".csv"
        if os.path.isfile(candidate):
            return candidate
    return path_base  # on renverra l'erreur plus tard si inexistant

def parse_args():
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument("--input", "-i", default=None)
    parser.add_argument("--output", "-o", default=None)
    parser.add_argument("--threshold", "-t", type=float, default=None)
    parser.add_argument("--topn", "-n", type=int, default=None)
    parser.add_argument("--result_type", "-r", default=None)
    parser.add_argument("--help", "-h", action="store_true")
    args = parser.parse_args()

    if args.help:
        print(
            "Usage (paramètres en tête du script modifiables) :\n"
            "  python cluster_serp.py [--input FICHIER] [--output FICHIER] [--threshold 0.6] [--topn 10] [--result_type organic]\n"
            "Les options en CLI écrasent les paramètres au-dessus."
        )
        sys.exit(0)

    cfg = {
        "input": args.input or INPUT_FILE,
        "output": args.output or OUTPUT_FILE,
        "threshold": TAUX_SIMILARITE if args.threshold is None else args.threshold,
        "topn": NB_URLS_ANALYSE if args.topn is None else args.topn,
        "result_type": TYPE_RESULTAT if args.result_type is None else args.result_type,
    }
    if not (0.0 <= cfg["threshold"] <= 1.0):
        sys.stderr.write("[ERREUR] --threshold doit être entre 0 et 1.\n")
        sys.exit(1)
    if cfg["topn"] <= 0:
        sys.stderr.write("[ERREUR] --topn doit être > 0.\n")
        sys.exit(1)
    return cfg

# -------------------------------
# Normalisation d'URL
# -------------------------------

def normalize_url(u: str) -> str:
    """Normalise une URL pour rendre la comparaison robuste."""
    if not isinstance(u, str) or not u.strip():
        return ""
    u = u.strip()
    parsed = urlparse(u)

    # netloc en minuscule + retrait de 'www.'
    netloc = (parsed.netloc or "").lower()
    if RETIRER_WWW and netloc.startswith("www."):
        netloc = netloc[4:]

    # Query params : retirer tracking (utm_*, gclid, fbclid, srsltid, etc.)
    query_params = []
    for k, v in parse_qsl(parsed.query, keep_blank_values=True):
        if k in EXCLURE_PARAMS_FIXES:
            continue
        if any(k.startswith(pref) for pref in EXCLURE_PREFIX_PARAMS):
            continue
        query_params.append((k, v))
    new_query = urlencode(query_params, doseq=True)

    # Fragments
    fragment = "" if RETIRER_FRAGMENT else parsed.fragment

    # Path: trailing slash
    path = parsed.path or ""
    if HARMONISER_SLASH and path != "/" and path.endswith("/"):
        path = path[:-1]

    # Reconstruit
    normalized = urlunparse((
        parsed.scheme if not RETIRER_SCHEMA else "",
        netloc,
        path,
        "",                 # params rarement utilisés sur le web
        new_query,
        fragment
    ))

    # Retirer schéma "manuellement" si besoin
    if RETIRER_SCHEMA and "://" in normalized:
        normalized = normalized.split("://", 1)[1]
    return normalized

# -------------------------------
# Similarité & Clustering
# -------------------------------

def dice_similarity(urls_a: set, urls_b: set) -> float:
    """Coefficient de Sørensen–Dice: 2|A∩B| / (|A|+|B|)."""
    if not urls_a and not urls_b:
        return 0.0
    inter = len(urls_a.intersection(urls_b))
    return (2.0 * inter) / (len(urls_a) + len(urls_b))

class UnionFind:
    def __init__(self, items):
        self.parent = {x: x for x in items}
        self.rank = {x: 0 for x in items}
    def find(self, x):
        p = self.parent.get(x, x)
        if p != x:
            self.parent[x] = self.find(p)
        return self.parent[x]
    def union(self, a, b):
        ra, rb = self.find(a), self.find(b)
        if ra == rb:
            return
        if self.rank[ra] < self.rank[rb]:
            self.parent[ra] = rb
        elif self.rank[rb] < self.rank[ra]:
            self.parent[rb] = ra
        else:
            self.parent[rb] = ra
            self.rank[ra] += 1

# -------------------------------
# Chargement & Préparation
# -------------------------------

def load_data(path_base: str) -> pd.DataFrame:
    path = resolve_input_path(path_base)
    if not os.path.isfile(path):
        sys.stderr.write(f"[ERREUR] Fichier introuvable: {path}\n")
        sys.exit(1)
    try:
        # ✅ corrige le DtypeWarning et fiabilise l'inférence des types
        df = pd.read_csv(path, low_memory=False)
    except Exception as e:
        sys.stderr.write(f"[ERREUR] Lecture CSV '{path}': {e}\n")
        sys.exit(1)

    required = {"keyword", "volume", "type", "url"}
    missing = [c for c in required if c not in df.columns]
    if missing:
        sys.stderr.write(f"[ERREUR] Colonnes manquantes: {missing}\n")
        sys.exit(1)

    return df

def build_keyword_urlsets(df: pd.DataFrame, topn: int, result_type: str):
    """
    Retourne:
      - urlsets: dict[keyword] -> set(normalized_top_urls)
      - volumes: dict[keyword] -> volume (max trouvé pour ce keyword, tous types confondus)
    """
    df = df.copy()
    # Volumes en numérique
    df["volume"] = pd.to_numeric(df["volume"], errors="coerce").fillna(0)

    # Volumes par keyword (max tous types)
    volumes = df.groupby(df["keyword"].astype(str), sort=False)["volume"].max().to_dict()

    # Filtrer sur le type (organic), insensible à la casse
    organic = df[df["type"].astype(str).str.lower() == str(result_type).lower()].copy()

    urlsets = {}

    # Keywords présents dans tout le fichier (on veut inclure ceux sans organic → set() vide)
    all_keywords = df["keyword"].dropna().astype(str).tolist()

    # Construire ensembles pour keywords ayant des organic
    for kw, sub in organic.groupby(organic["keyword"].astype(str), sort=False):
        # URLs normalisées, dédupliquées, ordre d'apparition
        uniq = []
        seen_u = set()
        for u in sub["url"].astype(str):
            nu = normalize_url(u)
            if nu and nu not in seen_u:
                uniq.append(nu)
                seen_u.add(nu)
            if len(uniq) >= topn:
                break
        urlsets[kw] = set(uniq)

    # Ajouter les keywords sans organic → ensemble vide
    for kw in all_keywords:
        if kw not in urlsets:
            urlsets[kw] = set()
            if kw not in volumes:
                volumes[kw] = 0.0

    return urlsets, volumes

def build_clusters(urlsets: dict, threshold: float):
    """Composantes connexes du graphe des similarités ≥ threshold."""
    keywords = list(urlsets.keys())
    uf = UnionFind(keywords)
    n = len(keywords)

    for i in range(n):
        ki = keywords[i]
        set_i = urlsets[ki]
        if not set_i:
            continue
        for j in range(i + 1, n):
            kj = keywords[j]
            set_j = urlsets[kj]
            if not set_j:
                continue
            sim = dice_similarity(set_i, set_j)
            if sim >= threshold:
                uf.union(ki, kj)

    clusters = {}
    for k in keywords:
        r = uf.find(k)
        clusters.setdefault(r, []).append(k)
    return list(clusters.values())

# -------------------------------
# Export
# -------------------------------

def make_export_df(clusters, volumes: dict) -> pd.DataFrame:
    rows = []
    for cl in clusters:
        # principal = volume max, puis alpha si égalité
        cl_sorted = sorted(cl, key=lambda k: (-float(volumes.get(k, 0.0)), k))
        main_kw = cl_sorted[0]
        secundaries = [k for k in cl if k != main_kw]
        main_vol = float(volumes.get(main_kw, 0.0))
        total_vol = float(sum(float(volumes.get(k, 0.0)) for k in cl))

        rows.append({
            "Mot-clé principal": main_kw,
            "Mot-clé secondaire": ", ".join(secundaries),  # vide si singleton
            "Volume de recherche du mot-clé principal": int(main_vol) if main_vol.is_integer() else main_vol,
            "Volume de recherche total": int(total_vol) if total_vol.is_integer() else total_vol,
        })

    out = pd.DataFrame(rows)
    # Tri: volume total décroissant puis alpha
    out = out.sort_values(by=["Volume de recherche total", "Mot-clé principal"],
                          ascending=[False, True], kind="mergesort").reset_index(drop=True)
    return out

# -------------------------------
# Main
# -------------------------------

def main():
    cfg = parse_args()
    df = load_data(cfg["input"])
    urlsets, volumes = build_keyword_urlsets(df, topn=cfg["topn"], result_type=cfg["result_type"])
    clusters = build_clusters(urlsets, threshold=cfg["threshold"])
    export_df = make_export_df(clusters, volumes)
    try:
        export_df.to_csv(cfg["output"], index=False, encoding="utf-8-sig")
    except Exception as e:
        sys.stderr.write(f"[ERREUR] Écriture CSV '{cfg['output']}': {e}\n")
        sys.exit(1)

    print(f"[OK] {len(export_df)} lignes exportées dans '{cfg['output']}'")
    # aperçu console
    try:
        print(export_df.head(10).to_string(index=False))
    except Exception:
        pass

if __name__ == "__main__":
    main()
