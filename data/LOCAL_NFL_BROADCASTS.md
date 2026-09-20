# Local NFL broadcasts

ZIP 91789 uses Los Angeles stations KTTV (FOX) and KCBS-TV (CBS).
`local_nfl_broadcasts.py` reads their public TV Passport listings for dates
with FOX/CBS games within the next 14 days. Only explicitly live NFL listings
with both team names matching the schedule qualify. Generic NFL placeholders
remain unlabeled. Successful checks replace that station/date's assignments,
so withdrawn games are removed. Failed requests preserve previous assignments
and record errors in `_errors`; cached listings can therefore be outdated
during a provider outage. Source URLs and check times are saved under `_sources`.

`file_loop.py` runs the checker at startup and every 24 hours. A timestamp in
`.scoreboard-state` prevents repeated network checks when the app restarts.
The Electron app starts that scheduler automatically; restart an already open
app after installing this change. The computer/app must be running to check.
No separate Windows scheduled task or paid account is required.

Manual refresh: `python data/local_nfl_broadcasts.py --force`

Parser checks: `python -m unittest discover -s data -p test_local_nfl_broadcasts.py`

The frontend reloads `public/data/nfl_local_broadcasts.json` every minute.
Future weeks fill in as station listings become available; this does not
predict unpublished coverage. Website markup changes may require maintenance.
