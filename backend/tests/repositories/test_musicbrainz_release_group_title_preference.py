"""A recording on both a single and a compilation: the requested album title must win
over the Album > EP > Single heuristic (Sufjan Stevens "Mystery of Love" vs the CMBYN OST)."""

from repositories.musicbrainz_album import _pick_best_release_group, _releases_titled

_OST = {
    "id": "e209b2ce-577c-42f5-b0e0-ef5ffbd92544",
    "title": "Call Me by Your Name: Original Motion Picture Soundtrack",
    "primary-type": "Album",
    "secondary-types": ["Compilation", "Soundtrack"],
}
_SINGLE = {
    "id": "1ba770ae-5a81-458f-897c-7382531d7f9e",
    "title": "Mystery of Love",
    "primary-type": "Single",
    "secondary-types": ["Soundtrack"],
}
RELEASES = [
    {
        "title": _OST["title"],
        "status": "Official",
        "date": "2017-11-03",
        "release-group": _OST,
    },
    {
        "title": "Mystery of Love",
        "status": "Official",
        "date": "2017-12-01",
        "release-group": _SINGLE,
    },
    {
        "title": _OST["title"],
        "status": "Official",
        "date": "2017",
        "release-group": _OST,
    },
]


def test_heuristic_alone_prefers_the_album():
    assert _pick_best_release_group(RELEASES)[0] == _OST["id"]


def test_requested_title_narrows_to_the_single():
    assert (
        _pick_best_release_group(_releases_titled(RELEASES, "mystery of love"))[0]
        == _SINGLE["id"]
    )


def test_unmatched_title_falls_back_to_every_release():
    assert _releases_titled(RELEASES, "Carrie & Lowell") == RELEASES
    assert _releases_titled(RELEASES, None) == RELEASES
