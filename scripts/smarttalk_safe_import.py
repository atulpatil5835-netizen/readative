import csv
import hashlib
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE_CSV = ROOT / "cleaned_import.csv"
RUNS_DIR = ROOT / "smarttalk_import_runs"
CHECKPOINT_FILE = ROOT / "smarttalk_import_checkpoint.json"
ENV_FILE = ROOT / ".env.local"

SOURCE_LIMIT = 100
CHECKPOINT_EVERY = 20
COLLECTION = "smarttalk"
IMPORT_AUTHOR = "Readative Import"
IMPORT_AUTHOR_ID = "readative-import"

CATEGORY_BY_TOPIC = {
    "AI": "ai",
    "Productivity Tools": "productivity",
    "Software/Coding": "development",
    "Cybersecurity/Privacy": "cybersecurity",
    "Hardware/Gifts": "technology",
    "UX/UI Design": "technology",
}


class ImportErrorReport(Exception):
    pass


def utc_slug() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def read_env() -> dict[str, str]:
    values: dict[str, str] = {}
    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def source_hash() -> str:
    return hashlib.sha256(SOURCE_CSV.read_bytes()).hexdigest()


def read_source_questions() -> list[dict]:
    grouped: dict[str, dict] = {}
    order: list[str] = []

    with SOURCE_CSV.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        required = {
            "questionId",
            "topic",
            "question",
            "answerCount",
            "answerId",
            "author",
            "answerText",
        }
        missing = required.difference(reader.fieldnames or [])
        if missing:
            raise ImportErrorReport(f"cleaned_import.csv is missing columns: {sorted(missing)}")

        for line_number, row in enumerate(reader, start=2):
            question_id = row["questionId"].strip()
            question = row["question"]
            topic = row["topic"]

            if not question_id or not question.strip():
                continue

            if question_id not in grouped:
                if len(order) >= SOURCE_LIMIT:
                    continue
                order.append(question_id)
                grouped[question_id] = {
                    "questionId": question_id,
                    "topic": topic,
                    "question": question,
                    "sourceLines": [],
                    "answers": [],
                }

            if question_id not in grouped:
                continue

            item = grouped[question_id]
            if item["question"] != question:
                raise ImportErrorReport(
                    f"questionId {question_id} maps to multiple question texts in cleaned_import.csv"
                )
            item["sourceLines"].append(line_number)

            answer_text = row["answerText"]
            answer_id = row["answerId"].strip()
            if not answer_text.strip():
                continue
            if not answer_id:
                raise ImportErrorReport(
                    f"questionId {question_id} has non-empty answer text with empty answerId at line {line_number}"
                )
            item["answers"].append(
                {
                    "id": answer_id,
                    "author": row["author"],
                    "content": answer_text,
                    "sourceLine": line_number,
                }
            )

    return [grouped[question_id] for question_id in order]


def firestore_url(project_id: str, api_key: str, path: str, params: dict | None = None) -> str:
    query = {"key": api_key}
    if params:
        query.update(params)
    return (
        f"https://firestore.googleapis.com/v1/projects/{project_id}"
        f"/databases/(default)/documents/{path}?{urllib.parse.urlencode(query, doseq=True)}"
    )


def request_json(
    method: str,
    url: str,
    payload: dict | None = None,
    timeout: int = 30,
) -> dict:
    data = None
    headers = {"Accept": "application/json"}
    if payload is not None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        headers["Content-Type"] = "application/json; charset=utf-8"

    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            body = response.read().decode("utf-8")
            return json.loads(body) if body else {}
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        try:
            detail = json.loads(body)
        except json.JSONDecodeError:
            detail = {"error": body}
        raise ImportErrorReport(
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


def scrub_api_key(value: str) -> str:
    return re.sub(r"key=[^&]+", "key=<redacted>", value)


def fetch_collection(project_id: str, api_key: str) -> list[dict]:
    docs: list[dict] = []
    page_token = None
    while True:
        params: dict[str, str | int] = {"pageSize": 1000}
        if page_token:
            params["pageToken"] = page_token
        url = firestore_url(project_id, api_key, COLLECTION, params)
        payload = request_json("GET", url)
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


def value_to_firestore(value):
    if value is None:
        return {"nullValue": None}
    if isinstance(value, bool):
        return {"booleanValue": value}
    if isinstance(value, int):
        return {"integerValue": str(value)}
    if isinstance(value, float):
        return {"doubleValue": value}
    if isinstance(value, list):
        if not value:
            return {"arrayValue": {}}
        return {"arrayValue": {"values": [value_to_firestore(item) for item in value]}}
    if isinstance(value, dict):
        return {
            "mapValue": {
                "fields": {
                    key: value_to_firestore(item)
                    for key, item in value.items()
                    if item is not None
                }
            }
        }
    return {"stringValue": str(value)}


def timestamp_value(dt: datetime) -> dict:
    return {"timestampValue": dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")}


def build_question_document(question: dict, index: int, run_id: str) -> dict:
    created_at = datetime.now(timezone.utc)
    category = CATEGORY_BY_TOPIC.get(question["topic"], "technology")
    answers = []
    base_answer_time = int(time.time() * 1000) + index * 1000

    for answer_index, answer in enumerate(question["answers"]):
        answers.append(
            {
                "id": answer["id"],
                "author": answer["author"],
                "authorId": "",
                "content": answer["content"],
                "likes": [],
                "dislikes": [],
                "helpfulIds": [],
                "helpfulCount": 0,
                "misleadingIds": [],
                "misleadingCount": 0,
                "createdAt": base_answer_time + answer_index,
            }
        )

    fields = {
        "author": value_to_firestore(IMPORT_AUTHOR),
        "authorId": value_to_firestore(IMPORT_AUTHOR_ID),
        "content": value_to_firestore(question["question"]),
        "answers": value_to_firestore(answers),
        "savedBy": value_to_firestore([]),
        "saveCount": value_to_firestore(0),
        "category": value_to_firestore(category),
        "sourceTopic": value_to_firestore(question["topic"]),
        "importSource": value_to_firestore(
            {
                "source": "cleaned_import.csv",
                "runId": run_id,
                "questionId": question["questionId"],
                "answerCount": len(answers),
            }
        ),
        "createdAt": timestamp_value(created_at),
    }
    return {"fields": fields}


def write_json(path: Path, payload: dict | list) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def save_checkpoint(run_dir: Path, payload: dict, imported_count: int) -> None:
    checkpoint = {
        **payload,
        "lastSuccessfulImportedQuestionCount": imported_count,
        "updatedAt": datetime.now(timezone.utc).isoformat(),
    }
    write_json(run_dir / "checkpoints" / f"checkpoint_{imported_count:03d}.json", checkpoint)
    write_json(CHECKPOINT_FILE, checkpoint)


def create_doc(project_id: str, api_key: str, question_id: str, document: dict) -> None:
    url = firestore_url(
        project_id,
        api_key,
        f"{COLLECTION}/{urllib.parse.quote(question_id, safe='')}",
        {"currentDocument.exists": "false"},
    )
    request_json("PATCH", url, document)


def delete_doc(project_id: str, api_key: str, question_id: str) -> None:
    url = firestore_url(
        project_id,
        api_key,
        f"{COLLECTION}/{urllib.parse.quote(question_id, safe='')}",
        {"currentDocument.exists": "true"},
    )
    request_json("DELETE", url)


def validate_state(
    source_questions: list[dict],
    decoded_docs: list[dict],
    imported_question_ids: set[str],
) -> dict:
    doc_ids = [item["id"] for item in decoded_docs]
    doc_by_id = {item["id"]: item for item in decoded_docs}
    source_answer_ids = {
        answer["id"]
        for question in source_questions
        for answer in question["answers"]
    }

    all_answer_ids = []
    missing_imported_docs = []
    imported_answer_count = 0
    orphan_answer_issues = []
    content_mismatches = []

    for doc in decoded_docs:
        for answer in doc.get("answers") or []:
            if not isinstance(answer, dict):
                orphan_answer_issues.append({"questionId": doc["id"], "issue": "answer is not an object"})
                continue
            answer_id = answer.get("id")
            if answer_id:
                all_answer_ids.append(str(answer_id))
            if not answer_id or not answer.get("content"):
                orphan_answer_issues.append(
                    {
                        "questionId": doc["id"],
                        "answerId": answer_id or "",
                        "issue": "answer missing id or content",
                    }
                )

    for question in source_questions:
        question_id = question["questionId"]
        doc = doc_by_id.get(question_id)
        if not doc:
            missing_imported_docs.append(question_id)
            continue
        if doc.get("content") != question["question"]:
            content_mismatches.append(question_id)
        answer_ids = {
            str(answer.get("id"))
            for answer in (doc.get("answers") or [])
            if isinstance(answer, dict) and answer.get("id")
        }
        expected_answer_ids = {answer["id"] for answer in question["answers"]}
        if answer_ids != expected_answer_ids:
            orphan_answer_issues.append(
                {
                    "questionId": question_id,
                    "issue": "imported answer IDs do not match source",
                    "expected": sorted(expected_answer_ids),
                    "actual": sorted(answer_ids),
                }
            )
        imported_answer_count += len(answer_ids.intersection(source_answer_ids))

    duplicate_question_ids = sorted(
        question_id for question_id, count in Counter(doc_ids).items() if count > 1
    )
    duplicate_answer_ids = sorted(
        answer_id for answer_id, count in Counter(all_answer_ids).items() if count > 1
    )

    import_load_sample = [
        {
            "id": doc["id"],
            "content": doc.get("content", ""),
            "answerCount": len(doc.get("answers") or []),
        }
        for doc in decoded_docs
        if doc["id"] in imported_question_ids
    ][:5]

    search_terms = ["python", "password", "chatgpt", "mouse"]
    search_checks = {
        term: any(
            term in " ".join(
                [
                    str(doc.get("content", "")),
                    *[
                        str(answer.get("content", ""))
                        for answer in (doc.get("answers") or [])
                        if isinstance(answer, dict)
                    ],
                ]
            ).lower()
            for doc in decoded_docs
        )
        for term in search_terms
    }

    top_question_candidates = sorted(
        [
            {
                "id": doc["id"],
                "answerCount": len(doc.get("answers") or []),
                "content": str(doc.get("content", "")),
            }
            for doc in decoded_docs
        ],
        key=lambda item: item["answerCount"],
        reverse=True,
    )[:10]

    imported_question_count = sum(1 for question in source_questions if question["questionId"] in doc_by_id)
    expected_answer_count = sum(len(question["answers"]) for question in source_questions)

    validation = {
        "smartTalkLoadsReadCheck": len(decoded_docs) > 0 and len(import_load_sample) > 0,
        "exploreTopQuestionsReadCheck": len(top_question_candidates) > 0,
        "searchReadCheck": all(search_checks.values()),
        "noDuplicateQuestionIds": len(duplicate_question_ids) == 0,
        "duplicateQuestionIds": duplicate_question_ids,
        "noDuplicateAnswerIds": len(duplicate_answer_ids) == 0,
        "duplicateAnswerIds": duplicate_answer_ids,
        "noOrphanAnswers": len(orphan_answer_issues) == 0,
        "orphanAnswerIssues": orphan_answer_issues[:20],
        "importedQuestionCountMatchesSource": imported_question_count == SOURCE_LIMIT,
        "importedQuestionCount": imported_question_count,
        "expectedQuestionCount": SOURCE_LIMIT,
        "importedAnswerCountMatchesSource": imported_answer_count == expected_answer_count,
        "importedAnswerCount": imported_answer_count,
        "expectedAnswerCount": expected_answer_count,
        "missingImportedDocs": missing_imported_docs,
        "contentMismatches": content_mismatches,
        "searchChecks": search_checks,
        "topQuestionCandidates": top_question_candidates,
        "smartTalkSample": import_load_sample,
    }
    validation["passed"] = all(
        [
            validation["smartTalkLoadsReadCheck"],
            validation["exploreTopQuestionsReadCheck"],
            validation["searchReadCheck"],
            validation["noDuplicateQuestionIds"],
            validation["noDuplicateAnswerIds"],
            validation["noOrphanAnswers"],
            validation["importedQuestionCountMatchesSource"],
            validation["importedAnswerCountMatchesSource"],
            len(validation["contentMismatches"]) == 0,
        ]
    )
    return validation


def rollback_created_docs(project_id: str, api_key: str, created_question_ids: list[str]) -> dict:
    deleted = []
    failed = []
    for question_id in reversed(created_question_ids):
        try:
            delete_doc(project_id, api_key, question_id)
            deleted.append(question_id)
        except ImportErrorReport as error:
            failed.append({"questionId": question_id, "error": str(error)})
    return {
        "attempted": bool(created_question_ids),
        "deletedQuestionIds": deleted,
        "failed": failed,
        "status": "rolled_back" if not failed else "rollback_failed",
    }


def main() -> int:
    run_id = utc_slug()
    run_dir = RUNS_DIR / run_id
    run_dir.mkdir(parents=True, exist_ok=False)

    env = read_env()
    project_id = env.get("VITE_FIREBASE_PROJECT_ID")
    api_key = env.get("VITE_FIREBASE_API_KEY")
    if not project_id or not api_key:
        raise ImportErrorReport("Missing VITE_FIREBASE_PROJECT_ID or VITE_FIREBASE_API_KEY")

    source_questions = read_source_questions()
    if len(source_questions) != SOURCE_LIMIT:
        raise ImportErrorReport(
            f"Expected {SOURCE_LIMIT} source questions, found {len(source_questions)}"
        )

    answer_ids = [
        answer["id"]
        for question in source_questions
        for answer in question["answers"]
    ]
    if len(answer_ids) != len(set(answer_ids)):
        raise ImportErrorReport("cleaned_import.csv contains duplicate generated answer IDs")

    source = {
        "sourceFile": str(SOURCE_CSV),
        "sourceHash": source_hash(),
        "selectedQuestionCount": len(source_questions),
        "selectedAnswerCount": len(answer_ids),
        "questionIds": [question["questionId"] for question in source_questions],
    }
    write_json(run_dir / "source_manifest.json", source)

    production_before_raw = fetch_collection(project_id, api_key)
    production_before = [decode_document(item) for item in production_before_raw]
    write_json(run_dir / "pre_import_snapshot.json", production_before_raw)
    write_json(run_dir / "rollback_snapshot.json", production_before_raw)

    existing_ids = {item["id"] for item in production_before}
    existing_answer_ids = {
        str(answer.get("id"))
        for item in production_before
        for answer in (item.get("answers") or [])
        if isinstance(answer, dict) and answer.get("id")
    }
    source_question_ids = {question["questionId"] for question in source_questions}
    source_answer_ids = set(answer_ids)
    conflicts = {
        "questionIdConflicts": sorted(source_question_ids.intersection(existing_ids)),
        "answerIdConflicts": sorted(source_answer_ids.intersection(existing_answer_ids)),
        "skippedQuestions": [],
    }
    write_json(run_dir / "conflicts_pre_import.json", conflicts)

    created_question_ids: list[str] = []
    imported_answer_count = 0
    skipped_records = []
    rollback_status = {
        "preImportSnapshotCreated": True,
        "rollbackSnapshotCreated": True,
        "rollbackAttempted": False,
        "status": "not_needed",
    }

    checkpoint_base = {
        "runId": run_id,
        "runDir": str(run_dir),
        "sourceHash": source["sourceHash"],
        "sourceFile": str(SOURCE_CSV),
        "checkpointEvery": CHECKPOINT_EVERY,
    }

    try:
        for index, question in enumerate(source_questions, start=1):
            if question["questionId"] in existing_ids:
                skipped_records.append(
                    {
                        "questionId": question["questionId"],
                        "reason": "questionId already exists in production",
                    }
                )
                continue

            answer_conflicts = [
                answer["id"]
                for answer in question["answers"]
                if answer["id"] in existing_answer_ids
            ]
            if answer_conflicts:
                skipped_records.append(
                    {
                        "questionId": question["questionId"],
                        "reason": "one or more answer IDs already exist in production",
                        "answerIds": answer_conflicts,
                    }
                )
                continue

            document = build_question_document(question, index, run_id)
            create_doc(project_id, api_key, question["questionId"], document)
            created_question_ids.append(question["questionId"])
            imported_answer_count += len(question["answers"])
            existing_ids.add(question["questionId"])
            existing_answer_ids.update(answer["id"] for answer in question["answers"])

            if len(created_question_ids) % CHECKPOINT_EVERY == 0:
                save_checkpoint(
                    run_dir,
                    {
                        **checkpoint_base,
                        "createdQuestionIds": created_question_ids,
                        "importedAnswerCount": imported_answer_count,
                        "skippedRecords": skipped_records,
                        "complete": False,
                    },
                    len(created_question_ids),
                )

        production_after = [decode_document(item) for item in fetch_collection(project_id, api_key)]
        write_json(run_dir / "post_import_snapshot.json", production_after)
        validation = validate_state(source_questions, production_after, set(created_question_ids))
        write_json(run_dir / "validation_report.json", validation)

        if not validation["passed"]:
            rollback_result = rollback_created_docs(project_id, api_key, created_question_ids)
            rollback_status = {
                "preImportSnapshotCreated": True,
                "rollbackSnapshotCreated": True,
                "rollbackAttempted": True,
                **rollback_result,
            }
            error_report = {
                "error": "Validation failed after import",
                "validation": validation,
                "rollbackStatus": rollback_status,
            }
            write_json(run_dir / "error_report.json", error_report)
            raise ImportErrorReport("Validation failed after import; rollback attempted.")

        save_checkpoint(
            run_dir,
            {
                **checkpoint_base,
                "createdQuestionIds": created_question_ids,
                "importedAnswerCount": imported_answer_count,
                "skippedRecords": skipped_records,
                "complete": True,
            },
            len(created_question_ids),
        )

        summary = {
            "runId": run_id,
            "runDir": str(run_dir),
            "productionProject": project_id,
            "preImportSnapshot": str(run_dir / "pre_import_snapshot.json"),
            "rollbackSnapshot": str(run_dir / "rollback_snapshot.json"),
            "importedQuestionsCount": len(created_question_ids),
            "importedAnswersCount": imported_answer_count,
            "skippedRecords": skipped_records,
            "validationReport": validation,
            "rollbackStatus": rollback_status,
            "remainingQuestionsNotYetImported": [
                question["questionId"]
                for question in source_questions
                if question["questionId"] not in set(created_question_ids)
                and question["questionId"] not in {item.get("questionId") for item in skipped_records}
            ],
        }
        write_json(run_dir / "import_summary.json", summary)
        print(json.dumps(summary, indent=2, ensure_ascii=False))
        return 0
    except Exception as error:
        if not isinstance(error, ImportErrorReport):
            error = ImportErrorReport(str(error))
        error_report = {
            "runId": run_id,
            "runDir": str(run_dir),
            "error": str(error),
            "createdQuestionIds": created_question_ids,
            "importedAnswerCountBeforeFailure": imported_answer_count,
            "skippedRecords": skipped_records,
            "rollbackStatus": rollback_status,
        }
        write_json(run_dir / "error_report.json", error_report)
        print(json.dumps(error_report, indent=2, ensure_ascii=False), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
