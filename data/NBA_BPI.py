import requests
import html as htmllib
import json
import re
from typing import List, Dict, Any

url = "https://www.espn.com/nba/bpi"

payload = {}
headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Accept-Encoding': 'gzip, deflate, br, zstd',
  'Referer': 'https://www.google.com/',
  'Connection': 'keep-alive',
  'Cookie': 'SWID=1BC12018-76AD-4298-C23C-5EB9DD70B6BB; edition=espn-en-us; edition-view=espn-en-us; region=ccpa; tveAuth=espn3; cookieMonster=1; __fitt-sess-device.prod=5f9743f5-1991-4b56-9df2-7e9b375039cf; mbox=PC^#1675cae4ea40400982cd551583a6f1a9.35_0^#1824862869|session^#eea1bc0aab58454d83a920073615455e^#1762410355; s_ensNR=1761618067402-New; OptanonConsent=isGpcEnabled=0&datestamp=Mon+Oct+27+2025+19%3A23%3A27+GMT-0700+(Pacific+Daylight+Time)&version=202407.2.0&browserGpcFlag=0&isIABGlobal=false&hosts=&consentId=e9d9a673-36ea-482a-bbc0-be0a0c2e9a66&interactionCount=1&isAnonUser=1&landingPath=https%3A%2F%2Fwww.espn.com%2Fnba%2Fstandings&groups=C0001%3A1%2CC0003%3A1%2CBG407%3A1%2CC0002%3A1%2CC0004%3A1%2CC0005%3A1; usprivacy=1YNY; AMCV_EE0201AC512D2BE80A490D4C%40AdobeOrg=-330454231%7CMCMID%7C21080104722962798112362429104193239130%7CMCAAMLH-1761773075%7C9%7CMCAAMB-1762070091%7C6G1ynYcLPuiQxYZrsz_pkqfLG9yMXBpb2zX5dvJdYQJzPXImdj0y%7CMCOPTOUT-1762077292s%7CNONE%7CMCAID%7CNONE%7CvVersion%7C3.1.2%7CMCIDTS%7C20395; _cb=7wPu32JWTGDRHnlv; _chartbeat2=.1761618071782.1761618071782.1.D7xZXhDdqSFLQsx9hB2p1CxBWavfN.1; ab.storage.userId.96ad02b7-2edc-4238-8442-bc35ba85853c=g%3A1BC12018-76AD-4298-C23C-5EB9DD70B6BB%7Ce%3Aundefined%7Cc%3A1761618071793%7Cl%3A1761618071794; ab.storage.sessionId.96ad02b7-2edc-4238-8442-bc35ba85853c=g%3A618d7a20-942d-6bde-6155-fddbba6d0a31%7Ce%3A1761619871802%7Cc%3A1761618071793%7Cl%3A1761618071802; ab.storage.deviceId.96ad02b7-2edc-4238-8442-bc35ba85853c=g%3A675b46c1-c25d-8cfa-f9c5-167bb80dd0eb%7Ce%3Aundefined%7Cc%3A1761618071794%7Cl%3A1761618071794; s_ecid=MCMID%7C21080104722962798112362429104193239130; nol_fpid=4xrlotegxpquurxzsizqc21cqjeys1761618072|1761618072742|1761618072742|1761618072742; _scor_uid=ae659a55ede4490d944632b84ae8ab23; cto_bundle=JEfh-l8lMkZnbEd2WGNTQVlYdjdqSkMlMkZLRDdKZUt1UERMbWlVdzh0YmRPdHk1ZVkzT1BHOWI1YyUyQlk5aGxkV1NOJTJCRnB1WlRwTkM2SDFTaVhkWVNaekVwRHhUeXlONUc2UDc3MTRydHBoU3JvcXZMMnRCV0lMR1lsdHRnWDIlMkZORTJGZUlmTEVrb2Z2NTdnbFZ0RDU5REM1ekpkbUdUOW9GVDQ2dHNybmVJMkltNU0yVkVVJTNE; _cc_id=5841a92d1e3e143af8abb2bbe75ad7d5; connectId={"ttl":86400000,"lastUsed":1761618074543,"lastSynced":1761618074543}; __gads=ID=004e9c5f3cff2d56:T=1761618064:RT=1761618064:S=ALNI_MbxIjptHk03T2ZOpy_qKwrO9sDLnA; __gpi=UID=000012b915e0787d:T=1761618064:RT=1761618064:S=ALNI_MbdhHDRDUUk5XKaAkE_8nB0-3jTJg; __eoi=ID=e292e959d05a8c28:T=1761618064:RT=1761618064:S=AA-AfjZFdCPFJxDNzTNtD4AVn8Su; _gcl_au=1.1.1448530675.1761618075; s_c24=1762072568910; connectionspeed=full; dtcAuth=; _dcf=1; country=us; check=true; block.check=false%7Ctrue; userZip=91744; country=us; hashedIp=e254a6954ed7a8f960da0d43231c9bcd91eef4d566fd72f864c24baa1fdebff9; client_type=html5; client_version=4.7.1; espn-prev-page=espn%3Anba%3ApowerIndex; SWID=602B85A4-0AFC-4F42-CFE9-D8EFDCFE56E8; _dcf=1; connectionspeed=full; country=us; edition=espn-en-us; edition-view=espn-en-us; region=ccpa',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'cross-site',
  'Sec-Fetch-User': '?1',
  'If-Modified-Since': 'Thu, 06 Nov 2025 05:59:16 GMT',
  'Priority': 'u=0, i',
  'TE': 'trailers'
}

response = requests.request("GET", url, headers=headers, data=payload)
nba_bpi_data = response.text

import json
from bs4 import BeautifulSoup
import re

# ============================
#  SAME JSON PARSER YOU USE FOR NFL
# ============================

def _extract_balanced_objects(raw: str, anchor: str = '{"team"') -> List[str]:
    s = htmllib.unescape(raw)
    out = []
    i = 0
    n = len(s)

    while True:
        start = s.find(anchor, i)
        if start == -1:
            break
        brace_depth = 0
        j = start
        in_str = False
        esc = False
        while j < n:
            ch = s[j]
            if in_str:
                if esc:
                    esc = False
                elif ch == '\\':
                    esc = True
                elif ch == '"':
                    in_str = False
            else:
                if ch == '"':
                    in_str = True
                elif ch == '{':
                    brace_depth += 1
                elif ch == '}':
                    brace_depth -= 1
                    if brace_depth == 0:
                        out.append(s[start:j + 1])
                        i = j + 1
                        break
            j += 1
        else:
            i = start + len(anchor)
    return out


def _stats_list_to_map(stats: List[Dict[str, Any]]) -> Dict[str, Any]:
    m = {}
    for item in stats or []:
        name = item.get("name")
        val = item.get("value")

        # auto number -> float/int
        if isinstance(val, str):
            try:
                if val.replace(".", "", 1).replace("-", "", 1).isdigit():
                    val = float(val) if "." in val else int(val)
            except:
                pass

        m[name] = val
    return m


def _get_first_present(d: Dict[str, Any], keys: List[str]):
    for k in keys:
        if k in d and d[k] not in (None, ""):
            return d[k]
    return None


# ============================
#  NBA BPI PARSER
# ============================

def parse_nba_bpi(html: str):
    blocks = _extract_balanced_objects(html)
    teams = []
    all_stat_keys = set()
    sample_stats_for_rank1 = None

    for raw_obj in blocks:
        try:
            obj = json.loads(raw_obj)
        except json.JSONDecodeError:
            continue

        if "team" not in obj or "stats" not in obj:
            continue

        team = obj["team"]
        stats = _stats_list_to_map(obj["stats"])
        for _k in stats.keys():
            all_stat_keys.add(_k)

        team_row = {
            "name": team.get("displayName"),
            "abbr": team.get("abbrev"),
            "logo": team.get("logo"),
            # Primary and fallbacks for each stat
            "bpi": _get_first_present(stats, ["bpi", "BPI", "bpi_value"]),
            "bpirank": _get_first_present(stats, ["bpirank", "BPI RK", "bpi_rank", "rank_bpi", "bpiRank"]),
            "off": _get_first_present(stats, ["off", "OFF", "off_bpi", "offense", "off_rating", "offRating", "offBpi"]),
            "def": _get_first_present(stats, ["def", "DEF", "def_bpi", "defense", "def_rating", "defRating", "defBpi"]),
            "pbpi": _get_first_present(stats, ["proj_bpi", "pbpi", "PBPI", "projected_bpi", "projBpi"])
        }
        teams.append(team_row)

        if sample_stats_for_rank1 is None:
            try:
                if int(team_row.get("bpirank") or 0) == 1:
                    sample_stats_for_rank1 = {"team": team_row.get("abbr"), "stats": stats}
            except Exception:
                pass

    # Try to augment OFF/DEF/PBPI by scraping the rendered numbers from the HTML table if present
    try:
        soup = BeautifulSoup(html, "html.parser")
        by_rank = {}
        for tr in soup.find_all("tr"):
            tds = tr.find_all("td")
            if len(tds) < 6:
                continue
            # Pull plain text of the first 6 tds (record, bpi, rank, off, def, pbpi)
            vals = []
            for td in tds[:6]:
                # Some values are nested in <div>, but .get_text() covers both
                vals.append(td.get_text(strip=True))
            rec, bpi_s, rank_s, off_s, def_s, pbpi_s = vals

            # Basic validation: record like d+-d+, rank is digit
            if not re.match(r"^\d+-\d+$", rec):
                continue
            if not re.match(r"^\d+$", rank_s):
                continue

            def to_num(s):
                s = s.strip()
                if s == "--" or s == "—" or s == "-":
                    return None
                try:
                    return float(s)
                except Exception:
                    return None

            rank = int(rank_s)
            by_rank[rank] = {
                "bpi": to_num(bpi_s),
                "off": to_num(off_s),
                "def": to_num(def_s),
                "pbpi": to_num(pbpi_s),
                "record": rec,
            }

        if by_rank:
            for t in teams:
                try:
                    r = int(t.get("bpirank") or 0)
                except Exception:
                    r = 0
                if r in by_rank:
                    nums = by_rank[r]
                    # override missing fields only
                    if t.get("off") is None and nums.get("off") is not None:
                        t["off"] = nums.get("off")
                    if t.get("def") is None and nums.get("def") is not None:
                        t["def"] = nums.get("def")
                    if t.get("pbpi") is None and nums.get("pbpi") is not None:
                        t["pbpi"] = nums.get("pbpi")
    except Exception:
        pass

    # write stat keys and a sample for debugging to help discover OFF/DEF/PBPI keys
    try:
        with open("nba_bpi_stat_keys.json", "w", encoding="utf-8") as _fkeys:
            json.dump({
                "unique_stat_keys": sorted(list(all_stat_keys)),
                "sample_rank1": sample_stats_for_rank1
            }, _fkeys, indent=2)
    except Exception:
        pass

    return teams


# ============================
#  RUN + SAVE
# ============================

teams = parse_nba_bpi(nba_bpi_data)

with open("nba_bpi_output.json", "w") as f:
    json.dump(teams, f, indent=2)

print(f"✅ Extracted {len(teams)} NBA teams")

