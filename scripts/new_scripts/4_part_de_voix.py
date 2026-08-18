# -*- coding: utf-8 -*-
"""
Calcul des métriques SEO par domaine à partir d'un export SERP top 50.

Entrée : CSV "serps_resultats" (top 50 par mot-clé, 1 ligne = 1 domaine positionné)
Colonnes attendues (configurables ci-dessous) :
- keyword : mot-clé
- volume  : volume de recherche (par mot-clé)
- domain  : domaine/URL positionné (tolère URL complète, http/https, www)
- position: position dans la SERP (si absent, tentative auto sur ['position','pos','rank','ranking'])
- type    : type de résultat SERP (organic, paid, featured_snippet...) -> voir RESULT_TYPE_FILTER

Sortie : "domain_metrics.csv" avec :
- domain
- part_de_voix_trafic (0-1) : trafic estimé du domaine / trafic estimé de TOUS les domaines.
                              C'est la vraie part de voix : elle somme bien à 100 %.
- indice_visibilite  (0-1) : volume cumulé des mots-clés où le domaine est en top10 /
                             volume total. Indice de couverture pondéré par le volume,
                             il ne somme PAS à 100 % (chaque mot-clé est crédité à ses 10 domaines).
- trafic_estime
- pct_kw_top10 (0-1)
- pct_kw_top3  (0-1)
- nb_kw_top10
- nb_kw_top3
- nb_kw_total (référence = nombre total de mots-clés uniques du fichier)
- voice_volume

Note : par défaut seules les lignes de type "organic" sont prises en compte (RESULT_TYPE_FILTER),
car chez DataForSEO la position (rank_group) redémarre à 1 pour CHAQUE type de bloc : sans ce
filtre, une annonce Ads peut ressortir en "position 3" et recevoir un CTR organique.

Usage :
    - Placez ce script dans le même dossier que votre CSV (ou ajustez FILE_PATH).
    - python script_metrics_serp.py
"""

import os
import re
import sys
import math
import pandas as pd

for _s in (sys.stdout, sys.stderr):          # [FIX] sortie console en UTF-8
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# =========================
# =======  CONFIG  ========
# =========================

# Nom/chemin du fichier d'entrée
FILE_PATH = "serps_resultats_with_volume.csv"   # adaptez si besoin (ex: "data/serps_resultats.csv")

# Noms des colonnes (insensibles à la casse; on fera un mapping auto)
COL_KEYWORD = "keyword"
COL_VOLUME  = "volume"
COL_DOMAIN  = "domain"
# La colonne position peut varier; on tentera de la détecter si non strictement "position"
POSITION_CANDIDATES = ["position", "pos", "rank", "ranking"]

# Type de résultat SERP à conserver (colonne 'type' du CSV de la phase 1).
# Chez DataForSEO, la position (rank_group) redémarre à 1 pour CHAQUE type de bloc :
# sans filtre, une annonce "paid" ou un featured_snippet reçoit une fausse position organique
# (et donc un CTR). Les phases 2 et 3 filtrent déjà sur "organic" : on fait pareil ici.
RESULT_TYPE_FILTER = "organic"   # [FIX] ne garder que l'organique ; None = tout garder

# Courbe CTR (positions 1 à 10). Au-delà de 10 => CTR=0
CTR = {
    1: 0.20,
    2: 0.10,
    3: 0.08,
    4: 0.07,
    5: 0.06,
    6: 0.05,
    7: 0.04,
    8: 0.03,
    9: 0.02,
    10: 0.01
}

# Sortie
OUTPUT_CSV = "domain_metrics.csv"

# =========================
# ======  FONCTIONS  ======
# =========================

def find_column(actual_cols, desired_name, fallback_list=None):
    """
    Trouve dans actual_cols la colonne correspondant à desired_name (ou l'une des fallbacks),
    de manière insensible à la casse et en tolérant les underscores/espaces.
    """
    def norm(x):
        return re.sub(r"[\s_]+", "", x.strip().lower())
    wanted = [desired_name] + (fallback_list or [])
    wanted_norm = [norm(w) for w in wanted]

    for col in actual_cols:
        if norm(col) in wanted_norm:
            return col
    return None

def extract_host(value):
    """
    Extrait l'hôte d'une URL ou retourne tel quel si déjà un host/domaine.
    - supprime protocole
    - coupe chemin/params
    - enlève 'www.'
    - met en minuscule
    """
    if pd.isna(value):
        return None
    s = str(value).strip().lower()

    # enlever protocole
    s = re.sub(r"^https?://", "", s)
    # enlever tout ce qui suit un premier /, ?, #
    s = re.split(r"[/?#]", s, maxsplit=1)[0]
    # enlever user:pass@ si présent
    s = re.sub(r"^[^@]+@", "", s)
    # enlever port :xxxx
    s = re.sub(r":\d+$", "", s)
    # enlever www.
    if s.startswith("www."):
        s = s[4:]
    # enlever trailing dot
    s = s.rstrip(".")
    return s or None

def main():
    if not os.path.exists(FILE_PATH):
        print(f"Fichier introuvable : {FILE_PATH}", file=sys.stderr)
        sys.exit(1)

    # Lecture CSV (tolérant)
    df = pd.read_csv(FILE_PATH, low_memory=False, encoding="utf-8-sig")

    # Mapping des colonnes
    cols = list(df.columns)
    col_keyword = find_column(cols, COL_KEYWORD)
    col_volume  = find_column(cols, COL_VOLUME)
    col_domain  = find_column(cols, COL_DOMAIN)
    col_position = find_column(cols, "position", fallback_list=POSITION_CANDIDATES)

    missing = [name for name, col in [
        ("keyword", col_keyword), ("volume", col_volume), ("domain", col_domain)
    ] if col is None]
    if missing:
        raise ValueError(f"Colonnes manquantes dans le CSV : {', '.join(missing)}")

    if col_position is None:
        raise ValueError(
            "Colonne de position introuvable (essayé: position, pos, rank, ranking).\n"
            "Veuillez préciser/renommer la colonne de position dans le fichier."
        )

    # Renommage standard interne
    df = df.rename(columns={
        col_keyword: "keyword",
        col_volume:  "volume",
        col_domain:  "domain",
        col_position:"position"
    })

    # Nettoyage / typage
    df["keyword"] = df["keyword"].astype(str).str.strip()
    # volume numérique
    df["volume"] = pd.to_numeric(df["volume"], errors="coerce").fillna(0).astype(float)
    # position numérique
    df["position"] = pd.to_numeric(df["position"], errors="coerce")

    # Normalisation domaine
    df["domain"] = df["domain"].map(extract_host)
    df = df.dropna(subset=["domain", "keyword"])
    df = df[df["domain"] != ""]

    # Si des positions manquent, on les élimine (pas exploitable pour CTR ni top10/top3)
    df = df.dropna(subset=["position"])
    df["position"] = df["position"].astype(int)

    # Volume par mot-clé unique (référence globale, évite le double comptage)
    # [FIX] calculé AVANT le filtre sur le type : un mot-clé sans aucun résultat organique
    # doit rester au dénominateur, sinon les pourcentages changent de base.
    kw_volume = df.groupby("keyword", as_index=True)["volume"].first().to_dict()
    total_kw = len(kw_volume)
    total_volume_all = float(sum(kw_volume.values()))

    if total_kw == 0 or total_volume_all == 0:
        raise ValueError("Aucun mot-clé ou volume total = 0. Vérifiez la colonne 'volume' et les données.")

    # ---------- Filtre sur le type de résultat SERP ----------  # [FIX]
    # [FIX] noms de repli : un export peut nommer la colonne item_type / se_type / result_type
    col_type = find_column(list(df.columns), "type",
                           fallback_list=["item_type", "se_type", "result_type", "serp_type"])
    if RESULT_TYPE_FILTER is None:                               # [FIX]
        print("[INFO] RESULT_TYPE_FILTER = None : aucun filtre sur le type de résultat.")
    elif col_type is None:                                       # [FIX]
        # Ancien fichier sans colonne 'type' : on continue, mais on prévient clairement.
        # [FIX] l'alerte part AUSSI sur stdout : sur stderr seul, elle peut passer inaperçue
        #       dans un éditeur qui sépare les flux, et le livrable partirait avec les annonces.
        _msg = ("[ATTENTION] Colonne 'type' absente du CSV : impossible de filtrer sur "
                f"'{RESULT_TYPE_FILTER}'. Toutes les lignes sont conservées, les annonces et "
                "blocs SERP peuvent donc fausser les positions et le trafic estimé.")
        print(_msg, file=sys.stderr)
        print(_msg)
    else:                                                        # [FIX]
        type_serie = df[col_type].astype(str).str.strip()
        # contains insensible à la casse, cohérent avec la phase 3 (cannibalisation)
        garde = type_serie.str.contains(RESULT_TYPE_FILTER, case=False, regex=False, na=False)
        nb_ecartes = int((~garde).sum())
        if nb_ecartes:
            # [FIX] la phase 1 écrit "" (pas NaN) quand le type manque : couvrir les deux cas
            repartition = (type_serie[~garde].str.lower()
                           .replace({"nan": "(type vide)", "": "(type vide)"}).value_counts())
            detail = ", ".join(f"{t}={n}" for t, n in repartition.items())
            print(f"[FILTRE] {nb_ecartes} lignes non {RESULT_TYPE_FILTER} écartées : {detail}")
        else:
            print(f"[FILTRE] Aucune ligne écartée : toutes de type '{RESULT_TYPE_FILTER}'.")
        df = df[garde].copy()
        if df.empty:
            raise ValueError(
                f"Plus aucune ligne après le filtre type='{RESULT_TYPE_FILTER}'. "
                "Vérifiez la colonne 'type' du CSV ou passez RESULT_TYPE_FILTER = None."
            )

    # Dédupliquer (keyword, domain) -> garder la meilleure position
    # Important si des 'types' du SERP génèrent des doublons
    df_best = (df
               .sort_values(["keyword", "domain", "position"], ascending=[True, True, True])
               .groupby(["keyword", "domain"], as_index=False)
               .first())

    # Filtrage top10 & top3
    df_top10 = df_best[df_best["position"] <= 10].copy()
    df_top3  = df_best[df_best["position"] <= 3].copy()

    # ---------- Indice de visibilité ----------
    # Indice = (Somme des volumes des mots-clés où le domaine est présent en top10) / (Volume total de tous les mots-clés)
    # On veut des mots-clés UNIQUES par domaine en top10.
    # [FIX] ancien "part_de_voix", renommé : ce n'est PAS une part de marché et la colonne
    # ne somme PAS à 100 % (chaque mot-clé est crédité en entier à chacun de ses 10 domaines).
    # C'est un indice de couverture pondéré par le volume. La vraie part de voix est
    # "part_de_voix_trafic", calculée plus bas à partir du trafic estimé.
    voice_by_domain = (
        df_top10.groupby("domain")["keyword"]
        .apply(lambda kws: sum(kw_volume.get(k, 0.0) for k in set(kws)))
        .rename("voice_volume")
        .to_frame()
    )
    voice_by_domain["indice_visibilite"] = voice_by_domain["voice_volume"] / total_volume_all   # [FIX]

    # ---------- Trafic estimé ----------
    # Somme(volume(keyword) * CTR(position)) pour chaque occurrence (domaine, keyword, position<=10)
    def position_ctr(pos: int) -> float:
        return CTR.get(int(pos), 0.0)

    df_top10["ctr"] = df_top10["position"].map(position_ctr)
    df_top10["traffic_contrib"] = df_top10["keyword"].map(kw_volume).fillna(0.0) * df_top10["ctr"]

    traffic_by_domain = (
        df_top10.groupby("domain", as_index=True)["traffic_contrib"]
        .sum()
        .rename("trafic_estime")
        .to_frame()
    )

    # ---------- % de mots-clés en top10 / top3 ----------
    # Base = nombre total de mots-clés uniques du fichier
    kw_top10_counts = (
        df_top10.groupby("domain")["keyword"]
        .nunique()
        .rename("nb_kw_top10")
        .to_frame()
    )
    kw_top3_counts = (
        df_top3.groupby("domain")["keyword"]
        .nunique()
        .rename("nb_kw_top3")
        .to_frame()
    )

    # Assemblage final
    out = (voice_by_domain
           .join(traffic_by_domain, how="outer")
           .join(kw_top10_counts, how="outer")
           .join(kw_top3_counts, how="outer"))

    out = out.fillna(0.0)
    # [FIX] compteurs de mots-clés en entier : sans ça nb_kw_top3 sortait en "81.0" dans le CSV
    out[["nb_kw_top10", "nb_kw_top3"]] = out[["nb_kw_top10", "nb_kw_top3"]].astype(int)
    out["nb_kw_total"]  = total_kw
    out["pct_kw_top10"] = out["nb_kw_top10"] / total_kw
    out["pct_kw_top3"]  = out["nb_kw_top3"]  / total_kw

    # ---------- Part de voix (trafic) ----------  # [FIX]
    # Vraie part de voix : trafic estimé du domaine / trafic estimé cumulé de tous les domaines.
    # Contrairement à indice_visibilite, cette colonne somme bien à 100 %.
    total_trafic_all = float(out["trafic_estime"].sum())                                  # [FIX]
    if total_trafic_all > 0:                                                              # [FIX]
        out["part_de_voix_trafic"] = out["trafic_estime"] / total_trafic_all              # [FIX]
    else:                                                                                 # [FIX]
        out["part_de_voix_trafic"] = 0.0                                                  # [FIX]

    # Ordonner les colonnes
    out = out.reset_index().rename(columns={"index": "domain"})
    out = out[[
        "domain",
        "part_de_voix_trafic",   # [FIX] somme à 100 % : c'est la part de voix
        "indice_visibilite",     # [FIX] ex "part_de_voix" : indice de couverture, ne somme pas à 100 %
        "trafic_estime",
        "pct_kw_top10",
        "pct_kw_top3",
        "nb_kw_top10",
        "nb_kw_top3",
        "nb_kw_total",
        "voice_volume"
    ]]

    # Tri par part de voix (trafic) décroissante  # [FIX]
    out = out.sort_values(["part_de_voix_trafic", "trafic_estime"], ascending=[False, False])

    # Export
    out.to_csv(OUTPUT_CSV, index=False, encoding="utf-8-sig")

    # Affichage console bref
    print(f"[OK] {len(out)} domaines traités.")
    print(f"Total mots-clés uniques : {total_kw} | Volume total : {int(total_volume_all)}")
    # [FIX] contrôle : les deux colonnes n'ont pas la même nature
    print(f"Somme part_de_voix_trafic : {out['part_de_voix_trafic'].sum() * 100:.1f} % "
          f"(doit valoir ~100 % : c'est bien une part)")
    print(f"Somme indice_visibilite  : {out['indice_visibilite'].sum() * 100:.1f} % "
          f"(largement > 100 % : indice de couverture, pas une part)")
    print(f"Fichier exporté : {OUTPUT_CSV}")

if __name__ == "__main__":
    main()
