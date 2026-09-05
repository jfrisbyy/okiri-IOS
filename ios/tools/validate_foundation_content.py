#!/usr/bin/env python3
"""Validate a FoundationContent v2 file or fragment.
Usage: python3 ios/tools/validate_foundation_content.py ios/FluentFrenchIOS/Resources/FoundationContent.json --full
Exit 0 when valid; prints one line per problem otherwise.
--full additionally requires every taxonomy concept to be present with teaching + 3 probes.
"""
import json, re, sys, unicodedata
import os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'FluentFrenchIOS'))
TAX = os.path.join(ROOT, 'Models', 'ConceptTaxonomy.swift')
def taxonomy():
    src = open(TAX, encoding='utf-8').read()
    out = {}
    for m in re.finditer(r'c\("([a-z0-9-]+)",\s*"[^"]*",\s*\.(\w+),\s*\.(A1|A2|B1|B2|C1|C2)', src):
        out[m.group(1)] = (m.group(2), m.group(3))
    return out
def norm(s): return unicodedata.normalize('NFC', s).strip().lower()
def main():
    path = sys.argv[1]; full = '--full' in sys.argv
    tax = taxonomy(); errs = []
    try:
        d = json.load(open(path, encoding='utf-8'))
    except Exception as e:
        print(f'PARSE ERROR: {e}'); sys.exit(1)
    if d.get('version') != 2: errs.append('version must be 2')
    skills = d.get('skills', [])
    seen_ids = set(); fr_seen = {}
    for s in skills:
        sid = s.get('id', '?')
        if sid in seen_ids: errs.append(f'{sid}: duplicate skill block')
        seen_ids.add(sid)
        if sid not in tax: errs.append(f'{sid}: not in ConceptTaxonomy'); continue
        cat, lvl = tax[sid]
        if s.get('category') != cat: errs.append(f'{sid}: category {s.get("category")} != taxonomy {cat}')
        t = s.get('teaching')
        if not isinstance(t, dict): errs.append(f'{sid}: missing teaching')
        else:
            if len(t.get('rule', '')) < 60: errs.append(f'{sid}: teaching.rule too short (<60 chars)')
            ex = t.get('examples', [])
            if len(ex) < 2: errs.append(f'{sid}: teaching.examples needs >=2')
            for i, e in enumerate(ex):
                for k in ('fr', 'en', 'note'):
                    if not e.get(k): errs.append(f'{sid}: teaching.examples[{i}].{k} empty')
            if len(t.get('contrast', [])) < 1: errs.append(f'{sid}: teaching.contrast needs >=1')
            for i, e in enumerate(t.get('contrast', [])):
                for k in ('fr', 'en', 'note'):
                    if not e.get(k): errs.append(f'{sid}: teaching.contrast[{i}].{k} empty')
            if not t.get('commonMistake'): errs.append(f'{sid}: teaching.commonMistake empty')
        probes = s.get('probes', [])
        if len(probes) != 3: errs.append(f'{sid}: needs exactly 3 probes (has {len(probes)})')
        for i, p in enumerate(probes):
            for k in ('fr', 'en', 'ex', 'exEn'):
                if not p.get(k): errs.append(f'{sid}: probes[{i}].{k} empty')
            opts = p.get('options', [])
            if len(opts) != 3 or len({norm(o) for o in opts}) != 3: errs.append(f'{sid}: probes[{i}] needs 3 distinct options')
            if any(norm(o) == norm(p.get('en', '')) for o in opts): errs.append(f'{sid}: probes[{i}] option equals the answer')
        items = s.get('items', [])
        if len(items) < 10: errs.append(f'{sid}: needs >=10 items (has {len(items)})')
        en_seen = {}
        for i, it in enumerate(items):
            e = norm(it.get('en', ''))
            if e in en_seen: errs.append(f'{sid}: items[{i}] en "{it.get("en")}" duplicates items[{en_seen[e]}] (MC distractor clash)')
            else: en_seen[e] = i
        for i, it in enumerate(items):
            for k in ('fr', 'en', 'note', 'ex', 'exEn', 'blank'):
                if not it.get(k): errs.append(f'{sid}: items[{i}].{k} empty')
            if it.get('diff') not in (None, 'hard', 'okay', 'easy'): errs.append(f'{sid}: items[{i}].diff invalid')
            testable = it.get('testable', True)
            if not isinstance(testable, bool): errs.append(f'{sid}: items[{i}].testable must be bool')
            blank = it.get('blank', ''); ex = it.get('ex', '')
            if blank and ex and blank not in ex: errs.append(f'{sid}: items[{i}] blank "{blank}" not found verbatim in ex "{ex}"')
            if blank and ex and testable:
                if not re.search(r'(?<![\w\'’])' + re.escape(blank) + r'(?![\w])', ex):
                    errs.append(f'{sid}: items[{i}] blank "{blank}" is not a whole word in ex "{ex}"')
                elif len(re.findall(r'(?<![\w\'’])' + re.escape(blank) + r'(?![\w])', ex)) > 1:
                    errs.append(f'{sid}: items[{i}] blank "{blank}" occurs more than once in ex "{ex}"')
            alts = it.get('alts', [])
            if not isinstance(alts, list) or any(not isinstance(a, str) or not a.strip() for a in alts):
                errs.append(f'{sid}: items[{i}].alts must be a list of non-empty strings')
            fr, en = norm(it.get('fr', '')), norm(it.get('en', ''))
            if fr and fr == en: errs.append(f'{sid}: items[{i}] fr == en ("{fr}")')
            key = fr
            if key:
                if key in fr_seen and fr_seen[key] != sid: errs.append(f'{sid}: items[{i}] fr "{it.get("fr")}" duplicates {fr_seen[key]}')
                elif key in fr_seen: errs.append(f'{sid}: items[{i}] fr "{it.get("fr")}" duplicated within skill')
                fr_seen[key] = sid
            if re.search(r'\b(the|and|is|are|you|with)\b', fr): errs.append(f'{sid}: items[{i}].fr looks English: "{it.get("fr")}"')
    if full:
        for cid in tax:
            if cid not in seen_ids: errs.append(f'{cid}: missing from full file')
    if errs:
        for e in errs: print(e)
        print(f'INVALID: {len(errs)} problem(s)'); sys.exit(1)
    print(f'OK: {len(skills)} skills, {sum(len(s.get("items", [])) for s in skills)} items')
main()
