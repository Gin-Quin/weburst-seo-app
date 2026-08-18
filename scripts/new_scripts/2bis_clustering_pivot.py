# -*- coding: utf-8 -*-
"""
Clustering de mots-clés par similarité de SERP — méthode PIVOT / SEED (étoile).

Corrige l'effet de chaîne (single-linkage) du Union-Find de 'script similarité v2.py'.
Chaque cluster est ancré sur un pivot, choisi par volume décroissant. On n'y rattache
QUE les mots-clés DIRECTEMENT similaires au pivot (Dice >= seuil), sans transitivité.
La colonne « Mot-clé principal » exportée reste, comme dans le script d'origine, le mot-clé
au plus gros volume du cluster : après la passe 2 ce n'est plus forcément le pivot.

[FIX] Le rattachement se fait en deux passes : passe 1 = identification des pivots (greedy
par volume décroissant, inchangée), passe 2 = chaque mot-clé va au pivot le PLUS similaire
et non plus au premier pivot rencontré au-dessus du seuil.

Réutilise normalize_url / build_keyword_urlsets / dice_similarity du script d'origine
(une seule source de vérité pour la normalisation).
"""

import argparse
import importlib.util
import os                                        # [FIX] chemins de la promotion vers clusters_serp.csv
import shutil                                    # [FIX] sauvegarde de l'ancien clusters_serp.csv
import sys
for _s in (sys.stdout, sys.stderr):              # [FIX] sortie console en UTF-8
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
import pandas as pd

# ============== Paramètres ==============
# [FIX] le script de similarité est cherché À CÔTÉ de ce fichier (dossier portable),
#       avec repli sur l'ancien emplacement Downloads si besoin.
_ICI        = os.path.dirname(os.path.abspath(__file__))
SIM_PATH    = os.path.join(_ICI, "script similarité v2.py")
if not os.path.isfile(SIM_PATH):
    SIM_PATH = r"C:\Users\Dany\Downloads\script similarité v2.py"
INPUT_FILE  = r"C:\Users\dany\Documents\Test analyse SERP\serps_resultats_with_volume.csv"
OUTPUT_FILE = r"C:\Users\dany\Documents\Test analyse SERP\clusters_serp_pivot.csv"
THRESHOLD   = 0.50
TOPN        = 12
RESULT_TYPE = "organic"
# ========================================


def load_sim_module(path):
    spec = importlib.util.spec_from_file_location("sim_origin", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def pivot_clustering(urlsets, volumes, threshold, dice):
    """Star clustering en DEUX passes : pivots pris par volume décroissant, puis
    rattachement de chaque mot-clé au pivot le PLUS similaire (et non plus au premier
    pivot rencontré qui dépassait le seuil).

    Retourne (clusters, nb_reaffectes) : nb_reaffectes = nombre de mots-clés qui changent
    de cluster par rapport à l'ancienne méthode « premier pivot rencontré »."""
    keywords = sorted(urlsets.keys(), key=lambda k: (-float(volumes.get(k, 0.0)), k))

    # ---- Passe 1 : identification des pivots (algorithme greedy inchangé) ----
    # L'identité des pivots reste strictement la même qu'avant : un mot-clé non encore
    # rattaché devient pivot et « réserve » les mots-clés similaires.
    assigned = set()
    clusters = []
    premier_pivot = {}                                    # [FIX] mémorise l'ancien rattachement, pour le comptage
    for kw in keywords:
        if kw in assigned:
            continue
        seed_set = urlsets[kw]
        cluster = [kw]
        assigned.add(kw)
        if seed_set:  # un pivot sans URL organic = singleton
            for other in keywords:
                if other in assigned or not urlsets[other]:
                    continue
                if dice(seed_set, urlsets[other]) >= threshold:
                    cluster.append(other)
                    assigned.add(other)
                    premier_pivot[other] = kw             # [FIX]
        clusters.append(cluster)

    # ---- Passe 2 : réaffectation au MEILLEUR pivot ----                     # [FIX] bloc entier
    # Propriété exploitée ici : par construction de la passe 1, deux pivots sont toujours
    # EN DESSOUS du seuil l'un par rapport à l'autre (sinon le second aurait été absorbé par
    # le premier). Un pivot ne peut donc jamais être absorbé par un autre pivot : on peut
    # réaffecter librement tous les non-pivots sans casser la liste des clusters.
    pivots = [cl[0] for cl in clusters]
    pivots_actifs = [p for p in pivots if urlsets[p]]     # un pivot sans URL organic n'attire rien
    par_pivot = {p: [p] for p in pivots}
    nb_reaffectes = 0
    for kw in keywords:
        if kw in par_pivot or not urlsets[kw]:           # pivots et mots-clés sans URL organic : intacts
            continue
        meilleur = None
        for p in pivots_actifs:
            d = dice(urlsets[p], urlsets[kw])
            if d < threshold:
                continue
            # départage : Dice le plus élevé, puis plus gros volume, puis ordre alphabétique
            cle = (-d, -float(volumes.get(p, 0.0)), p)
            if meilleur is None or cle < meilleur[0]:
                meilleur = (cle, p)
        if meilleur is None:
            par_pivot[kw] = [kw]                         # ne matche aucun pivot au seuil : singleton
            if premier_pivot.get(kw) is not None:
                nb_reaffectes += 1
            continue
        par_pivot[meilleur[1]].append(kw)
        if premier_pivot.get(kw) != meilleur[1]:
            nb_reaffectes += 1

    # on reconstruit les clusters dans le même ordre que la passe 1 (pivots par volume)
    clusters = [par_pivot[k] for k in keywords if k in par_pivot]
    return clusters, nb_reaffectes


def make_export_df(clusters, volumes):
    rows = []
    for cl in clusters:
        cl_sorted = sorted(cl, key=lambda k: (-float(volumes.get(k, 0.0)), k))
        # Convention historique conservée : le mot-clé principal est celui au PLUS GROS VOLUME
        # du cluster (identique à 'script similarité v2.py', et c'est la clé de jointure de la
        # phase 3). Depuis la passe 2 de réaffectation, ce n'est plus forcément le pivot dont la
        # SERP a servi de référence : le pivot est disponible dans cl[0] si besoin un jour.
        main_kw = cl_sorted[0]
        secs = [k for k in cl_sorted if k != main_kw]
        main_vol = float(volumes.get(main_kw, 0.0))
        total = float(sum(float(volumes.get(k, 0.0)) for k in cl))
        rows.append({
            "Mot-clé principal": main_kw,
            "Mot-clé secondaire": ", ".join(secs),
            "Volume de recherche du mot-clé principal": int(main_vol) if main_vol.is_integer() else main_vol,
            "Volume de recherche total": int(total) if total.is_integer() else total,
        })
    out = pd.DataFrame(rows)
    out = out.sort_values(["Volume de recherche total", "Mot-clé principal"],
                          ascending=[False, True], kind="mergesort").reset_index(drop=True)
    return out


def parse_args():
    p = argparse.ArgumentParser(description="Clustering SERP par pivot/seed.")
    p.add_argument("--input", "-i", default=INPUT_FILE)
    p.add_argument("--output", "-o", default=OUTPUT_FILE)
    p.add_argument("--threshold", "-t", type=float, default=THRESHOLD)
    p.add_argument("--topn", "-n", type=int, default=TOPN)
    # [FIX] --promote (activé par défaut) : recopie le résultat dans clusters_serp.csv,
    #       le fichier que lit réellement la phase 3 (script cannibalisation).
    p.add_argument("--promote", "-p", dest="promote", action="store_true", default=True,
                   help="recopie aussi le résultat dans clusters_serp.csv (par défaut)")
    p.add_argument("--no-promote", dest="promote", action="store_false",
                   help="n'écrit que le fichier --output, sans alimenter la phase 3")
    return p.parse_args()


def promote_to_phase3(out, output_path):                  # [FIX] fonction entière
    """Recopie le clustering pivot dans clusters_serp.csv, DANS LE MÊME DOSSIER que
    --output (et non dans le dossier courant), car la phase 3 (script cannibalisation)
    lit INPUT_CLUSTERS = 'clusters_serp.csv'. L'éventuel fichier single-linkage déjà
    présent est d'abord sauvegardé."""
    dossier = os.path.dirname(os.path.abspath(output_path))
    cible = os.path.join(dossier, "clusters_serp.csv")
    # [FIX] normcase : Windows est insensible à la casse, sinon -o CLUSTERS_SERP.CSV
    #       ferait copier le fichier sur lui-même en croyant sauvegarder l'ancien.
    if os.path.normcase(os.path.abspath(cible)) == os.path.normcase(os.path.abspath(output_path)):
        print("[i] --output est déjà clusters_serp.csv : rien à recopier.")
        return
    if os.path.isfile(cible):
        # [FIX] ne JAMAIS écraser clusters_serp.csv sans l'avoir sauvegardé quelque part :
        #       si la sauvegarde principale existe déjà, on suffixe au lieu de sauter l'étape.
        sauvegarde = os.path.join(dossier, "clusters_serp_singlelinkage.csv")
        if os.path.isfile(sauvegarde):
            n = 2
            while os.path.isfile(os.path.join(dossier, f"clusters_serp_precedent_{n}.csv")):
                n += 1
            sauvegarde = os.path.join(dossier, f"clusters_serp_precedent_{n}.csv")
        shutil.copy2(cible, sauvegarde)
        print(f"[OK] Ancien clusters_serp.csv sauvegardé -> {sauvegarde}")
    out.to_csv(cible, index=False, encoding="utf-8-sig")
    print(f"[OK] Clustering pivot recopié pour la phase 3 -> {cible}")


def main():
    a = parse_args()
    sim = load_sim_module(SIM_PATH)
    df = pd.read_csv(a.input, low_memory=False)
    urlsets, volumes = sim.build_keyword_urlsets(df, topn=a.topn, result_type=RESULT_TYPE)

    clusters, nb_reaffectes = pivot_clustering(urlsets, volumes, a.threshold, sim.dice_similarity)  # [FIX]
    out = make_export_df(clusters, volumes)
    out.to_csv(a.output, index=False, encoding="utf-8-sig")

    sizes = sorted((len(c) for c in clusters), reverse=True)
    multi = [s for s in sizes if s > 1]
    total_kw = sum(sizes)                                 # [FIX] contrôle anti-régression : aucun mot-clé perdu
    print(f"[OK] {len(out)} clusters -> {a.output}")
    print(f"     Plus gros cluster : {sizes[0]} | clusters >1 : {len(multi)} | singletons : {sizes.count(1)}")
    print(f"     Clusters de plus de 20 mots-clés : {sum(1 for s in sizes if s > 20)}")
    print(f"     Mots-clés répartis : {total_kw} / {len(urlsets)} en entrée")   # [FIX]
    print(f"     Rattachés à un meilleur pivot qu'avec l'ancienne méthode : {nb_reaffectes}")  # [FIX]

    if a.promote:                                         # [FIX]
        promote_to_phase3(out, a.output)
    else:
        print("[i] --no-promote : clusters_serp.csv n'a pas été mis à jour, "
              "la phase 3 lira l'ancien fichier.")


if __name__ == "__main__":
    main()
