"""Normalize ESPN's national NBA broadcasters for schedule display."""

import re


def _network_key(name):
    # Ignore spacing/punctuation differences while keeping ESPN+ distinct.
    return re.sub(r"[^a-z0-9+]", "", name.casefold())


_NETWORK_NAMES = {
    _network_key(name): name
    for name in (
        "Prime Video", "Peacock", "ESPN", "ESPN2", "ESPNU", "ESPNEWS",
        "ESPN+", "ESPN3", "ESPN Deportes", "ABC", "NBC",
        "Telemundo", "Universo", "TNT", "TBS", "truTV",
    )
}
# NBCSN carries the NBA's Peacock package. Match exact names so regional
# networks such as NBC Sports Bay Area are not mistaken for Peacock.
for provider, aliases in {
    "Peacock": ("NBCSN", "NBC Sports Network", "Peacock TV", "Peacock Premium", "Peacock Premium Plus"),
    "Prime Video": ("Amazon Prime Video", "Amazon Prime", "Prime"),
    "ESPNEWS": ("ESPN News",),
    "ABC": ("American Broadcasting Company",),
    "NBC": ("National Broadcasting Company",),
}.items():
    _NETWORK_NAMES.update({_network_key(alias): provider for alias in aliases})


def get_nba_tv_providers(broadcasts):
    providers = []
    for broadcast in broadcasts or []:
        if not isinstance(broadcast, dict):
            continue
        region = str(broadcast.get("region") or "us").strip().casefold()
        broadcast_type = str(broadcast.get("type") or "").strip().casefold()
        if region != "us" or broadcast_type in {"radio", "subscription package"}:
            continue
        names = [
            value.strip()
            for field in ("name", "shortName", "callLetters", "station", "slug")
            if isinstance(value := broadcast.get(field), str) and value.strip()
        ]
        # Hide unavailable NBA TV listings, including the national fallback.
        if any(_network_key(name) in {"nbatv", "nbatelevision"} for name in names):
            continue
        provider = next(
            (_NETWORK_NAMES[_network_key(name)] for name in names if _network_key(name) in _NETWORK_NAMES),
            None,
        )
        # A renamed/new national network should not disappear just because it
        # is absent from our aliases. ESPN explicitly identifies its coverage.
        if not provider and broadcast.get("isNational") is True and broadcast_type in {"tv", "streaming"}:
            provider = next(iter(names), None)
        if provider and provider not in providers:
            providers.append(provider)
    return providers
