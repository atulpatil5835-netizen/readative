import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ENV_FILE = ROOT / ".env.local"
RUNS_DIR = ROOT / "smarttalk_author_migration_runs"
AUTHOR_REPORT = ROOT / "author_migration_report.json"
FINAL_VALIDATION_REPORT = ROOT / "final_validation_report.json"
COLLECTION = "smarttalk"
TARGET_AUTHOR = "Readative Import"

AUTHOR_POOL = [
    "TechExplorer01",
    "TechExplorer02",
    "CodeSeeker01",
    "CodeSeeker02",
    "StartupMind01",
    "StartupMind02",
    "GrowthHacker01",
    "GrowthHacker02",
    "AIBuilder01",
    "AIBuilder02",
    "CloudPilot01",
    "CloudPilot02",
    "DataNerd01",
    "DataNerd02",
    "FutureCoder01",
    "FutureCoder02",
    "ProductHunter01",
    "ProductHunter02",
    "DigitalThinker01",
    "DigitalThinker02",
    "DevMaster01",
    "DevMaster02",
    "MarketGuru01",
    "MarketGuru02",
    "InnovationGeek01",
    "InnovationGeek02",
    "SmartInvestor01",
    "SmartInvestor02",
    "NextGenFounder01",
    "NextGenFounder02",
    "TechNomad01",
    "TechNomad02",
    "StartupScout01",
    "StartupScout02",
    "BusinessBrain01",
    "BusinessBrain02",
    "CodeWizard01",
    "CodeWizard02",
    "AICurious01",
    "AICurious02",
    "GrowthStrategist01",
    "GrowthStrategist02",
    "CloudArchitect01",
    "CloudArchitect02",
    "DataExplorer01",
    "DataExplorer02",
    "ProductCreator01",
    "ProductCreator02",
    "TechLearner01",
    "TechLearner02",
    "DeveloperHub01",
    "DeveloperHub02",
    "FutureBuilder01",
    "FutureBuilder02",
    "DigitalCreator01",
    "DigitalCreator02",
    "MarketExplorer01",
    "MarketExplorer02",
    "StartupBuilder01",
    "StartupBuilder02",
    "BusinessExplorer01",
    "BusinessExplorer02",
    "TechVisionary01",
    "TechVisionary02",
    "AIExplorer01",
    "AIExplorer02",
    "CloudEngineer01",
    "CloudEngineer02",
    "DataThinker01",
    "DataThinker02",
    "GrowthBuilder01",
    "GrowthBuilder02",
    "InnovationLeader01",
    "InnovationLeader02",
    "ProductExplorer01",
    "ProductExplorer02",
    "SmartCreator01",
    "SmartCreator02",
    "TechGuru01",
    "TechGuru02",
    "CodeMentor01",
    "CodeMentor02",
    "StartupLeader01",
    "StartupLeader02",
    "DigitalPioneer01",
    "DigitalPioneer02",
    "FutureExplorer01",
    "FutureExplorer02",
    "MarketAnalyst01",
    "MarketAnalyst02",
    "BusinessMentor01",
    "BusinessMentor02",
    "DeveloperMind01",
    "DeveloperMind02",
    "TechFounder01",
    "TechFounder02",
    "AIInnovator01",
    "AIInnovator02",
    "CloudThinker01",
    "CloudThinker02",
    "DataBuilder01",
    "DataBuilder02",
]


class MigrationError(Exception):
    pass


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def run_id() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def write_json(path: Path, payload: dict | list) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def read_env() -> dict[str, str]:
    values: dict[str, str] = {}
    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def scrub_api_key(value: str) -> str:
    return re.sub(r"key=[^&]+", "key=<redacted>", value)


def firestore_url(project_id: str, api_key: str, path: str, params: dict | None = None) -> str:
    query = {"key": api_key}
    if params:
        query.update(params)
    return (
        f"https://firestore.googleapis.com/v1/projects/{project_id}"
        f"/databases/(default)/documents/{path}?{urllib.parse.urlencode(query, doseq=True)}"
    )


def request_json(method: str, url: str, payload: dict | None = None) -> dict:
    data = None
    headers = {"Accept": "application/json"}
    if payload is not None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        headers["Content-Type"] = "application/json; charset=utf-8"

    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            body = response.read().decode("utf-8")
            return json.loads(body) if body else {}
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        try:
            detail = json.loads(body)
        except json.JSONDecodeError:
            detail = {"error": body}
        raise MigrationError(
            json.dumps(
                {
                    "method": method,
                    "url": scrub_api_key(url),
                    "status": error.code,
                    "detail": detail,
                },
                ensure_ascii=False,
            )
        ) from error


def fetch_collection(project_id: str, api_key: str) -> list[dict]:
    docs: list[dict] = []
    page_token = None
    while True:
        params: dict[str, str | int] = {"pageSize": 1000}
        if page_token:
            params["pageToken"] = page_token
        payload = request_json("GET", firestore_url(project_id, api_key, COLLECTION, params))
        docs.extend(payload.get("documents", []))
        page_token = payload.get("nextPageToken")
        if not page_token:
            return docs


def doc_id(document: dict) -> str:
    return str(document.get("name", "")).rstrip("/").split("/")[-1]


def decode_value(value: dict):
    if "stringValue" in value:
        return value["stringValue"]
    if "integerValue" in value:
        return int(value["integerValue"])
    if "doubleValue" in value:
        return value["doubleValue"]
    if "booleanValue" in value:
        return value["booleanValue"]
    if "timestampValue" in value:
        return value["timestampValue"]
    if "nullValue" in value:
        return None
    if "arrayValue" in value:
        return [decode_value(item) for item in value.get("arrayValue", {}).get("values", [])]
    if "mapValue" in value:
        return {
            key: decode_value(item)
            for key, item in value.get("mapValue", {}).get("fields", {}).items()
        }
    return value


def decode_document(document: dict) -> dict:
    fields = {
        key: decode_value(value)
        for key, value in document.get("fields", {}).items()
    }
    fields["id"] = doc_id(document)
    return fields


def update_author(project_id: str, api_key: str, question_id: str, author: str) -> None:
    url = firestore_url(
        project_id,
        api_key,
        f"{COLLECTION}/{urllib.parse.quote(question_id, safe='')}",
        {"updateMask.fieldPaths": "author", "currentDocument.exists": "true"},
    )
    request_json("PATCH", url, {"fields": {"author": {"stringValue": author}}})


def sort_import_doc(document: dict) -> tuple[int, str]:
    match = re.fullmatch(r"import_q(\d+)", document["id"])
    return (int(match.group(1)) if match else 10_000, document["id"])


def validate(
    before_docs: list[dict],
    after_docs: list[dict],
    migration_plan: list[dict],
) -> dict:
    before_by_id = {document["id"]: document for document in before_docs}
    after_by_id = {document["id"]: document for document in after_docs}
    answer_ids = []
    content_changes = []
    timestamp_changes = []
    answer_id_changes = []

    for item in migration_plan:
        before = before_by_id.get(item["questionId"])
        after = after_by_id.get(item["questionId"])
        if not before or not after:
            continue
        if before.get("content") != after.get("content"):
            content_changes.append(item["questionId"])
        if before.get("createdAt") != after.get("createdAt"):
            timestamp_changes.append(item["questionId"])
        before_answer_ids = [
            answer.get("id")
            for answer in before.get("answers") or []
            if isinstance(answer, dict)
        ]
        after_answer_ids = [
            answer.get("id")
            for answer in after.get("answers") or []
            if isinstance(answer, dict)
        ]
        if before_answer_ids != after_answer_ids:
            answer_id_changes.append(item["questionId"])

    for document in after_docs:
        for answer in document.get("answers") or []:
            if isinstance(answer, dict) and answer.get("id"):
                answer_ids.append(str(answer["id"]))

    migrated_author_mismatches = [
        {
            "questionId": item["questionId"],
            "expectedAuthor": item["newAuthor"],
            "actualAuthor": after_by_id.get(item["questionId"], {}).get("author"),
        }
        for item in migration_plan
        if after_by_id.get(item["questionId"], {}).get("author") != item["newAuthor"]
    ]
    remaining_target_author = [
        document["id"]
        for document in after_docs
        if document.get("author") == TARGET_AUTHOR and document["id"].startswith("import_q")
    ]
    duplicate_answer_ids = sorted(
        answer_id for answer_id, count in Counter(answer_ids).items() if count > 1
    )

    report = {
        "totalFirestoreDocsUnchanged": len(before_docs) == len(after_docs),
        "beforeDocCount": len(before_docs),
        "afterDocCount": len(after_docs),
        "authorNamesUpdated": len(migrated_author_mismatches) == 0,
        "migratedAuthorMismatches": migrated_author_mismatches,
        "remainingImportedReadativeImportAuthors": remaining_target_author,
        "noDuplicateQuestionIds": len(after_docs) == len(set(after_by_id)),
        "noDuplicateAnswerIds": len(duplicate_answer_ids) == 0,
        "duplicateAnswerIds": duplicate_answer_ids,
        "questionContentUnchanged": len(content_changes) == 0,
        "contentChanges": content_changes,
        "questionTimestampsUnchanged": len(timestamp_changes) == 0,
        "timestampChanges": timestamp_changes,
        "answerIdsUnchanged": len(answer_id_changes) == 0,
        "answerIdChanges": answer_id_changes,
    }
    report["passed"] = all(
        [
            report["totalFirestoreDocsUnchanged"],
            report["authorNamesUpdated"],
            len(report["remainingImportedReadativeImportAuthors"]) == 0,
            report["noDuplicateQuestionIds"],
            report["noDuplicateAnswerIds"],
            report["questionContentUnchanged"],
            report["questionTimestampsUnchanged"],
            report["answerIdsUnchanged"],
        ]
    )
    return report


def rollback(project_id: str, api_key: str, completed_updates: list[dict]) -> dict:
    restored = []
    failed = []
    for item in reversed(completed_updates):
        try:
            update_author(project_id, api_key, item["questionId"], item["oldAuthor"])
            restored.append(item["questionId"])
        except MigrationError as error:
            failed.append({"questionId": item["questionId"], "error": str(error)})
    return {
        "attempted": bool(completed_updates),
        "restoredQuestionIds": restored,
        "failed": failed,
        "status": "rolled_back" if not failed else "rollback_failed",
    }


def main() -> int:
    if len(AUTHOR_POOL) < 100:
        raise MigrationError(f"Expected at least 100 authors, found {len(AUTHOR_POOL)}")

    env = read_env()
    project_id = env.get("VITE_FIREBASE_PROJECT_ID")
    api_key = env.get("VITE_FIREBASE_API_KEY")
    if not project_id or not api_key:
        raise MigrationError("Missing VITE_FIREBASE_PROJECT_ID or VITE_FIREBASE_API_KEY")

    migration_id = run_id()
    run_dir = RUNS_DIR / migration_id
    run_dir.mkdir(parents=True, exist_ok=False)

    before_raw = fetch_collection(project_id, api_key)
    before_docs = [decode_document(document) for document in before_raw]
    write_json(run_dir / "rollback_snapshot.json", before_raw)

    targets = sorted(
        [
            document
            for document in before_docs
            if document.get("author") == TARGET_AUTHOR and document["id"].startswith("import_q")
        ],
        key=sort_import_doc,
    )
    if len(targets) != 100:
        report = {
            "runId": migration_id,
            "status": "stopped",
            "reason": f"Expected 100 imported target docs, found {len(targets)}",
            "targetCount": len(targets),
            "rollbackSnapshot": str(run_dir / "rollback_snapshot.json"),
        }
        write_json(AUTHOR_REPORT, report)
        write_json(run_dir / "author_migration_report.json", report)
        print(json.dumps(report, indent=2, ensure_ascii=False))
        return 1

    migration_plan = [
        {
            "questionId": document["id"],
            "oldAuthor": TARGET_AUTHOR,
            "newAuthor": AUTHOR_POOL[index],
        }
        for index, document in enumerate(targets)
    ]
    write_json(run_dir / "migration_plan.json", migration_plan)

    completed_updates = []
    rollback_status = {"attempted": False, "status": "not_needed"}

    try:
        for item in migration_plan:
            update_author(project_id, api_key, item["questionId"], item["newAuthor"])
            completed_updates.append(item)

        after_docs = [decode_document(document) for document in fetch_collection(project_id, api_key)]
        validation = validate(before_docs, after_docs, migration_plan)
        write_json(run_dir / "author_validation_report.json", validation)

        if not validation["passed"]:
            rollback_status = rollback(project_id, api_key, completed_updates)
            error_report = {
                "runId": migration_id,
                "status": "validation_failed",
                "rollbackStatus": rollback_status,
                "validation": validation,
            }
            write_json(run_dir / "error_report.json", error_report)
            write_json(AUTHOR_REPORT, error_report)
            write_json(FINAL_VALIDATION_REPORT, error_report)
            print(json.dumps(error_report, indent=2, ensure_ascii=False))
            return 1

        report = {
            "runId": migration_id,
            "status": "completed",
            "productionProject": project_id,
            "startedAt": migration_id,
            "completedAt": now_iso(),
            "rollbackSnapshot": str(run_dir / "rollback_snapshot.json"),
            "targetCondition": 'author == "Readative Import" and document id starts with "import_q"',
            "providedAuthorPoolCount": len(AUTHOR_POOL),
            "usedAuthorPoolCount": len(completed_updates),
            "updatedQuestionCount": len(completed_updates),
            "updatedField": "author",
            "changedQuestionIds": [item["questionId"] for item in completed_updates],
            "authorAssignments": migration_plan,
            "rollbackStatus": rollback_status,
            "validation": validation,
        }
        write_json(AUTHOR_REPORT, report)
        write_json(run_dir / "author_migration_report.json", report)
        print(json.dumps(report, indent=2, ensure_ascii=False))
        return 0
    except Exception as error:
        rollback_status = rollback(project_id, api_key, completed_updates)
        error_report = {
            "runId": migration_id,
            "status": "error",
            "error": str(error),
            "completedUpdateCountBeforeFailure": len(completed_updates),
            "rollbackStatus": rollback_status,
        }
        write_json(run_dir / "error_report.json", error_report)
        write_json(AUTHOR_REPORT, error_report)
        print(json.dumps(error_report, indent=2, ensure_ascii=False), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
