import time
import pandas as pd
from tqdm import tqdm
from client import RestClient

###
# - Récupération de la liste de mots-clés + volumes associés
# - Séparation en batches de 100 mots-clés + volumes (pourquoi 100 ?)
# - On appelle /v3/serp/google/organic/task_post qui retourne une liste de task_id
# - On récupère les résultats des tâches créées avec du long polling sur /v3/serp/google/organic/tasks_ready
# -
###

API_LOGIN = ""
API_PASSWORD = ""
client = RestClient(API_LOGIN, API_PASSWORD)

INPUT_FILE = "keywords.csv"
BATCH_SIZE = 100
LANGUAGE = "fr"
LOCATION = 2250  # France
DEVICE = "desktop"
DEPTH = 5  # Nombre de résultats Google (max. 10 maintenant)

# Lecture du fichier mots-clés
df = pd.read_csv(INPUT_FILE)
print("Colonnes lues :", df.columns.tolist())
if "keyword" not in df.columns:
    raise ValueError("Colonne 'keyword' manquante dans le fichier d'entrée.")

keywords = df["keyword"].astype(str).tolist()
volumes = df["volume"].tolist() if "volume" in df.columns else [None] * len(keywords)

task_id_to_keyword = {}
all_results = []

for i in tqdm(range(0, len(keywords), BATCH_SIZE), desc="Création des batches"):
    batch_keywords = keywords[i : i + BATCH_SIZE]
    batch_volumes = volumes[i : i + BATCH_SIZE]
    post_data = {}
    for j, kw in enumerate(batch_keywords):
        d = dict(
            language_code=LANGUAGE,
            location_code=LOCATION,
            keyword=kw,
            device=DEVICE,
            depth=DEPTH,
        )
        post_data[j] = d
    print(f"\nBatch {i // BATCH_SIZE + 1} : Payload envoyé =>", post_data)
    response = client.post("/v3/serp/google/organic/task_post", post_data)
    print("Réponse brute :", response)
    if response.get("status_code", 0) != 20000:
        print("Erreur API lors de la création du batch :", response)
        continue
    for idx, task in enumerate(response.get("tasks", [])):
        if "id" in task and task.get("status_code", 0) == 20100:
            task_id_to_keyword[task["id"]] = {
                "keyword": batch_keywords[idx],
                "volume": batch_volumes[idx],
            }

print(
    f"Tâches créées ({len(task_id_to_keyword)} au total). Attente initiale de 90s pour génération SERP..."
)

# Pourquoi 1min30 ?
time.sleep(90)

collected = set()
max_attempts = 40
attempts = 0

pbar = tqdm(total=len(task_id_to_keyword), desc="Collecte SERP")
while len(collected) < len(task_id_to_keyword) and attempts < max_attempts:
    attempts += 1
    resp_ready = client.get("/v3/serp/google/organic/tasks_ready")
    if resp_ready.get("status_code", 0) != 20000:
        print("Erreur API lors de /tasks_ready :", resp_ready)
        time.sleep(15)
        continue
    for task in resp_ready.get("tasks", []):
        for resultTaskInfo in task.get("result", []):
            id_ = resultTaskInfo.get("id")
            if id_ in task_id_to_keyword and id_ not in collected:
                meta = task_id_to_keyword[id_]

                # On a deux façons différentes de récupérer les résultats ?
                if resultTaskInfo.get("endpoint_regular"):
                    res = client.get(resultTaskInfo["endpoint_regular"])
                elif resultTaskInfo.get("id"):
                    reg_id = resultTaskInfo["id"]
                    res = client.get(
                        f"/v3/serp/google/organic/task_get/regular/{reg_id}"
                    )
                else:
                    continue  # Qu'est-ce que signifie ce cas ?

                if res.get("tasks") and res["tasks"][0].get("result"):
                    r = res["tasks"][0]["result"][0]
                    items = r.get("items", [])
                    features = r.get("serp_features", [])
                    for item in items:
                        # C'est là qu'il y a la data qui nous intéresse
                        all_results.append(
                            {
                                "keyword": meta["keyword"],
                                "volume": meta["volume"],
                                "position": item.get("rank_group", ""),
                                "domain": item.get("domain", ""),
                                "url": item.get("url", ""),
                                "type": item.get("type", ""),
                                "title": item.get("title", ""),
                                "serp_features": ", ".join(
                                    [f.get("feature") for f in features]
                                )
                                if features
                                else "",
                                "snippet": item.get("description", ""),
                            }
                        )
                    collected.add(id_)
                    pbar.update(1)
    if len(collected) < len(task_id_to_keyword):
        time.sleep(15)
pbar.close()

if all_results:
    pd.DataFrame(all_results).to_csv(
        "serps_resultats.csv", index=False, encoding="utf-8"
    )
    print("\n✅ Export terminé : serps_resultats.csv")
else:
    print("Aucun résultat collecté.")
