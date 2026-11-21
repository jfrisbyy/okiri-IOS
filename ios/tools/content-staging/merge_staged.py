# Merge reviewed staged concepts into FoundationContent.json, assigning stable ids.
# Usage: BASE=<current json> OUT=<output json> python3 merge_staged.py [concept-ids-to-exclude...]
import json, re, sys
ROOT='/home/user/okiri-IOS'
import os
P=os.environ['OUT']
BASE=os.environ['BASE']
groups={1:["silent-final-consonants","accent-marks","elision","e-muet"],2:["vowel-contrasts","rhythm-and-stress","avoir-expressions","il-faut-necessity"],3:["present-ir-re-verbs","imperative","modal-verbs","venir-de-recent-past"],4:["futur-simple","etre-en-train-de","on-pronoun","depuis-pendant-il-y-a"],5:["stressed-pronouns","demonstrative-adjectives","contractions-au-du","de-after-negation"],6:["quantity-expressions","comparatives-superlatives","adverb-formation","countries-prepositions"],7:["shopping-money-vocab","travel-transport-vocab","health-vocab","daily-routine-vocab"],8:["leisure-sports-vocab","describing-people","feelings-vocab","everyday-transactions","polite-requests"]}
exclude=set(sys.argv[1:])
src=open(ROOT+'/ios/FluentFrenchIOS/Models/ConceptTaxonomy.swift').read()
order=[m for m in re.findall(r'c\("([a-z0-9-]+)", "',src)]
d=json.load(open(BASE,encoding='utf-8'))
existing={s['id'] for s in d['skills']}
new=[]
for g,ready in groups.items():
    st=json.load(open(f'{ROOT}/ios/tools/content-staging/group-{g}.json',encoding='utf-8'))
    byid={s['id']:s for s in st['skills']}
    for cid in ready:
        if cid in exclude: continue
        assert cid not in existing, cid
        s=byid[cid]
        assert re.fullmatch(r'[a-z0-9]+(-[a-z0-9]+)*',cid)
        for kind,key,mark in (('items','items',''),('probes','probes','p')):
            out=[]
            for n,it in enumerate(s[key],1):
                assert 'id' not in it, (cid,it)
                out.append({'id':f'{cid}.{mark}{n}',**it})
            s[key]=out
        new.append(s)
skills=d['skills']+new
skills.sort(key=lambda s: order.index(s['id']))
d['skills']=skills
open(P,'w',encoding='utf-8').write(json.dumps(d,indent=2,ensure_ascii=False)+'\n')
print('skills',len(skills),'merged',len(new))
