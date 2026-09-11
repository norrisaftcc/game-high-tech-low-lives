#!/usr/bin/env python3
"""Builds cartridge.json for the M3 'Hard Land, Rising' arcade cartridge, and
injects the same JSON (byte-equal when parsed) into index.html's embedded
`var CARTRIDGE = ...;` block. Small, tables in.

Inputs:
  - m3-content.json (lead_notes, lead_intro, handler_intro, compel, os text)
  - ../../personas/personas.json (Handler lines per Lead/Handler pair)

Outputs:
  - cartridge.json
  - index.html, with its CARTRIDGE block replaced (engine/skin/HTML untouched)

Run: python3 gen_cartridge.py
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
CONTENT_PATH = "/tmp/claude-0/-home-user/2a418cc6-1aef-5c2b-b24c-5df1042d2567/scratchpad/m3-content.json"
PERSONAS_PATH = os.path.normpath(os.path.join(HERE, "..", "..", "personas", "personas.json"))
CARTRIDGE_JSON_PATH = os.path.join(HERE, "cartridge.json")
INDEX_HTML_PATH = os.path.join(HERE, "index.html")

LEADS = ["infiltrator", "influencer", "nomad", "fixer"]

TRANSFER_SENTENCE = (
    "Before finalizing your DataMan backlog, review whether any item is high value but "
    "not ready, depends on unresolved work, consumes disproportionate effort, or should "
    "move because it reduces risk or unlocks other work."
)

# Base item table, ported from arcade/spikes/hard-land-rising/index.html (ITEMS, ~L199-235).
BASE_ITEMS = [
    {"id": "pump-bypass", "k": 1, "title": "Pump bypass", "weight": 3, "value": "High",
     "dep": [], "risk": "Low", "ready": "Ready",
     "note": "Reroutes intake before the lower deck goes under. Nothing else here holds if this doesn’t."},
    {"id": "bulkhead-seal", "k": 2, "title": "Bulkhead seal", "weight": 2, "value": "High",
     "dep": ["pump-bypass"], "risk": "Low", "ready": "Ready",
     "note": "Confirms the reroute holds. Cheap once the bypass is in."},
    {"id": "crew-beacon-relay", "k": 3, "title": "Crew beacon relay", "weight": 3, "value": "High",
     "dep": ["pump-bypass"], "risk": "Medium", "ready": "Ready",
     "note": "Recalls crew who missed the first call to climb."},
    {"id": "ladder-release", "k": 4, "title": "Manual ladder release", "weight": 2, "value": "High",
     "dep": ["pump-bypass"], "risk": "Low", "ready": "Ready",
     "note": "Works with no chrome. Nobody has needed it yet."},
    {"id": "cargo-manifest-sync", "k": 5, "title": "Cargo manifest sync", "weight": 4, "value": "Medium",
     "dep": ["pump-bypass", "bulkhead-seal"], "risk": "Medium", "ready": "Ready",
     "note": "Tracks what’s still down there once the deck goes under."},
    {"id": "sponsor-stream-feed", "k": 6, "title": "Sponsor stream feed", "weight": 2, "value": "Low",
     "dep": [], "risk": "Low", "ready": "Ready",
     "note": "Meridian’s cameras. Good optics, no bearing on anyone’s survival."},
    {"id": "auto-route-advisory", "k": 7, "title": "Auto-route advisory", "weight": 5, "value": "Medium",
     "dep": [], "depNote": "a crew telemetry feed that doesn’t exist yet", "risk": "High", "ready": "Needs refinement",
     "note": "Routes crew by predicted risk. The predicting part still isn’t settled."},
    {"id": "medbay-uplink", "k": 8, "title": "Medbay uplink", "weight": 5, "value": "Medium",
     "dep": ["cargo-manifest-sync"], "risk": "Medium", "ready": "Needs refinement",
     "note": "Pipes vitals topside. Nobody’s agreed what Meridian gets to see."}
]

LEAD_TITLE = {"infiltrator": "Infiltrator", "influencer": "Influencer", "nomad": "Nomad", "fixer": "Fixer"}


def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def require_keys(d, keys, label):
    missing = [k for k in keys if k not in d]
    if missing:
        raise SystemExit("m3-content.json missing %s keys: %s (have: %s)" % (label, missing, list(d.keys())))


def build_pack_items(content):
    lead_notes = content["lead_notes"]
    items = []
    for base in BASE_ITEMS:
        item = dict(base)
        notes = lead_notes.get(item["id"], {})
        item["notes"] = {lead: notes.get(lead, "") for lead in LEADS}
        items.append(item)
    return items


def scenario_line(lead):
    return (
        "You are the %s, climbing a flooding Meridian Holdings platform shaft with "
        "everything you can carry before the water decides for you; your Handler is on "
        "comms, keeping count of what it costs." % LEAD_TITLE[lead]
    )


def build_scenes(content, os_text):
    scenes = {}

    scenes["welcome"] = {
        "messages": [{"speaker": "system", "text": os_text["wizard_1"]}],
        "choices": [{"id": "begin", "text": "Begin", "effects": {"next": "lead-pick"}}]
    }

    scenes["lead-pick"] = {
        "messages": [{"speaker": "system", "text": os_text["wizard_lead"]}],
        "choices": [
            {"id": "lead-" + lead, "text": LEAD_TITLE[lead],
             "effects": {"flags_set": ["lead-" + lead], "next": "handler-pick-" + lead}}
            for lead in LEADS
        ]
    }

    for lead in LEADS:
        handlers = [h for h in LEADS if h != lead]
        scenes["handler-pick-" + lead] = {
            "messages": [{"speaker": "system", "text": os_text["wizard_handler"]}],
            "choices": [
                {"id": "handler-" + h, "text": LEAD_TITLE[h],
                 "effects": {"flags_set": ["handler-" + h], "next": "brief-" + lead}}
                for h in handlers
            ]
        }

        scenes["brief-" + lead] = {
            "event": "begin",
            "messages": [
                {"speaker": "system", "text": os_text["brief"]},
                {"speaker": "handler", "text": content["handler_intro"][lead]},
                {"speaker": "lead", "text": content["lead_intro"][lead]},
                {"speaker": "data", "text": scenario_line(lead)}
            ],
            "choices": [{"id": "to-pack", "text": "Start the climb", "effects": {"next": "pack-1"}}]
        }

        compel_c = content["compel"][lead]
        scenes["compel-" + lead] = {
            "event": "core50",
            "compel": {
                "trouble": compel_c["trouble"],
                "offer": compel_c["offer"],
                "acceptText": compel_c["accept"],
                "refuseText": compel_c["refuse"],
                "accept": {"effects": {"flags_set": ["forced-sponsor"], "next": "pack-2"}},
                "refuse": {"effects": {"next": "pack-2"}}
            }
        }

    scenes["pack-1"] = {
        "pack": {
            "round": 1,
            "limit": 13,
            "required": [],
            "badges": False,
            "fields": [
                {"id": "r1reason", "label": os_text["field_r1_reason"]},
                {"id": "r1defer", "label": os_text["field_r1_defer"]}
            ],
            "submitLabel": "Climb",
            "confirm": os_text["confirm_climb"],
            "flags_set": ["slice-r1"],
            "next": "climbing-1"
        }
    }

    scenes["climbing-1"] = {
        "event": "stageClear",
        "messages": [{"speaker": "system", "text": os_text["progress_1"]}],
        "choices": [{"id": "continue", "text": "Continue", "effects": {"next": "complication"}}]
    }

    scenes["complication"] = {
        "complication": True,
        "event": "hull40",
        "messages": [{"speaker": "system", "text": os_text["complication"]}],
        "choices": [
            {"id": "continue-" + lead, "text": "Continue",
             "conditions": {"flags_set": ["lead-" + lead]},
             "effects": {"next": "compel-" + lead}}
            for lead in LEADS
        ]
    }

    scenes["pack-2"] = {
        "pack": {
            "round": 2,
            "limit": 10,
            "required": ["ladder-release"],
            "badges": True,
            "locked_if": {"forced-sponsor": "sponsor-stream-feed"},
            "fields": [
                {"id": "r2change", "label": os_text["field_r2_change"]},
                {"id": "r2tradeoff", "label": os_text["field_r2_tradeoff"]}
            ],
            "submitLabel": "Climb",
            "confirm": os_text["confirm_climb"],
            "flags_unset": ["slice-r1"],
            "flags_set": ["slice-r2"],
            "next": "climbing-2"
        }
    }

    scenes["climbing-2"] = {
        "messages": [{"speaker": "system", "text": os_text["progress_2"]}],
        "choices": [{"id": "continue", "text": "Continue", "effects": {"next": "top"}}]
    }

    scenes["top"] = {
        "event": "win",
        "messages": [{"speaker": "system", "text": os_text["top"]}],
        "choices": []
    }

    return scenes


def build_pairs(personas):
    out = {}
    for key, pair in personas["pairs"].items():
        entry = {"lead": pair["lead"], "handler": pair["handler"], "lines": pair["lines"]}
        if "swapped" in pair:
            entry["swapped"] = {"lead": pair["swapped"]["lead"], "handler": pair["swapped"]["handler"],
                                 "lines": pair["swapped"]["lines"]}
        out[key] = entry
    return out


def build_cartridge(content, personas):
    os_text = content["os"]
    return {
        "metadata": {
            "title": "Hard Land, Rising",
            "module": "M3",
            "version": "0.1",
            "transfer": TRANSFER_SENTENCE
        },
        "profile_default": "classroom",
        "personas": {"lead": None, "handler": None},
        "start_scene": "welcome",
        "character": {
            "stats": {"body": 0, "reflexes": 0, "cool": 0, "code": 0, "tech": 0},
            "stress": {
                "meat": {"max": 3, "current": 0},
                "nerves": {"max": 3, "current": 0},
                "systems": {"max": 3, "current": 0}
            },
            "fate_points": 1
        },
        "pack_items": build_pack_items(content),
        "pairs": build_pairs(personas),
        "scenes": build_scenes(content, os_text),
        "record": {
            "title": "M3 Product Owner Decision Record",
            "layout": "m3-product-owner"
        }
    }


def inject_into_html(cartridge_obj):
    with open(INDEX_HTML_PATH, "r", encoding="utf-8") as f:
        html = f.read()
    marker = "var CARTRIDGE = "
    start = html.find(marker)
    if start == -1:
        raise SystemExit("CARTRIDGE assignment not found in index.html")
    json_start = start + len(marker)
    end_marker = ";\n/* ===================== end CARTRIDGE"
    end = html.find(end_marker, json_start)
    if end == -1:
        raise SystemExit("end-of-CARTRIDGE marker not found in index.html")
    new_json_text = json.dumps(cartridge_obj, ensure_ascii=False, indent=2)
    new_html = html[:json_start] + new_json_text + html[end:]
    with open(INDEX_HTML_PATH, "w", encoding="utf-8") as f:
        f.write(new_html)


def main():
    content = load_json(CONTENT_PATH)
    require_keys(content, ["lead_notes", "lead_intro", "handler_intro", "compel", "os"], "top-level")
    require_keys(content["os"], [
        "wizard_1", "wizard_lead", "wizard_handler", "brief", "confirm_climb",
        "progress_1", "complication", "progress_2", "top",
        "field_r1_reason", "field_r1_defer", "field_r2_change", "field_r2_tradeoff"
    ], "os")
    for lead in LEADS:
        require_keys(content["lead_intro"], [lead], "lead_intro")
        require_keys(content["handler_intro"], [lead], "handler_intro")
        require_keys(content["compel"], [lead], "compel")
        require_keys(content["compel"][lead], ["trouble", "offer", "accept", "refuse"], "compel[%s]" % lead)

    personas = load_json(PERSONAS_PATH)

    cartridge = build_cartridge(content, personas)

    with open(CARTRIDGE_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(cartridge, f, ensure_ascii=False, indent=2)
        f.write("\n")

    inject_into_html(cartridge)

    print("Wrote %s" % CARTRIDGE_JSON_PATH)
    print("Injected CARTRIDGE into %s" % INDEX_HTML_PATH)
    print("Scenes: %d" % len(cartridge["scenes"]))


if __name__ == "__main__":
    main()
