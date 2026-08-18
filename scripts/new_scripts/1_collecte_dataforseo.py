# -*- coding: utf-8 -*-
"""
Pipeline DataForSEO (Standard mode) — robuste + "stop early"
Version complète avec identifiants API en clair
"""

import os
import csv
import sys                                       # [FIX] necessaire pour reconfigurer stdout/stderr
import time
import json
import shutil
import pandas as pd
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
from concurrent.futures import ThreadPoolExecutor, as_completed
from client import RestClient  # fourni par DataForSEO

# Sans ceci, dès que la sortie est un pipe (console PyCharm, redirection > log.txt,
# capture VS Code), Python retombe sur cp1252 et les emoji des print font planter
# le script APRÈS que les task_post ont déjà été facturés.
for _s in (sys.stdout, sys.stderr):          # [FIX] sortie console en UTF-8
    try:
        _s.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# ==========================
# ======= CONFIG ===========
# ==========================

# Identifiants API (comme avant)
API_LOGIN = "data@weburst.fr"
API_PASSWORD = "d1570c3f2d4bdc11"

# Dossier de travail
BASE_DIR = r"C:\Users\dany\Documents\Test analyse SERP"

# Fichiers I/O
KEYWORDS_FILE = os.path.join(BASE_DIR, "keywords.csv")                   
OUTPUT_SERP  = os.path.join(BASE_DIR, "serps_resultats_with_volume.csv")

# Paramètres d'envoi
LANGUAGE_CODE = "en"
LOCATION_CODE = 2826
DEVICE = "desktop"
OS_NAME = "windows"
DEPTH = 50
PRIORITY = 2
BATCH_SIZE = 100
WAIT_BETWEEN_BATCHES = 1 

# Polling / parallélisme
WAIT_INITIAL_SEC   = 60    
POLL_INTERVAL_SEC  = 10
MAX_POLLS          = 180   
MAX_WORKERS        = 16    
RETRY_MAX          = 5
RETRY_BACKOFF      = 1.6
DEBUG              = True
CREATE_BACKUP      = True
CHUNK_SIZE         = 200  

PARIS_TZ = ZoneInfo("Europe/Paris")

# Fichiers du run
RUN_TS         = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
TAG            = f"std_run_{RUN_TS}"
SUBMITTED_CSV  = os.path.join(BASE_DIR, f"submitted_keywords_{RUN_TS}.csv")
TASK_IDS_CSV   = os.path.join(BASE_DIR, f"task_ids_{RUN_TS}.csv")
NEW_ROWS_CSV   = os.path.join(BASE_DIR, f"serp_rows_{RUN_TS}.csv")

# ==========================
# ======= HELPERS ==========
# ==========================

def dprint(*args):
    if DEBUG:
        print(*args)

def normalize_kw(s: str) -> str:
    if not isinstance(s, str):
        return ""
    return " ".join(s.strip().lower().split())

def try_read_csv(path):
    for sep in [",",";","|","\t"]:
        for enc in ["utf-8","utf-8-sig","cp1252"]:
            try:
                df = pd.read_csv(path, sep=sep, encoding=enc)
                if df.shape[1] == 1 and df.iloc[:20,0].astype(str).str.contains(sep).any():
                    continue
                return df
            except Exception:
                continue
    return pd.read_csv(path)

def api_retry_get(client, endpoint: str, retry_max=RETRY_MAX, backoff=RETRY_BACKOFF):
    delay = 1.0
    for _ in range(retry_max):
        try:
            res = client.get(endpoint)
            if res and res.get("status_code") == 20000:
                return res
        except Exception:
            pass
        time.sleep(delay); delay *= backoff
    return None

def api_retry_post(client, endpoint: str, payload: dict, retry_max=RETRY_MAX, backoff=RETRY_BACKOFF):
    delay = 1.0
    for _ in range(retry_max):
        try:
            res = client.post(endpoint, payload)
            if res and res.get("status_code") == 20000:
                return res
        except Exception:
            pass
        time.sleep(delay); delay *= backoff
    return None

# ==========================
# ======= VOLUMES ==========
# ==========================

def load_keywords_and_volume(keywords_file: str):
    if not os.path.isfile(keywords_file):
        raise FileNotFoundError(f"keywords.csv introuvable: {keywords_file}")
    df = try_read_csv(keywords_file)
    if "keyword" not in df.columns:
        raise ValueError("keywords.csv doit contenir une colonne 'keyword'.")
    kws = [str(k).strip() for k in df["keyword"].dropna().tolist() if str(k).strip()]
    vol_map = {}
    if "volume" in df.columns:
        for _, r in df.iterrows():
            kw = str(r["keyword"]).strip()
            if not kw:
                continue
            norm = normalize_kw(kw)
            v = r.get("volume")
            if pd.notna(v) and norm not in vol_map:
                try:
                    vol_map[norm] = int(v)
                except Exception:
                    vol_map[norm] = v
    return kws, vol_map

# ==========================
# ======= ENVOI POST =======
# ==========================

def submit_tasks(client, keywords):
    os.makedirs(BASE_DIR, exist_ok=True)
    with open(SUBMITTED_CSV, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["keyword","tag","priority","depth","language_code","location_code","device","os"])
        w.writeheader()
    with open(TASK_IDS_CSV, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["id","endpoint_regular","date_posted","tag"])
        w.writeheader()

    total_sent = 0
    submitted_norm = set()
    post_ids = set()

    for i in range(0, len(keywords), BATCH_SIZE):
        batch = keywords[i:i+BATCH_SIZE]
        payload = {}
        for idx, kw in enumerate(batch):
            payload[idx] = dict(
                language_code=LANGUAGE_CODE,
                location_code=LOCATION_CODE,
                keyword=kw,
                device=DEVICE,
                os=OS_NAME,
                depth=DEPTH,
                priority=PRIORITY,
                tag=TAG
            )

        resp = api_retry_post(client, "/v3/serp/google/organic/task_post", payload)
        if not resp:
            print(f"[WARN] POST batch {i//BATCH_SIZE+1} échoué (réponse vide).")
        else:
            sc = resp.get("status_code")
            print(f"[POST] batch {i//BATCH_SIZE+1}: status_code={sc}, tasks_error={resp.get('tasks_error')}")
            if DEBUG:
                print(json.dumps(resp, indent=2, ensure_ascii=False))
            for t in (resp.get("tasks") or []):
                if t and t.get("status_code") == 20100:
                    tid = t.get("id")
                    if tid and tid not in post_ids:
                        post_ids.add(tid)
                        with open(TASK_IDS_CSV, "a", newline="", encoding="utf-8") as f:
                            w = csv.DictWriter(f, fieldnames=["id","endpoint_regular","date_posted","tag"])
                            w.writerow({"id": tid, "endpoint_regular": "", "date_posted": "", "tag": TAG})

        with open(SUBMITTED_CSV, "a", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=["keyword","tag","priority","depth","language_code","location_code","device","os"])
            for kw in batch:
                submitted_norm.add(normalize_kw(kw))
                w.writerow({
                    "keyword": kw, "tag": TAG, "priority": PRIORITY, "depth": DEPTH,
                    "language_code": LANGUAGE_CODE, "location_code": LOCATION_CODE,
                    "device": DEVICE, "os": OS_NAME
                })

        total_sent += len(batch)
        time.sleep(WAIT_BETWEEN_BATCHES)

    print(f"✅ Envoi terminé : {total_sent} mots-clés | TAG={TAG} | IDs captés au POST: {len(post_ids)}")
    return total_sent, submitted_norm, post_ids

# ==========================
# ====== COLLECT IDS =======
# ==========================

def poll_tasks_ready_for_ids(client, window_start_utc, window_end_utc, target_task_count, already_ids=None):
    collected = set(already_ids or set())
    print(f"⏳ Attente initiale {WAIT_INITIAL_SEC}s…")
    time.sleep(WAIT_INITIAL_SEC)
    polls = 0
    while polls < MAX_POLLS:
        polls += 1
        resp = api_retry_get(client, "/v3/serp/google/organic/tasks_ready")
        if not resp or resp.get("status_code") != 20000:
            print(f"[tasks_ready] statut invalide, tentative {polls}/{MAX_POLLS}")
            time.sleep(POLL_INTERVAL_SEC)
            continue

        all_tasks = resp.get("tasks") or []
        total_found = 0
        new_here = 0
        rejetes = 0                                                  # [FIX] rejets du filtre de tag

        for t in all_tasks:
            result_list = (t or {}).get("result") or []
            total_found += len(result_list)
            for info in result_list:
                if not isinstance(info, dict):
                    continue
                tid = info.get("id")
                tag = info.get("tag")
                if tag is None and isinstance(info.get("metadata"), dict):   # [FIX] tag parfois sous metadata
                    tag = info["metadata"].get("tag")
                ep  = info.get("endpoint_regular")
                dp  = info.get("date_posted") or ""
                # Fail-closed : une tâche dont on ne peut pas prouver qu'elle appartient au run
                # courant est ignorée. Avant, "if tag and tag != TAG" laissait passer les tâches
                # sans tag, donc celles des runs précédents.
                if tag != TAG:                                               # [FIX] fail-closed
                    rejetes += 1                                             # [FIX] rendre le rejet visible
                    continue
                try:
                    dp_dt = datetime.strptime(dp.replace(" +00:00",""), "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc) if dp else None
                except Exception:
                    dp_dt = None
                in_window = (dp_dt is None) or (window_start_utc <= dp_dt <= window_end_utc)
                if in_window and tid and (tid not in collected):
                    collected.add(tid)
                    new_here += 1
                    with open(TASK_IDS_CSV, "a", newline="", encoding="utf-8") as f:
                        w = csv.DictWriter(f, fieldnames=["id","endpoint_regular","date_posted","tag"])
                        w.writerow({"id": tid, "endpoint_regular": ep or "", "date_posted": dp, "tag": tag or ""})

        # [FIX] 'rejetés' = tâches d'un AUTRE run écartées par le filtre de tag. Un chiffre élevé
        #       avec +0 ID signifie que l'API ne renvoie pas le tag : voir l'avertissement final.
        print(f"[poll {polls}] result_items={total_found} | +{new_here} IDs | "
              f"rejetés (autre run)={rejetes} | total={len(collected)}/{target_task_count}")
        if len(collected) >= target_task_count:
            print("🟢 Tous les task_ids attendus ont été collectés. Fin du polling /tasks_ready.")
            break
        time.sleep(POLL_INTERVAL_SEC)

    return collected

def id_list_fallback(client, window_start_utc, window_end_utc, already_ids, target_task_count):
    def fmt(dt): return dt.strftime("%Y-%m-%d %H:%M:%S +00:00")
    start_s, end_s = fmt(window_start_utc), fmt(window_end_utc)
    limit = 1000
    offset = 0
    added = 0

    while True:
        payload = {}
        payload[len(payload)] = dict(
            datetime_from=start_s,
            datetime_to=end_s,
            limit=limit,
            offset=offset,
            sort="asc",
            include_metadata=True,
            se="google",
            se_type="organic"
        )
        resp = api_retry_post(client, "/v3/serp/id_list", payload)
        if not resp or resp.get("status_code") != 20000:
            print("[id_list] statut invalide, on arrête le fallback.")
            break
        result = (resp.get("tasks") or [{}])[0].get("result") or []
        if not result:
            break
        for row in result:
            # On teste la cible AVANT d'ajouter : sinon on ajoutait toujours un id de trop, et
            # comme sort="asc" sur une fenêtre de now-6h, cet id était le PLUS ANCIEN, donc une
            # tâche du run précédent.
            if len(already_ids) >= target_task_count:      # [FIX] test AVANT l'ajout
                print("🟢 id_list: quantité d'IDs atteinte, arrêt du fallback.")
                return already_ids
            tid = row.get("id")
            # Anti-contamination inter-run : ignorer les tâches d'un autre tag
            # (le fallback id_list récupère toute la fenêtre temporelle, sans filtre de tag).
            row_tag = row.get("tag")                        # [FIX] tag parfois sous metadata
            if row_tag is None and isinstance(row.get("metadata"), dict):
                row_tag = row["metadata"].get("tag")
            # Fail-closed : /v3/serp/id_list ne renvoie pas toujours 'tag' à la racine, donc
            # l'ancien test laissait passer TOUTES les lignes. Sans risque : les ids sont déjà
            # tous captés au POST, ce fallback n'est qu'un filet de sécurité qui ne doit ajouter
            # que ce qu'on peut attribuer à ce run.
            if row_tag != TAG:                              # [FIX] fail-closed
                continue
            if tid and tid not in already_ids:
                already_ids.add(tid)
                added += 1
                with open(TASK_IDS_CSV, "a", newline="", encoding="utf-8") as f:
                    w = csv.DictWriter(f, fieldnames=["id","endpoint_regular","date_posted","tag"])
                    w.writerow({
                        "id": tid,
                        "endpoint_regular": "",
                        "date_posted": row.get("datetime", ""),
                        "tag": row_tag or ""                # [FIX] tag résolu (racine ou metadata)
                    })
        if len(result) < limit:
            break
        offset += limit
    print(f"[id_list] IDs ajoutés via fallback : {added}")
    return already_ids

# ==========================
# ==== TASK_GET PARALLÈLE ==
# ==========================

def fetch_one_regular(client, task_id, vol_map, submitted_norm):
    endpoint = f"/v3/serp/google/organic/task_get/regular/{task_id}"
    res = api_retry_get(client, endpoint)
    rows = []
    if not res:
        return rows
    tasks = res.get("tasks") or []
    if not tasks:
        return rows
    r0 = (tasks[0].get("result") or [{}])[0]
    kw = r0.get("keyword")
    if not kw:                                     # [FIX] tâche pas encore prête : rien à signaler
        return rows
    norm = normalize_kw(kw)
    # Dernière ligne de défense : une tâche contaminante (autre run, autre marché) renvoie un
    # mot-clé qui n'a pas été envoyé par CE run. On la jette avant qu'elle ne pollue le CSV et
    # ne fasse déclencher le seuil d'arrêt à la place d'un mot-clé légitime.
    if norm not in submitted_norm:                 # [FIX] mot-clé étranger au run
        print(f"[WARN] Tâche ignorée : le mot-clé {kw!r} n'a pas été envoyé par ce run (task_id={task_id}).")
        return rows
    vol = vol_map.get(norm)
    items = r0.get("items") or []
    serp_features = r0.get("serp_features") or []
    feat_str = ", ".join([f.get("feature") for f in serp_features if isinstance(f, dict) and f.get("feature")])
    for it in items:
        if not isinstance(it, dict):
            continue
        rg = it.get("rank_group")
        try:
            if rg is not None and int(rg) > DEPTH:
                continue
        except Exception:
            pass
        rows.append({
            "task_id": task_id,
            "keyword": kw,
            "volume": vol,
            "position": it.get("rank_group",""),
            "rank_absolute": it.get("rank_absolute",""),
            "type": it.get("type",""),
            "title": it.get("title",""),
            "url": it.get("url",""),
            "domain": it.get("domain",""),
            "snippet": it.get("description",""),
            "serp_features": feat_str,
            "language_code": LANGUAGE_CODE,        # [FIX] traçabilité du marché
            "location_code": LOCATION_CODE,        # [FIX] traçabilité du marché
            "run_tag": TAG                         # [FIX] traçabilité du run
        })
    return rows

def collect_results_parallel_chunked(client, task_ids, vol_map, target_kw_count, submitted_norm, chunk_size=200):
    header = ["task_id","keyword","volume","position","rank_absolute","type","title","url","domain","snippet","serp_features",
              "language_code","location_code","run_tag"]   # [FIX] 3 colonnes de traçabilité
    with open(NEW_ROWS_CSV, "w", newline="", encoding="utf-8") as f:
        csv.DictWriter(f, fieldnames=header).writeheader()
    if not task_ids:
        print("[INFO] Aucun task_id à collecter.")
        return NEW_ROWS_CSV
    recovered_norm = set()
    total_rows = 0
    for start in range(0, len(task_ids), chunk_size):
        if len(recovered_norm) >= target_kw_count:
            print("🟢 Tous les mots-clés ont été récupérés. Arrêt de la collecte.")
            break
        ids_chunk = task_ids[start:start+chunk_size]
        print(f"[collect] chunk {start//chunk_size+1} → {len(ids_chunk)} ids | progress {len(recovered_norm)}/{target_kw_count}")
        stop_now = False
        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
            futures = [ex.submit(fetch_one_regular, client, tid, vol_map, submitted_norm) for tid in ids_chunk]
            for fut in as_completed(futures):
                rows = fut.result() or []
                if rows:
                    for r in rows:
                        kw_norm = normalize_kw(r.get("keyword") or "")
                        if kw_norm and kw_norm in submitted_norm:   # [FIX] ne compter que les mots-clés du run
                            recovered_norm.add(kw_norm)
                    with open(NEW_ROWS_CSV, "a", newline="", encoding="utf-8") as f:
                        w = csv.DictWriter(f, fieldnames=header)
                        for r in rows:
                            w.writerow(r)
                            total_rows += 1
                if len(recovered_norm) >= target_kw_count:
                    print("🟢 Seuil atteint pendant la tranche. Arrêt immédiat du pool.")
                    stop_now = True
                    ex.shutdown(cancel_futures=True)   # [FIX] annule les futures encore en attente
                    break
        if stop_now:
            break
    print(f"✅ Nouvelles lignes collectées : {total_rows} → {NEW_ROWS_CSV}")
    return NEW_ROWS_CSV

# ==========================
# ====== FUSION FINALE =====
# ==========================

def merge_into_output(new_rows_csv: str, output_csv: str):
    if not os.path.isfile(new_rows_csv):
        print("[INFO] Aucun nouveau fichier à fusionner.")
        return
    df_new = try_read_csv(new_rows_csv)
    if not os.path.isfile(output_csv):
        df_new.to_csv(output_csv, index=False, encoding="utf-8")
        print(f"✅ Créé : {output_csv}")
        return
    df_old = try_read_csv(output_csv)

    # Anti-mélange de marchés : OUTPUT_SERP porte un nom fixe. Sans ce garde-fou, un run FR se
    # concatène silencieusement à un export UK — drop_duplicates ne supprime rien puisque les
    # mots-clés des deux marchés ne se recoupent pas.
    def _norm_code(v):                                   # [FIX] "2826", "2826.0" et 2826 doivent matcher
        s = str(v).strip()
        return s[:-2] if s.endswith(".0") else s

    if ("language_code" in df_old.columns) or ("location_code" in df_old.columns):   # [FIX] contrôle de marché
        old_langs = set(df_old["language_code"].dropna().map(_norm_code)) if "language_code" in df_old.columns else set()
        old_locs  = set(df_old["location_code"].dropna().map(_norm_code)) if "location_code" in df_old.columns else set()
        if (old_langs and old_langs != {_norm_code(LANGUAGE_CODE)}) or \
           (old_locs and old_locs != {_norm_code(LOCATION_CODE)}):
            raise SystemExit(
                "[ERREUR] Mélange de marchés détecté : la fusion est annulée.\n"
                f"  Fichier existant : language_code={sorted(old_langs) or 'absent'} | "
                f"location_code={sorted(old_locs) or 'absent'}\n"
                f"  Run courant      : language_code=['{LANGUAGE_CODE}'] | location_code=['{LOCATION_CODE}']\n"
                f"  Archivez ou renommez le fichier existant avant de lancer un autre marché :\n"
                f"    {output_csv}\n"
                f"  Les résultats de ce run sont intacts dans : {new_rows_csv}"
            )
    else:
        print("[AVERTISSEMENT] Le fichier de sortie existant ne contient ni 'language_code' ni "  # [FIX]
              "'location_code' (export antérieur au correctif) : impossible de vérifier qu'il "
              "s'agit du même marché. Fusion effectuée quand même — vérifiez le résultat.")

    if CREATE_BACKUP:
        ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        shutil.copy2(output_csv, f"{output_csv}_backup_{ts}.csv")
    for col in set(df_old.columns).union(set(df_new.columns)):
        if col not in df_old.columns: df_old[col] = None
        if col not in df_new.columns: df_new[col] = None
    df_all = pd.concat([df_old[df_new.columns], df_new[df_new.columns]], ignore_index=True)
    dedup_cols = [c for c in ["keyword","type","url","rank_absolute"] if c in df_all.columns]
    df_all = df_all.drop_duplicates(subset=dedup_cols, keep="first")
    df_all.to_csv(output_csv, index=False, encoding="utf-8")
    print(f"✅ Fusion terminée : {output_csv}")

# ==========================
# ========== RUN ===========
# ==========================

if __name__ == "__main__":
    os.makedirs(BASE_DIR, exist_ok=True)
    client = RestClient(API_LOGIN, API_PASSWORD)

    # 1) Charger keywords + volumes
    keywords, vol_map = load_keywords_and_volume(KEYWORDS_FILE)
    print(f"[INFO] Keywords à envoyer: {len(keywords)} | PRIORITY={PRIORITY} | TAG={TAG}")

    # Fenêtre large (évite de rater des tasks à cause d'horodatages)
    now_utc = datetime.now(timezone.utc)
    run_start_utc = now_utc - timedelta(hours=6)
    run_end_utc   = now_utc + timedelta(hours=2)

    # 2) Envoi en batchs (+ capture éventuelle d'IDs dès le POST)
    total_sent, submitted_norm, post_ids = submit_tasks(client, keywords)
    if total_sent == 0:
        raise SystemExit("[ERREUR] Aucun mot-clé envoyé.")
    target_kw_count = len(submitted_norm)

    # 3) Poll /tasks_ready (en partant déjà des IDs récupérés au POST)
    ids = set(post_ids)
    ids = poll_tasks_ready_for_ids(client, run_start_utc, run_end_utc,
                                   target_task_count=target_kw_count,
                                   already_ids=ids)

    # 4) Fallback /v3/serp/id_list, uniquement si la cible n'est pas déjà atteinte
    if len(ids) < target_kw_count:                 # [FIX] inutile (et risqué) si on a déjà tous les IDs
        ids = id_list_fallback(client, run_start_utc, datetime.now(timezone.utc),
                               ids, target_task_count=target_kw_count)
    print(f"[INFO] Total task_ids collectés: {len(ids)}/{target_kw_count}")

    # 5) Collecte des résultats (task_get/regular) en parallèle, par tranches
    sorted_ids = sorted(list(ids))
    new_rows_csv = collect_results_parallel_chunked(client, sorted_ids, vol_map,
                                                    target_kw_count, submitted_norm,   # [FIX] mots-clés du run
                                                    chunk_size=CHUNK_SIZE)

    # 6) Fusion dans l'export final
    merge_into_output(new_rows_csv, OUTPUT_SERP)

    # [FIX] Contrôle de complétude : ne jamais laisser croire qu'un run partiel est complet.
    #       On compare les mots-clés réellement présents dans le CSV produit à ceux envoyés.
    try:
        _df_ctrl = try_read_csv(new_rows_csv)
        _recus = {normalize_kw(k) for k in _df_ctrl["keyword"].dropna().astype(str)}
    except Exception:
        _recus = set()
    _manquants = sorted(submitted_norm - _recus)
    _intrus = sorted(_recus - submitted_norm)
    print(f"[CONTRÔLE] mots-clés récupérés : {len(_recus)}/{target_kw_count} "
          f"| manquants : {len(_manquants)} | intrus : {len(_intrus)}")
    if _manquants:
        print("[ATTENTION] Mots-clés PAYÉS mais absents du fichier final "
              f"({len(_manquants)}) : {', '.join(_manquants[:15])}"
              f"{' ...' if len(_manquants) > 15 else ''}")
        print("            Les tâches sont déjà facturées : elles restent récupérables "
              "gratuitement via task_get sur les task_ids du fichier task_ids_*.csv.")
    if _intrus:
        print(f"[ATTENTION] Mots-clés ÉTRANGERS au run détectés ({len(_intrus)}) : "
              f"{', '.join(_intrus[:15])} — contamination inter-run, à retirer avant analyse.")

    print("✅ Pipeline terminé.")